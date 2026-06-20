import { Router } from "express";
import { getPublicAppUrl, logToFile, parseDateString } from "../utils.js";
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
  const targetId = req.query.personaId || "cod_confirm";
  const callerNumber = encodeURIComponent(req.body?.From || req.query.From || "");

  console.log(`[Webhook] Inbound call received on Twilio endpoint! Target: ${targetId}, From: ${callerNumber}`);

  res.type("text/xml");
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Aditi">Connecting you to AI Voice Studio. Please speak naturally.</Say>
  <Connect>
    <Stream url="${streamUrl}/api/twilio/live?personaId=${targetId}&amp;callerNumber=${callerNumber}" />
  </Connect>
</Response>`);
});

// ─── Vobiz / SIP webhook (Inbound) ─────────────────────────────

function sendVobizStreamXml(req: any, res: any) {
  const appUrl = getPublicAppUrl(req);
  const streamUrl = appUrl.replace(/^http:/, "ws:").replace(/^https:/, "wss:");
  const targetId = req.query.personaId || "cod_confirm";
  const callerNumber = encodeURIComponent(req.body?.From || req.query.From || req.query.caller || "");
  const callId = req.query.callId || "";
  const direction = req.query.direction || "inbound";

  console.log(`[Webhook] Inbound call on Vobiz SIP! Target: ${targetId}, From: ${callerNumber}`);

  res.type("text/xml");
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Speak>Connecting you to AI Voice Studio. Please speak naturally.</Speak>
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
  const personaId = req.query.personaId || "cod_confirm";
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
      personaId || "cod_confirm",
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

// ─── Order Confirmation Call Trigger Scanner ──────────────────

async function handleOrderConfirmationsTrigger(req: any, res: any) {
  try {
    const appUrl = getPublicAppUrl(req);
    logToFile(`[Order Scanner] Scanning orders for outbound COD confirmation calls. appUrl: ${appUrl}`);

    const { readSheetRows } = await import("../services/googleSheetsService.js");
    const { isGoogleSheetsActive, ORDERS_CSV, parseCSV, ensureCSVExists } = await import("../services/ecommerceService.js");
    const fs = await import("fs");

    const useSheets = await isGoogleSheetsActive();
    let rows: string[][] = [];

    if (useSheets) {
      try {
        rows = await readSheetRows("Orders");
      } catch (err: any) {
        logToFile(`[Order Scanner] Google Sheets read failed, falling back to CSV: ${err?.message || err}`);
        ensureCSVExists(
          ORDERS_CSV,
          "OrderID,CustomerName,Phone,Email,OrderValue,Status,ShippingAddress,CallSummary,CallRecordingUrl,PaymentMethod,RetryCount,NextRetryTime"
        );
        const content = fs.readFileSync(ORDERS_CSV, "utf8");
        rows = parseCSV(content);
      }
    } else {
      ensureCSVExists(
        ORDERS_CSV,
        "OrderID,CustomerName,Phone,Email,OrderValue,Status,ShippingAddress,CallSummary,CallRecordingUrl,PaymentMethod,RetryCount,NextRetryTime"
      );
      const content = fs.readFileSync(ORDERS_CSV, "utf8");
      rows = parseCSV(content);
    }

    if (rows.length <= 1) {
      return res.json({ success: true, triggeredCount: 0, message: "No orders found in database." });
    }

    const header = rows[0];
    const dataRows = rows.slice(1);

    const idIdx = header.indexOf("OrderID");
    const nameIdx = header.indexOf("CustomerName");
    const phoneIdx = header.indexOf("Phone");
    const statusIdx = header.indexOf("Status");

    const triggeredOrders: string[] = [];

    for (const row of dataRows) {
      const orderId = row[idIdx];
      const name = row[nameIdx];
      const phone = row[phoneIdx];
      const status = row[statusIdx];

      if (status !== "Pending COD Confirmation") continue;

      logToFile(`[Order Scanner] Order ${orderId} qualifies (Name: ${name}, Phone: ${phone})`);

      let formattedNumber = phone.trim();
      if (!formattedNumber.startsWith("+")) {
        formattedNumber = "+91" + formattedNumber.replace(/^0+/, "");
      }

      try {
        // Trigger outbound call using the dedicated cod_confirm persona
        await initiateOutboundCall(
          formattedNumber,
          "cod_confirm",
          appUrl,
          orderId
        );
        triggeredOrders.push(orderId);
      } catch (callErr: any) {
        logToFile(`[Order Scanner] Failed calling order ${orderId}: ${callErr?.message || callErr}`);
      }
    }

    res.json({
      success: true,
      triggeredCount: triggeredOrders.length,
      triggeredOrders,
      message: `Successfully scanned and triggered ${triggeredOrders.length} order confirmation call(s).`,
    });
  } catch (err: any) {
    console.error("[Order Scanner] Error:", err?.message || err);
    res.status(500).json({ success: false, error: err?.message || "Failed order scanner." });
  }
}

router.post("/orders/trigger-confirmations", handleOrderConfirmationsTrigger);
router.post("/bookings/trigger-confirmations", handleOrderConfirmationsTrigger);

router.post("/orders/bulk-add", async (req, res) => {
  try {
    const { csvText, type } = req.body;
    if (!csvText) {
      return res.status(400).json({ success: false, error: "Missing csvText in body." });
    }
    const { ensureCSVExists, ORDERS_CSV, ABANDONED_CARTS_CSV, parseCSV } = await import("../services/ecommerceService.js");
    const fs = await import("fs");

    const parsed = parseCSV(csvText);
    if (parsed.length === 0) {
      return res.status(400).json({ success: false, error: "Invalid CSV format." });
    }

    const isCart = type === "cart";
    const targetFile = isCart ? ABANDONED_CARTS_CSV : ORDERS_CSV;
    const header = isCart
      ? "CartID,CustomerName,Phone,Email,CartValue,Status,Items,CallSummary,CallRecordingUrl,DiscountApplied"
      : "OrderID,CustomerName,Phone,Email,OrderValue,Status,ShippingAddress,CallSummary,CallRecordingUrl,PaymentMethod,RetryCount,NextRetryTime";

    ensureCSVExists(targetFile, header);

    let startIndex = 0;
    if (parsed[0][0].toLowerCase().includes("id") || parsed[0][0].toLowerCase().includes("name") || parsed[0][0].toLowerCase().includes("phone")) {
      startIndex = 1;
    }

    let addedCount = 0;
    for (let i = startIndex; i < parsed.length; i++) {
      const row = parsed[i];
      if (row.length < 3) continue;

      let fullRow: string[];
      if (isCart) {
        const cartId = row[0] || "CRT-" + Math.floor(1000 + Math.random() * 9000);
        const name = row[1] || "Customer";
        const phone = row[2] || "";
        const email = row[3] || "";
        const val = row[4] || "0";
        const status = row[5] || "Abandoned";
        const items = row[6] || "";
        fullRow = [cartId, name, phone, email, val, status, items, "", "", ""];
      } else {
        const orderId = row[0] || "OD-" + Math.floor(1000 + Math.random() * 9000);
        const name = row[1] || "Customer";
        const phone = row[2] || "";
        const email = row[3] || "";
        const val = row[4] || "0";
        const status = row[5] || "Pending COD Confirmation";
        const addr = row[6] || "";
        const pm = row[7] || "COD";
        fullRow = [orderId, name, phone, email, val, status, addr, "", "", pm, "0", ""];
      }

      fs.appendFileSync(targetFile, fullRow.join(",") + "\n", "utf8");
      addedCount++;
    }

    res.json({ success: true, count: addedCount });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
