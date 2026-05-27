export interface KnowledgeDocument {
  id: string;
  title: string;
  content: string;
}

export interface KnowledgeBase {
  id: string;
  name: string;
  description: string;
  documents: KnowledgeDocument[];
}

export interface Persona {
  id: string;
  name: string;
  role: string;
  description?: string;
  voice: "Zephyr" | "Puck" | "Charon" | "Kore" | "Fenrir" | "Aoede";
  systemInstruction: string;
  accentColor: string;
  bgColor?: string;
  borderColor?: string;
  avatar?: string;
  initialGreeting?: string;
  phoneNumber?: string;
  knowledgeBaseId?: string;
  ambientSound?: "none" | "office" | "cafe" | "airport";
  silenceTimeout?: number;
  temperature?: number;
}

export type CallState = "idle" | "calling" | "connected" | "ended" | "error";

export interface ChatMessage {
  id: string;
  role: "user" | "agent";
  text: string;
  timestamp: Date;
}

// ─── Analytics Types ────────────────────────────────────────────

export interface CallLogEntry {
  callId: string;
  personaId: string;
  personaName: string;
  callerNumber: string;
  provider: "browser" | "twilio" | "vobiz";
  direction: "inbound" | "outbound";
  status: string;
  startedAt: string;
  connectedAt?: string;
  endedAt?: string;
  durationSeconds?: number;
  audioPacketsReceived: number;
  audioPacketsSent: number;
  transcriptCount?: number;
  toolCallCount?: number;
  errorMessage?: string;
}

export interface CallLogDetail extends CallLogEntry {
  transcript: Array<{ role: "user" | "agent"; text: string; timestamp: string }>;
  toolCallsUsed: Array<{ name: string; args: any; result: any; timestamp: string }>;
}

export interface AnalyticsStats {
  totalCalls: number;
  totalDurationSeconds: number;
  avgDurationSeconds: number;
  callsToday: number;
  callsByPersona: Record<string, number>;
  callsByStatus: Record<string, number>;
  callsByDay: Array<{ date: string; count: number }>;
  callsByProvider: Record<string, number>;
}
