import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
import { GEMINI_MODEL } from "../server/config.js";
import { allToolDeclarations } from "../server/services/gemini.js";

async function testTools() {
  console.log("Starting tool declarations test with model:", GEMINI_MODEL);

  const ai = new GoogleGenAI({ 
    apiKey: GEMINI_API_KEY
  });
  let session: any = null;

  try {
    session = await ai.live.connect({
      model: GEMINI_MODEL,
      config: {
        responseModalities: ["AUDIO" as any],
        systemInstruction: "You are a helpful calling agent.",
        tools: [{ functionDeclarations: allToolDeclarations }],
      },
      callbacks: {
        onmessage: async (msg) => {
          console.log("[Test] Received message:", Object.keys(msg));
        },
        onclose: (e) => {
          console.log("[Test] Connection closed:", e);
        },
        onerror: (err) => {
          console.error("[Test] Socket error:", err);
        }
      }
    });

    console.log("[Test] Connected successfully!");
    setTimeout(() => {
      if (session) {
        console.log("[Test] Closing session...");
        session.close();
      }
    }, 5000);
  } catch (err) {
    console.error("Failed to connect:", err);
  }
}

testTools().catch(console.error);
