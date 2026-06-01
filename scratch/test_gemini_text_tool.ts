import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
import { GEMINI_MODEL } from "../server/config.js";
import { hotelRoomTools } from "../server/services/gemini.js";
import { executeToolCalls } from "../server/services/toolExecutor.js";

async function testTextTool() {
  console.log("Starting natural tool call test with model:", GEMINI_MODEL);

  const ai = new GoogleGenAI({ 
    apiKey: GEMINI_API_KEY
  });

  let session: any = null;

  try {
    session = await ai.live.connect({
      model: GEMINI_MODEL,
      config: {
        responseModalities: ["AUDIO" as any],
        systemInstruction: "You are a hotel receptionist calling agent. Use tools to answer questions.",
        tools: [{ functionDeclarations: hotelRoomTools }]
      },
      callbacks: {
        onmessage: async (msg) => {
          console.log("[Direct] Received message keys:", Object.keys(msg));
          if (msg.serverContent?.modelTurn?.parts) {
            for (const part of msg.serverContent.modelTurn.parts) {
              if (part.text) {
                console.log("[Direct] Model output text:", part.text);
              }
            }
          }
          if ((msg as any).toolCall?.functionCalls) {
            console.log("[Direct] Tool call detected! functionCalls:", JSON.stringify((msg as any).toolCall.functionCalls, null, 2));
            try {
              const responses = await executeToolCalls(
                (msg as any).toolCall.functionCalls,
                "default"
              );
              console.log("[Direct] Tool execution output:", JSON.stringify(responses, null, 2));

              console.log("[Direct] Sending tool response to Gemini...");
              session.sendToolResponse({ functionResponses: responses });
              console.log("[Direct] Tool response sent successfully!");
            } catch (err) {
              console.error("[Direct] Error during tool execution/response:", err);
            }
          }
        },
        onclose: (e) => {
          console.log("[Direct] Connection closed:", e);
        },
        onerror: (err) => {
          console.error("[Direct] Socket error:", err);
        }
      }
    });

    console.log("[Direct] Connected to socket! Sending user query...");
    session.sendClientContent({
      turns: [
        {
          role: "user",
          parts: [{ text: "Hi, please check room availability for check-in 2026-06-01 and check-out 2026-06-03 for 2 guests." }]
        }
      ],
      turnComplete: true
    });
  } catch (err) {
    console.error("Failed to connect:", err);
  }
}

testTextTool();
