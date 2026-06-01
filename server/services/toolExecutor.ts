import { google } from "googleapis";
import { GoogleTokenModel } from "../models/GoogleToken.js";
import { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } from "../config.js";
import type { CallLogger } from "./callLogger.js";
import {
  checkRoomAvailability,
  makeRoomReservation,
  modifyOrCancelReservation,
  orderFood,
  getHotelFaq
} from "./hotelService.js";

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
 * Unified tool call execution handler — executes hotel operations locally (via CSV)
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

        // ─── Hotel Room Receptionist Tools ───
        case "check_room_availability": {
          const { startDate, endDate, guestCount, roomTypePreference } = fc.args;
          response = await checkRoomAvailability(startDate, endDate, guestCount, roomTypePreference);
          break;
        }

        case "make_room_reservation": {
          const { name, phone, email, roomType, checkIn, checkOut, guests, addons } = fc.args;
          response = await makeRoomReservation(name, phone, email, roomType, checkIn, checkOut, guests, addons || []);
          
          // Fire-and-forget: send confirmation email in background WITHOUT blocking the tool response.
          // This MUST NOT be awaited — Gemini Live has a strict timeout for tool responses and the
          // Gmail API round-trip (OAuth refresh + send) can take 2-5 seconds, causing a 1008 disconnect.
          const bookingResponse = response; // capture for closure
          void (async () => {
            try {
              const activeAuth = await getAuthenticatedOAuth2(callerPhoneKey);
              if (!activeAuth || !email) return;

              const gmail = google.gmail({ version: "v1", auth: activeAuth });
              const subject = `Booking Confirmation - The Grand Imperial Hotel (${bookingResponse.bookingId})`;
              const body = `
                <h3>Thank you for choosing The Grand Imperial Hotel!</h3>
                <p>Dear ${name},</p>
                <p>Your room booking has been successfully confirmed. Here are your reservation details:</p>
                <ul>
                  <li><strong>Booking ID:</strong> ${bookingResponse.bookingId}</li>
                  <li><strong>Room Type:</strong> ${bookingResponse.roomType}</li>
                  <li><strong>Check-in Date:</strong> ${checkIn}</li>
                  <li><strong>Check-out Date:</strong> ${checkOut}</li>
                  <li><strong>Guests:</strong> ${guests}</li>
                  <li><strong>Total Price:</strong> Rs. ${bookingResponse.totalPrice}</li>
                  <li><strong>Add-ons Selected:</strong> ${bookingResponse.addons && bookingResponse.addons.length > 0 ? bookingResponse.addons.join(", ") : "None"}</li>
                </ul>
                <p>We look forward to welcoming you soon!</p>
                <p>Best Regards,<br/>Diya - Hotel AI Receptionist</p>
              `;
              const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString("base64")}?=`;
              const messageParts = [
                `To: ${email}`,
                "Content-Type: text/html; charset=utf-8",
                "MIME-Version: 1.0",
                `Subject: ${utf8Subject}`,
                "",
                body,
              ];
              const rawMsg = messageParts.join("\n");
              const encodedMessage = Buffer.from(rawMsg).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
              await gmail.users.messages.send({ userId: "me", requestBody: { raw: encodedMessage } });
              console.log(`[ToolExecutor] Booking confirmation email successfully dispatched to ${email}`);
            } catch (mailErr) {
              console.warn("[ToolExecutor] Failed to send automated confirmation email:", mailErr);
            }
          })();
          break;
        }

        case "modify_or_cancel_reservation": {
          const { bookingId, phone, action, updates } = fc.args;
          response = await modifyOrCancelReservation(bookingId, phone, action, updates);
          break;
        }

        case "order_food": {
          const { bookingIdOrRoom, items } = fc.args;
          response = await orderFood(bookingIdOrRoom, items);
          break;
        }

        case "get_hotel_faq": {
          const { query } = fc.args;
          response = await getHotelFaq(query);
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
