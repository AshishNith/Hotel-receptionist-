import React, { useState, useEffect, useCallback } from "react";
import { useClientConfig } from "../../config/ThemeProvider";
import { Settings, Shield, Palette, User, Save, RefreshCw, Phone, Database, Cpu, ToggleLeft, Coins, Eye, EyeOff, CheckCircle } from "lucide-react";

interface SettingsData {
  brand: {
    name: string;
    tagline: string;
    logoInitials: string;
    logoUrl: string;
    accentColor: string;
    accentColorLight: string;
    accentGradientFrom: string;
    accentGradientTo: string;
  };
  user: { name: string; email: string; role: string; avatar: string };
  vobiz: { authId: string; authToken: string; fromNumber: string };
  googleSheets: { spreadsheetId: string };
  gemini: { apiKey: string; model: string };
  credits: { costPerMinute: number; walletBalance: number; label: string };
  features: Record<string, boolean>;
}

const EMPTY_SETTINGS: SettingsData = {
  brand: { name: "", tagline: "", logoInitials: "", logoUrl: "", accentColor: "#4f46e5", accentColorLight: "#6366f1", accentGradientFrom: "#4f46e5", accentGradientTo: "#3730a3" },
  user: { name: "", email: "", role: "", avatar: "" },
  vobiz: { authId: "", authToken: "", fromNumber: "" },
  googleSheets: { spreadsheetId: "" },
  gemini: { apiKey: "", model: "" },
  credits: { costPerMinute: 1.5, walletBalance: 100000, label: "CREDITS" },
  features: {},
};

export function SettingsPage() {
  const config = useClientConfig();
  const [formData, setFormData] = useState<SettingsData>(EMPTY_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [showVobizToken, setShowVobizToken] = useState(false);
  const [showGeminiKey, setShowGeminiKey] = useState(false);

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/settings");
      const json = await res.json();
      if (json.success && json.data) {
        const d = json.data;
        setFormData({
          brand: {
            name: d.brand?.name || "",
            tagline: d.brand?.tagline || "",
            logoInitials: d.brand?.logoInitials || "",
            logoUrl: d.brand?.logoUrl || "",
            accentColor: d.brand?.accentColor || "#4f46e5",
            accentColorLight: d.brand?.accentColorLight || "#6366f1",
            accentGradientFrom: d.brand?.accentGradientFrom || "#4f46e5",
            accentGradientTo: d.brand?.accentGradientTo || "#3730a3",
          },
          user: {
            name: d.user?.name || "",
            email: d.user?.email || "",
            role: d.user?.role || "",
            avatar: d.user?.avatar || "",
          },
          vobiz: {
            authId: d.vobiz?.authId || "",
            authToken: d.vobiz?.authToken || "",
            fromNumber: d.vobiz?.fromNumber || "",
          },
          googleSheets: {
            spreadsheetId: d.googleSheets?.spreadsheetId || "",
          },
          gemini: {
            apiKey: d.gemini?.apiKey || "",
            model: d.gemini?.model || "",
          },
          credits: {
            costPerMinute: d.credits?.costPerMinute ?? 1.5,
            walletBalance: d.credits?.walletBalance ?? 100000,
            label: d.credits?.label || "CREDITS",
          },
          features: d.features || {},
        });
      }
    } catch (err) {
      console.error("Failed to fetch settings:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const json = await res.json();
      if (json.success) {
        setMessage("Settings saved successfully!");
        // Refresh the theme provider to apply new branding
        if (config.refreshConfig) {
          await config.refreshConfig();
        }
      } else {
        setMessage(`Error: ${json.message}`);
      }
    } catch (err: any) {
      setMessage(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const updateBrand = (key: string, value: string) => {
    setFormData((prev) => ({ ...prev, brand: { ...prev.brand, [key]: value } }));
  };
  const updateUser = (key: string, value: string) => {
    setFormData((prev) => ({ ...prev, user: { ...prev.user, [key]: value } }));
  };
  const updateVobiz = (key: string, value: string) => {
    setFormData((prev) => ({ ...prev, vobiz: { ...prev.vobiz, [key]: value } }));
  };
  const updateGemini = (key: string, value: string) => {
    setFormData((prev) => ({ ...prev, gemini: { ...prev.gemini, [key]: value } }));
  };
  const updateSheets = (key: string, value: string) => {
    setFormData((prev) => ({ ...prev, googleSheets: { ...prev.googleSheets, [key]: value } }));
  };
  const updateCredits = (key: string, value: number | string) => {
    setFormData((prev) => ({ ...prev, credits: { ...prev.credits, [key]: value } }));
  };
  const toggleFeature = (key: string) => {
    setFormData((prev) => ({
      ...prev,
      features: { ...prev.features, [key]: !prev.features[key] },
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="w-6 h-6 animate-spin text-zinc-400 mr-3" />
        <span className="text-sm font-mono text-zinc-500">Loading settings...</span>
      </div>
    );
  }

  return (
    <div className="placeholder-page">
      <div className="placeholder-header">
        <h2 className="placeholder-title flex items-center gap-2">
          <Settings className="w-6 h-6 text-zinc-900" />
          System Settings
        </h2>
        <p className="text-xs text-zinc-500 font-mono tracking-wider mt-1 uppercase">
          Configure branding, telephony, AI, and platform features
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="settings-grid">
          {/* ─── Left Column: Main Settings ─── */}
          <div className="col-span-2 space-y-6">

            {/* Branding & Theme */}
            <div className="settings-card">
              <h3 className="settings-section-title flex items-center gap-2">
                <Palette className="w-4 h-4 text-zinc-500" /> Branding & Theme
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                <div>
                  <label className="settings-label">Platform Name</label>
                  <input type="text" value={formData.brand.name} onChange={(e) => updateBrand("name", e.target.value)} className="settings-input" />
                </div>
                <div>
                  <label className="settings-label">Tagline</label>
                  <input type="text" value={formData.brand.tagline} onChange={(e) => updateBrand("tagline", e.target.value)} className="settings-input" />
                </div>
                <div>
                  <label className="settings-label">Logo Initials</label>
                  <input type="text" value={formData.brand.logoInitials} onChange={(e) => updateBrand("logoInitials", e.target.value)} className="settings-input" maxLength={4} />
                </div>
                <div>
                  <label className="settings-label">Logo URL</label>
                  <input type="text" value={formData.brand.logoUrl} onChange={(e) => updateBrand("logoUrl", e.target.value)} className="settings-input" placeholder="https://..." />
                </div>
                <div>
                  <label className="settings-label">Accent Color</label>
                  <div className="flex gap-2">
                    <input type="color" value={formData.brand.accentColor} onChange={(e) => updateBrand("accentColor", e.target.value)} className="settings-color-input" />
                    <input type="text" value={formData.brand.accentColor} onChange={(e) => updateBrand("accentColor", e.target.value)} className="settings-input flex-1" />
                  </div>
                </div>
                <div>
                  <label className="settings-label">Accent Color Light</label>
                  <div className="flex gap-2">
                    <input type="color" value={formData.brand.accentColorLight} onChange={(e) => updateBrand("accentColorLight", e.target.value)} className="settings-color-input" />
                    <input type="text" value={formData.brand.accentColorLight} onChange={(e) => updateBrand("accentColorLight", e.target.value)} className="settings-input flex-1" />
                  </div>
                </div>
                <div>
                  <label className="settings-label">Gradient Start</label>
                  <div className="flex gap-2">
                    <input type="color" value={formData.brand.accentGradientFrom} onChange={(e) => updateBrand("accentGradientFrom", e.target.value)} className="settings-color-input" />
                    <input type="text" value={formData.brand.accentGradientFrom} onChange={(e) => updateBrand("accentGradientFrom", e.target.value)} className="settings-input flex-1" />
                  </div>
                </div>
                <div>
                  <label className="settings-label">Gradient End</label>
                  <div className="flex gap-2">
                    <input type="color" value={formData.brand.accentGradientTo} onChange={(e) => updateBrand("accentGradientTo", e.target.value)} className="settings-color-input" />
                    <input type="text" value={formData.brand.accentGradientTo} onChange={(e) => updateBrand("accentGradientTo", e.target.value)} className="settings-input flex-1" />
                  </div>
                </div>
              </div>
            </div>

            {/* VoBiz Telephony */}
            <div className="settings-card">
              <h3 className="settings-section-title flex items-center gap-2">
                <Phone className="w-4 h-4 text-zinc-500" /> VoBiz Telephony
              </h3>
              <p className="text-[11px] text-zinc-500 mb-3">Configure your VoBiz account credentials for inbound and outbound calling.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                <div>
                  <label className="settings-label">Auth ID</label>
                  <input type="text" value={formData.vobiz.authId} onChange={(e) => updateVobiz("authId", e.target.value)} className="settings-input font-mono" placeholder="Your VoBiz Auth ID" />
                </div>
                <div>
                  <label className="settings-label">Auth Token</label>
                  <div className="relative">
                    <input
                      type={showVobizToken ? "text" : "password"}
                      value={formData.vobiz.authToken}
                      onChange={(e) => updateVobiz("authToken", e.target.value)}
                      className="settings-input font-mono pr-10"
                      placeholder="Your VoBiz Auth Token"
                    />
                    <button type="button" onClick={() => setShowVobizToken(!showVobizToken)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 cursor-pointer">
                      {showVobizToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label className="settings-label">From Number (with country code)</label>
                  <input type="text" value={formData.vobiz.fromNumber} onChange={(e) => updateVobiz("fromNumber", e.target.value)} className="settings-input font-mono" placeholder="+919876543210" />
                </div>
              </div>
            </div>

            {/* Gemini AI */}
            <div className="settings-card">
              <h3 className="settings-section-title flex items-center gap-2">
                <Cpu className="w-4 h-4 text-zinc-500" /> Gemini AI
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                <div>
                  <label className="settings-label">API Key</label>
                  <div className="relative">
                    <input
                      type={showGeminiKey ? "text" : "password"}
                      value={formData.gemini.apiKey}
                      onChange={(e) => updateGemini("apiKey", e.target.value)}
                      className="settings-input font-mono pr-10"
                      placeholder="Your Gemini API Key"
                    />
                    <button type="button" onClick={() => setShowGeminiKey(!showGeminiKey)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 cursor-pointer">
                      {showGeminiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="settings-label">Model</label>
                  <input type="text" value={formData.gemini.model} onChange={(e) => updateGemini("model", e.target.value)} className="settings-input font-mono" placeholder="gemini-3.1-flash-live-preview" />
                </div>
              </div>
            </div>

            {/* Google Sheets */}
            <div className="settings-card">
              <h3 className="settings-section-title flex items-center gap-2">
                <Database className="w-4 h-4 text-zinc-500" /> Google Sheets Integration
              </h3>
              <div className="mt-3">
                <label className="settings-label">Spreadsheet ID</label>
                <input type="text" value={formData.googleSheets.spreadsheetId} onChange={(e) => updateSheets("spreadsheetId", e.target.value)} className="settings-input font-mono" placeholder="Your Google Sheets Spreadsheet ID" />
                <p className="text-[10px] text-zinc-500 mt-1.5">Used for order data sync. Find this in the Google Sheets URL after /d/</p>
              </div>
            </div>

            {/* Cost & Credits */}
            <div className="settings-card">
              <h3 className="settings-section-title flex items-center gap-2">
                <Coins className="w-4 h-4 text-zinc-500" /> Cost & Credits
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3">
                <div>
                  <label className="settings-label">Cost Per Minute (₹)</label>
                  <input type="number" step="0.1" min="0" value={formData.credits.costPerMinute} onChange={(e) => updateCredits("costPerMinute", parseFloat(e.target.value) || 0)} className="settings-input font-mono" />
                </div>
                <div>
                  <label className="settings-label">Wallet Balance (₹)</label>
                  <input type="number" min="0" value={formData.credits.walletBalance} onChange={(e) => updateCredits("walletBalance", parseFloat(e.target.value) || 0)} className="settings-input font-mono" />
                </div>
                <div>
                  <label className="settings-label">Credits Label</label>
                  <input type="text" value={formData.credits.label} onChange={(e) => updateCredits("label", e.target.value)} className="settings-input" />
                </div>
              </div>
            </div>

            {/* User Profile */}
            <div className="settings-card">
              <h3 className="settings-section-title flex items-center gap-2">
                <User className="w-4 h-4 text-zinc-500" /> User Profile
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                <div>
                  <label className="settings-label">Admin Name</label>
                  <input type="text" value={formData.user.name} onChange={(e) => updateUser("name", e.target.value)} className="settings-input" />
                </div>
                <div>
                  <label className="settings-label">Role</label>
                  <input type="text" value={formData.user.role} onChange={(e) => updateUser("role", e.target.value)} className="settings-input" />
                </div>
                <div className="md:col-span-2">
                  <label className="settings-label">Email Address</label>
                  <input type="email" value={formData.user.email} onChange={(e) => updateUser("email", e.target.value)} className="settings-input" />
                </div>
              </div>
            </div>
          </div>

          {/* ─── Right Column: Feature Flags & Info ─── */}
          <div className="space-y-4">
            {/* Feature Flags */}
            <div className="settings-card">
              <h3 className="settings-section-title flex items-center gap-2">
                <ToggleLeft className="w-4 h-4 text-zinc-500" /> Feature Flags
              </h3>
              <div className="space-y-2.5 mt-4">
                {Object.entries(formData.features).map(([key, val]) => (
                  <div key={key} className="flex items-center justify-between text-xs font-mono">
                    <span className="text-zinc-600 capitalize">{key.replace(/([A-Z])/g, " $1")}</span>
                    <button
                      type="button"
                      onClick={() => toggleFeature(key)}
                      className={`px-2.5 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                        val
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                          : "bg-zinc-100 text-zinc-500 border border-zinc-200 hover:bg-zinc-200"
                      }`}
                    >
                      {val ? "ENABLED" : "DISABLED"}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Platform Info */}
            <div className="settings-card">
              <h3 className="settings-section-title flex items-center gap-2">
                <Shield className="w-4 h-4 text-zinc-500" /> Platform Info
              </h3>
              <div className="space-y-2 mt-3 text-xs font-mono text-zinc-600">
                <div className="flex justify-between">
                  <span>Architecture</span>
                  <span className="text-zinc-900 font-semibold">Single Instance</span>
                </div>
                <div className="flex justify-between">
                  <span>Telephony</span>
                  <span className="text-zinc-900 font-semibold">VoBiz</span>
                </div>
                <div className="flex justify-between">
                  <span>AI Engine</span>
                  <span className="text-zinc-900 font-semibold">Gemini Live</span>
                </div>
                <div className="flex justify-between">
                  <span>Database</span>
                  <span className="text-zinc-900 font-semibold">MongoDB</span>
                </div>
              </div>
            </div>

            {/* Brand Preview */}
            {formData.brand.name && (
              <div className="settings-card">
                <h3 className="settings-section-title">Brand Preview</h3>
                <div className="mt-3 flex items-center gap-3">
                  {formData.brand.logoUrl ? (
                    <img src={formData.brand.logoUrl} alt="Logo" className="max-h-8 max-w-[120px] object-contain" />
                  ) : (
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm"
                      style={{ background: `linear-gradient(135deg, ${formData.brand.accentGradientFrom}, ${formData.brand.accentGradientTo})` }}
                    >
                      {formData.brand.logoInitials || "AI"}
                    </div>
                  )}
                  <div>
                    <div className="text-sm font-semibold text-zinc-900">{formData.brand.name}</div>
                    <div className="text-[10px] text-zinc-500">{formData.brand.tagline}</div>
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <div className="w-8 h-8 rounded-lg" style={{ backgroundColor: formData.brand.accentColor }} title="Accent" />
                  <div className="w-8 h-8 rounded-lg" style={{ backgroundColor: formData.brand.accentColorLight }} title="Accent Light" />
                  <div className="w-8 h-8 rounded-lg" style={{ background: `linear-gradient(135deg, ${formData.brand.accentGradientFrom}, ${formData.brand.accentGradientTo})` }} title="Gradient" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Save Button */}
        <div className="flex items-center justify-between pt-4 border-t border-zinc-200">
          {message && (
            <p className={`text-xs font-mono flex items-center gap-1.5 ${message.startsWith("Error") ? "text-red-600" : "text-emerald-600"}`}>
              {!message.startsWith("Error") && <CheckCircle className="w-3.5 h-3.5" />}
              {message}
            </p>
          )}
          <button
            type="submit"
            disabled={saving}
            className="settings-save-btn ml-auto bg-zinc-950 hover:bg-zinc-900 text-white"
          >
            {saving ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>{saving ? "Saving..." : "Save Settings"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
