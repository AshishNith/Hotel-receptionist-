import type { WebSocket } from "ws";
import type { LiveServerMessage } from "@google/genai";
import { getGeminiClient, getCompiledSystemInstruction, allToolDeclarations, GEMINI_MODEL, Modality } from "../services/gemini.js";
import { executeToolCalls } from "../services/toolExecutor.js";
import { CallLogger } from "../services/callLogger.js";

/**
 * Handles a browser WebSocket connection at /api/live.
 * Receives setup + raw PCM audio from the browser and pipes it to Gemini Live.
 */
export async function handleBrowserWebSocket(clientWs: WebSocket): Promise<void> {
  console.log("[WS] Client connected. Waiting for setup details...");

  let geminiSession: any = null;
  let isInitiated = false;
  let callLogger: CallLogger | null = null;

  clientWs.on("message", async (data) => {
    try {
      const message = JSON.parse(data.toString());

      if (message.type === "setup") {
        if (isInitiated) {
          clientWs.send(JSON.stringify({ type: "error", message: "Session already initiated." }));
          return;
        }

        const voice = message.voice || "Zephyr";
        const baseInstruction = message.systemInstruction || "You are a helpful calling agent.";
        const kbId = message.knowledgeBaseId;
        const instruction = await getCompiledSystemInstruction(baseInstruction, kbId);
        const temperature = typeof message.temperature === "number" ? message.temperature : 0.7;
        const googlePhoneKey = message.googlePhoneKey || "default";
        const personaId = message.personaId || "unknown";
        const personaName = message.personaName || "Unknown Agent";

        // Initialize call logger
        callLogger = new CallLogger(personaId, personaName, "browser-user", "browser", "outbound");

        console.log(`[WS] Setting up Gemini. Voice: ${voice}. Instruction: ${instruction.length} chars. Temp: ${temperature}`);

        try {
          const ai = getGeminiClient();

          geminiSession = await ai.live.connect({
            model: GEMINI_MODEL,
            callbacks: {
              onmessage: async (msg: LiveServerMessage) => {
                try {
                  // Handle tool calls
                  if ((msg as any).toolCall?.functionCalls) {
                    const responses = await executeToolCalls(
                      (msg as any).toolCall.functionCalls,
                      googlePhoneKey,
                      callLogger ?? undefined
                    );

                    if (responses.length > 0 && geminiSession) {
                      geminiSession.sendToolResponse({ functionResponses: responses });
                    }
                  }

                  // Forward audio + text content
                  const parts = msg.serverContent?.modelTurn?.parts;
                  if (parts) {
                    for (const part of parts) {
                      if (part.inlineData?.data) {
                        clientWs.send(JSON.stringify({ type: "audio", data: part.inlineData.data }));
                        callLogger?.incrementPackets("out");
                      }
                      if (part.text) {
                        clientWs.send(JSON.stringify({ type: "output-transcription", text: part.text }));
                        callLogger?.addTranscript("agent", part.text);
                      }
                    }
                  }

                  if (msg.serverContent?.interrupted) {
                    clientWs.send(JSON.stringify({ type: "interrupted" }));
                  }

                  // Transcription events
                  if (msg.serverContent?.outputTranscription?.text) {
                    const text = msg.serverContent.outputTranscription.text;
                    clientWs.send(JSON.stringify({ type: "output-transcription", text }));
                    callLogger?.addTranscript("agent", text);
                  }
                  if (msg.serverContent?.inputTranscription?.text) {
                    const text = msg.serverContent.inputTranscription.text;
                    clientWs.send(JSON.stringify({ type: "input-transcription", text }));
                    callLogger?.addTranscript("user", text);
                  }
                } catch (err: any) {
                  console.error("[WS] Error forwarding message from Gemini:", err);
                }
              },
              onclose: () => {
                console.log("[WS] Gemini connection closed.");
                clientWs.send(JSON.stringify({ type: "status", message: "disconnected", detail: "Gemini connection closed" }));
              },
              onerror: (err: any) => {
                console.error("[WS] Gemini error:", err);
                clientWs.send(JSON.stringify({ type: "error", message: err?.message || "Gemini Live API error" }));
              },
            },
            config: {
              responseModalities: [Modality.AUDIO],
              speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } },
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
          clientWs.send(JSON.stringify({
            type: "status",
            message: "connected",
            callId: callLogger.getCallId(),
          }));
          console.log("[WS] Gemini Live session connected!");
        } catch (err: any) {
          console.error("[WS] Failed to connect to Gemini Live:", err);
          callLogger?.markFailed(err?.message || "Connection failed");
          await callLogger?.finalize();
          clientWs.send(JSON.stringify({
            type: "error",
            message: err?.message || "Could not spin up Gemini Live session.",
          }));
        }
        return;
      }

      // Handle raw audio input
      if (message.type === "audio") {
        if (!isInitiated || !geminiSession) return;
        geminiSession.sendRealtimeInput({
          audio: { data: message.data, mimeType: "audio/pcm;rate=16000" },
        });
        callLogger?.incrementPackets("in");
        return;
      }

      if (message.type === "interrupt") {
        console.log("[WS] Client requested interrupt.");
        return;
      }
    } catch (err: any) {
      console.error("[WS] Error parsing client message:", err);
    }
  });

  clientWs.on("close", async () => {
    console.log("[WS] Client disconnected. Cleaning up...");
    if (geminiSession) {
      try { geminiSession.close(); } catch {}
    }
    callLogger?.markCompleted("Client disconnected");
    await callLogger?.finalize();
  });
}
