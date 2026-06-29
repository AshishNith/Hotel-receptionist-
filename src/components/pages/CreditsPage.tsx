import React, { useState, useEffect, useCallback } from "react";
import { useClientConfig } from "../../config/ThemeProvider";
import { Coins, FileText, RefreshCw, BarChart3, Clock, ArrowUpRight, ShieldCheck } from "lucide-react";

interface AnalyticsStats {
  totalCalls: number;
  totalDurationSeconds: number;
  avgDurationSeconds: number;
  apiConsumption: number;
  walletBalance: number;
  avgCostPerCall: string;
  callsByPersona: Record<string, number>;
}

interface CallRecord {
  callId: string;
  personaName: string;
  callerNumber: string;
  provider: string;
  direction: string;
  status: string;
  startedAt: string;
  durationSeconds?: number;
}

interface SettingsData {
  credits: {
    costPerMinute: number;
    walletBalance: number;
    label: string;
  };
}

export function CreditsPage() {
  const config = useClientConfig();
  const [stats, setStats] = useState<AnalyticsStats | null>(null);
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setRefreshing(true);
      const [statsRes, callsRes, settingsRes] = await Promise.all([
        fetch("/api/analytics/stats"),
        fetch("/api/analytics/calls?limit=10"),
        fetch("/api/settings")
      ]);

      const [statsJson, callsJson, settingsJson] = await Promise.all([
        statsRes.json(),
        callsRes.json(),
        settingsRes.json()
      ]);

      if (statsJson.success) setStats(statsJson.data);
      if (callsJson.success) setCalls(callsJson.data);
      if (settingsJson.success) setSettings(settingsJson.data);
    } catch (err) {
      console.error("Error fetching billing/credits data:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const formatCurrency = (n: number) => {
    return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDuration = (seconds?: number) => {
    if (seconds === undefined || seconds === null) return "0s";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="w-6 h-6 animate-spin text-zinc-400 mr-3" />
        <span className="text-sm font-mono text-zinc-500">Loading billing details...</span>
      </div>
    );
  }

  const costPerMinute = settings?.credits?.costPerMinute ?? 1.5;
  const walletBalance = stats?.walletBalance ?? settings?.credits?.walletBalance ?? 100000;
  const apiConsumption = stats?.apiConsumption ?? 0;
  const totalCalls = stats?.totalCalls ?? 0;
  const totalDuration = stats?.totalDurationSeconds ?? 0;
  
  return (
    <div className="placeholder-page">
      <div className="placeholder-header flex items-center justify-between">
        <div>
          <h2 className="placeholder-title flex items-center gap-2">
            <Coins className="w-6 h-6" style={{ color: config.brand.accentColor }} />
            Billing & Credits
          </h2>
          <p className="text-xs text-zinc-500 font-mono tracking-wider mt-1 uppercase">
            Track real usage metrics and API consumption costs
          </p>
        </div>
        <button
          onClick={fetchData}
          disabled={refreshing}
          className="p-2 border border-zinc-200 bg-white hover:bg-zinc-50 rounded-xl text-zinc-500 hover:text-zinc-900 transition flex items-center gap-1.5 cursor-pointer text-xs font-mono"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Credit Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        
        {/* Wallet Balance */}
        <div className="credits-overview-card bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm relative overflow-hidden" style={{ borderLeft: `4px solid ${config.brand.accentColor}` }}>
          <span className="credits-overview-label block text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-1">
            Wallet Balance
          </span>
          <h3 className="credits-overview-value text-2xl font-bold font-mono" style={{ color: config.brand.accentColor }}>
            {formatCurrency(walletBalance)}
          </h3>
          <p className="text-[10px] text-zinc-400 mt-2 font-mono uppercase">
            Credits Label: {settings?.credits?.label || "INR"}
          </p>
        </div>

        {/* Cost Rate */}
        <div className="credits-overview-card bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm" style={{ borderLeft: `4px solid ${config.brand.accentColorLight || "#6366f1"}` }}>
          <span className="credits-overview-label block text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-1">
            Call Billing Rate
          </span>
          <h3 className="credits-overview-value text-2xl font-bold font-mono text-zinc-900">
            {formatCurrency(costPerMinute)} <span className="text-xs font-normal text-zinc-500">/ min</span>
          </h3>
          <p className="text-[10px] text-zinc-400 mt-2 font-serif italic">
            Calculated proportionally down to the second of active call time.
          </p>
        </div>

        {/* Used Credits */}
        <div className="credits-overview-card bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm" style={{ borderLeft: "4px solid #f43f5e" }}>
          <span className="credits-overview-label block text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-1">
            Total Spent (Consumption)
          </span>
          <h3 className="credits-overview-value text-2xl font-bold font-mono text-zinc-900">
            {formatCurrency(apiConsumption)}
          </h3>
          <p className="text-[10px] text-zinc-400 mt-2 font-mono uppercase">
            Across {totalCalls} total calls ({formatDuration(totalDuration)})
          </p>
        </div>

      </div>

      {/* Grid Layout: Usage breakdown and Ledger */}
      <div className="credits-grid grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left: Persona Usage Breakdown */}
        <div className="lg:col-span-1 space-y-4">
          <h3 className="credits-section-title text-xs font-mono uppercase tracking-widest text-zinc-500 flex items-center gap-1.5">
            <BarChart3 className="w-4 h-4 text-zinc-650" />
            Consumption by Persona
          </h3>

          <div className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-sm space-y-4">
            {stats && Object.keys(stats.callsByPersona).length > 0 ? (
              <div className="divide-y divide-zinc-200">
                {Object.entries(stats.callsByPersona).map(([personaName, count]) => {
                  // We don't have the exact duration per persona from backend aggregates,
                  // but we can show the call count, and estimate. Or just show the call counts.
                  return (
                    <div key={personaName} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-zinc-950 font-mono">{personaName}</span>
                        <p className="text-[10px] text-zinc-500 mt-0.5">{count} {count === 1 ? "call" : "calls"} made</p>
                      </div>
                      <div className="bg-zinc-50 border border-zinc-200 px-2.5 py-1 rounded-xl text-[10px] font-mono text-zinc-700 font-bold">
                        {count} calls
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-zinc-400 text-xs">
                No persona calls recorded yet.
              </div>
            )}
            
            <div className="border-t border-zinc-150 pt-4 bg-zinc-50/50 -mx-4 -mb-4 p-4 rounded-b-2xl">
              <h4 className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-2 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Billing System Info
              </h4>
              <p className="text-[10px] text-zinc-500 leading-relaxed">
                Billing records are automatically created in the database at the end of each session. There are no monthly base fees.
              </p>
            </div>
          </div>
        </div>

        {/* Right: Transactions Ledger */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="credits-section-title text-xs font-mono uppercase tracking-widest text-zinc-500 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-zinc-650" />
              Transaction Ledger (Call Logs)
            </span>
            <span className="text-[9px] text-zinc-400 font-normal">
              Showing recent {calls.length} entries
            </span>
          </h3>

          <div className="bg-white border border-zinc-200 rounded-2xl p-4 divide-y divide-zinc-250 shadow-sm overflow-hidden">
            {calls.length > 0 ? (
              <div className="divide-y divide-zinc-200">
                {calls.map((c) => {
                  const duration = c.durationSeconds || 0;
                  const cost = duration * (costPerMinute / 60);
                  const isOutbound = c.direction === "outbound";
                  const directionLabel = isOutbound ? "Outbound Call" : "Inbound Call";
                  
                  return (
                    <div key={c.callId} className="flex items-start justify-between py-3.5 first:pt-0 last:pb-0">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono uppercase font-bold ${
                            isOutbound 
                              ? "bg-indigo-50 text-indigo-700 border border-indigo-100" 
                              : "bg-emerald-50 text-emerald-700 border border-emerald-100"
                          }`}>
                            {c.direction}
                          </span>
                          <h5 className="text-xs font-bold text-zinc-900">
                            {directionLabel} to {c.callerNumber || "Unknown Number"}
                          </h5>
                        </div>
                        <p className="text-[10px] text-zinc-500 font-mono">
                          {c.personaName || "Unknown Persona"} · ID: {c.callId} · {formatDate(c.startedAt)}
                        </p>
                      </div>
                      
                      <div className="text-right">
                        <span className="text-xs font-mono font-bold text-zinc-900">
                          -{formatCurrency(cost)}
                        </span>
                        <div className="flex items-center gap-1 justify-end mt-0.5">
                          <Clock className="w-2.5 h-2.5 text-zinc-400" />
                          <span className="text-[10px] font-mono text-zinc-500">{formatDuration(duration)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12 text-zinc-400 text-xs">
                No transactions recorded yet. Completed calls will appear here automatically.
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
