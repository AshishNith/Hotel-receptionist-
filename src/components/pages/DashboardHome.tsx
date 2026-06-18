import React, { useState, useEffect, useCallback } from "react";
import { useClientConfig } from "../../config/ThemeProvider";
import type { AnalyticsStats } from "../../types";
import {
  Users,
  PhoneCall,
  Coins,
  Phone,
  ArrowUpRight,
  Activity,
  TrendingUp,
  Loader2,
} from "lucide-react";

interface DashboardHomeProps {
  onPlaceCall?: (phoneNumber: string) => void;
}

export function DashboardHome({ onPlaceCall }: DashboardHomeProps) {
  const config = useClientConfig();
  const [stats, setStats] = useState<AnalyticsStats | null>(null);
  const [phoneNumber, setPhoneNumber] = useState("8002825353");
  const [calling, setCalling] = useState(false);
  const [callError, setCallError] = useState("");

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/analytics/stats");
      const json = await res.json();
      if (json.success) setStats(json.data);
    } catch (err) {
      console.error("Failed to fetch dashboard stats:", err);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  const handleCall = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber.trim()) return;

    setCalling(true);
    setCallError("");

    let formatted = phoneNumber.trim();
    if (!formatted.startsWith("+")) {
      formatted = "+91" + formatted.replace(/^0+/, "");
    }

    try {
      const res = await fetch("/api/outbound/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toNumber: formatted, personaId: "diya" }),
      });
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || "Failed to initiate call");
      }
      if (onPlaceCall) onPlaceCall(formatted);
    } catch (err: any) {
      setCallError(err?.message || "Call failed");
    } finally {
      setCalling(false);
    }
  };

  const activeAgents = stats ? Object.keys(stats.callsByPersona || {}).length : 0;

  return (
    <div className="dashboard-home">
      {/* Page Title */}
      <div className="dashboard-home-header">
        <h2 className="dashboard-home-title">Dashboard</h2>
      </div>

      {/* ─── Metric Cards ─── */}
      <div className="metric-cards-grid">
        <MetricCard
          icon={<Users className="w-5 h-5" />}
          label="Active agents"
          value={activeAgents > 0 ? activeAgents.toString() : "—"}
          trend={activeAgents > 0 ? `${activeAgents} configured` : undefined}
          accentColor={config.brand.accentColor}
        />
        <MetricCard
          icon={<PhoneCall className="w-5 h-5" />}
          label="Calls today"
          value={stats?.callsToday != null ? stats.callsToday.toString() : "—"}
          trend={stats?.totalCalls ? `${stats.totalCalls} total` : undefined}
          accentColor="#06b6d4"
        />
        <MetricCard
          icon={<Coins className="w-5 h-5" />}
          label="Credits remaining"
          value={config.credits.total > 0 ? formatCreditsDisplay(config.credits.total - config.credits.used) : "—"}
          trend="View ledger"
          accentColor="#8b5cf6"
        />
      </div>

      {/* ─── Place a Call Widget ─── */}
      <div className="call-widget">
        <div className="call-widget-header">
          <div className="call-widget-icon" style={{ background: `linear-gradient(135deg, ${config.brand.accentGradientFrom}, ${config.brand.accentGradientTo})` }}>
            <Phone className="w-4 h-4 text-white" />
          </div>
          <h3 className="call-widget-title">Place a call</h3>
        </div>
        <p className="call-widget-desc">
          Enter a number and the {config.brand.name} AI agent will call it. For India, enter the 10-digit number (e.g. 8002825353).
        </p>
        <form onSubmit={handleCall} className="call-widget-form">
          <div className="call-widget-input-wrap">
            <input
              type="text"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="8002825353"
              className="call-widget-input"
              disabled={calling}
            />
            <button
              type="submit"
              disabled={!phoneNumber.trim() || calling}
              className="call-widget-btn bg-zinc-950 text-white hover:bg-zinc-900 cursor-pointer"
            >
              {calling ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : "Call me"}
            </button>
          </div>
          {callError && <p className="call-widget-error">{callError}</p>}
        </form>
      </div>

      {/* ─── Live Metrics Status ─── */}
      <div className="live-metrics-status">
        <Activity className="w-4 h-4" style={{ color: config.brand.accentColor }} />
        <span>
          {stats && stats.totalCalls > 0
            ? `${stats.totalCalls} calls tracked · Avg duration ${formatDuration(stats.avgDurationSeconds)} · ${stats.callsToday} today`
            : "Live metrics arrive once Stream S1 ships the calls/campaign data."}
        </span>
      </div>

      {/* ─── Quick Stats Bar (30-day trend) ─── */}
      {stats && stats.callsByDay && stats.callsByDay.length > 0 && (
        <div className="quick-stats-section">
          <div className="quick-stats-header">
            <TrendingUp className="w-4 h-4" style={{ color: config.brand.accentColor }} />
            <span>30-Day Call Volume</span>
          </div>
          <div className="quick-stats-chart">
            {stats.callsByDay.map((d) => {
              const max = Math.max(...stats.callsByDay.map((x) => x.count), 1);
              const height = Math.max(4, (d.count / max) * 100);
              return (
                <div key={d.date} className="quick-stats-bar-wrap group">
                  <div
                    className="quick-stats-bar"
                    style={{
                      height: `${height}%`,
                      background: `linear-gradient(180deg, ${config.brand.accentColor}, ${config.brand.accentGradientTo})`,
                    }}
                  />
                  <div className="quick-stats-tooltip">
                    {d.date}: {d.count}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────

function MetricCard({
  icon,
  label,
  value,
  trend,
  accentColor,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  trend?: string;
  accentColor: string;
}) {
  return (
    <div className="metric-card">
      <div className="metric-card-top">
        <span className="metric-card-label">{label}</span>
        <span className="metric-card-icon" style={{ color: accentColor }}>
          {icon}
        </span>
      </div>
      <div className="metric-card-value">{value}</div>
      {trend && (
        <div className="metric-card-trend">
          <ArrowUpRight className="w-3 h-3" />
          <span>{trend}</span>
        </div>
      )}
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────

function formatCreditsDisplay(n: number): string {
  if (n >= 1000000) return (n / 100000).toFixed(0).replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "0,000";
  return n.toLocaleString("en-IN");
}

function formatDuration(sec: number | undefined): string {
  if (!sec || sec <= 0) return "0s";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}
