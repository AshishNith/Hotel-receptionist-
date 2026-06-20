// ─── Client Configuration System ────────────────────────────────
// Change these values to white-label the dashboard for any client.
// This single file controls branding, colors, features, and user info.

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
  clientPortal: boolean;
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

// ─── Default Configuration ──────────────────────────────────────
// Modify this to change the dashboard for different clients.

const clientConfig: ClientConfig = {
  brand: {
    name: "VoiceLink",
    tagline: "DTC Call Automation & COD Confirmation",
    logoInitials: "VL",
    logoUrl: "https://res.cloudinary.com/dvwpxb2oa/image/upload/v1781609580/Full_Logo_neu1ij.png",
    accentColor: "#4f46e5",           // indigo-600
    accentColorLight: "#6366f1",      // indigo-500
    accentGradientFrom: "#4f46e5",    // indigo-600
    accentGradientTo: "#3730a3",      // indigo-800
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
    clientPortal: true,
  },
  credits: {
    total: 1000000,
    used: 2450,
    label: "CREDITS",
  },
  user: {
    name: "DTC Founder",
    email: "founder@brand.com",
    role: "Administrator",
  },
};

export default clientConfig;
