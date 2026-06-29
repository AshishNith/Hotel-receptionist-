import React, { useState, useEffect, useCallback } from "react";
import { useClientConfig } from "../../config/ThemeProvider";
import {
  Megaphone, Plus, Clock, Play, Pause, Trash2,
  RefreshCw, Search, Phone, Settings, Users,
  Sparkles, Loader2, CheckCircle, XCircle, ArrowLeft, ChevronDown, ChevronUp
} from "lucide-react";
import { Persona } from "../../types";

interface CampaignContact {
  name: string;
  phone: string;
  bookingId?: string;
  status: "pending" | "calling" | "completed" | "failed";
  callId?: string;
  errorMessage?: string;
}

interface Campaign {
  id: string;
  name: string;
  personaId: string;
  status: "draft" | "running" | "paused" | "completed";
  contacts: CampaignContact[];
  createdAt: string;
  completedAt?: string;
}

export function CampaignsPage() {
  const config = useClientConfig();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  
  // Create campaign form states
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newCampaignName, setNewCampaignName] = useState("");
  const [newCampaignPersona, setNewCampaignPersona] = useState("");
  const [contactsCsv, setContactsCsv] = useState("");
  
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchCampaigns = useCallback(async () => {
    try {
      const res = await fetch("/api/campaigns");
      const json = await res.json();
      if (json.success) {
        setCampaigns(json.data || []);
      }
    } catch (err) {
      console.error("Failed to load campaigns:", err);
    }
  }, []);

  const fetchPersonas = useCallback(async () => {
    try {
      const res = await fetch("/api/personas");
      const json = await res.json();
      if (json.success) {
        setPersonas(json.data || []);
        if (json.data && json.data.length > 0) {
          setNewCampaignPersona(json.data[0].id);
        }
      }
    } catch (err) {
      console.error("Failed to load personas:", err);
    }
  }, []);

  const initData = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchCampaigns(), fetchPersonas()]);
    setLoading(false);
  }, [fetchCampaigns, fetchPersonas]);

  useEffect(() => {
    initData();
  }, [initData]);

  // Polling for campaign updates when campaigns are running
  useEffect(() => {
    const hasRunning = campaigns.some(c => c.status === "running");
    if (!hasRunning) return;

    const interval = setInterval(() => {
      fetchCampaigns();
    }, 4000);

    return () => clearInterval(interval);
  }, [campaigns, fetchCampaigns]);

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionStatus(null);
    setActionError(null);

    if (!newCampaignName.trim()) {
      setActionError("Campaign name is required.");
      return;
    }
    if (!newCampaignPersona) {
      setActionError("Please select a persona.");
      return;
    }
    if (!contactsCsv.trim()) {
      setActionError("Please provide at least one contact.");
      return;
    }

    // Parse CSV lines: "Name, Phone, OptionalBookingId"
    const lines = contactsCsv.split("\n");
    const parsedContacts: Array<{ name: string; phone: string; bookingId?: string }> = [];

    for (let line of lines) {
      line = line.trim();
      if (!line) continue;

      const parts = line.split(",").map(p => p.trim());
      if (parts.length < 2) {
        setActionError(`Invalid CSV line: "${line}". Each line must contain Name and Phone.`);
        return;
      }

      parsedContacts.push({
        name: parts[0],
        phone: parts[1],
        bookingId: parts[2] || ""
      });
    }

    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newCampaignName.trim(),
          personaId: newCampaignPersona,
          contacts: parsedContacts
        })
      });

      const json = await res.json();
      if (json.success) {
        setActionStatus("Campaign created successfully!");
        setNewCampaignName("");
        setContactsCsv("");
        setShowCreateForm(false);
        fetchCampaigns();
      } else {
        setActionError(json.message || "Failed to create campaign.");
      }
    } catch (err: any) {
      setActionError(`Connection error: ${err.message}`);
    }
  };

  const handleStartCampaign = async (campaignId: string) => {
    setActionStatus(null);
    setActionError(null);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/start`, { method: "POST" });
      const json = await res.json();
      if (json.success) {
        setActionStatus("Campaign started successfully.");
        fetchCampaigns();
      } else {
        setActionError(json.message || "Failed to start campaign.");
      }
    } catch (err: any) {
      setActionError(`Connection error: ${err.message}`);
    }
  };

  const handlePauseCampaign = async (campaignId: string) => {
    setActionStatus(null);
    setActionError(null);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/pause`, { method: "POST" });
      const json = await res.json();
      if (json.success) {
        setActionStatus("Campaign paused.");
        fetchCampaigns();
      } else {
        setActionError(json.message || "Failed to pause campaign.");
      }
    } catch (err: any) {
      setActionError(`Connection error: ${err.message}`);
    }
  };

  const handleDeleteCampaign = async (campaignId: string) => {
    if (!confirm("Are you sure you want to delete this campaign? All contact history will be lost.")) return;
    
    setActionStatus(null);
    setActionError(null);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
        setActionStatus("Campaign deleted.");
        if (selectedCampaignId === campaignId) setSelectedCampaignId(null);
        fetchCampaigns();
      } else {
        setActionError(json.message || "Failed to delete campaign.");
      }
    } catch (err: any) {
      setActionError(`Connection error: ${err.message}`);
    }
  };

  const selectedCampaign = campaigns.find(c => c.id === selectedCampaignId);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "running": return "text-indigo-700 bg-indigo-50 border-indigo-200 animate-pulse";
      case "paused": return "text-amber-700 bg-amber-50 border-amber-200";
      case "completed": return "text-emerald-700 bg-emerald-50 border-emerald-200";
      default: return "text-zinc-500 bg-zinc-55 border-zinc-200";
    }
  };

  const getContactStatusColor = (status: string) => {
    switch (status) {
      case "calling": return "text-indigo-700 bg-indigo-50 border-indigo-200 animate-pulse";
      case "completed": return "text-emerald-700 bg-emerald-50 border-emerald-200";
      case "failed": return "text-red-700 bg-red-50 border-red-200";
      default: return "text-zinc-500 bg-zinc-50 border-zinc-200";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="w-6 h-6 animate-spin text-zinc-400 mr-3" />
        <span className="text-sm font-mono text-zinc-500">Loading campaigns...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-200 pb-5">
        <div>
          <h2 className="text-2xl font-semibold text-zinc-900 tracking-tight flex items-center gap-3">
            <Megaphone className="w-6 h-6" style={{ color: config.brand.accentColor }} />
            Campaign Manager
          </h2>
          <p className="text-xs text-zinc-500 font-mono tracking-wide mt-1 uppercase">
            Upload custom contact sheets and manage automated AI dialer campaigns
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchCampaigns}
            className="flex items-center gap-2 px-3 py-2 border border-zinc-200 bg-white hover:bg-zinc-50 rounded-xl text-xs font-mono uppercase tracking-wider transition cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
          {!showCreateForm ? (
            <button
              onClick={() => setShowCreateForm(true)}
              className="flex items-center gap-2 px-4 py-2 text-white bg-zinc-950 hover:bg-zinc-900 rounded-xl text-xs font-mono uppercase tracking-wider transition cursor-pointer font-semibold"
            >
              <Plus className="w-3.5 h-3.5 text-white" />
              Create Campaign
            </button>
          ) : (
            <button
              onClick={() => setShowCreateForm(false)}
              className="flex items-center gap-2 px-4 py-2 border border-zinc-200 bg-white hover:bg-zinc-50 rounded-xl text-xs font-mono uppercase tracking-wider transition cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back
            </button>
          )}
        </div>
      </div>

      {/* Notifications */}
      {actionStatus && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-250 text-emerald-800 text-xs font-mono flex items-center gap-3">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionStatus}</span>
        </div>
      )}
      {actionError && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-250 text-red-800 text-xs font-mono flex items-center gap-3">
          <XCircle className="w-4 h-4 text-red-650 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {showCreateForm ? (
        // ─── Campaign Creation Form ───
        <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm max-w-2xl">
          <h3 className="text-sm font-mono uppercase tracking-widest text-zinc-900 mb-4 flex items-center gap-2">
            <Plus className="w-4 h-4 text-zinc-900" />
            Create Outbound Campaign
          </h3>
          <form onSubmit={handleCreateCampaign} className="space-y-5">
            <div>
              <label className="block text-xs font-mono uppercase tracking-widest text-zinc-500 mb-2">
                Campaign Name
              </label>
              <input
                type="text"
                required
                value={newCampaignName}
                onChange={e => setNewCampaignName(e.target.value)}
                placeholder="e.g. June Cart Recovery Callout"
                className="w-full bg-white border border-zinc-200 rounded-xl p-3.5 text-sm focus:outline-none focus:border-zinc-950 font-sans"
              />
            </div>

            <div>
              <label className="block text-xs font-mono uppercase tracking-widest text-zinc-500 mb-2">
                Target Calling Agent Persona
              </label>
              <select
                value={newCampaignPersona}
                onChange={e => setNewCampaignPersona(e.target.value)}
                className="w-full bg-white border border-zinc-200 rounded-xl p-3.5 text-sm focus:outline-none focus:border-zinc-950 font-sans"
              >
                <option value="" disabled>Select Persona</option>
                {personas.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.role})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-mono uppercase tracking-widest text-zinc-500 mb-2">
                Upload Contacts (CSV Format)
              </label>
              <textarea
                value={contactsCsv}
                onChange={e => setContactsCsv(e.target.value)}
                placeholder="Name, Phone, OptionalBookingId&#10;Rahul Gupta, +919876543210, OD-9018&#10;Sneha Sharma, +918877665544, CRT-9012"
                rows={5}
                className="w-full bg-white border border-zinc-200 rounded-xl p-4 text-xs font-mono focus:outline-none focus:border-zinc-950 leading-relaxed"
              />
              <p className="text-[10px] text-zinc-400 mt-1.5 font-serif italic">
                One contact per line: Name, Phone (with country code), bookingId/context (optional).
              </p>
            </div>

            <button
              type="submit"
              className="px-6 py-3.5 bg-zinc-950 hover:bg-zinc-900 text-white rounded-xl text-xs font-mono uppercase tracking-widest font-semibold transition cursor-pointer"
            >
              Save & Create Campaign
            </button>
          </form>
        </div>
      ) : (
        // ─── Campaigns Dashboard View ───
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* List of Campaigns */}
          <div className="lg:col-span-1 space-y-4">
            <h3 className="text-xs font-mono uppercase tracking-widest text-zinc-500 flex items-center gap-1.5">
              <Megaphone className="w-4 h-4 text-zinc-600" />
              Outbound Campaigns
            </h3>

            <div className="space-y-3">
              {campaigns.length === 0 ? (
                <div className="bg-white border border-zinc-200 rounded-2xl p-8 text-center text-zinc-400 text-xs shadow-sm">
                  No campaigns created yet. Click "Create Campaign" to start.
                </div>
              ) : (
                campaigns.map(c => {
                  const resolvedPersona = personas.find(p => p.id === c.personaId)?.name || c.personaId;
                  const completedCount = c.contacts.filter(con => con.status === "completed").length;
                  const totalCount = c.contacts.length;
                  const isSelected = selectedCampaignId === c.id;

                  return (
                    <div
                      key={c.id}
                      onClick={() => setSelectedCampaignId(c.id)}
                      className={`p-4 bg-white border border-zinc-200 rounded-2xl shadow-sm cursor-pointer hover:border-zinc-400 transition flex flex-col justify-between gap-3 ${
                        isSelected ? "ring-2 ring-zinc-950 border-zinc-400" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="text-sm font-bold text-zinc-900 line-clamp-1">{c.name}</h4>
                          <span className="text-[10px] text-zinc-500 font-mono mt-0.5 block truncate">
                            Persona: {resolvedPersona}
                          </span>
                        </div>
                        <span className={`text-[9px] px-2 py-0.5 rounded-full border capitalize font-mono ${getStatusColor(c.status)}`}>
                          {c.status}
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div>
                        <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500 mb-1">
                          <span>Progress</span>
                          <span>{completedCount} / {totalCount} dials</span>
                        </div>
                        <div className="w-full bg-zinc-100 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                            style={{ width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%` }}
                          />
                        </div>
                      </div>

                      {/* Controls */}
                      <div className="flex justify-end items-center gap-1.5 border-t border-zinc-100 pt-3 mt-1" onClick={e => e.stopPropagation()}>
                        {c.status === "running" ? (
                          <button
                            onClick={() => handlePauseCampaign(c.id)}
                            className="p-2 border border-zinc-200 bg-white hover:bg-zinc-50 hover:border-zinc-400 rounded-lg text-zinc-650 transition cursor-pointer"
                            title="Pause Campaign"
                          >
                            <Pause className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button
                            disabled={c.status === "completed"}
                            onClick={() => handleStartCampaign(c.id)}
                            className="p-2 border border-zinc-200 bg-white hover:bg-zinc-50 hover:border-zinc-400 rounded-lg text-zinc-650 disabled:opacity-30 disabled:hover:border-zinc-200 transition cursor-pointer"
                            title="Start Campaign"
                          >
                            <Play className="w-3.5 h-3.5 fill-current text-zinc-600" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteCampaign(c.id)}
                          className="p-2 border border-zinc-200 bg-white hover:bg-red-50 hover:border-red-200 hover:text-red-650 rounded-lg text-zinc-600 transition cursor-pointer"
                          title="Delete Campaign"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Active / Selected Campaign Details */}
          <div className="lg:col-span-2 space-y-4">
            <h3 className="text-xs font-mono uppercase tracking-widest text-zinc-500 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-zinc-600" />
              Campaign Details
            </h3>

            {selectedCampaign ? (
              <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
                {/* Details Header */}
                <div className="p-5 border-b border-zinc-250 bg-zinc-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <span className={`text-[9px] px-2 py-0.5 rounded-full border capitalize font-mono ${getStatusColor(selectedCampaign.status)}`}>
                      {selectedCampaign.status}
                    </span>
                    <h4 className="text-base font-bold text-zinc-900 mt-1">{selectedCampaign.name}</h4>
                    <p className="text-[10px] text-zinc-500 font-mono mt-0.5">
                      Created: {new Date(selectedCampaign.createdAt).toLocaleString("en-IN")}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {selectedCampaign.status === "running" ? (
                      <button
                        onClick={() => handlePauseCampaign(selectedCampaign.id)}
                        className="px-3.5 py-2 border border-zinc-200 bg-white hover:bg-zinc-50 rounded-xl text-xs font-mono uppercase tracking-wider font-semibold transition cursor-pointer flex items-center gap-1.5"
                      >
                        <Pause className="w-3.5 h-3.5 text-zinc-700" />
                        Pause Dialer
                      </button>
                    ) : (
                      <button
                        disabled={selectedCampaign.status === "completed"}
                        onClick={() => handleStartCampaign(selectedCampaign.id)}
                        className="px-3.5 py-2 text-white bg-zinc-950 hover:bg-zinc-900 rounded-xl text-xs font-mono uppercase tracking-wider font-semibold transition cursor-pointer flex items-center gap-1.5 disabled:opacity-35"
                      >
                        <Play className="w-3.5 h-3.5 text-white fill-current" />
                        Resume Dialer
                      </button>
                    )}
                  </div>
                </div>

                {/* Contacts List Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="bg-zinc-50 text-[10px] text-zinc-500 font-mono uppercase tracking-wider border-b border-zinc-200">
                        <th className="px-4 py-3">Customer Name</th>
                        <th className="px-4 py-3">Phone</th>
                        <th className="px-4 py-3">Booking ID Context</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-right">Details / Error</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-150">
                      {selectedCampaign.contacts.map((con, i) => (
                        <tr key={i} className="hover:bg-zinc-50/50">
                          <td className="px-4 py-3 font-semibold text-zinc-900">{con.name}</td>
                          <td className="px-4 py-3 font-mono text-zinc-650">{con.phone}</td>
                          <td className="px-4 py-3 font-mono text-zinc-500">{con.bookingId || "\u2014"}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono border capitalize ${getContactStatusColor(con.status)}`}>
                              {con.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {con.errorMessage ? (
                              <span className="text-[10px] font-mono text-red-650" title={con.errorMessage}>
                                {con.errorMessage.length > 30 ? `${con.errorMessage.substring(0, 27)}...` : con.errorMessage}
                              </span>
                            ) : con.callId ? (
                              <span className="text-[10px] font-mono text-zinc-400">Call ID: {con.callId}</span>
                            ) : (
                              <span className="text-[10px] font-mono text-zinc-400">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="bg-white border border-zinc-200 rounded-2xl p-12 text-center text-zinc-450 text-xs shadow-sm">
                Select a campaign from the list on the left to view dials, start operations, or track results.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
