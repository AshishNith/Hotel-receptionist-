import React, { useState } from "react";
import { useClientConfig } from "../../config/ThemeProvider";
import { Settings, Shield, Palette, LayoutGrid, User, Sliders, Save, RefreshCw } from "lucide-react";

export function SettingsPage() {
  const config = useClientConfig();
  const [formData, setFormData] = useState({
    brandName: config.brand.name,
    tagline: config.brand.tagline,
    accentColor: config.brand.accentColor,
    userName: config.user.name,
    userRole: config.user.role,
    userEmail: config.user.email || "",
  });

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    // Simulate saving settings (since config is client-side state)
    setTimeout(() => {
      setSaving(false);
      setMessage("Settings updated locally! To make these changes permanent, update src/config/clientConfig.ts.");
    }, 800);
  };

  return (
    <div className="placeholder-page">
      <div className="placeholder-header">
        <h2 className="placeholder-title flex items-center gap-2">
          <Settings className="w-6 h-6 text-zinc-900" />
          System Settings
        </h2>
      </div>

      <div className="settings-grid">
        {/* Left Column: Form */}
        <div className="settings-card col-span-2">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Branding Section */}
            <div className="settings-section">
              <h3 className="settings-section-title flex items-center gap-2">
                <Palette className="w-4 h-4 text-zinc-500" /> Branding & Theme
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                <div>
                  <label className="settings-label">Platform Name</label>
                  <input
                    type="text"
                    value={formData.brandName}
                    onChange={(e) => setFormData({ ...formData, brandName: e.target.value })}
                    className="settings-input"
                  />
                </div>
                <div>
                  <label className="settings-label">Platform Tagline</label>
                  <input
                    type="text"
                    value={formData.tagline}
                    onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
                    className="settings-input"
                  />
                </div>
                <div>
                  <label className="settings-label">Accent Theme Color</label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={formData.accentColor}
                      onChange={(e) => setFormData({ ...formData, accentColor: e.target.value })}
                      className="settings-color-input"
                    />
                    <input
                      type="text"
                      value={formData.accentColor}
                      onChange={(e) => setFormData({ ...formData, accentColor: e.target.value })}
                      className="settings-input flex-1"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Profile Section */}
            <div className="settings-section">
              <h3 className="settings-section-title flex items-center gap-2">
                <User className="w-4 h-4 text-zinc-500" /> User Profile
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                <div>
                  <label className="settings-label">Admin Name</label>
                  <input
                    type="text"
                    value={formData.userName}
                    onChange={(e) => setFormData({ ...formData, userName: e.target.value })}
                    className="settings-input"
                  />
                </div>
                <div>
                  <label className="settings-label">Access Role</label>
                  <input
                    type="text"
                    value={formData.userRole}
                    onChange={(e) => setFormData({ ...formData, userRole: e.target.value })}
                    className="settings-input"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="settings-label">Email Address</label>
                  <input
                    type="email"
                    value={formData.userEmail}
                    onChange={(e) => setFormData({ ...formData, userEmail: e.target.value })}
                    className="settings-input"
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-zinc-200">
              {message && <p className="text-xs text-emerald-600 font-mono">{message}</p>}
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
                <span>Save Settings</span>
              </button>
            </div>
          </form>
        </div>

        {/* Right Column: Metadata / Feature Flags Info */}
        <div className="space-y-4">
          <div className="settings-card">
            <h3 className="settings-section-title flex items-center gap-2">
              <LayoutGrid className="w-4 h-4 text-zinc-500" /> Active Features
            </h3>
            <div className="space-y-2.5 mt-4">
              {Object.entries(config.features).map(([key, val]) => (
                <div key={key} className="flex items-center justify-between text-xs font-mono">
                  <span className="text-zinc-600 capitalize">{key.replace(/([A-Z])/g, " $1")}</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      val
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : "bg-zinc-100 text-zinc-500 border border-zinc-200"
                    }`}
                  >
                    {val ? "ENABLED" : "DISABLED"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="settings-card">
            <h3 className="settings-section-title flex items-center gap-2">
              <Shield className="w-4 h-4 text-zinc-500" /> White-Label Readiness
            </h3>
            <p className="text-xs text-zinc-600 leading-relaxed mt-2.5">
              This system is fully modular. To deploy for a new client, duplicate the codebase or inject standard environment variables matching the keys in <code className="text-zinc-800 font-mono bg-zinc-50 border border-zinc-200 px-1 py-0.5 rounded">clientConfig.ts</code>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
