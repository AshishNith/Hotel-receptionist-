import { Router } from "express";
import { getPublicAppUrl } from "../utils.js";
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

  console.log(`[Webhook] Outbound call answered! PersonaId: ${personaId}, CallId: ${callId}`);

  // Mark the call as in-progress
  if (callId) {
    updateCallStatus(callId, "in-progress");
  }

  res.type("text/xml");
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Stream bidirectional="true" keepCallAlive="true" audioTrack="inbound" contentType="audio/x-l16;rate=16000">
    ${streamUrl}/api/sip/live?personaId=${personaId}&amp;callerNumber=outbound&amp;callId=${callId}&amp;direction=outbound
  </Stream>
</Response>`);
});

// ─── Outbound Call: Initiate (REST API) ─────────────────────────

router.post("/outbound/call", async (req, res) => {
  try {
    const { toNumber, personaId } = req.body;

    if (!toNumber) {
      return res.status(400).json({ success: false, error: "Missing 'toNumber' in request body." });
    }

    const appUrl = getPublicAppUrl(req);
    const callState = await initiateOutboundCall(
      toNumber,
      personaId || "diya",
      appUrl
    );

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

export default router;
