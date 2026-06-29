import { Schema, model } from "mongoose";

// ─── Brand Settings ─────────────────────────────────────────────
export interface IBrandSettings {
  name: string;
  tagline: string;
  logoInitials: string;
  logoUrl?: string;
  accentColor: string;
  accentColorLight: string;
  accentGradientFrom: string;
  accentGradientTo: string;
}

// ─── User Profile ───────────────────────────────────────────────
export interface IUserSettings {
  name: string;
  email?: string;
  role: string;
  avatar?: string;
}

// ─── VoBiz Telephony ────────────────────────────────────────────
export interface IVobizSettings {
  authId: string;
  authToken: string;
  fromNumber: string;
}

// ─── Google Sheets ──────────────────────────────────────────────
export interface IGoogleSheetsSettings {
  spreadsheetId: string;
}

// ─── Gemini AI ──────────────────────────────────────────────────
export interface IGeminiSettings {
  apiKey: string;
  model: string;
}

// ─── Credits & Billing ──────────────────────────────────────────
export interface ICreditsSettings {
  costPerMinute: number;
  walletBalance: number;
  label: string;
}

// ─── Feature Flags ──────────────────────────────────────────────
export interface IFeatureFlags {
  dashboard: boolean;
  agents: boolean;
  campaigns: boolean;
  calls: boolean;
  voices: boolean;
  credits: boolean;
  settings: boolean;
  knowledgeBases: boolean;
  analytics: boolean;
  outboundCalling: boolean;
}

// ─── Combined Settings ──────────────────────────────────────────
export interface ISettings {
  _key: string; // singleton key, always "global"
  brand: IBrandSettings;
  user: IUserSettings;
  vobiz: IVobizSettings;
  googleSheets: IGoogleSheetsSettings;
  gemini: IGeminiSettings;
  credits: ICreditsSettings;
  features: IFeatureFlags;
  updatedAt: Date;
}

const BrandSettingsSchema = new Schema<IBrandSettings>(
  {
    name:              { type: String, default: "VoiceLink" },
    tagline:           { type: String, default: "AI Call Automation Platform" },
    logoInitials:      { type: String, default: "VL" },
    logoUrl:           { type: String, default: "" },
    accentColor:       { type: String, default: "#4f46e5" },
    accentColorLight:  { type: String, default: "#6366f1" },
    accentGradientFrom:{ type: String, default: "#4f46e5" },
    accentGradientTo:  { type: String, default: "#3730a3" },
  },
  { _id: false }
);

const UserSettingsSchema = new Schema<IUserSettings>(
  {
    name:   { type: String, default: "Admin" },
    email:  { type: String, default: "" },
    role:   { type: String, default: "Administrator" },
    avatar: { type: String, default: "" },
  },
  { _id: false }
);

const VobizSettingsSchema = new Schema<IVobizSettings>(
  {
    authId:     { type: String, default: "" },
    authToken:  { type: String, default: "" },
    fromNumber: { type: String, default: "" },
  },
  { _id: false }
);

const GoogleSheetsSettingsSchema = new Schema<IGoogleSheetsSettings>(
  {
    spreadsheetId: { type: String, default: "" },
  },
  { _id: false }
);

const GeminiSettingsSchema = new Schema<IGeminiSettings>(
  {
    apiKey: { type: String, default: "" },
    model:  { type: String, default: "gemini-3.1-flash-live-preview" },
  },
  { _id: false }
);

const CreditsSettingsSchema = new Schema<ICreditsSettings>(
  {
    costPerMinute: { type: Number, default: 1.5 },
    walletBalance: { type: Number, default: 100000 },
    label:         { type: String, default: "CREDITS" },
  },
  { _id: false }
);

const FeatureFlagsSchema = new Schema<IFeatureFlags>(
  {
    dashboard:       { type: Boolean, default: true },
    agents:          { type: Boolean, default: true },
    campaigns:       { type: Boolean, default: true },
    calls:           { type: Boolean, default: true },
    voices:          { type: Boolean, default: true },
    credits:         { type: Boolean, default: true },
    settings:        { type: Boolean, default: true },
    knowledgeBases:  { type: Boolean, default: true },
    analytics:       { type: Boolean, default: true },
    outboundCalling: { type: Boolean, default: true },
  },
  { _id: false }
);

const SettingsSchema = new Schema<ISettings>({
  _key:         { type: String, required: true, unique: true, default: "global" },
  brand:        { type: BrandSettingsSchema, default: () => ({}) },
  user:         { type: UserSettingsSchema, default: () => ({}) },
  vobiz:        { type: VobizSettingsSchema, default: () => ({}) },
  googleSheets: { type: GoogleSheetsSettingsSchema, default: () => ({}) },
  gemini:       { type: GeminiSettingsSchema, default: () => ({}) },
  credits:      { type: CreditsSettingsSchema, default: () => ({}) },
  features:     { type: FeatureFlagsSchema, default: () => ({}) },
  updatedAt:    { type: Date, default: Date.now },
});

export const SettingsModel = model<ISettings>("Settings", SettingsSchema);

/**
 * Retrieves the global settings document, creating one with defaults if it doesn't exist.
 */
export async function getGlobalSettings(): Promise<ISettings> {
  let settings = await SettingsModel.findOne({ _key: "global" });
  if (!settings) {
    settings = await SettingsModel.create({ _key: "global" });
  }
  return settings;
}
