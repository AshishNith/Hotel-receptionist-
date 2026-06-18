import React, { useState, useEffect } from "react";
import { useClientConfig } from "../../config/ThemeProvider";
import { Cpu, CheckCircle2, AlertTriangle, AlertCircle, HelpCircle, Code, Terminal, ChevronDown, ChevronUp, RefreshCw, Play } from "lucide-react";

interface ToolParameter {
  type: string;
  description?: string;
  items?: { type: string; properties?: any; required?: string[] };
  properties?: Record<string, any>;
}

interface ToolDeclaration {
  name: string;
  description: string;
  parametersJsonSchema?: {
    type: string;
    properties?: Record<string, ToolParameter>;
    required?: string[];
  };
  status: "active" | "error" | "needs_auth" | "not_configured";
  statusDetails: string;
}

export function ToolsPage() {
  const config = useClientConfig();
  const [tools, setTools] = useState<ToolDeclaration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedSchema, setExpandedSchema] = useState<Record<string, boolean>>({});
  const [expandedTest, setExpandedTest] = useState<Record<string, boolean>>({});
  const [testPayloads, setTestPayloads] = useState<Record<string, string>>({});
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; data: any; loading?: boolean }>>({});

  const fetchTools = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/tools");
      const json = await res.json();
      if (json.success && json.data) {
        setTools(json.data);
        // Initialize default payloads
        const payloads: Record<string, string> = {};
        json.data.forEach((tool: ToolDeclaration) => {
          payloads[tool.name] = generateDummyPayload(tool);
        });
        setTestPayloads(payloads);
      } else {
        setError(json.message || "Failed to fetch tools.");
      }
    } catch (err: any) {
      setError(err.message || "Connection error when fetching tools.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTools();
  }, []);

  const generateDummyPayload = (tool: ToolDeclaration): string => {
    const props = tool.parametersJsonSchema?.properties || {};
    const dummy: Record<string, any> = {};
    Object.keys(props).forEach((key) => {
      const p = props[key];
      if (p.type === "STRING" || p.type === "string") {
        if (key.toLowerCase().includes("date")) {
          dummy[key] = new Date().toISOString().split("T")[0];
        } else if (key.toLowerCase().includes("email")) {
          dummy[key] = "guest@example.com";
        } else if (key === "phone" || key === "recipientPhone") {
          dummy[key] = "+15551234567";
        } else if (key === "bookingId") {
          dummy[key] = "BK-1234";
        } else if (key === "roomType" || key === "newRoomType") {
          dummy[key] = "deluxe";
        } else if (key === "action") {
          dummy[key] = "modify";
        } else {
          dummy[key] = p.description ? `test_${key}` : "";
        }
      } else if (p.type === "INTEGER" || p.type === "NUMBER" || p.type === "integer" || p.type === "number") {
        dummy[key] = 1;
      } else if (p.type === "ARRAY" || p.type === "array") {
        if (key === "addons" || key === "newAddons") {
          dummy[key] = ["breakfast"];
        } else if (key === "items") {
          dummy[key] = [{ itemId: "sandwich", quantity: 2 }];
        } else {
          dummy[key] = [];
        }
      } else if (p.type === "OBJECT" || p.type === "object") {
        dummy[key] = {};
      }
    });
    return JSON.stringify(dummy, null, 2);
  };

  const handleTestSubmit = async (toolName: string) => {
    setTestResults((prev) => ({
      ...prev,
      [toolName]: { success: false, data: null, loading: true },
    }));

    try {
      let parsedArgs = {};
      try {
        parsedArgs = JSON.parse(testPayloads[toolName] || "{}");
      } catch (e: any) {
        throw new Error(`Invalid JSON arguments: ${e.message}`);
      }

      const res = await fetch(`/api/tools/${toolName}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ args: parsedArgs }),
      });
      const json = await res.json();
      setTestResults((prev) => ({
        ...prev,
        [toolName]: {
          success: json.success,
          data: json.success ? json.result : json.error || "Failed to execute tool call test.",
          loading: false,
        },
      }));
    } catch (err: any) {
      setTestResults((prev) => ({
        ...prev,
        [toolName]: { success: false, data: err.message, loading: false },
      }));
    }
  };

  const toggleSchema = (name: string) => {
    setExpandedSchema((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  const toggleTest = (name: string) => {
    setExpandedTest((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  const getStatusBadge = (status: ToolDeclaration["status"]) => {
    switch (status) {
      case "active":
        return (
          <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-250">
            <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Active
          </span>
        );
      case "needs_auth":
        return (
          <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-250 animate-pulse">
            <AlertTriangle className="w-3 h-3 text-amber-500" /> Needs OAuth
          </span>
        );
      case "not_configured":
        return (
          <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-zinc-100 text-zinc-650 border border-zinc-250">
            <AlertCircle className="w-3 h-3 text-zinc-500" /> Not Configured
          </span>
        );
      case "error":
        return (
          <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-red-50 text-red-700 border border-red-250">
            <AlertCircle className="w-3 h-3 text-red-500" /> Error
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-5">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-zinc-900 flex items-center gap-2">
            <Cpu className="w-6 h-6" style={{ color: config.brand.accentColor }} />
            Agent Tools
          </h2>
          <p className="text-xs text-zinc-500 font-mono tracking-wide mt-1 uppercase">
            Manage, inspect, and test function calls connected to the Gemini Live Agent
          </p>
        </div>
        <button
          onClick={fetchTools}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 border border-zinc-200 bg-white hover:bg-zinc-50 hover:border-zinc-350 text-zinc-700 hover:text-zinc-950 rounded-xl text-xs font-mono uppercase tracking-wider transition cursor-pointer disabled:opacity-50 shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Reload Tools
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 bg-white border border-zinc-200 rounded-2xl">
          <RefreshCw className="w-8 h-8 text-zinc-400 animate-spin mb-3" />
          <p className="text-xs font-mono text-zinc-500 uppercase tracking-widest">Loading tools configurations...</p>
        </div>
      ) : error ? (
        <div className="p-6 bg-red-50 border border-red-250 text-red-700 rounded-2xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-sm">Failed to sync agent tools</h4>
            <p className="text-xs font-mono mt-1">{error}</p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {tools.map((tool) => {
            const isGoogle = ["list_upcoming_meetings", "create_calendar_event", "send_gmail_message", "read_latest_emails"].includes(tool.name);
            const schemaExpanded = !!expandedSchema[tool.name];
            const testExpanded = !!expandedTest[tool.name];
            const testRes = testResults[tool.name];

            return (
              <div
                key={tool.name}
                className="bg-white border border-zinc-200 rounded-2xl p-5 hover:border-zinc-350 transition-all duration-200 shadow-sm"
              >
                {/* Card Top Title Row */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center border shrink-0 ${
                      isGoogle 
                        ? "bg-indigo-50 border-indigo-200 text-indigo-650"
                        : "bg-emerald-50 border-emerald-200 text-emerald-650"
                    }`}>
                      <Code className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-base text-zinc-900 font-mono">{tool.name}</h3>
                        <span className={`text-[8px] font-mono font-bold uppercase tracking-widest px-2 py-0.5 border rounded ${
                          isGoogle
                            ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                            : "bg-emerald-50 border-emerald-200 text-emerald-700"
                        }`}>
                          {isGoogle ? "Google Workspace" : "Hotel Database"}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-650 mt-1 leading-relaxed">{tool.description}</p>
                    </div>
                  </div>
                  <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-center gap-2 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-zinc-100">
                    {getStatusBadge(tool.status)}
                    <span className="text-[10px] text-zinc-500 font-mono tracking-wide">{tool.statusDetails}</span>
                  </div>
                </div>

                {/* Card Actions Row */}
                <div className="flex gap-2 mt-4 pt-4 border-t border-zinc-100">
                  <button
                    onClick={() => toggleSchema(tool.name)}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 hover:text-zinc-950 rounded-lg text-[10px] font-mono uppercase tracking-wider transition cursor-pointer"
                  >
                    <Terminal className="w-3.5 h-3.5" />
                    <span>Parameters</span>
                    {schemaExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                  <button
                    onClick={() => toggleTest(tool.name)}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 hover:text-zinc-950 rounded-lg text-[10px] font-mono uppercase tracking-wider transition cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 text-zinc-650" />
                    <span>Dry-Run Test</span>
                    {testExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                </div>

                {/* Parameters Schema Details Section */}
                {schemaExpanded && (
                  <div className="mt-4 p-4 bg-zinc-50 border border-zinc-200 rounded-xl space-y-3 font-mono text-[11px] text-zinc-700">
                    <h4 className="font-semibold text-xs text-zinc-900 uppercase tracking-wider flex items-center gap-1">
                      <Code className="w-3.5 h-3.5" /> Parameter Fields
                    </h4>
                    {tool.parametersJsonSchema?.properties && Object.keys(tool.parametersJsonSchema.properties).length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-zinc-200 text-zinc-500">
                              <th className="py-2 pr-4 font-semibold">Parameter</th>
                              <th className="py-2 px-4 font-semibold">Type</th>
                              <th className="py-2 px-4 font-semibold">Required</th>
                              <th className="py-2 pl-4 font-semibold">Description</th>
                            </tr>
                          </thead>
                          <tbody>
                            {Object.entries(tool.parametersJsonSchema.properties).map(([pName, pVal]) => {
                              const isRequired = tool.parametersJsonSchema?.required?.includes(pName);
                              return (
                                <tr key={pName} className="border-b border-zinc-150 last:border-0 hover:bg-zinc-100/50">
                                  <td className="py-2.5 pr-4 font-bold text-zinc-900">{pName}</td>
                                  <td className="py-2.5 px-4"><span className="px-1.5 py-0.5 bg-zinc-200/60 rounded text-[10px] text-zinc-800 uppercase">{pVal.type}</span></td>
                                  <td className="py-2.5 px-4">
                                    {isRequired ? (
                                      <span className="text-amber-700 font-semibold text-[10px] uppercase">Yes</span>
                                    ) : (
                                      <span className="text-zinc-400">Optional</span>
                                    )}
                                  </td>
                                  <td className="py-2.5 pl-4 text-zinc-600 leading-normal">{pVal.description || "N/A"}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-zinc-500 italic">No parameters required for this tool.</p>
                    )}
                  </div>
                )}

                {/* Dry Run Test Console Section */}
                {testExpanded && (
                  <div className="mt-4 p-4 bg-zinc-950 border border-zinc-800 rounded-xl space-y-4 font-mono">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-xs text-white uppercase tracking-wider flex items-center gap-1.5">
                        <Terminal className="w-3.5 h-3.5 text-zinc-450" /> Test Execution Console
                      </h4>
                      <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-mono">Payload JSON</span>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {/* Left: Input Payload */}
                      <div className="space-y-2">
                        <textarea
                          value={testPayloads[tool.name] || "{}"}
                          onChange={(e) => setTestPayloads({ ...testPayloads, [tool.name]: e.target.value })}
                          className="w-full h-40 bg-zinc-900 border border-zinc-850 rounded-xl p-3 text-[11px] text-emerald-400 font-mono focus:outline-none focus:border-zinc-700 focus:ring-1 focus:ring-zinc-700 leading-normal"
                        />
                        <button
                          onClick={() => handleTestSubmit(tool.name)}
                          disabled={testRes?.loading}
                          className="w-full py-2 bg-white hover:bg-zinc-100 text-zinc-950 rounded-xl text-xs font-mono uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-2 font-semibold disabled:opacity-50"
                        >
                          {testRes?.loading ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              <span>Executing Test...</span>
                            </>
                          ) : (
                            <>
                              <Play className="w-3.5 h-3.5 fill-current" />
                              <span>Execute Dry-Run</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* Right: Response Output */}
                      <div className="flex flex-col h-48 lg:h-auto">
                        <div className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1.5 flex items-center justify-between">
                          <span>Output Result</span>
                          {testRes && !testRes.loading && (
                            <span className={testRes.success ? "text-emerald-500 font-semibold" : "text-red-500 font-semibold"}>
                              {testRes.success ? "SUCCESS" : "FAILED"}
                            </span>
                          )}
                        </div>
                        <div className="flex-1 bg-zinc-900 border border-zinc-850 rounded-xl p-3 text-[11px] font-mono overflow-auto max-h-[178px] custom-scrollbar">
                          {testRes?.loading ? (
                            <span className="text-zinc-500 animate-pulse">Running function execution check...</span>
                          ) : testRes ? (
                            <pre className={testRes.success ? "text-emerald-400 whitespace-pre-wrap" : "text-red-400 whitespace-pre-wrap"}>
                              {JSON.stringify(testRes.data, null, 2)}
                            </pre>
                          ) : (
                            <span className="text-zinc-600 italic">No output. Run test execution to check health.</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
