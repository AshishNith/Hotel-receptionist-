import { Schema, model } from "mongoose";

export interface ICallTranscript {
  role: "user" | "agent";
  text: string;
  timestamp: Date;
}

export interface IToolCallRecord {
  name: string;
  args: any;
  result: any;
  timestamp: Date;
}

export interface ICallLog {
  callId: string;
  personaId: string;
  personaName: string;
  callerNumber: string;
  provider: "browser" | "twilio" | "vobiz";
  direction: "inbound" | "outbound";
  status: "ringing" | "connected" | "completed" | "failed" | "missed";
  startedAt: Date;
  connectedAt?: Date;
  endedAt?: Date;
  durationSeconds?: number;
  transcript: ICallTranscript[];
  toolCallsUsed: IToolCallRecord[];
  audioPacketsReceived: number;
  audioPacketsSent: number;
  errorMessage?: string;
}

const CallTranscriptSchema = new Schema<ICallTranscript>(
  {
    role:      { type: String, enum: ["user", "agent"], required: true },
    text:      { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

const ToolCallRecordSchema = new Schema<IToolCallRecord>(
  {
    name:      { type: String, required: true },
    args:      { type: Schema.Types.Mixed, default: {} },
    result:    { type: Schema.Types.Mixed, default: {} },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

const CallLogSchema = new Schema<ICallLog>({
  callId:               { type: String, required: true, unique: true },
  personaId:            { type: String, required: true, index: true },
  personaName:          { type: String, required: true },
  callerNumber:         { type: String, default: "" },
  provider:             { type: String, enum: ["browser", "twilio", "vobiz"], required: true },
  direction:            { type: String, enum: ["inbound", "outbound"], default: "inbound" },
  status:               { type: String, enum: ["ringing", "connected", "completed", "failed", "missed"], default: "ringing", index: true },
  startedAt:            { type: Date, default: Date.now, index: true },
  connectedAt:          { type: Date },
  endedAt:              { type: Date },
  durationSeconds:      { type: Number, default: 0 },
  transcript:           { type: [CallTranscriptSchema], default: [] },
  toolCallsUsed:        { type: [ToolCallRecordSchema], default: [] },
  audioPacketsReceived: { type: Number, default: 0 },
  audioPacketsSent:     { type: Number, default: 0 },
  errorMessage:         { type: String },
});

export const CallLogModel = model<ICallLog>("CallLog", CallLogSchema);
