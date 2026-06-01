import dotenv from "dotenv";
import path from "path";
import mongoose from "mongoose";

const result = dotenv.config({ path: path.resolve(process.cwd(), ".env"), override: true });
console.log(`[Config] process.cwd(): ${process.cwd()}`);
console.log(`[Config] dotenv result:`, result);

// ─── Server ─────────────────────────────────────────────────────
export const PORT = Number(process.env.PORT) || 3000;

// ─── MongoDB ────────────────────────────────────────────────────
export const MONGODB_URI =
  process.env.MONGODB_URI ||
  "mongodb://localhost:27017/gemini_voice_agent";

// ─── Gemini ─────────────────────────────────────────────────────
export const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
export const GEMINI_MODEL = "gemini-3.1-flash-live-preview";

// ─── Google OAuth ───────────────────────────────────────────────
export const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
export const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
export const GOOGLE_REDIRECT_URI =
  process.env.GOOGLE_REDIRECT_URI ||
  `http://localhost:${PORT}/api/auth/google/callback`;

// ─── App ────────────────────────────────────────────────────────
export const APP_URL = process.env.APP_URL || "";

// ─── VoBiz Outbound Calling ─────────────────────────────────────
export const VOBIZ_AUTH_ID = process.env.VOBIZ_AUTH_ID || "";
export const VOBIZ_AUTH_TOKEN = process.env.VOBIZ_AUTH_TOKEN || "";
export const VOBIZ_FROM_NUMBER = process.env.VOBIZ_FROM_NUMBER || "";
export const GOOGLE_SHEETS_SPREADSHEET_ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID || "";

// ─── Database Connection ────────────────────────────────────────
export async function connectDatabase(): Promise<void> {
  mongoose.set("bufferCommands", false);
  await mongoose.connect(MONGODB_URI);
  console.log("[DB] Connected successfully to MongoDB!");
}
