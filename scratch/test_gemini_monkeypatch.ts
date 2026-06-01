import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
import { GEMINI_MODEL } from "../server/config.js";
import { hotelRoomTools } from "../server/services/gemini.js";
import { executeToolCalls } from "../server/services/toolExecutor.js";

async function testMonkeypatch() {
  console.log("Starting forced tool call test with monkeypatch and model:", GEMINI_MODEL);

  const ai = new GoogleGenAI({ 
    apiKey: GEMINI_API_KEY
  });

  // Let's monkeypatch the webSocketFactory on the live client
  const liveClient = (ai as any).live;
  const originalCreate = liveClient.webSocketFactory.create.bind(liveClient.webSocketFactory);

  liveClient.webSocketFactory.create = function(url: string, headers: any, callbacks: any) {
    console.log("[Monkeypatch] webSocketFactory.create intercepted!");
    const conn = originalCreate(url, headers, callbacks);
    const originalSend = conn.send.bind(conn);

    conn.send = function(data: string) {
      try {
        const msg = JSON.parse(data);
        if (msg.setup) {
          console.log("[Monkeypatch] Injecting tool_config (snake_case) flat under setup!");
          msg.setup.tool_config = {
            function_calling_config: {
              mode: "ANY",
              allowed_function_names: ["check_room_availability"]
            }
          };
          console.log("[Monkeypatch] Modified setup message:", JSON.stringify(msg, null, 2));
          return originalSend(JSON.stringify(msg));
        }
      } catch (err) {
        console.error("[Monkeypatch] Error modifying send data:", err);
      }
      return originalSend(data);
    };

    return conn;
  };

  let session: any = null;

  try {
    session = await ai.live.connect({
      model: GEMINI_MODEL,
      config: {
        responseModalities: ["AUDIO" as any],
        systemInstruction: "You are a helpful calling agent. Check room availability for any input.",
        tools: [{ functionDeclarations: hotelRoomTools }]
      },
      callbacks: {
        onmessage: async (msg) => {
          console.log("[Direct] Received message keys:", Object.keys(msg));
          if ((msg as any).toolCall?.functionCalls) {
            console.log("[Direct] Tool call detected! Executing functionCalls:", JSON.stringify((msg as any).toolCall.functionCalls, null, 2));
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
          parts: [{ text: "Can you check room availability for check-in 2026-06-01 and check-out 2026-06-03 for 2 guests?" }]
        }
      ],
      turnComplete: true
    });
  } catch (err) {
    console.error("Failed to connect:", err);
  }
}

testMonkeypatch();
