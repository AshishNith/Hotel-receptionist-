import { Router } from "express";
import { getPublicAppUrl } from "../utils.js";

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

// ─── Vobiz / SIP webhook ────────────────────────────────────────

function sendVobizStreamXml(req: any, res: any) {
  const appUrl = getPublicAppUrl(req);
  const streamUrl = appUrl.replace(/^http:/, "ws:").replace(/^https:/, "wss:");
  const targetId = req.query.personaId || "diya";
  const callerNumber = encodeURIComponent(req.body?.From || req.query.From || req.query.caller || "");

  console.log(`[Webhook] Inbound call on Vobiz SIP! Target: ${targetId}, From: ${callerNumber}`);

  res.type("text/xml");
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Speak>Connecting you to Gemini Voice Studio. Please speak naturally.</Speak>
  <Stream bidirectional="true" keepCallAlive="true" audioTrack="inbound" contentType="audio/x-l16;rate=16000">
    ${streamUrl}/api/sip/live?personaId=${targetId}&amp;callerNumber=${callerNumber}
  </Stream>
</Response>`);
}

router.all("/vobiz/incoming-call", sendVobizStreamXml);
router.all("/sip/incoming-call", sendVobizStreamXml);

router.all("/vobiz/hangup", (req, res) => {
  console.log("[Webhook] Vobiz hangup event received.");
  res.status(200).json({ success: true });
});

export default router;
