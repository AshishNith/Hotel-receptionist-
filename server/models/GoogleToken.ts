import { Schema, model } from "mongoose";

export interface IGoogleToken {
  phoneKey: string;
  access_token?: string;
  refresh_token?: string;
  expiry_date?: number;
  scope?: string;
  token_type?: string;
}

const GoogleTokenSchema = new Schema<IGoogleToken>({
  phoneKey:      { type: String, required: true, unique: true },
  access_token:  { type: String },
  refresh_token: { type: String },
  expiry_date:   { type: Number },
  scope:         { type: String },
  token_type:    { type: String },
});

export const GoogleTokenModel = model<IGoogleToken>("GoogleToken", GoogleTokenSchema);
