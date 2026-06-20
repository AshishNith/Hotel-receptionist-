import React, { useState, useEffect, useCallback } from "react";
import { useClientConfig } from "../../config/ThemeProvider";
import {
  Megaphone,
  Plus,
  ArrowUpRight,
  Clock,
  BarChart3,
  Upload,
  RefreshCw,
  Search,
  Phone,
  Settings,
  Database,
  Sparkles,
  Loader2,
  CheckCircle,
  XCircle
} from "lucide-react";

export function CampaignsPage() {
  const config = useClientConfig();
  const [activeTab, setActiveTab] = useState<"orders" | "carts">("orders");
  const [orders, setOrders] = useState<any[]>([]);
  const [carts, setCarts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [csvText, setCsvText] = useState("");
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [triggeringBulk, setTriggeringBulk] = useState(false);
  const [webhookConfig, setWebhookConfig] = useState({
    syncOnCOD: true,
    syncOnAbandon: true,
    syncOnNDR: true,
    writeBackTags: true
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const ordersRes = await fetch("/api/analytics/orders");
      const ordersJson = await ordersRes.json();
      if (ordersJson.success) setOrders(ordersJson.data || []);

      const cartsRes = await fetch("/api/analytics/carts");
      const cartsJson = await cartsRes.json();
      if (cartsJson.success) setCarts(cartsJson.data || []);
    } catch (err) {
      console.error("Failed to load campaign data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCsvUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvText.trim()) return;

    setLoading(true);
    setUploadStatus(null);
    try {
      const res = await fetch("/api/orders/bulk-add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvText, type: activeTab === "orders" ? "order" : "cart" }),
      });
      const data = await res.json();
      if (data.success) {
        setUploadStatus(`Successfully imported ${data.count} ${activeTab === "orders" ? "orders" : "carts"}.`);
        setCsvText("");
        fetchData();
      } else {
        setUploadStatus(`Import failed: ${data.error}`);
      }
    } catch (err: any) {
      setUploadStatus(`Connection error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const triggerBulkCalls = async () => {
    setTriggeringBulk(true);
    setUploadStatus(null);
    try {
      const res = await fetch("/api/orders/trigger-confirmations", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setUploadStatus(`Bulk call trigger completed. Initiated ${data.triggeredCount} calls.`);
        fetchData();
      } else {
        setUploadStatus(`Trigger failed: ${data.error}`);
      }
    } catch (err: any) {
      setUploadStatus(`Network error: ${err.message}`);
    } finally {
      setTriggeringBulk(false);
    }
  };

  const dialManualCustomer = async (phone: string, id: string, type: "order" | "cart") => {
    try {
      setUploadStatus(`Dialing ${phone}...`);
      const res = await fetch("/api/outbound/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toNumber: phone,
          personaId: type === "order" ? "cod_confirm" : "cart_recovery",
          bookingId: id // Pass orderId/cartId in bookingId field for call context sync
        }),
      });
      const json = await res.json();
      if (json.success) {
        setUploadStatus(`Outbound call initiated to ${phone}. ID: ${json.callId}`);
      } else {
        setUploadStatus(`Failed to initiate call: ${json.error}`);
      }
    } catch (err: any) {
      setUploadStatus(`Call error: ${err.message}`);
    }
  };

  const filteredOrders = orders.filter(o => 
    o.OrderID?.toLowerCase().includes(search.toLowerCase()) ||
    o.CustomerName?.toLowerCase().includes(search.toLowerCase()) ||
    o.Phone?.includes(search)
  );

  const filteredCarts = carts.filter(c => 
    c.CartID?.toLowerCase().includes(search.toLowerCase()) ||
    c.CustomerName?.toLowerCase().includes(search.toLowerCase()) ||
    c.Phone?.includes(search)
  );

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
            Upload contact lists & manage automated customer outbound dialers
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 border border-zinc-200 bg-white hover:bg-zinc-50 rounded-xl text-xs font-mono uppercase tracking-wider transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh Queue
          </button>
          <button
            onClick={triggerBulkCalls}
            disabled={triggeringBulk}
            className="flex items-center gap-2 px-4 py-2 text-white bg-zinc-950 hover:bg-zinc-900 rounded-xl text-xs font-mono uppercase tracking-wider transition cursor-pointer"
          >
            {triggeringBulk ? <Loader2 className="w-3.5 h-3.5 animate-spin text-white" /> : <Sparkles className="w-3.5 h-3.5 text-white" />}
            Trigger Active Campaign
          </button>
        </div>
      </div>

      {uploadStatus && (
        <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-mono flex items-center gap-3">
          <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
          <span>{uploadStatus}</span>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 bg-white border border-zinc-200 rounded-2xl flex items-center gap-3 shadow-sm">
          <Database className="w-5 h-5 text-indigo-600" />
          <div>
            <span className="text-[10px] text-zinc-500 font-mono uppercase block">COD Confirm Queue</span>
            <span className="text-lg font-bold text-zinc-900 font-mono">
              {orders.filter(o => o.Status === "Pending COD Confirmation").length} / {orders.length}
            </span>
          </div>
        </div>
        <div className="p-4 bg-white border border-zinc-200 rounded-2xl flex items-center gap-3 shadow-sm">
          <Clock className="w-5 h-5 text-amber-600" />
          <div>
            <span className="text-[10px] text-zinc-500 font-mono uppercase block">Abandoned Carts</span>
            <span className="text-lg font-bold text-zinc-900 font-mono">
              {carts.filter(c => c.Status === "Abandoned").length} / {carts.length}
            </span>
          </div>
        </div>
        <div className="p-4 bg-white border border-zinc-200 rounded-2xl flex items-center gap-3 shadow-sm">
          <CheckCircle className="w-5 h-5 text-emerald-600" />
          <div>
            <span className="text-[10px] text-zinc-500 font-mono uppercase block">Auto-Retry Limit</span>
            <span className="text-lg font-bold text-zinc-900 font-mono">3 Attempts</span>
          </div>
        </div>
        <div className="p-4 bg-white border border-zinc-200 rounded-2xl flex items-center gap-3 shadow-sm">
          <Settings className="w-5 h-5 text-rose-600" />
          <div>
            <span className="text-[10px] text-zinc-500 font-mono uppercase block">Shopify Webhooks</span>
            <span className="text-xs font-bold text-emerald-600 font-mono uppercase">Connected</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Side: CSV List copy-paste & Settings */}
        <div className="lg:col-span-4 space-y-6">
          {/* CSV Bulk Importer */}
          <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
            <h3 className="text-sm font-mono uppercase tracking-widest text-zinc-800 mb-3 flex items-center gap-2">
              <Upload className="w-4 h-4" />
              CSV Bulk Importer
            </h3>
            <p className="text-[11px] text-zinc-500 leading-normal mb-4 font-serif italic">
              Paste raw comma-separated lists of customers to import them into the active dialer queue.
            </p>
            <form onSubmit={handleCsvUpload} className="space-y-4">
              <div>
                <label className="block text-[10px] font-mono text-zinc-400 uppercase tracking-widest mb-1.5">
                  CSV Raw Text (ID, Name, Phone, Email, Value, Status...)
                </label>
                <textarea
                  value={csvText}
                  onChange={e => setCsvText(e.target.value)}
                  placeholder={
                    activeTab === "orders"
                      ? "OD-9901,Rahul Gupta,9934225353,rahul@example.com,1899,Pending COD Confirmation,Sector 15 Noida"
                      : "CRT-9902,Amit Kumar,9934225353,amit@example.com,2499,Abandoned,Premium Earbuds"
                  }
                  rows={4}
                  className="w-full bg-white border border-zinc-200 rounded-xl p-3 text-xs font-mono focus:outline-none focus:border-zinc-950"
                />
              </div>
              <button
                type="submit"
                disabled={loading || !csvText.trim()}
                className="w-full py-2.5 bg-zinc-950 text-white rounded-xl text-xs font-mono uppercase tracking-widest font-semibold cursor-pointer hover:bg-zinc-900 disabled:opacity-50"
              >
                Import Data List
              </button>
            </form>
          </div>

          {/* Shopify Webhook Sync Settings */}
          <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
            <h3 className="text-sm font-mono uppercase tracking-widest text-zinc-800 mb-4 flex items-center gap-2">
              <Settings className="w-4 h-4 text-zinc-600" />
              Shopify / WooCommerce Settings
            </h3>
            <div className="space-y-3">
              <label className="flex items-center justify-between text-xs text-zinc-700 cursor-pointer">
                <span>Call COD Orders Instantly</span>
                <input
                  type="checkbox"
                  checked={webhookConfig.syncOnCOD}
                  onChange={e => setWebhookConfig({ ...webhookConfig, syncOnCOD: e.target.checked })}
                  className="w-4 h-4 accent-zinc-900 rounded"
                />
              </label>
              <label className="flex items-center justify-between text-xs text-zinc-700 cursor-pointer">
                <span>Call Carts after 30 mins</span>
                <input
                  type="checkbox"
                  checked={webhookConfig.syncOnAbandon}
                  onChange={e => setWebhookConfig({ ...webhookConfig, syncOnAbandon: e.target.checked })}
                  className="w-4 h-4 accent-zinc-900 rounded"
                />
              </label>
              <label className="flex items-center justify-between text-xs text-zinc-700 cursor-pointer">
                <span>Schedule NDR redelivery calls</span>
                <input
                  type="checkbox"
                  checked={webhookConfig.syncOnNDR}
                  onChange={e => setWebhookConfig({ ...webhookConfig, syncOnNDR: e.target.checked })}
                  className="w-4 h-4 accent-zinc-900 rounded"
                />
              </label>
              <label className="flex items-center justify-between text-xs text-zinc-700 cursor-pointer">
                <span>Tag orders "Confirmed by AI"</span>
                <input
                  type="checkbox"
                  checked={webhookConfig.writeBackTags}
                  onChange={e => setWebhookConfig({ ...webhookConfig, writeBackTags: e.target.checked })}
                  className="w-4 h-4 accent-zinc-900 rounded"
                />
              </label>
            </div>
            <div className="mt-4 pt-4 border-t border-zinc-100 flex justify-between items-center text-[10px] font-mono text-zinc-400 uppercase">
              <span>Webhook API status</span>
              <span className="text-emerald-600 font-bold">Active</span>
            </div>
          </div>
        </div>

        {/* Right Side: Active Queue Tables */}
        <div className="lg:col-span-8 bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden flex flex-col justify-between">
          <div>
            {/* Tabs & Search */}
            <div className="p-4 border-b border-zinc-200 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex gap-1 border border-zinc-200 p-1 rounded-xl bg-zinc-50 shrink-0">
                <button
                  onClick={() => setActiveTab("orders")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono uppercase tracking-wider transition cursor-pointer ${
                    activeTab === "orders" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-900"
                  }`}
                >
                  COD Orders Queue
                </button>
                <button
                  onClick={() => setActiveTab("carts")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono uppercase tracking-wider transition cursor-pointer ${
                    activeTab === "carts" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-900"
                  }`}
                >
                  Abandoned Carts Queue
                </button>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Search customer name or phone..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full bg-white border border-zinc-200 rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:border-zinc-950 font-sans"
                />
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="bg-zinc-50 text-[10px] text-zinc-500 font-mono uppercase tracking-wider border-b border-zinc-200">
                    <th className="px-4 py-3">ID</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Phone</th>
                    <th className="px-4 py-3">Value</th>
                    <th className="px-4 py-3">Status</th>
                    {activeTab === "orders" ? (
                      <th className="px-4 py-3">Retries / Schedule</th>
                    ) : (
                      <th className="px-4 py-3">Discount Code</th>
                    )}
                    <th className="px-4 py-3 text-right">Dialer Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {activeTab === "orders" ? (
                    filteredOrders.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-10 text-zinc-400 italic">
                          No pending COD orders found.
                        </td>
                      </tr>
                    ) : (
                      filteredOrders.map(o => (
                        <tr key={o.OrderID} className="border-b border-zinc-100 hover:bg-zinc-50/50">
                          <td className="px-4 py-3 font-mono font-bold">{o.OrderID}</td>
                          <td className="px-4 py-3">{o.CustomerName}</td>
                          <td className="px-4 py-3 font-mono text-zinc-650">{o.Phone}</td>
                          <td className="px-4 py-3 font-mono">₹{o.OrderValue}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono border ${
                              o.Status === "COD Confirmed"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : o.Status === "COD Cancelled"
                                ? "bg-red-50 text-red-700 border-red-200"
                                : "bg-amber-50 text-amber-700 border-amber-200"
                            }`}>
                              {o.Status}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono">
                            <div className="flex items-center gap-1.5">
                              <span>Attempts: {o.RetryCount || 0}/3</span>
                              {o.NextRetryTime && <span className="text-[9px] text-zinc-400">({o.NextRetryTime})</span>}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              disabled={o.Status === "COD Confirmed" || o.Status === "COD Cancelled"}
                              onClick={() => dialManualCustomer(o.Phone, o.OrderID, "order")}
                              className="px-2.5 py-1.5 bg-zinc-950 text-white hover:bg-zinc-900 rounded-lg text-[10px] font-mono uppercase tracking-wider cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              Dial Now
                            </button>
                          </td>
                        </tr>
                      ))
                    )
                  ) : (
                    filteredCarts.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-10 text-zinc-400 italic">
                          No abandoned checkouts found.
                        </td>
                      </tr>
                    ) : (
                      filteredCarts.map(c => (
                        <tr key={c.CartID} className="border-b border-zinc-100 hover:bg-zinc-50/50">
                          <td className="px-4 py-3 font-mono font-bold">{c.CartID}</td>
                          <td className="px-4 py-3">{c.CustomerName}</td>
                          <td className="px-4 py-3 font-mono text-zinc-650">{c.Phone}</td>
                          <td className="px-4 py-3 font-mono">₹{c.CartValue}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono border ${
                              c.Status === "Recovered"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-amber-50 text-amber-700 border-amber-200"
                            }`}>
                              {c.Status}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono">{c.DiscountApplied || "None"}</td>
                          <td className="px-4 py-3 text-right">
                            <button
                              disabled={c.Status === "Recovered"}
                              onClick={() => dialManualCustomer(c.Phone, c.CartID, "cart")}
                              className="px-2.5 py-1.5 bg-zinc-950 text-white hover:bg-zinc-900 rounded-lg text-[10px] font-mono uppercase tracking-wider cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              Recover
                            </button>
                          </td>
                        </tr>
                      ))
                    )
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
