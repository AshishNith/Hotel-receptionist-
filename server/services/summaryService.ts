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
You are a highly efficient assistant for a premium hotel. Review the phone call transcript below between a Hotel AI Receptionist ("AGENT") and a guest/caller ("USER").
Generate a concise, professional summary formatted with clear headers and bullet points.

Requirements:
1. Topic: Briefly state what the main focus of the call was (e.g., Room Booking, Room Availability Check, Food Order, Hotel Policy inquiry, Booking Confirmation).
2. Key Details: Bullet-point the crucial details discussed (such as dates, room types, guest name, phone, email, food items, total price, specific hotel FAQ answers).
3. Outcome: State the final result of the call in one clear line (e.g., "Successfully reserved room BK-1234", "Food ordered successfully", "Answered pool timings inquiry", "Call hung up during discussion").
4. Guest operational status (Mandatory for booking confirmation calls): If this call was a booking confirmation call, you MUST explicitly output a line containing:
   "GUEST_STATUS: Confirmed" (if they explicitly stated they are coming and plan to check in)
   "GUEST_STATUS: Cancelled" (if they explicitly requested a cancellation or stated they are not coming)
   "GUEST_STATUS: Uncertain" (if they did not give a clear confirmation, were unreachable, or call hung up before they answered)

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

    // 6. Sync to Google Sheets and local CSV if reservation was made or updated during this call
    try {
      const bookingToolCalls = call.toolCallsUsed.filter(
        (tc) => tc.name === "makeRoomReservation" && tc.result?.success && tc.result?.bookingId
      );

      let confirmationBookingId: string | null = null;
      let bookingStatusUpdate: string | null = null;

      if (summaryText.includes("GUEST_STATUS: Confirmed")) {
        bookingStatusUpdate = "Confirmed";
      } else if (summaryText.includes("GUEST_STATUS: Cancelled")) {
        bookingStatusUpdate = "Cancelled";
      }

      // If call is outbound and callerNumber represents outbound dialer
      const isOutboundCall = call.callerNumber === "outbound" || call.direction === "outbound";
      if (isOutboundCall) {
        const cancelToolCall = call.toolCallsUsed.find(tc => tc.name === "modify_or_cancel_reservation" && tc.args?.bookingId);
        if (cancelToolCall) {
          confirmationBookingId = cancelToolCall.args.bookingId;
        }
      }

      const appUrl = process.env.APP_URL || "https://hotel-receptionist-agent.onrender.com";
      const absoluteRecordingUrl = call.recordingUrl ? `${appUrl.replace(/\/$/, "")}${call.recordingUrl}` : "";

      const { updateBookingWithCallSummary } = await import("./hotelService.js");

      // A. Sync new room bookings
      if (bookingToolCalls.length > 0) {
        logToFile(`[Summary Service] Found ${bookingToolCalls.length} new booking(s) in call ${callId}. Syncing summary...`);
        for (const tc of bookingToolCalls) {
          const bId = tc.result.bookingId;
          await updateBookingWithCallSummary(bId, summaryText, absoluteRecordingUrl);
        }
      }

      // B. Sync confirmation call updates
      const targetBookingId = confirmationBookingId || call.toolCallsUsed.find(tc => tc.name === "modify_or_cancel_reservation" && tc.args?.bookingId)?.args?.bookingId;
      
      if (targetBookingId && bookingStatusUpdate) {
        logToFile(`[Summary Service] Confirmation resolved status: ${bookingStatusUpdate} for booking: ${targetBookingId}. Updating Sheet...`);
        await updateBookingWithCallSummary(targetBookingId, summaryText, absoluteRecordingUrl, bookingStatusUpdate);
      } else if (bookingStatusUpdate) {
        // Fallback: Scan transcript for Booking ID (BK-XXXX) matching patterns
        const transcriptTextCombined = call.transcript.map(t => t.text).join(" ");
        const match = transcriptTextCombined.match(/BK-\d{4}/i);
        if (match) {
          const matchedBookingId = match[0].toUpperCase();
          logToFile(`[Summary Service] Found booking ID ${matchedBookingId} in transcript. Status resolved: ${bookingStatusUpdate}. Updating Sheet...`);
          await updateBookingWithCallSummary(matchedBookingId, summaryText, absoluteRecordingUrl, bookingStatusUpdate);
        }
      }
    } catch (syncErr: any) {
      logToFile(`[Summary Service] Failed to synchronize booking with call summary: ${syncErr?.message || syncErr}`);
    }

    return summaryText;
  } catch (err: any) {
    logToFile(`[Summary Service] Error generating summary for call ${callId}: ${err?.message || err}`);
    return "";
  }
}
