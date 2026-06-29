// ─── Client Configuration System ────────────────────────────────
// Default/fallback values used when the server settings API is unavailable.
// In production, all values are fetched from MongoDB via /api/settings.

export interface ClientBrand {
  name: string;
  tagline: string;
  logoInitials: string;
  logoUrl?: string;
  accentColor: string;
  accentColorLight: string;
  accentGradientFrom: string;
  accentGradientTo: string;
  sidebarBg: string;
  sidebarBorder: string;
}

export interface ClientFeatures {
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

export interface ClientCredits {
  total: number;
  used: number;
  label: string;
}

export interface ClientUser {
  name: string;
  email?: string;
  avatar?: string;
  role: string;
}

export interface ClientConfig {
  brand: ClientBrand;
  features: ClientFeatures;
  credits: ClientCredits;
  user: ClientUser;
}

// ─── Default Configuration (Fallback Only) ──────────────────────
// These values are used before the server settings load.
// Actual values come from MongoDB Settings via /api/settings.

const clientConfig: ClientConfig = {
  brand: {
    name: "VoiceLink",
    tagline: "AI Call Automation Platform",
    logoInitials: "VL",
    accentColor: "#4f46e5",
    accentColorLight: "#6366f1",
    accentGradientFrom: "#4f46e5",
    accentGradientTo: "#3730a3",
    sidebarBg: "#ffffff",
    sidebarBorder: "#e4e4e7",
  },
  features: {
    dashboard: true,
    agents: true,
    campaigns: true,
    calls: true,
    voices: true,
    credits: true,
    settings: true,
    knowledgeBases: true,
    analytics: true,
    outboundCalling: true,
  },
  credits: {
    total: 100000,
    used: 0,
    label: "CREDITS",
  },
  user: {
    name: "Admin",
    email: "",
    role: "Administrator",
  },
};

export default clientConfig;
