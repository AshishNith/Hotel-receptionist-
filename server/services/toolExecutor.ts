import { google } from "googleapis";
import { GoogleTokenModel } from "../models/GoogleToken.js";
import { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI, getDynamicSettings } from "../config.js";
import type { CallLogger } from "./callLogger.js";
import {
  confirmCodOrder,
  verifyShippingAddress,
  applyCartDiscount,
  scheduleRedelivery,
  recordDeliveryFeedback,
  trackOrderStatus,
  escalateToHuman,
  getStoreFaq,
  getOrderDetails
} from "./ecommerceService.js";

interface FunctionCall {
  id: string;
  name: string;
  args: any;
}

interface FunctionResponse {
  id: string;
  name: string;
  response: any;
}

/**
 * Creates a per-request OAuth2 client with stored tokens for a caller.
 */
async function getAuthenticatedOAuth2(callerPhoneKey: string) {
  const oAuth = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI
  );

  const stored = await GoogleTokenModel.findOne({ phoneKey: callerPhoneKey });
  if (!stored || !stored.access_token) {
    return null;
  }

  oAuth.setCredentials({
    access_token: stored.access_token,
    refresh_token: stored.refresh_token,
    expiry_date: stored.expiry_date,
    scope: stored.scope,
    token_type: stored.token_type,
  });

  return oAuth;
}

/**
 * Unified tool call execution handler — executes e-commerce operations locally (via CSV)
 * and Google Workspace tools via OAuth if connected.
 */
export async function executeToolCalls(
  functionCalls: FunctionCall[],
  callerPhoneKey: string,
  callLogger?: CallLogger
): Promise<FunctionResponse[]> {
  const functionResponses: FunctionResponse[] = [];

  if (!functionCalls || functionCalls.length === 0) {
    return functionResponses;
  }

  // Resolve Google OAuth tokens (lazy load on demand if calendar/gmail tools are used)
  let auth: any = null;
  const hasGoogleTools = functionCalls.some(fc => 
    ["list_upcoming_meetings", "create_calendar_event", "send_gmail_message", "read_latest_emails"].includes(fc.name)
  );

  if (hasGoogleTools) {
    auth = await getAuthenticatedOAuth2(callerPhoneKey);
  }

  for (const fc of functionCalls) {
    console.log(`[ToolExecutor] Executing: ${fc.name}`, fc.args);

    try {
      let response: any;

      switch (fc.name) {
        // ─── Google Workspace Tools ───
        case "list_upcoming_meetings": {
          if (!auth) {
            response = { error: "Google account not authenticated. Link Google account in dashboard." };
            break;
          }
          const calendar = google.calendar({ version: "v3", auth });
          const max = fc.args?.maxResults || 5;
          const res = await calendar.events.list({
            calendarId: "primary",
            timeMin: new Date().toISOString(),
            maxResults: max,
            singleEvents: true,
            orderBy: "startTime",
          });
          const events = res.data.items?.map(e => ({
            summary: e.summary,
            start: e.start?.dateTime || e.start?.date,
            end: e.end?.dateTime || e.end?.date,
          })) || [];
          response = { events };
          break;
        }

        case "create_calendar_event": {
          if (!auth) {
            response = { error: "Google account not authenticated. Link Google account in dashboard." };
            break;
          }
          const calendar = google.calendar({ version: "v3", auth });
          const { summary, description, startTime, endTime } = fc.args;
          const res = await calendar.events.insert({
            calendarId: "primary",
            requestBody: {
              summary,
              description,
              start: { dateTime: startTime },
              end: { dateTime: endTime },
            },
          });
          response = { success: true, eventId: res.data.id, htmlLink: res.data.htmlLink };
          break;
        }

        case "send_gmail_message": {
          if (!auth) {
            response = { error: "Google account not authenticated. Link Google account in dashboard." };
            break;
          }
          const gmail = google.gmail({ version: "v1", auth });
          const { recipientEmail, subject, body } = fc.args;
          const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString("base64")}?=`;
          const messageParts = [
            `To: ${recipientEmail}`,
            "Content-Type: text/html; charset=utf-8",
            "MIME-Version: 1.0",
            `Subject: ${utf8Subject}`,
            "",
            body,
          ];
          const rawMsg = messageParts.join("\n");
          const encodedMessage = Buffer.from(rawMsg)
            .toString("base64")
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=+$/, "");

          const res = await gmail.users.messages.send({
            userId: "me",
            requestBody: { raw: encodedMessage },
          });
          response = { success: true, messageId: res.data.id };
          break;
        }

        case "read_latest_emails": {
          if (!auth) {
            response = { error: "Google account not authenticated. Link Google account in dashboard." };
            break;
          }
          const gmail = google.gmail({ version: "v1", auth });
          const max = fc.args?.maxResults || 3;
          const listRes = await gmail.users.messages.list({
            userId: "me",
            maxResults: max,
            q: "is:unread",
          });

          const emails: any[] = [];
          if (listRes.data.messages) {
            for (const m of listRes.data.messages) {
              if (m.id) {
                const msgRes = await gmail.users.messages.get({
                  userId: "me",
                  id: m.id,
                  format: "metadata",
                  metadataHeaders: ["Subject", "From", "Date"],
                });
                const headers = msgRes.data.payload?.headers || [];
                const subject = headers.find(h => h.name === "Subject")?.value || "(No Subject)";
                const from = headers.find(h => h.name === "From")?.value || "(Unknown Sender)";
                const date = headers.find(h => h.name === "Date")?.value || "";
                emails.push({ id: m.id, subject, from, date, snippet: msgRes.data.snippet });
              }
            }
          }
          response = { emails };
          break;
        }

        // ─── Agent Tools ───
        case "confirm_order": {
          const { orderId, confirmed, reason } = fc.args;
          if (orderId && orderId.toUpperCase().startsWith("DEMO-")) {
            console.log(`[ToolExecutor] [DEMO MODE] Skip database write for ${orderId}`);
            response = {
              success: true,
              orderId,
              status: confirmed ? "COD Confirmed" : "COD Cancelled",
              reason: reason || "Demo updated via AI call."
            };
          } else {
            response = await confirmCodOrder(orderId, confirmed, reason);
            
            // Fire-and-forget: send confirmation email in background without blocking the voice loop
            const orderResponse = response;
            void (async () => {
              try {
                if (!orderResponse.success) return;
                const orderDetails = await getOrderDetails(orderId);
                if (!orderDetails || !orderDetails.email) return;

                const activeAuth = await getAuthenticatedOAuth2(callerPhoneKey);
                if (!activeAuth) return;

                const gmail = google.gmail({ version: "v1", auth: activeAuth });
                const dynSettings = await getDynamicSettings();
                const brandName = dynSettings.brandName;
                const subject = `Order ${orderId} Update - ${brandName}`;
                const body = `
                  <h3>Your order status has been updated!</h3>
                  <p>Dear ${orderDetails.customerName},</p>
                  <p>Your order <strong>${orderId}</strong> status is now: <strong>${orderResponse.status}</strong>.</p>
                  <p>Shipping Details: ${orderDetails.shippingAddress}</p>
                  <p>Total Value: Rs. ${orderDetails.orderValue}</p>
                  <br/>
                  <p>Thank you for your purchase!</p>
                  <p>Best Regards,<br/>${brandName} Support Team</p>
                `;
                const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString("base64")}?=`;
                const messageParts = [
                  `To: ${orderDetails.email}`,
                  "Content-Type: text/html; charset=utf-8",
                  "MIME-Version: 1.0",
                  `Subject: ${utf8Subject}`,
                  "",
                  body,
                ];
                const rawMsg = messageParts.join("\n");
                const encodedMessage = Buffer.from(rawMsg).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
                await gmail.users.messages.send({ userId: "me", requestBody: { raw: encodedMessage } });
                console.log(`[ToolExecutor] Order update email successfully dispatched to ${orderDetails.email}`);
              } catch (mailErr) {
                console.warn("[ToolExecutor] Failed to send automated email update:", mailErr);
              }
            })();
          }
          break;
        }

        case "verify_address": {
          const { orderId, correctedAddress, isCorrect } = fc.args;
          if (orderId && orderId.toUpperCase().startsWith("DEMO-")) {
            console.log(`[ToolExecutor] [DEMO MODE] Skip database write for ${orderId}`);
            response = {
              success: true,
              orderId,
              isCorrect,
              shippingAddress: correctedAddress || "Demo Address - Updated via call"
            };
          } else {
            response = await verifyShippingAddress(orderId, correctedAddress, isCorrect);
          }
          break;
        }

        case "apply_discount": {
          const { cartId, discountCode, discountValue } = fc.args;
          if (cartId && cartId.toUpperCase().startsWith("DEMO-")) {
            console.log(`[ToolExecutor] [DEMO MODE] Skip database write for ${cartId}`);
            response = {
              success: true,
              cartId,
              discountApplied: discountCode || "SAVE10",
              cartValue: 1349
            };
          } else {
            response = await applyCartDiscount(cartId, discountCode, discountValue);
          }
          break;
        }

        case "schedule_redelivery": {
          const { orderId, reattemptDate, reattemptTimeSlot } = fc.args;
          if (orderId && orderId.toUpperCase().startsWith("DEMO-")) {
            console.log(`[ToolExecutor] [DEMO MODE] Skip database write for ${orderId}`);
            response = {
              success: true,
              orderId,
              status: "Redelivery Scheduled",
              reattemptDate,
              reattemptTimeSlot
            };
          } else {
            response = await scheduleRedelivery(orderId, reattemptDate, reattemptTimeSlot);
          }
          break;
        }

        case "record_delivery_feedback": {
          const { orderId, rating, comments } = fc.args;
          if (orderId && orderId.toUpperCase().startsWith("DEMO-")) {
            console.log(`[ToolExecutor] [DEMO MODE] Skip database write for ${orderId}`);
            response = {
              success: true,
              orderId,
              rating,
              comments
            };
          } else {
            response = await recordDeliveryFeedback(orderId, rating, comments);
          }
          break;
        }

        case "track_order_shipment": {
          const { orderId } = fc.args;
          if (orderId && orderId.toUpperCase().startsWith("DEMO-")) {
            console.log(`[ToolExecutor] [DEMO MODE] Skip tracking lookup for ${orderId}`);
            response = {
              success: true,
              orderId,
              status: "In Transit",
              courier: "Delhivery",
              estimatedDelivery: "In 2 days"
            };
          } else {
            response = await trackOrderStatus(orderId);
          }
          break;
        }

        case "escalate_to_human": {
          const { reason } = fc.args;
          response = await escalateToHuman(callerPhoneKey, reason);
          break;
        }

        case "get_store_faq": {
          const { query } = fc.args;
          response = await getStoreFaq(query);
          break;
        }

        default:
          response = { error: `Tool '${fc.name}' is not implemented on the server.` };
          break;
      }

      // Ensure the response is a JSON object (Record<string, unknown>) as required by the Gemini Live API.
      let formattedResponse: Record<string, any>;
      if (response && typeof response === "object" && !Array.isArray(response)) {
        formattedResponse = response;
      } else {
        formattedResponse = { output: response };
      }

      functionResponses.push({ id: fc.id, name: fc.name, response: formattedResponse });
      callLogger?.addToolCall(fc.name, fc.args, response);
    } catch (err: any) {
      console.error(`[ToolExecutor] Error executing ${fc.name}:`, err?.message || err);
      const response = { error: `Failed to execute '${fc.name}': ${err?.message || err}` };
      functionResponses.push({ id: fc.id, name: fc.name, response });
      callLogger?.addToolCall(fc.name, fc.args, response);
    }
  }

  return functionResponses;
}
