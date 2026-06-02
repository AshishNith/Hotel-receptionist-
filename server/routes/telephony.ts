import { Router } from "express";
import { getPublicAppUrl, logToFile } from "../utils.js";
import {
  initiateOutboundCall,
  getCallState,
  hangupOutboundCall,
  addCallTranscript,
  updateCallStatus,
} from "../services/vobizService.js";

const router = Router();

// ─── Twilio TwiML webhook ───────────────────────────────────────

router.all("/twilio/incoming-call", (req, res) => {
  const appUrl = getPublicAppUrl(req);
  const streamUrl = appUrl.replace(/^http:/, "ws:").replace(/^https:/, "wss:");
  const targetId = req.query.personaId || "diya";
  const callerNumber = encodeURIComponent(req.body?.From || req.query.From || "");

  console.log(`[Webhook] Inbound call received on Twilio endpoint! Target: ${targetId}, From: ${callerNumber}`);

  res.type("text/xml");
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Aditi">Connecting you to Gemini Voice Studio. Please speak naturally.</Say>
  <Connect>
    <Stream url="${streamUrl}/api/twilio/live?personaId=${targetId}&amp;callerNumber=${callerNumber}" />
  </Connect>
</Response>`);
});

// ─── Vobiz / SIP webhook (Inbound) ─────────────────────────────

function sendVobizStreamXml(req: any, res: any) {
  const appUrl = getPublicAppUrl(req);
  const streamUrl = appUrl.replace(/^http:/, "ws:").replace(/^https:/, "wss:");
  const targetId = req.query.personaId || "diya";
  const callerNumber = encodeURIComponent(req.body?.From || req.query.From || req.query.caller || "");
  const callId = req.query.callId || "";
  const direction = req.query.direction || "inbound";

  console.log(`[Webhook] Inbound call on Vobiz SIP! Target: ${targetId}, From: ${callerNumber}`);

  res.type("text/xml");
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Speak>Connecting you to Gemini Voice Studio. Please speak naturally.</Speak>
  <Stream bidirectional="true" keepCallAlive="true" audioTrack="inbound" contentType="audio/x-l16;rate=16000">
    ${streamUrl}/api/sip/live?personaId=${targetId}&amp;callerNumber=${callerNumber}&amp;callId=${callId}&amp;direction=${direction}
  </Stream>
</Response>`);
}

router.all("/vobiz/incoming-call", sendVobizStreamXml);
router.all("/sip/incoming-call", sendVobizStreamXml);

router.all("/vobiz/hangup", (req, res) => {
  console.log("[Webhook] Vobiz hangup event received.");
  res.status(200).json({ success: true });
});

// ─── Outbound Call: Answer webhook ──────────────────────────────
// VoBiz fetches this URL when the outbound call is answered by the destination.
// We return the same <Stream> XML to open a bidirectional audio WebSocket.

router.all("/vobiz/outbound-answer", (req, res) => {
  const appUrl = getPublicAppUrl(req);
  const streamUrl = appUrl.replace(/^http:/, "ws:").replace(/^https:/, "wss:");
  const personaId = req.query.personaId || "diya";
  const callId = (req.query.callId as string) || "";
  const bookingId = (req.query.bookingId as string) || "";

  logToFile(`[Webhook] /vobiz/outbound-answer hit! PersonaId: ${personaId}, CallId: ${callId}, BookingId: ${bookingId}`);

  // Mark the call as in-progress
  if (callId) {
    updateCallStatus(callId, "in-progress");
  }

  const xmlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Stream bidirectional="true" keepCallAlive="true" audioTrack="inbound" contentType="audio/x-l16;rate=16000">
    ${streamUrl}/api/sip/live?personaId=${personaId}&amp;callerNumber=outbound&amp;callId=${callId}&amp;direction=outbound${bookingId ? `&amp;bookingId=${bookingId}` : ""}
  </Stream>
</Response>`;

  logToFile(`[Webhook] Sending XML Response:\n${xmlResponse}`);

  res.type("text/xml");
  res.send(xmlResponse);
});

// ─── Outbound Call: Initiate (REST API) ─────────────────────────

router.post("/outbound/call", async (req, res) => {
  try {
    const { toNumber, personaId } = req.body;

    if (!toNumber) {
      return res.status(400).json({ success: false, error: "Missing 'toNumber' in request body." });
    }

    const appUrl = getPublicAppUrl(req);
    logToFile(`[Outbound] Initiating call to: ${toNumber}, persona: ${personaId}, resolved appUrl: ${appUrl}`);
    const callState = await initiateOutboundCall(
      toNumber,
      personaId || "diya",
      appUrl
    );
    logToFile(`[Outbound] Call initiated! ID: ${callState.callId}, UUID: ${callState.callUUID}, Status: ${callState.status}`);

    res.json({
      success: true,
      callId: callState.callId,
      callUUID: callState.callUUID,
      status: callState.status,
    });
  } catch (err: any) {
    console.error("[Outbound] Failed to initiate call:", err?.message || err);
    res.status(500).json({ success: false, error: err?.message || "Failed to initiate outbound call." });
  }
});

// ─── Outbound Call: Status polling ──────────────────────────────

router.get("/outbound/status/:callId", (req, res) => {
  const callState = getCallState(req.params.callId);
  if (!callState) {
    return res.status(404).json({ success: false, error: "Call not found." });
  }

  const duration = callState.answeredAt
    ? Math.floor((Date.now() - callState.answeredAt.getTime()) / 1000)
    : 0;

  res.json({
    success: true,
    callId: callState.callId,
    status: callState.status,
    toNumber: callState.toNumber,
    fromNumber: callState.fromNumber,
    duration,
    transcript: callState.transcript,
    error: callState.error,
  });
});

// ─── Outbound Call: Hangup ──────────────────────────────────────

router.post("/outbound/hangup/:callId", async (req, res) => {
  const success = await hangupOutboundCall(req.params.callId);
  res.json({ success });
});

// ─── Booking Confirmation Call Trigger Scanner ──────────────────

router.post("/bookings/trigger-confirmations", async (req, res) => {
  try {
    const appUrl = getPublicAppUrl(req);
    logToFile(`[Confirmation Scanner] Scanning bookings for outbound confirmation calls. appUrl: ${appUrl}`);

    const { getSheetsAuthClient, readSheetRows } = await import("../services/googleSheetsService.js");
    const { isGoogleSheetsActive, BOOKINGS_CSV, parseCSV, ensureCSVExists } = await import("../services/hotelService.js");
    const fs = await import("fs");

    const useSheets = await isGoogleSheetsActive();
    let rows: string[][] = [];

    if (useSheets) {
      rows = await readSheetRows("Bookings");
    } else {
      ensureCSVExists(
        BOOKINGS_CSV,
        "BookingID,Name,Phone,Email,RoomType,CheckIn,CheckOut,Guests,TotalPrice,Status,Addons,CallSummary,CallRecordingUrl"
      );
      const content = fs.readFileSync(BOOKINGS_CSV, "utf8");
      rows = parseCSV(content);
    }

    if (rows.length <= 1) {
      return res.json({ success: true, triggeredCount: 0, message: "No bookings found in database." });
    }

    const header = rows[0];
    const dataRows = rows.slice(1);

    const idIdx = header.indexOf("BookingID");
    const nameIdx = header.indexOf("Name");
    const phoneIdx = header.indexOf("Phone");
    const checkInIdx = header.indexOf("CheckIn");
    const statusIdx = header.indexOf("Status");

    const now = Date.now();
    const triggeredBookings: string[] = [];

    for (const row of dataRows) {
      const bookingId = row[idIdx];
      const name = row[nameIdx];
      const phone = row[phoneIdx];
      const checkInStr = row[checkInIdx];
      const status = row[statusIdx];

      if (status !== "Booked") continue;

      const checkInDate = new Date(checkInStr);
      if (isNaN(checkInDate.getTime())) continue;

      const diffMs = checkInDate.getTime() - now;
      const hoursLeft = diffMs / (1000 * 60 * 60);

      // Trigger calls for any booking arriving tomorrow (0 to 36 hours check-in range)
      if (hoursLeft > 0 && hoursLeft <= 36) {
        logToFile(`[Confirmation Scanner] Booking ${bookingId} qualifies (Name: ${name}, Phone: ${phone}, Hours Left: ${hoursLeft.toFixed(1)}h)`);

        let formattedNumber = phone.trim();
        if (!formattedNumber.startsWith("+")) {
          formattedNumber = "+91" + formattedNumber.replace(/^0+/, "");
        }

        try {
          await initiateOutboundCall(
            formattedNumber,
            "diya",
            appUrl,
            bookingId
          );
          triggeredBookings.push(bookingId);
        } catch (callErr: any) {
          logToFile(`[Confirmation Scanner] Failed calling booking ${bookingId}: ${callErr?.message || callErr}`);
        }
      }
    }

    res.json({
      success: true,
      triggeredCount: triggeredBookings.length,
      triggeredBookings,
      message: `Successfully scanned and triggered ${triggeredBookings.length} confirmation call(s).`,
    });
  } catch (err: any) {
    console.error("[Confirmation Scanner] Error:", err?.message || err);
    res.status(500).json({ success: false, error: err?.message || "Failed scanner." });
  }
});

export default router;
