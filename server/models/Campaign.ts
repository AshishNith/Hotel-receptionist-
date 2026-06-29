import { Schema, model } from "mongoose";

export interface ICampaignContact {
  name: string;
  phone: string;
  bookingId?: string; // Optional context, e.g. orderId or cartId
  status: "pending" | "calling" | "completed" | "failed";
  callId?: string;
  errorMessage?: string;
}

export interface ICampaign {
  id: string;
  name: string;
  personaId: string;
  status: "draft" | "running" | "paused" | "completed";
  contacts: ICampaignContact[];
  createdAt: Date;
  completedAt?: Date;
}

const CampaignContactSchema = new Schema<ICampaignContact>(
  {
    name:         { type: String, required: true },
    phone:        { type: String, required: true },
    bookingId:    { type: String },
    status:       { type: String, enum: ["pending", "calling", "completed", "failed"], default: "pending" },
    callId:       { type: String },
    errorMessage: { type: String },
  },
  { _id: false }
);

const CampaignSchema = new Schema<ICampaign>({
  id:          { type: String, required: true, unique: true },
  name:        { type: String, required: true },
  personaId:   { type: String, required: true },
  status:      { type: String, enum: ["draft", "running", "paused", "completed"], default: "draft" },
  contacts:    { type: [CampaignContactSchema], default: [] },
  createdAt:   { type: Date, default: Date.now },
  completedAt: { type: Date },
});

export const CampaignModel = model<ICampaign>("Campaign", CampaignSchema);
