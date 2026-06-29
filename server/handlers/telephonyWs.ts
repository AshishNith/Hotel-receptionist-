import { WebSocket } from "ws";
import type { LiveServerMessage } from "@google/genai";
import { getGeminiClient, getCompiledSystemInstruction, getToolsForPersona, GEMINI_MODEL, Modality } from "../services/gemini.js";
import { executeToolCalls } from "../services/toolExecutor.js";
import { CallLogger } from "../services/callLogger.js";
import { PersonaModel } from "../models/Persona.js";
import { addCallTranscript, updateCallStatus } from "../services/vobizService.js";
import { generateCallSummary } from "../services/summaryService.js";
import {
  decodeMulaw, encodeMulaw,
  base64ToInt16Array, int16ArrayToBase64,
  resampleInt16Pcm,
} from "../services/audioCodec.js";

/**
 * Handles a telephony WebSocket connection at /api/twilio/live or /api/sip/live.
 * Receives G.711 μ-law (Twilio) or L16 PCM (Vobiz) audio, transcodes, and pipes to Gemini Live.
 */
import { logToFile } from "../utils.js";

export async function handleTelephonyWebSocket(telephonyWs: WebSocket, request: any): Promise<void> {
  const upgradeUrl = new URL(request.url || "", `http://localhost`);
  const isVobizStream = upgradeUrl.pathname === "/api/sip/live";
  const providerName = isVobizStream ? "Vobiz" : "Twilio";
  const provider = isVobizStream ? "vobiz" : "twilio";

  logToFile(`[${providerName} WS] Connection initiated. Path: ${upgradeUrl.pathname}, Query: ${upgradeUrl.search}`);

  const personaId = upgradeUrl.searchParams.get("personaId") || "order_confirm";
  const callerNumber = decodeURIComponent(upgradeUrl.searchParams.get("callerNumber") || "");
  const outboundCallId = upgradeUrl.searchParams.get("callId") || "";
  const direction = (upgradeUrl.searchParams.get("direction") || "inbound") as "inbound" | "outbound";
  const bookingId = upgradeUrl.searchParams.get("bookingId") || "";

  logToFile(`[${providerName} WS] Connection details -> personaId: ${personaId}, callerNumber: ${callerNumber}, outboundCallId: ${outboundCallId}, direction: ${direction}, bookingId: ${bookingId}`);

  // Resolve persona
  let persona = await PersonaModel.findOne({ id: personaId });
  if (!persona) persona = await PersonaModel.findOne({});
  if (!persona) {
    logToFile(`[${providerName} WS] Error: No persona found in database. Closing WebSocket.`);
    telephonyWs.close();
    return;
  }

  logToFile(`[${providerName} WS] Routing to persona: ${persona.name} (${persona.role})`);

  // Initialize call logger
  const callLogger = new CallLogger(persona.id, persona.name, callerNumber, provider as any, direction);
  let geminiSession: any = null;
  let streamSid = "";
  let isInitiated = false;
  let isToolCallPending = false;
  let startReceived = false;
  let greetingSent = false;
  let mediaFrameCount = 0;
  let outputAudioChunkCount = 0;
  let inboundEncoding = isVobizStream ? "audio/x-l16" : "audio/x-mulaw";
  let inboundSampleRate = isVobizStream ? 16000 : 8000;
  let order: any = null;
  let cart: any = null;

  const sendGreeting = () => {
    if (greetingSent) return;
    if (isInitiated && geminiSession && (startReceived || isVobizStream)) {
      greetingSent = true;
      setTimeout(() => {
        try {
          let greetingText = "";
          if (order) {
            if (direction === "outbound") {
              greetingText = `Call connected. Greet the customer in friendly, modern Hinglish (Hindi mixed with simple English words). Say: "Hi, main Neha baat kar rahi hoon. Kya meri baat Shruti se ho rahi hai?" or similar friendly modern greeting. Speak in a simple, natural, conversational style and DO NOT use the word "Customer" or ask "Am I speaking with customer?".`;
            } else {
              greetingText = `Call connected. Greet the customer professionally using your initial greeting. You are calling ${order.customerName} to confirm their order. Start by confirming you are speaking with the right person.`;
            }
          } else if (cart) {
            if (direction === "outbound") {
              greetingText = `Call connected. Greet the customer in friendly, modern Hinglish as Neha. Mention you noticed they left items in their cart and ask if you can help them complete their checkout. Speak in simple Hinglish and do not say "Am I speaking with customer?".`;
            } else {
              greetingText = `Call connected. Greet the customer warmly. You are calling ${cart.customerName} about items left in their cart. Start by mentioning you noticed they didn't finish checkout.`;
            }
          } else {
            if (direction === "outbound") {
              greetingText = `Call connected. Greet the customer in friendly, modern Hinglish as Neha: "Hi, main Neha baat kar rahi hoon. Kaise hain aap?" or similar. Do not say "Am I speaking with Customer?".`;
            } else {
              greetingText = `Call connected. Greet the caller using your initial greeting: "${persona.initialGreeting}"`;
            }
          }

          geminiSession.sendClientContent({
            turns: [
              {
                role: "user",
                parts: [{ text: greetingText }],
              },
            ],
            turnComplete: true,
          });
          console.log(`[${providerName}] Greeting dispatched: ${greetingText}`);
        } catch (err: any) {
          console.error(`[${providerName}] Failed to send greeting:`, err?.message || err);
        }
      }, 500);
    }
  };

  try {
    const ai = getGeminiClient();
    const baseInstruction = persona.systemInstruction || "You are a helpful calling agent.";
    const compiledInstruction = await getCompiledSystemInstruction(baseInstruction, persona.knowledgeBaseId);
    
    let customEcommerceInstruction = "";
    try {
      const { getOrderDetails, getCartDetails } = await import("../services/ecommerceService.js");
      let isDemoCall = false;

      if (bookingId) {
        if (bookingId.startsWith("DEMO-") || bookingId === "demo") {
          isDemoCall = true;
        } else {
          order = await getOrderDetails(bookingId);
          if (!order) {
            cart = await getCartDetails(bookingId);
          }
        }
      } else if (direction === "outbound") {
        isDemoCall = true;
      }

      if (isDemoCall) {
        logToFile(`[${providerName} WS] Running in DEMO MODE. Injected demo order context.`);
        order = {
          orderId: "DEMO-1001",
          customerName: "Shruti",
          orderValue: 1499,
          paymentMethod: "COD",
          shippingAddress: "Flat 402, Building B, Sector 62, Noida, Uttar Pradesh - 201301",
          phone: callerNumber || "+91 00000-DEMO",
          email: "demo@example.com"
        };
      }

      if (order) {
        logToFile(`[${providerName} WS] Found order confirmation context for ${order.orderId} (${order.customerName})! Injected instruction.`);
        if (direction === "outbound") {
          customEcommerceInstruction = `\n\n### CRITICAL CALL OUTBOUND MISSION (HINDI/HINGLISH CONVERSATION)
You are Neha, a friendly outbound customer care assistant. Your goal is to call the person to confirm their recent order details and verify their delivery address.

Language & Tone Rules:
1. Speak exclusively in friendly, simple, modern Hinglish (conversational Hindi mixed with simple English words).
2. DO NOT say "Am I speaking to Customer?" or "Are you Customer?". Never use the word "Customer" to refer to the person.
3. Instead of formal/stiff greeting, greet them warmly: "Hi, main Neha baat kar rahi hoon. Kya meri baat Shruti se ho rahi hai?" or confirm their name naturally if known.
4. Use simple, conversational Hindi. Avoid complex, bookish Hindi words like "सत्यापन" (satyaapan), "पुष्टि" (pushti), "सहमति" (sahmati), "मूल्य" (moolya), "पत्ता" (patta). Instead, use common English terms: "confirm karna", "verify karna", "address verify karna", "order", "delivery address", "payment mode", "discount".
5. Keep the tone friendly, polite, energetic, and helpful (like a modern Indian customer service girl).

Order Details:
Order ID: ${order.orderId}
Order Value: Rs. ${order.orderValue}
Payment Method: ${order.paymentMethod}
Shipping Address: ${order.shippingAddress}

Conversational Steps:
1. Greet the person as Neha, explain that you are calling about their order.
2. Confirm if they placed the order (value is Rs. ${order.orderValue}).
3. Read the shipping address (${order.shippingAddress}) and ask if it is correct.
4. If correct, call the \`verify_address\` tool with isCorrect=true. Then call the \`confirm_order\` tool with confirmed=true. Thank them politely in Hinglish ("Thank you, aapka order confirm ho gaya hai. Have a nice day!") and end the call.
5. If they have corrections, collect them, call \`verify_address\` with isCorrect=true and correctedAddress. Then call \`confirm_order\` with confirmed=true. Thank them and hang up.
6. If they cancel the order, ask for the reason, call \`confirm_order\` with confirmed=false and the reason, and end the call politely.
`;
        } else {
          customEcommerceInstruction = `\n\n### CRITICAL CALL OUTBOUND MISSION: ORDER CONFIRMATION & ADDRESS VERIFICATION
You are the Order Confirmation and Address Verification Agent. You are actively calling the customer ${order.customerName} on their phone number to confirm their recent order.
Order ID: ${order.orderId}
Customer Name: ${order.customerName}
Order Value: Rs. ${order.orderValue}
Payment Method: ${order.paymentMethod}
Shipping Address: ${order.shippingAddress}

Your strict conversational goal:
1. Greet the customer professionally. Start by confirming you are speaking with ${order.customerName}. Keep the tone professional, polite, direct, and concise.
2. If they confirm they are the customer, state the order confirmation details (items, value of Rs. ${order.orderValue}).
3. Ask if they wish to confirm their order.
4. Verify their shipping address by reading it out and asking if it is correct.
5. If they confirm the address is correct, call the \`verify_address\` tool with isCorrect=true. Then call the \`confirm_order\` tool with confirmed=true. Thank them professionally and end the call.
6. If they have address corrections, collect the corrected address and call the \`verify_address\` tool with isCorrect=true and correctedAddress. Then call the \`confirm_order\` tool with confirmed=true. Thank them and end the call.
7. If they cancel the order (No/Not planning to buy):
   - Politely ask for the cancellation reason.
   - Call the \`confirm_order\` tool with confirmed=false and the reason.
   - Acknowledge the cancellation professionally and end the call.
8. Keep statements clear and business-like.
`;
        }
      } else {
        cart = await getCartDetails(bookingId);
        if (cart) {
          logToFile(`[${providerName} WS] Found cart recovery context for ${cart.cartId} (${cart.customerName})! Injected instruction.`);
          if (direction === "outbound") {
            customEcommerceInstruction = `\n\n### CRITICAL CALL OUTBOUND MISSION: ABANDONED CART RECOVERY (HINDI/HINGLISH CONVERSATION)
You are Neha, a friendly outbound customer care assistant. Your goal is to call the person about items left in their cart and help them complete their purchase.

Language & Tone Rules:
1. Speak exclusively in friendly, simple, modern Hinglish (conversational Hindi mixed with simple English words).
2. DO NOT say "Am I speaking to Customer?" or "Are you Customer?". Never use the word "Customer" to refer to the person.
3. Instead of formal/stiff greeting, greet them warmly: "Hi, main Neha baat kar rahi hoon. Kya meri baat ho rahi hai?" or confirm their name naturally if known.
4. Use simple, conversational Hindi. Avoid complex, bookish Hindi words. Instead, use common English terms: "confirm karna", "discount apply karna", "cart", "checkout link", "items", "discount", "offer".
5. Keep the tone friendly, polite, energetic, and helpful (like a modern Indian customer service girl).

Cart Details:
Cart ID: ${cart.cartId}
Items: ${cart.items}
Cart Value: Rs. ${cart.cartValue}

Conversational Steps:
1. Greet them in Hinglish as Neha, mention they left items (${cart.items}) in their shopping cart.
2. Ask if there was any issue that prevented them from finishing checkout.
3. Address their concerns (e.g., free shipping, free returns) in friendly Hinglish.
4. Offer them a 10% discount coupon 'SAVE10' to complete the order today.
5. If they accept:
   - Call \`apply_discount\` with cartId="${cart.cartId}", discountCode="SAVE10", and discountValue=10.
   - Reassure them in Hinglish that the discount is applied, and a checkout link is being sent to their number.
   - Thank them and end the call politely.
6. If they decline:
   - Acknowledge politely and thank them for their time.
`;
          } else {
            customEcommerceInstruction = `\n\n### CRITICAL CALL OUTBOUND MISSION: ABANDONED CART RECOVERY
You are calling the customer ${cart.customerName} to help them complete their abandoned checkout.
Cart ID: ${cart.cartId}
Items: ${cart.items}
Cart Value: Rs. ${cart.cartValue}

Your strict conversational goal:
1. Greet the customer and mention they left items (${cart.items}) in their shopping cart.
2. Politely inquire if there was any issue that prevented them from finishing checkout.
3. Address their objections (free shipping, free returns).
4. Offer them a 10% discount coupon 'SAVE10' to complete the order today.
5. If they accept:
   - Call \`apply_discount\` with cartId="${cart.cartId}", discountCode="SAVE10", and discountValue=10.
   - Reassure them that the discount is applied, and a checkout link is being sent to their number.
6. If they decline:
   - Acknowledge politely and thank them for their time.
`;
          }
        }
      }
    } catch (err: any) {
      logToFile(`[${providerName} WS] Error loading e-commerce details for confirmation instruction: ${err?.message || err}`);
    }

    const instruction = compiledInstruction + customEcommerceInstruction;
    const temperature = typeof persona.temperature === "number" ? persona.temperature : 0.7;

    console.log(`[${providerName}] Connecting Gemini Live. Voice: ${persona.voice}. Temp: ${temperature}`);

    geminiSession = await ai.live.connect({
      model: GEMINI_MODEL,
      callbacks: {
        onmessage: async (msg: LiveServerMessage) => {
          try {
            // Handle tool calls via shared executor
            if ((msg as any).toolCall?.functionCalls) {
              isToolCallPending = true;
              try {
                const callerKey = callerNumber.replace(/^\+/, "").trim() || "default";
                const responses = await executeToolCalls(
                  (msg as any).toolCall.functionCalls,
                  callerKey,
                  callLogger
                );
                if (responses.length > 0 && geminiSession) {
                  geminiSession.sendToolResponse({ functionResponses: responses });
                }
              } finally {
                isToolCallPending = false;
              }
            }

            // Handle interruptions
            if (msg.serverContent?.interrupted && streamSid) {
              if (telephonyWs.readyState === WebSocket.OPEN && !isVobizStream) {
                telephonyWs.send(JSON.stringify({ event: "clear", streamSid }));
              }
            }

            // Transcription logging
            if (msg.serverContent?.outputTranscription?.text) {
              const text = msg.serverContent.outputTranscription.text;
              callLogger.addTranscript("agent", text);
              if (outboundCallId) addCallTranscript(outboundCallId, "agent", text);
            }
            if (msg.serverContent?.inputTranscription?.text) {
              const text = msg.serverContent.inputTranscription.text;
              callLogger.addTranscript("user", text);
              if (outboundCallId) addCallTranscript(outboundCallId, "user", text);
            }

            // Forward audio to telephony channel
            const parts = msg.serverContent?.modelTurn?.parts;
            if (parts) {
              for (const part of parts) {
                if (part.inlineData?.data && (streamSid || isVobizStream)) {
                  const base64PCM = part.inlineData.data;
                  outputAudioChunkCount++;
                  callLogger.incrementPackets("out");

                  if (telephonyWs.readyState === WebSocket.OPEN) {
                    const pcm24k = base64ToInt16Array(base64PCM);
                    const pcm16k = resampleInt16Pcm(pcm24k, 24000, 16000);
                    callLogger.addAudioChunk("agent", pcm16k);

                    if (isVobizStream) {
                      // Gemini 24kHz → 16kHz L16 for Vobiz
                      telephonyWs.send(JSON.stringify({
                        event: "playAudio",
                        media: {
                          contentType: "audio/x-l16",
                          sampleRate: 16000,
                          payload: int16ArrayToBase64(pcm16k),
                        },
                      }));
                    } else {
                      // Gemini 24kHz → 8kHz μ-law for Twilio
                      const mulawCount = Math.floor(pcm24k.length / 3);
                      const mulawBytes = new Uint8Array(mulawCount);
                      for (let i = 0; i < mulawCount; i++) {
                        mulawBytes[i] = encodeMulaw(pcm24k[i * 3]);
                      }
                      const mulawBase64 = Buffer.from(mulawBytes.buffer, mulawBytes.byteOffset, mulawBytes.byteLength).toString("base64");
                      telephonyWs.send(JSON.stringify({
                        event: "media",
                        streamSid,
                        media: { payload: mulawBase64 },
                      }));
                    }
                  }
                }
              }
            }
          } catch (err) {
            console.error(`[${providerName}] Transcoding error:`, err);
          }
        },
        onclose: () => {
          console.log(`[${providerName}] Gemini connection completed.`);
          telephonyWs.close();
        },
        onerror: (err: any) => {
          console.error(`[${providerName}] Gemini error:`, err);
          callLogger.markFailed(err?.message || "Gemini error");
          telephonyWs.close();
        },
      },
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: persona.voice } },
        },
        systemInstruction: instruction,
        temperature,
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        tools: [{ functionDeclarations: getToolsForPersona(persona.enabledTools) }],
      },
    });

    isInitiated = true;
    callLogger.markConnected();
    logToFile(`[${providerName} WS] Successfully established Gemini Live session!`);
    sendGreeting();
  } catch (err: any) {
    logToFile(`[${providerName} WS] ERROR: Failed to establish Gemini session: ${err?.message || err}`);
    if (err?.stack) {
      logToFile(`[${providerName} WS] Stack: ${err.stack}`);
    }
    callLogger.markFailed(err?.message || "Connection failed");
    await callLogger.finalize();
    telephonyWs.close();
    return;
  }

  // Handle incoming audio from telephony gateway
  telephonyWs.on("message", (rawMessage) => {
    try {
      const data = JSON.parse(rawMessage.toString());

      if (data.event === "start") {
        streamSid = data.start?.streamSid || data.start?.streamId || data.streamSid || data.streamId || "";
        logToFile(`[${providerName} WS] Stream active event received. streamSid/streamId: ${streamSid}`);
        if (isVobizStream) {
          inboundEncoding = data.start?.mediaFormat?.encoding || inboundEncoding;
          inboundSampleRate = Number(data.start?.mediaFormat?.sampleRate || inboundSampleRate);
        }
        startReceived = true;
        sendGreeting();
        return;
      }

      if (data.event === "media") {
        if (!isInitiated || !geminiSession) return;
        if (isToolCallPending) {
          // Discard G.711 stream frames during tool call execution to prevent policy violation 1008
          return;
        }
        const payloadBase64 = data.media.payload;
        mediaFrameCount++;
        callLogger.incrementPackets("in");

        let pcm16Samples: Int16Array;
        if (inboundEncoding === "audio/x-l16") {
          const inboundPcm = base64ToInt16Array(payloadBase64);
          pcm16Samples = resampleInt16Pcm(inboundPcm, inboundSampleRate, 16000);
        } else {
          // μ-law 8kHz → PCM 16kHz via interpolation
          const mulawBuffer = Buffer.from(payloadBase64, "base64");
          pcm16Samples = new Int16Array(mulawBuffer.length * 2);
          for (let i = 0; i < mulawBuffer.length; i++) {
            const currentSample = decodeMulaw(mulawBuffer[i]);
            pcm16Samples[i * 2] = currentSample;
            if (i < mulawBuffer.length - 1) {
              const nextSample = decodeMulaw(mulawBuffer[i + 1]);
              pcm16Samples[i * 2 + 1] = Math.round((currentSample + nextSample) / 2);
            } else {
              pcm16Samples[i * 2 + 1] = currentSample;
            }
          }
        }

        const base64PCM = int16ArrayToBase64(pcm16Samples);
        callLogger.addAudioChunk("user", pcm16Samples);
        geminiSession.sendRealtimeInput({
          audio: { data: base64PCM, mimeType: "audio/pcm;rate=16000" },
        });
        return;
      }

      if (data.event === "stop") {
        logToFile(`[${providerName} WS] Stop event received. Caller disconnected.`);
        telephonyWs.close();
        return;
      }
    } catch (err: any) {
      logToFile(`[${providerName} WS] ERROR parsing message: ${err?.message || err}`);
    }
  });

  telephonyWs.on("close", async () => {
    logToFile(`[${providerName} WS] Socket closed.`);
    if (geminiSession) {
      try { geminiSession.close(); } catch {}
    }
    callLogger.markCompleted(direction === "outbound" ? "Outbound call ended" : "Caller disconnected");
    if (outboundCallId) updateCallStatus(outboundCallId, "completed");
    await callLogger.finalize();

    // Trigger background AI summarization!
    void generateCallSummary(callLogger.getCallId());
  });
}
