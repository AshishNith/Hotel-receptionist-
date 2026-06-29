import React, { useState, useEffect, useCallback } from "react";
import { useClientConfig } from "../../config/ThemeProvider";
import type { AnalyticsStats, CallLogEntry } from "../../types";
import {
  Users,
  PhoneCall,
  Coins,
  Phone,
  ArrowUpRight,
  Activity,
  TrendingUp,
  Loader2,
  Shield,
  CheckCircle,
  MessageSquare,
  Wallet,
  Clock
} from "lucide-react";

interface DashboardHomeProps {
  onPlaceCall?: (phoneNumber: string) => void;
}

export function DashboardHome({ onPlaceCall }: DashboardHomeProps) {
  const config = useClientConfig();
  const [stats, setStats] = useState<any>(null);
  const [recentCalls, setRecentCalls] = useState<CallLogEntry[]>([]);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [calling, setCalling] = useState(false);
  const [callError, setCallError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [loadingFeed, setLoadingFeed] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/analytics/stats");
      const json = await res.json();
      if (json.success) setStats(json.data);
    } catch (err) {
      console.error("Failed to fetch dashboard stats:", err);
    }
  }, []);

  const fetchRecentCalls = useCallback(async () => {
    try {
      setLoadingFeed(true);
      const res = await fetch("/api/analytics/calls?page=1&limit=5");
      const json = await res.json();
      if (json.success && json.data) {
        setRecentCalls(json.data);
      }
    } catch (err) {
      console.error("Failed to fetch recent calls for feed:", err);
    } finally {
      setLoadingFeed(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    fetchRecentCalls();
    const interval = setInterval(() => {
      fetchStats();
      fetchRecentCalls();
    }, 20000);
    return () => clearInterval(interval);
  }, [fetchStats, fetchRecentCalls]);

  const handleCall = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber.trim()) return;

    setCalling(true);
    setCallError("");
    setSuccessMessage("");

    let formatted = phoneNumber.trim();
    if (!formatted.startsWith("+")) {
      formatted = "+91" + formatted.replace(/^0+/, "");
    }

    try {
      const res = await fetch("/api/outbound/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toNumber: formatted, personaId: "order_confirm" }),
      });
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || "Failed to initiate call");
      }
      setSuccessMessage(`Outbound call initiated to ${formatted}. ID: ${json.callId}`);
      setPhoneNumber("");
      fetchRecentCalls();
      fetchStats();
      if (onPlaceCall) onPlaceCall(formatted);
    } catch (err: any) {
      setCallError(err?.message || "Call failed");
    } finally {
      setCalling(false);
    }
  };

  const activeAgents = stats ? Object.keys(stats.callsByPersona || {}).length : 4;

  return (
    <div className="dashboard-home space-y-6">
      {/* Page Title */}
      <div className="dashboard-home-header">
        <h2 className="text-2xl font-semibold tracking-tight text-zinc-900">Dashboard Overview</h2>
        <p className="text-xs text-zinc-500 font-mono tracking-wider mt-1 uppercase">
          {config.brand.tagline || "AI Call Automation Metrics"}
        </p>
      </div>

      {/* ─── Metric Cards Grid ─── */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <MetricCard
          icon={<PhoneCall className="w-5 h-5" />}
          label="Total Calls"
          value={stats?.totalCalls != null ? stats.totalCalls.toString() : "0"}
          trend={stats?.callsToday != null ? `+${stats.callsToday} today` : undefined}
          accentColor={config.brand.accentColor}
        />
        <MetricCard
          icon={<Activity className="w-5 h-5" />}
          label="Avg Answer Rate"
          value={stats?.answerRate != null ? `${stats.answerRate}%` : "—"}
          trend="Target: >80%"
          accentColor="#06b6d4"
        />
        <MetricCard
          icon={<CheckCircle className="w-5 h-5" />}
          label="COD Confirmations"
          value={stats?.codConfirmedCount != null ? stats.codConfirmedCount.toString() : "0"}
          trend={stats?.codCancelledCount != null ? `${stats.codCancelledCount} cancelled` : undefined}
          accentColor="#10b981"
        />
        <MetricCard
          icon={<Coins className="w-5 h-5" />}
          label="Revenue Recovered"
          value={stats?.revenueRecovered != null ? `₹${stats.revenueRecovered.toLocaleString("en-IN")}` : "₹0"}
          trend="Cart Recovery"
          accentColor="#8b5cf6"
        />
        <MetricCard
          icon={<Shield className="w-5 h-5" />}
          label="RTO Expenses Saved"
          value={stats?.rtoSaved != null ? `₹${stats.rtoSaved.toLocaleString("en-IN")}` : "₹0"}
          trend="₹150 saved/call"
          accentColor="#f59e0b"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Cost Analytics & Test Dialer */}
        <div className="lg:col-span-6 space-y-6">
          {/* Cost Analytics */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h3 className="text-sm font-mono uppercase tracking-widest text-zinc-500 mb-4 flex items-center gap-2">
              <Wallet className="w-4 h-4 text-indigo-600" />
              Cost Analytics
            </h3>
            <div className="grid grid-cols-3 gap-4 border-b border-zinc-100 pb-4 mb-4 font-mono">
              <div>
                <span className="text-[10px] text-zinc-500 block uppercase">Wallet Balance</span>
                <span className="text-lg font-bold text-zinc-900 mt-1 block">
                  {stats?.walletBalance != null ? `₹${stats.walletBalance.toLocaleString("en-IN")}` : "₹1,00,000"}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-zinc-500 block uppercase">API Consumption</span>
                <span className="text-lg font-bold text-zinc-600 mt-1 block">
                  {stats?.apiConsumption != null ? `₹${stats.apiConsumption}` : "₹0"}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-zinc-500 block uppercase">Avg Cost/Call</span>
                <span className="text-lg font-bold text-zinc-600 mt-1 block">
                  {stats?.avgCostPerCall != null ? `₹${stats.avgCostPerCall}` : "₹0.00"}
                </span>
              </div>
            </div>
            <p className="text-[10px] text-zinc-500 font-serif italic leading-relaxed">
              Usage costs are computed from call duration × configured rate per minute. View and manage billing settings in the Settings page.
            </p>
          </div>

          {/* Place a Call Widget */}
          <div className="call-widget rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className="call-widget-icon w-8 h-8 rounded-xl bg-zinc-950 flex items-center justify-center">
                <Phone className="w-4 h-4 text-white" />
              </div>
              <h3 className="text-sm font-mono uppercase tracking-widest text-zinc-850">Place a Test Customer Call</h3>
            </div>
            <p className="text-xs text-zinc-500 leading-normal mb-4">
              Enter a phone number to trigger a test outbound call using the <strong>Order Confirmation Agent</strong>.
            </p>
            <form onSubmit={handleCall} className="call-widget-form">
              <div className="call-widget-input-wrap flex gap-2">
                <input
                  type="text"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="9876543210"
                  className="flex-1 bg-white border border-zinc-200 rounded-xl px-4 py-3 text-sm font-mono text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-950"
                  disabled={calling}
                />
                <button
                  type="submit"
                  disabled={!phoneNumber.trim() || calling}
                  className="px-5 py-3 bg-zinc-950 text-white rounded-xl text-xs font-mono uppercase tracking-widest font-bold cursor-pointer hover:bg-zinc-900 flex items-center justify-center min-w-[100px]"
                >
                  {calling ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : "Dial Customer"}
                </button>
              </div>
              {callError && <p className="text-xs text-red-500 mt-2 font-mono">{callError}</p>}
              {successMessage && <p className="text-xs text-emerald-600 mt-2 font-mono">{successMessage}</p>}
            </form>
          </div>
        </div>

        {/* Right Column: Scrolling Live Outcomes Feed */}
        <div className="lg:col-span-6">
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm h-full flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-mono uppercase tracking-widest text-zinc-500 mb-4 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-emerald-600" />
                Live Call Outcomes Feed
              </h3>
              
              <div className="space-y-4 max-h-[320px] overflow-y-auto pr-2 custom-scrollbar">
                {loadingFeed && recentCalls.length === 0 ? (
                  <div className="flex items-center justify-center py-10 text-zinc-400 text-xs font-mono">
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Fetching outcomes...
                  </div>
                ) : recentCalls.length === 0 ? (
                  <div className="text-center py-10 text-zinc-400 text-xs font-mono italic">
                    Waiting for call outcomes...
                  </div>
                ) : (
                  recentCalls.map((call) => (
                    <div key={call.callId} className="p-3 bg-zinc-50 border border-zinc-150 rounded-xl space-y-1.5 transition duration-200 hover:border-zinc-250">
                      <div className="flex items-center justify-between text-[10px] font-mono">
                        <span className="font-bold text-zinc-800">{call.personaName}</span>
                        <span className="text-zinc-500">{new Date(call.startedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-zinc-650 font-mono">{call.callerNumber}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono uppercase border ${
                          call.status === "completed" 
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-amber-50 text-amber-700 border-amber-200"
                        }`}>
                          {call.status}
                        </span>
                      </div>
                      {call.summary && (
                        <p className="text-[10px] text-zinc-500 font-serif leading-relaxed line-clamp-2 italic pt-1 border-t border-zinc-100">
                          {call.summary.replace(/GUEST_STATUS: \w+/g, "").replace(/ORDER_STATUS: \w+/g, "")}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-400 uppercase tracking-widest pt-4 border-t border-zinc-100 mt-4">
              <Clock className="w-3.5 h-3.5 text-zinc-400" />
              <span>Real-time Syncing Active</span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── 30-Day Call Volume Chart ─── */}
      {stats && stats.callsByDay && stats.callsByDay.length > 0 && (
        <div className="quick-stats-section border border-zinc-200 bg-white p-6 rounded-2xl">
          <div className="quick-stats-header mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-indigo-600" />
            <span className="text-sm font-mono uppercase tracking-widest text-zinc-700">30-Day Call Volume</span>
          </div>
          <div className="quick-stats-chart flex items-end justify-between h-28 pt-2">
            {stats.callsByDay.map((d: any) => {
              const max = Math.max(...stats.callsByDay.map((x: any) => x.count), 1);
              const height = Math.max(4, (d.count / max) * 100);
              return (
                <div key={d.date} className="quick-stats-bar-wrap group flex-1 flex flex-col items-center relative">
                  <div
                    className="quick-stats-bar w-3 rounded-t-sm transition-all duration-300 group-hover:opacity-80"
                    style={{
                      height: `${height}%`,
                      background: `linear-gradient(180deg, ${config.brand.accentColor}, ${config.brand.accentColorLight})`,
                    }}
                  />
                  <div className="quick-stats-tooltip absolute bottom-full mb-1 bg-zinc-950 text-white text-[9px] font-mono rounded px-1.5 py-0.5 opacity-0 group-hover:opacity-100 pointer-events-none transition duration-150 whitespace-nowrap shadow z-50">
                    {d.date}: {d.count} calls
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

// ─── Metric Card Sub-component ───

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
    <div className="metric-card bg-white border border-zinc-200 rounded-2xl p-4 shadow-sm hover:border-zinc-350 transition duration-200">
      <div className="metric-card-top flex items-center justify-between mb-1.5">
        <span className="metric-card-label text-[10px] font-mono text-zinc-500 uppercase tracking-wider">{label}</span>
        <span className="metric-card-icon" style={{ color: accentColor }}>
          {icon}
        </span>
      </div>
      <div className="metric-card-value text-xl font-bold text-zinc-900 tracking-tight">{value}</div>
      {trend && (
        <div className="metric-card-trend flex items-center gap-1 text-[10px] text-zinc-500 font-mono mt-1">
          <ArrowUpRight className="w-3 h-3 text-zinc-400" />
          <span>{trend}</span>
        </div>
      )}
    </div>
  );
}
