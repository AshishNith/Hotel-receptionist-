# VoiceLink integration & Embedding Guide

This guide documents how to link and embed VoiceLink AI calling agents into your website, external apps, or telephony carriers.

---

## 1. Web browser Call Widget (Mic & Speakers)
To embed a **"Talk to AI"** button on your site where visitors chat with the agent using their browser microphone, connect your frontend to the WebSocket proxy route.

* **WebSocket URI**: `wss://2196-2401-4900-8834-ed5a-459f-828d-2bf5-7a5f.ngrok-free.app/api/live`

### Simple Client-Side Example
```javascript
// 1. request browser microphone permissions
const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

// 2. Setup a 16kHz mono AudioContext to play linear PCM buffers
const audioCtx = new AudioContext({ sampleRate: 16000 });

// 3. Connect to the server WebSocket endpoint
const ws = new WebSocket("wss://2196-2401-4900-8834-ed5a-459f-828d-2bf5-7a5f.ngrok-free.app/api/live");

ws.onopen = () => {
  console.log("WebSocket connected. Sending setup payload...");
  
  // 4. Send the setup metadata to instantiate the voice agent
  ws.send(JSON.stringify({
    type: "setup",
    voice: "Zephyr",                // Zephyr, Puck, Charon, Kore, Fenrir, Aoede
    systemInstruction: "You are a customer support agent...",
    temperature: 0.7,
    personaId: "support_faq",        // support_faq, cod_confirm, cart_recovery, rto_feedback
    personaName: "Priya",
    initialGreeting: "Hi! Thanks for calling. How can I help you today?"
  }));
};

ws.onmessage = (event) => {
  // 5. Play raw 16kHz PCM audio buffers received from the server
  const pcmData = JSON.parse(event.data);
  if (pcmData.type === "audio") {
    // Decode and play in AudioContext...
  }
};
```

### Zero-Code iFrame Embedding
You can embed the pre-built, white-labeled client calling dashboard directly onto your page using an iframe:
```html
<iframe 
  src="https://2196-2401-4900-8834-ed5a-459f-828d-2bf5-7a5f.ngrok-free.app/client" 
  width="100%" 
  height="700px" 
  style="border: none; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.15);">
</iframe>
```

---

## 2. Telephony Outbound Dialer (REST API)
To add a **"Request Callback"** form on your site where visitors enter their phone number and click **"Call Me"**, trigger an automated outbound call via our HTTP REST API.

* **Method**: `POST`
* **URL**: `https://2196-2401-4900-8834-ed5a-459f-828d-2bf5-7a5f.ngrok-free.app/api/outbound/call`
* **Headers**:
  * `Content-Type: application/json`
* **Request Body**:
  ```json
  {
    "toNumber": "+919934225353",
    "personaId": "cod_confirm"
  }
  ```

### Server Response Example
```json
{
  "success": true,
  "callId": "out_kb021hs_8y12sa",
  "callUUID": "uuid-vobiz-request-xxxx",
  "status": "initiated"
}
```

---

## 3. Inbound Phone Lines (Twilio & SIP Trunks)
To assign a real phone number to your AI agent so customers can dial in:

* **Twilio Webhook URL**: 
  `https://2196-2401-4900-8834-ed5a-459f-828d-2bf5-7a5f.ngrok-free.app/api/twilio/incoming-call?personaId=support_faq`

* **Universal SIP trunk (VoBiz/Asterisk) Webhook URL**:
  `https://2196-2401-4900-8834-ed5a-459f-828d-2bf5-7a5f.ngrok-free.app/api/sip/incoming-call?personaId=support_faq`

### Integration Steps
1. Purchase or provision a phone number from your provider console (Twilio, VoBiz, Asterisk).
2. Configure the **Voice HTTP Incoming Webhook** for that phone number to point to one of the URLs listed above.
3. Dial the number from a real phone. The carrier will retrieve the XML instructions from our server, establish a live voice link, and connect the caller to your Gemini Live agent.
