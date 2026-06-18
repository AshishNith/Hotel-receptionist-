import React from "react";
import { useClientConfig } from "../../config/ThemeProvider";
import { Megaphone, Plus, ArrowUpRight, Clock, BarChart3 } from "lucide-react";

export function CampaignsPage() {
  const config = useClientConfig();

  return (
    <div className="placeholder-page">
      <div className="placeholder-header">
        <h2 className="placeholder-title">Campaigns</h2>
        <button
          className="placeholder-action-btn"
          style={{
            background: `linear-gradient(135deg, ${config.brand.accentGradientFrom}, ${config.brand.accentGradientTo})`,
          }}
        >
          <Plus className="w-4 h-4" />
          New Campaign
        </button>
      </div>

      <div className="placeholder-stats-row">
        <div className="placeholder-stat-card">
          <Megaphone className="w-5 h-5" style={{ color: config.brand.accentColor }} />
          <div>
            <span className="placeholder-stat-value">0</span>
            <span className="placeholder-stat-label">Active Campaigns</span>
          </div>
        </div>
        <div className="placeholder-stat-card">
          <BarChart3 className="w-5 h-5 text-cyan-400" />
          <div>
            <span className="placeholder-stat-value">0%</span>
            <span className="placeholder-stat-label">Avg. Pick-up Rate</span>
          </div>
        </div>
        <div className="placeholder-stat-card">
          <Clock className="w-5 h-5 text-violet-400" />
          <div>
            <span className="placeholder-stat-value">—</span>
            <span className="placeholder-stat-label">Last Campaign</span>
          </div>
        </div>
      </div>

      <div className="placeholder-empty">
        <div className="placeholder-empty-icon" style={{ borderColor: `${config.brand.accentColor}20` }}>
          <Megaphone className="w-10 h-10" style={{ color: `${config.brand.accentColor}60` }} />
        </div>
        <h3 className="placeholder-empty-title">No campaigns yet</h3>
        <p className="placeholder-empty-desc">
          Create your first outbound calling campaign to auto-dial a list of contacts with your AI agent.
        </p>
        <button
          className="placeholder-empty-btn"
          style={{
            background: `linear-gradient(135deg, ${config.brand.accentGradientFrom}, ${config.brand.accentGradientTo})`,
          }}
        >
          <ArrowUpRight className="w-4 h-4" />
          Create Campaign
        </button>
      </div>
    </div>
  );
}
