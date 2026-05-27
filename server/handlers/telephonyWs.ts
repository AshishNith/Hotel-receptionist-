import { WebSocket } from "ws";
import type { LiveServerMessage } from "@google/genai";
import { getGeminiClient, getCompiledSystemInstruction, allToolDeclarations, GEMINI_MODEL, Modality } from "../services/gemini.js";
import { executeToolCalls } from "../services/toolExecutor.js";
import { CallLogger } from "../services/callLogger.js";
import { PersonaModel } from "../models/Persona.js";
import {
  decodeMulaw, encodeMulaw,
  base64ToInt16Array, int16ArrayToBase64,
  resampleInt16Pcm,
} from "../services/audioCodec.js";

/**
 * Handles a telephony WebSocket connection at /api/twilio/live or /api/sip/live.
 * Receives G.711 μ-law (Twilio) or L16 PCM (Vobiz) audio, transcodes, and pipes to Gemini Live.
 */
export async function handleTelephonyWebSocket(telephonyWs: WebSocket, request: any): Promise<void> {
  const upgradeUrl = new URL(request.url || "", `http://localhost`);
  const isVobizStream = upgradeUrl.pathname === "/api/sip/live";
  const providerName = isVobizStream ? "Vobiz" : "Twilio";
  const provider = isVobizStream ? "vobiz" : "twilio";

  console.log(`[${providerName}] New inbound phone stream opened.`);

  const personaId = upgradeUrl.searchParams.get("personaId") || "diya";
  const callerNumber = decodeURIComponent(upgradeUrl.searchParams.get("callerNumber") || "");

  // Resolve persona
  let persona = await PersonaModel.findOne({ id: personaId });
  if (!persona) persona = await PersonaModel.findOne({});
  if (!persona) {
    console.error(`[${providerName}] No persona found. Closing.`);
    telephonyWs.close();
    return;
  }

  console.log(`[${providerName}] Routing to: ${persona.name} (${persona.role}), From: ${callerNumber}`);

  // Initialize call logger
  const callLogger = new CallLogger(persona.id, persona.name, callerNumber, provider as any, "inbound");

  let geminiSession: any = null;
  let streamSid = "";
  let isInitiated = false;
  let startReceived = false;
  let greetingSent = false;
  let mediaFrameCount = 0;
  let outputAudioChunkCount = 0;
  let inboundEncoding = isVobizStream ? "audio/x-l16" : "audio/x-mulaw";
  let inboundSampleRate = isVobizStream ? 16000 : 8000;

  const sendGreeting = () => {
    if (greetingSent) return;
    if (isInitiated && geminiSession && (startReceived || isVobizStream)) {
      greetingSent = true;
      setTimeout(() => {
        try {
          geminiSession.sendClientContent({
            turns: [
              {
                role: "user",
                parts: [{ text: "Call connected. Greet the caller now warmly and ask how you can help them today." }],
              },
            ],
            turnComplete: true,
          });
          console.log(`[${providerName}] Greeting dispatched.`);
        } catch (err: any) {
          console.error(`[${providerName}] Failed to send greeting:`, err?.message || err);
        }
      }, 500);
    }
  };

  try {
    const ai = getGeminiClient();
    const baseInstruction = persona.systemInstruction || "You are a helpful calling agent.";
    const instruction = await getCompiledSystemInstruction(baseInstruction, persona.knowledgeBaseId);
    const temperature = typeof persona.temperature === "number" ? persona.temperature : 0.7;

    console.log(`[${providerName}] Connecting Gemini Live. Voice: ${persona.voice}. Temp: ${temperature}`);

    geminiSession = await ai.live.connect({
      model: GEMINI_MODEL,
      callbacks: {
        onmessage: async (msg: LiveServerMessage) => {
          try {
            // Handle tool calls via shared executor
            if ((msg as any).toolCall?.functionCalls) {
              const callerKey = callerNumber.replace(/^\+/, "").trim() || "default";
              const responses = await executeToolCalls(
                (msg as any).toolCall.functionCalls,
                callerKey,
                callLogger
              );
              if (responses.length > 0 && geminiSession) {
                geminiSession.sendToolResponse({ functionResponses: responses });
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
              callLogger.addTranscript("agent", msg.serverContent.outputTranscription.text);
            }
            if (msg.serverContent?.inputTranscription?.text) {
              callLogger.addTranscript("user", msg.serverContent.inputTranscription.text);
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
                    if (isVobizStream) {
                      // Gemini 24kHz → 16kHz L16 for Vobiz
                      const pcm24k = base64ToInt16Array(base64PCM);
                      const pcm16k = resampleInt16Pcm(pcm24k, 24000, 16000);
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
                      const int16Arr = base64ToInt16Array(base64PCM);
                      const mulawCount = Math.floor(int16Arr.length / 3);
                      const mulawBytes = new Uint8Array(mulawCount);
                      for (let i = 0; i < mulawCount; i++) {
                        mulawBytes[i] = encodeMulaw(int16Arr[i * 3]);
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
        tools: [{ functionDeclarations: allToolDeclarations }],
      },
    });

    isInitiated = true;
    callLogger.markConnected();
    sendGreeting();
  } catch (err: any) {
    console.error(`[${providerName}] Failed to establish Gemini session:`, err);
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
        console.log(`[${providerName}] Stream active: ${streamSid}`);
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
        geminiSession.sendRealtimeInput({
          audio: { data: base64PCM, mimeType: "audio/pcm;rate=16000" },
        });
        return;
      }

      if (data.event === "stop") {
        console.log(`[${providerName}] Caller disconnected.`);
        telephonyWs.close();
        return;
      }
    } catch (err) {
      console.error(`[${providerName}] Parse error:`, err);
    }
  });

  telephonyWs.on("close", async () => {
    console.log(`[${providerName}] Socket closed.`);
    if (geminiSession) {
      try { geminiSession.close(); } catch {}
    }
    callLogger.markCompleted("Caller disconnected");
    await callLogger.finalize();
  });
}
