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
1. Topic: Briefly state what the main focus of the call was (e.g., Room Booking, Room Availability Check, Food Order, Hotel Policy inquiry).
2. Key Details: Bullet-point the crucial details discussed (such as dates, room types, guest name, phone, email, food items, total price, specific hotel FAQ answers).
3. Outcome: State the final result of the call in one clear line (e.g., "Successfully reserved room BK-1234", "Food ordered successfully", "Answered pool timings inquiry", "Call hung up during discussion").

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

    // 6. Sync to Google Sheets and local CSV if reservation was made during this call
    try {
      const bookingToolCalls = call.toolCallsUsed.filter(
        (tc) => tc.name === "makeRoomReservation" && tc.result?.success && tc.result?.bookingId
      );

      if (bookingToolCalls.length > 0) {
        logToFile(`[Summary Service] Found ${bookingToolCalls.length} booking(s) in call ${callId}. Syncing summary and recording to Google Sheet...`);
        const { updateBookingWithCallSummary } = await import("./hotelService.js");

        const appUrl = process.env.APP_URL || "https://hotel-receptionist-agent.onrender.com";
        const absoluteRecordingUrl = call.recordingUrl ? `${appUrl.replace(/\/$/, "")}${call.recordingUrl}` : "";

        for (const tc of bookingToolCalls) {
          const bId = tc.result.bookingId;
          logToFile(`[Summary Service] Synchronizing summary and recording to Google Sheet for booking: ${bId}`);
          await updateBookingWithCallSummary(bId, summaryText, absoluteRecordingUrl);
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
