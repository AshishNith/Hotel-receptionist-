import React, { useState, useEffect, useCallback } from "react";
import type { CallLogEntry, CallLogDetail, AnalyticsStats } from "../types";
import {
  PhoneCall, Clock, TrendingUp, Users, BarChart3,
  ChevronLeft, ChevronRight, X, Phone, PhoneOff,
  Monitor, Radio, Wifi, ArrowDownUp, Trash2, Eye,
  Calendar, MessageSquare, Wrench, Volume2,
} from "lucide-react";

function formatDuration(sec: number | undefined): string {
  if (!sec || sec <= 0) return "0s";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

const statusColors: Record<string, string> = {
  completed: "text-emerald-400 bg-emerald-500/15",
  connected: "text-cyan-400 bg-cyan-500/15",
  ringing: "text-amber-400 bg-amber-500/15",
  failed: "text-red-400 bg-red-500/15",
  missed: "text-zinc-400 bg-zinc-500/15",
};

const providerIcons: Record<string, React.ReactNode> = {
  browser: <Monitor className="w-3 h-3" />,
  twilio: <Phone className="w-3 h-3" />,
  vobiz: <Wifi className="w-3 h-3" />,
};

export const AnalyticsDashboard: React.FC = () => {
  const [stats, setStats] = useState<AnalyticsStats | null>(null);
  const [calls, setCalls] = useState<CallLogEntry[]>([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [selectedCall, setSelectedCall] = useState<CallLogDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/analytics/stats");
      const json = await res.json();
      if (json.success) setStats(json.data);
    } catch (err) {
      console.error("Failed to fetch stats:", err);
    }
  }, []);

  const fetchCalls = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/analytics/calls?page=${page}&limit=15`);
      const json = await res.json();
      if (json.success) {
        setCalls(json.data);
        setPagination(json.pagination);
      }
    } catch (err) {
      setError("Failed to load call history.");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCallDetail = async (callId: string) => {
    try {
      const res = await fetch(`/api/analytics/calls/${callId}`);
      const json = await res.json();
      if (json.success) setSelectedCall(json.data);
    } catch (err) {
      console.error("Failed to fetch call detail:", err);
    }
  };

  const deleteCall = async (callId: string) => {
    if (!confirm("Delete this call log?")) return;
    try {
      await fetch(`/api/analytics/calls/${callId}`, { method: "DELETE" });
      fetchCalls(pagination.page);
      fetchStats();
      if (selectedCall?.callId === callId) setSelectedCall(null);
    } catch (err) {
      console.error("Failed to delete call:", err);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchCalls(1);
  }, [fetchStats, fetchCalls]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchStats();
      fetchCalls(pagination.page);
    }, 30000);
    return () => clearInterval(interval);
  }, [pagination.page, fetchStats, fetchCalls]);

  return (
    <div className="space-y-4">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={<PhoneCall className="w-4 h-4 text-emerald-400" />} label="Total Calls" value={stats?.totalCalls?.toString() || "0"} accent="emerald" />
        <StatCard icon={<Clock className="w-4 h-4 text-cyan-400" />} label="Avg Duration" value={formatDuration(stats?.avgDurationSeconds)} accent="cyan" />
        <StatCard icon={<TrendingUp className="w-4 h-4 text-amber-400" />} label="Today" value={stats?.callsToday?.toString() || "0"} accent="amber" />
        <StatCard icon={<Users className="w-4 h-4 text-violet-400" />} label="Total Time" value={formatDuration(stats?.totalDurationSeconds)} accent="violet" />
      </div>

      {/* Charts */}
      {stats && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="lg:col-span-2 bg-white/[0.02] backdrop-blur-2xl border border-white/5 rounded-xl p-4">
            <h4 className="text-[9px] font-semibold tracking-[0.2em] text-zinc-500 uppercase mb-3 flex items-center gap-1.5">
              <BarChart3 className="w-3 h-3 text-cyan-400" /> Calls Per Day (30d)
            </h4>
            <MiniBarChart data={stats.callsByDay} />
          </div>
          <div className="bg-white/[0.02] backdrop-blur-2xl border border-white/5 rounded-xl p-4">
            <h4 className="text-[9px] font-semibold tracking-[0.2em] text-zinc-500 uppercase mb-3 flex items-center gap-1.5">
              <Radio className="w-3 h-3 text-amber-400" /> By Provider
            </h4>
            <div className="space-y-2 mb-4">
              {Object.entries(stats.callsByProvider || {}).map(([provider, count]) => (
                <div key={provider} className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs text-zinc-300">
                    {providerIcons[provider] || <ArrowDownUp className="w-3 h-3" />}
                    <span className="capitalize text-[11px]">{provider}</span>
                  </div>
                  <span className="text-xs font-mono font-semibold text-zinc-200">{count}</span>
                </div>
              ))}
              {Object.keys(stats.callsByProvider || {}).length === 0 && (
                <p className="text-[10px] text-zinc-600">No data yet</p>
              )}
            </div>
            <h4 className="text-[9px] font-semibold tracking-[0.2em] text-zinc-500 uppercase mb-2 flex items-center gap-1.5">
              <PhoneOff className="w-3 h-3 text-rose-400" /> By Status
            </h4>
            <div className="space-y-1.5">
              {Object.entries(stats.callsByStatus || {}).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between">
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full capitalize ${statusColors[status] || "text-zinc-400 bg-zinc-500/15"}`}>
                    {status}
                  </span>
                  <span className="text-xs font-mono font-semibold text-zinc-200">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Call History */}
      <div className="bg-white/[0.02] backdrop-blur-2xl border border-white/5 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
          <h4 className="text-[9px] font-semibold tracking-[0.2em] text-zinc-500 uppercase flex items-center gap-1.5">
            <Calendar className="w-3 h-3 text-emerald-400" /> Call History
          </h4>
          <span className="text-[9px] font-mono text-zinc-600">{pagination.total} total</span>
        </div>

        {error && (
          <div className="px-4 py-6 text-center text-xs text-red-400">{error}</div>
        )}

        {!error && calls.length === 0 && !loading && (
          <div className="px-4 py-8 text-center">
            <PhoneCall className="w-6 h-6 text-zinc-700 mx-auto mb-2" />
            <p className="text-xs text-zinc-500">No calls recorded yet.</p>
          </div>
        )}

        {calls.length > 0 && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-[8px] text-zinc-500 uppercase tracking-widest border-b border-white/5">
                    <th className="px-4 py-2.5 text-left font-medium">Agent</th>
                    <th className="px-2 py-2.5 text-left font-medium">Caller</th>
                    <th className="px-2 py-2.5 text-left font-medium">Provider</th>
                    <th className="px-2 py-2.5 text-left font-medium">Duration</th>
                    <th className="px-2 py-2.5 text-left font-medium">Status</th>
                    <th className="px-2 py-2.5 text-left font-medium">Time</th>
                    <th className="px-2 py-2.5 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {calls.map((call) => (
                    <tr key={call.callId} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors cursor-pointer" onClick={() => fetchCallDetail(call.callId)}>
                      <td className="px-4 py-2.5">
                        <div className="text-xs text-zinc-200 truncate max-w-[140px]">{call.personaName}</div>
                      </td>
                      <td className="px-2 py-2.5 text-zinc-400 font-mono text-[10px]">{call.callerNumber || "\u2014"}</td>
                      <td className="px-2 py-2.5">
                        <span className="flex items-center gap-1 text-zinc-400 text-[10px] capitalize">
                          {providerIcons[call.provider]} {call.provider}
                        </span>
                      </td>
                      <td className="px-2 py-2.5 text-[10px] font-mono text-zinc-300">{formatDuration(call.durationSeconds)}</td>
                      <td className="px-2 py-2.5">
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full capitalize ${statusColors[call.status] || "text-zinc-400 bg-zinc-500/15"}`}>
                          {call.status}
                        </span>
                      </td>
                      <td className="px-2 py-2.5 text-[10px] text-zinc-500 whitespace-nowrap">
                        {formatDate(call.startedAt)}
                      </td>
                      <td className="px-2 py-2.5 text-right whitespace-nowrap">
                        <button onClick={(e) => { e.stopPropagation(); fetchCallDetail(call.callId); }} className="p-1 rounded-lg hover:bg-white/5 text-zinc-500 hover:text-zinc-300 transition-colors" title="View Details">
                          <Eye className="w-3 h-3" />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); deleteCall(call.callId); }} className="p-1 rounded-lg hover:bg-red-500/10 text-zinc-600 hover:text-red-400 transition-colors ml-0.5" title="Delete">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {pagination.totalPages > 1 && (
              <div className="px-4 py-2.5 border-t border-white/5 flex items-center justify-between">
                <span className="text-[9px] text-zinc-600 font-mono">Page {pagination.page} of {pagination.totalPages}</span>
                <div className="flex gap-1.5">
                  <button disabled={pagination.page <= 1} onClick={() => fetchCalls(pagination.page - 1)} className="p-1 rounded-lg border border-white/5 hover:bg-white/5 disabled:opacity-30 text-zinc-400">
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <button disabled={pagination.page >= pagination.totalPages} onClick={() => fetchCalls(pagination.page + 1)} className="p-1 rounded-lg border border-white/5 hover:bg-white/5 disabled:opacity-30 text-zinc-400">
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {selectedCall && (
        <CallDetailModal call={selectedCall} onClose={() => setSelectedCall(null)} onDelete={() => { deleteCall(selectedCall.callId); setSelectedCall(null); }} />
      )}
    </div>
  );
};

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string; accent: string }) {
  return (
    <div className="bg-white/[0.02] backdrop-blur-2xl border border-white/5 rounded-xl p-4 shadow-xl shadow-black/40">
      <div className="flex items-center gap-1.5 mb-1">{icon}</div>
      <div className="text-xl font-bold text-zinc-100 font-mono">{value}</div>
      <div className="text-[9px] text-zinc-500 uppercase tracking-widest mt-0.5">{label}</div>
    </div>
  );
}

function MiniBarChart({ data }: { data: Array<{ date: string; count: number }> }) {
  if (!data || data.length === 0) {
    return <p className="text-[10px] text-zinc-600 text-center py-4">No data for the last 30 days.</p>;
  }
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="flex items-end gap-[1px] h-20">
      {data.map((d) => (
        <div key={d.date} className="flex-1 flex flex-col items-center gap-0.5 group relative">
          <div className="w-full bg-cyan-500/30 rounded-sm hover:bg-cyan-500/50 transition-colors min-h-[2px]" style={{ height: `${(d.count / max) * 100}%` }} />
          <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-zinc-800 text-zinc-200 text-[8px] font-mono px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
            {d.date}: {d.count}
          </div>
        </div>
      ))}
    </div>
  );
}

function CallDetailModal({ call, onClose, onDelete }: { call: CallLogDetail; onClose: () => void; onDelete: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#0c0a09] border border-white/10 rounded-xl shadow-2xl max-w-xl w-full max-h-[85vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-xs font-semibold text-zinc-200">{call.personaName}</h3>
            <p className="text-[9px] text-zinc-500 font-mono mt-0.5">{call.callId} &middot; {call.provider} &middot; {call.direction}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-[9px] px-1.5 py-0.5 rounded-full capitalize ${statusColors[call.status] || ""}`}>
              {call.status}
            </span>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/5 text-zinc-500">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="px-5 py-2.5 border-b border-white/5 grid grid-cols-2 sm:grid-cols-5 gap-3 text-[10px] shrink-0">
          <div><span className="text-zinc-600 block">Duration</span><span className="text-zinc-200 font-mono">{formatDuration(call.durationSeconds)}</span></div>
          <div><span className="text-zinc-600 block">Caller</span><span className="text-zinc-200 font-mono">{call.callerNumber || "\u2014"}</span></div>
          <div><span className="text-zinc-600 block">Packets</span><span className="text-zinc-200 font-mono">{call.audioPacketsReceived}/{call.audioPacketsSent}</span></div>
          <div><span className="text-zinc-600 block">Latency/Jitter</span><span className="text-zinc-200 font-mono">{call.latencyMs != null ? `${call.latencyMs}ms` : "\u2014"} / {call.jitterMs != null ? `${call.jitterMs}ms` : "\u2014"}</span></div>
          <div><span className="text-zinc-600 block">Started</span><span className="text-zinc-200 font-mono">{formatDate(call.startedAt)} {formatTime(call.startedAt)}</span></div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3">
          {call.recordingUrl && (
            <div className="bg-white/[0.02] border border-white/5 p-3 rounded-lg space-y-1.5">
              <h4 className="text-[9px] font-semibold tracking-[0.2em] text-zinc-500 uppercase flex items-center gap-1.5">
                <Volume2 className="w-3 h-3 text-orange-400" /> Recording
              </h4>
              <audio controls src={call.recordingUrl} className="w-full h-7 outline-none filter invert brightness-90 bg-transparent rounded-lg" />
            </div>
          )}

          <div>
            <h4 className="text-[9px] font-semibold tracking-[0.2em] text-zinc-500 uppercase mb-2 flex items-center gap-1.5">
              <MessageSquare className="w-3 h-3 text-cyan-400" /> Transcript ({call.transcript?.length || 0})
            </h4>
            {(!call.transcript || call.transcript.length === 0) ? (
              <p className="text-[10px] text-zinc-600 italic">No transcript recorded.</p>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {call.transcript.map((t, i) => (
                  <div key={i} className={`text-[10px] px-2.5 py-1.5 rounded-lg max-w-[85%] ${t.role === "user" ? "bg-indigo-500/10 border border-indigo-500/20 text-indigo-200 ml-auto" : "bg-emerald-500/10 border border-emerald-500/20 text-emerald-200"}`}>
                    <span className="text-[8px] text-zinc-500 block mb-0.5 capitalize">{t.role}</span>
                    {t.text}
                  </div>
                ))}
              </div>
            )}
          </div>

          {call.toolCallsUsed && call.toolCallsUsed.length > 0 && (
            <div>
              <h4 className="text-[9px] font-semibold tracking-[0.2em] text-zinc-500 uppercase mb-2 flex items-center gap-1.5">
                <Wrench className="w-3 h-3 text-amber-400" /> Tool Calls ({call.toolCallsUsed.length})
              </h4>
              <div className="space-y-1.5">
                {call.toolCallsUsed.map((tc, i) => (
                  <div key={i} className="bg-amber-500/5 border border-amber-500/10 rounded-lg p-2.5 text-[10px]">
                    <div className="font-semibold text-amber-300 mb-0.5">{tc.name}</div>
                    <div className="text-zinc-500 font-mono text-[9px] break-all">Args: {JSON.stringify(tc.args)}</div>
                    <div className="text-zinc-400 font-mono text-[9px] mt-0.5 break-all">Result: {JSON.stringify(tc.result).substring(0, 200)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-2.5 border-t border-white/5 flex justify-end shrink-0">
          <button onClick={onDelete} className="text-[10px] text-red-400 hover:text-red-300 flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-red-500/10 transition-colors">
            <Trash2 className="w-3 h-3" /> Delete
          </button>
        </div>
      </div>
    </div>
  );
}
