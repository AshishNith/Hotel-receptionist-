import { getGeminiClient, GEMINI_MODEL } from "./gemini.js";
import { CallLogModel } from "../models/CallLog.js";
import { logToFile } from "../utils.js";

/**
 * Loads the transcript of a completed call, requests Google Gemini to summarize it,
 * and stores the final summary directly in the CallLog document in MongoDB.
 */
export async function generateCallSummary(callId: string): Promise<string> {
  try {
    logToFile(`[Summary Service] Triggered AI call summarization for: ${callId}`);
    
    // 1. Fetch CallLog with transcript
    const call = await CallLogModel.findOne({ callId });
    if (!call) {
      logToFile(`[Summary Service] Call log not found for ID: ${callId}`);
      return "";
    }

    if (!call.transcript || call.transcript.length === 0) {
      logToFile(`[Summary Service] Call ${callId} has an empty transcript. Skipping summary.`);
      return "No conversation recorded.";
    }

    // 2. Format transcript for prompt input
    const transcriptText = call.transcript
      .map((line) => `${line.role.toUpperCase()}: ${line.text}`)
      .join("\n");

    // 3. Formulate the summarization prompt
    const prompt = `
You are a highly efficient assistant for a premium DTC and e-commerce brand. Review the phone call transcript below between a Store AI Calling Agent ("AGENT") and a customer/caller ("USER").
Generate a concise, professional summary formatted with clear headers and bullet points.

Requirements:
1. Topic: Briefly state what the main focus of the call was (e.g., COD Order Confirmation, Abandoned Cart Recovery, Delivery Feedback, Order tracking inquiry).
2. Key Details: Bullet-point the crucial details discussed (such as Order ID/Cart ID, items, prices, shipping address, discount code, rating, or delivery slot).
3. Outcome: State the final result of the call in one clear line (e.g., "COD Order OD-4821 confirmed successfully", "Abandoned cart recovered with code SAVE10", "Feedback captured: rating 5/5", "Frustration escalated to live agent").
4. Customer operational status: Output a line containing:
   "ORDER_STATUS: Confirmed" (if they explicitly confirmed their COD order)
   "ORDER_STATUS: Cancelled" (if they cancelled their COD order)
   "CART_STATUS: Recovered" (if they accepted the recovery discount coupon)
   "DELIVERY_STATUS: Re-attempt" (if they scheduled redelivery)
   "ESC_STATUS: Escalated" (if transfer to live agent was requested)
   "STATUS: Uncertain" (if call hung up early or was busy/no-answer)

Keep the tone polished, objective, and highly readable. Avoid meta-commentary or generic introductory phrases.

Transcript:
${transcriptText}
`;

    // 4. Invoke Gemini API
    const ai = getGeminiClient();
    logToFile(`[Summary Service] Requesting Gemini summary using model gemini-2.5-flash...`);
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    const summaryText = response.text?.trim() || "Failed to generate call summary.";

    // 5. Update call log in MongoDB
    call.summary = summaryText;
    await call.save();
    
    logToFile(`[Summary Service] Successfully saved summary for call ${callId} to MongoDB!`);

    // 6. Sync to Google Sheets and local CSV if order/cart was updated during this call
    try {
      let resolvedOrderId: string | null = null;
      let resolvedCartId: string | null = null;
      let orderStatusUpdate: string | null = null;
      let cartStatusUpdate: string | null = null;

      // Check tool calls
      const confirmToolCall = call.toolCallsUsed.find(tc => tc.name === "confirm_cod_order" && tc.args?.orderId);
      if (confirmToolCall) {
        resolvedOrderId = confirmToolCall.args.orderId;
        orderStatusUpdate = confirmToolCall.result?.status || (confirmToolCall.args.confirmed ? "COD Confirmed" : "COD Cancelled");
      }

      const verifyAddressToolCall = call.toolCallsUsed.find(tc => tc.name === "verify_shipping_address" && tc.args?.orderId);
      if (verifyAddressToolCall) {
        resolvedOrderId = verifyAddressToolCall.args.orderId;
      }

      const discountToolCall = call.toolCallsUsed.find(tc => tc.name === "apply_cart_discount" && tc.args?.cartId);
      if (discountToolCall) {
        resolvedCartId = discountToolCall.args.cartId;
        cartStatusUpdate = "Recovered";
      }

      const scheduleRedeliveryToolCall = call.toolCallsUsed.find(tc => tc.name === "schedule_redelivery" && tc.args?.orderId);
      if (scheduleRedeliveryToolCall) {
        resolvedOrderId = scheduleRedeliveryToolCall.args.orderId;
        orderStatusUpdate = "Re-attempt Scheduled";
      }

      // Parse status updates from summary tags
      if (summaryText.includes("ORDER_STATUS: Confirmed")) {
        orderStatusUpdate = "COD Confirmed";
      } else if (summaryText.includes("ORDER_STATUS: Cancelled")) {
        orderStatusUpdate = "COD Cancelled";
      } else if (summaryText.includes("CART_STATUS: Recovered")) {
        cartStatusUpdate = "Recovered";
      } else if (summaryText.includes("DELIVERY_STATUS: Re-attempt")) {
        orderStatusUpdate = "Re-attempt Scheduled";
      }

      // Regex fallbacks to extract ID from transcript
      const transcriptTextCombined = call.transcript.map(t => t.text).join(" ");
      if (!resolvedOrderId) {
        const match = transcriptTextCombined.match(/OD-\d{4}/i);
        if (match) resolvedOrderId = match[0].toUpperCase();
      }
      if (!resolvedCartId) {
        const match = transcriptTextCombined.match(/CRT-\d{4}/i);
        if (match) resolvedCartId = match[0].toUpperCase();
      }

      const appUrl = process.env.APP_URL || "https://ecom-calling-agent.onrender.com";
      const absoluteRecordingUrl = call.recordingUrl ? `${appUrl.replace(/\/$/, "")}${call.recordingUrl}` : "";

      const { updateOrderWithCallSummary, updateCartWithCallSummary } = await import("./ecommerceService.js");

      if (resolvedOrderId && !resolvedOrderId.toUpperCase().startsWith("DEMO-")) {
        logToFile(`[Summary Service] Syncing call summary for order: ${resolvedOrderId}, Status: ${orderStatusUpdate}`);
        await updateOrderWithCallSummary(resolvedOrderId, summaryText, absoluteRecordingUrl, orderStatusUpdate || undefined);
      }
      if (resolvedCartId && !resolvedCartId.toUpperCase().startsWith("DEMO-")) {
        logToFile(`[Summary Service] Syncing call summary for cart: ${resolvedCartId}, Status: ${cartStatusUpdate}`);
        await updateCartWithCallSummary(resolvedCartId, summaryText, absoluteRecordingUrl, cartStatusUpdate || undefined);
      }
    } catch (syncErr: any) {
      logToFile(`[Summary Service] Failed to synchronize order/cart with call summary: ${syncErr?.message || syncErr}`);
    }

    return summaryText;
  } catch (err: any) {
    logToFile(`[Summary Service] Error generating summary for call ${callId}: ${err?.message || err}`);
    return "";
  }
}
