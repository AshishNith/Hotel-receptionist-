import { useState, useRef, useEffect } from "react";
import { Persona, CallState, ChatMessage } from "./types";
import { AVAILABLE_PERSONAS } from "./data/defaultPersonas";
import { PersonaList } from "./components/PersonaList";
import { DialPad } from "./components/DialPad";
import { CallConsole } from "./components/CallConsole";
import { TranscriptList } from "./components/TranscriptList";
import { CallStats } from "./components/CallStats";
import { AgentCreator } from "./components/AgentCreator";
import { KnowledgeBaseManager } from "./components/KnowledgeBaseManager";
import { AnalyticsDashboard } from "./components/AnalyticsDashboard";
import { OutboundCaller } from "./components/OutboundCaller";
import { ClientPortal } from "./components/ClientPortal";
import { float32ToInt16, arrayBufferToBase64, base64ToFloat32, startAmbientNoise } from "./utils/audio";
import { 
  Phone, CheckCircle, Flame, Shield, Server, ArrowUpRight, 
  Users, Plus, PhoneCall, Database, Sparkles, Trash2, Edit, AlertCircle, Info, Volume2, BarChart3, PhoneOutgoing
} from "lucide-react";

type PageID = "dashboard" | "creator" | "call" | "knowledge" | "analytics" | "outbound";

function resampleFloat32(input: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate) {
    return input;
  }
  const outputLength = Math.max(1, Math.floor(input.length * toRate / fromRate));
  const output = new Float32Array(outputLength);
  const ratio = fromRate / toRate;
  for (let i = 0; i < outputLength; i++) {
    const sourceIndex = i * ratio;
    const leftIndex = Math.floor(sourceIndex);
    const rightIndex = Math.min(leftIndex + 1, input.length - 1);
    const fraction = sourceIndex - leftIndex;
    output[i] = input[leftIndex] * (1 - fraction) + input[rightIndex] * fraction;
  }
  return output;
}

export default function App() {
  const [activePage, setActivePage] = useState<PageID>("dashboard");
  const [sipTutorialTab, setSipTutorialTab] = useState<"sip" | "vobiz" | "asterisk" | "twilio">("sip");
  const [editingPersona, setEditingPersona] = useState<Persona | null>(null);

  // Dynamic state for list of personas loaded from MongoDB
  const [personas, setPersonas] = useState<Persona[]>(AVAILABLE_PERSONAS);
  interface GoogleConnection {
    phoneKey: string;
    connected: boolean;
    expiryDate?: number;
  }
  const [googleConnections, setGoogleConnections] = useState<GoogleConnection[]>([]);
  const [dbStatus, setDbStatus] = useState<"connecting" | "connected" | "error">("connecting");

  const fetchServerPersonas = async () => {
    try {
      const res = await fetch("/api/personas");
      const json = await res.json();
      if (json.success && json.data && json.data.length > 0) {
        setPersonas(json.data);
        setSelectedPersona(json.data[0]);
      }
    } catch (err) {
      console.warn("Could not sync with server-side database. Using offline fallback.", err);
    }
  };

  const fetchGoogleStatus = async () => {
    try {
      const res = await fetch("/api/auth/google/status");
      const json = await res.json();
      if (json.success && json.connections) {
        setGoogleConnections(json.connections);
        setDbStatus("connected");
      }
    } catch (err) {
      console.error("Error fetching Google OAuth status:", err);
      setDbStatus("error");
    }
  };

  // Pull personas and connection statuses on startup and poll integrations
  useEffect(() => {
    fetchServerPersonas();
    fetchGoogleStatus();
    const interval = setInterval(() => {
      fetchGoogleStatus();
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const [selectedPersona, setSelectedPersona] = useState<Persona>(AVAILABLE_PERSONAS[0]);
  const [callState, setCallState] = useState<CallState>("idle");
  const [isMuted, setIsMuted] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [packetCount, setPacketCount] = useState(0);
  const [callStartTime, setCallStartTime] = useState<number | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | undefined>(undefined);

  // Sound activity states
  const [activeVoiceDetect, setActiveVoiceDetect] = useState(false);
  const [activeSpeakerDetect, setActiveSpeakerDetect] = useState(false);

  // Audio Context & WebSocket refs
  const audioCtxRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const ambientNoiseRef = useRef<{ stop: () => void } | null>(null);
  const silenceCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityTimeRef = useRef<number>(0);

  // Coordinated muting & telemetry tracking refs
  const isToolActiveRef = useRef(false);
  const latencyTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const telemetryTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pingMapRef = useRef<Map<number, number>>(new Map());
  const lastPacketTimeRef = useRef<number | null>(null);
  const lastDeltaRef = useRef<number | null>(null);
  const jitterSumRef = useRef<number>(0);
  const jitterCountRef = useRef<number>(0);
  const latencyHistoryRef = useRef<number[]>([]);

  // Callback / Timer references to bypass react closure issues in asynchronous event streams
  const isMutedRef = useRef(isMuted);
  const speakerTimerRef = useRef<NodeJS.Timeout | null>(null);
  const voiceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const activeVoiceDetectRef = useRef(false);
  const activeSpeakerDetectRef = useRef(false);

  // Keep mute status updated in raw stream callbacks
  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  // Clean resources on unmount or on hanging up
  const cleanupCallResources = () => {
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch (err) {}
      wsRef.current = null;
    }

    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => track.stop());
      micStreamRef.current = null;
    }

    if (micProcessorRef.current) {
      try {
        micProcessorRef.current.disconnect();
      } catch (err) {}
      micProcessorRef.current = null;
    }

    activeSourcesRef.current.forEach((source) => {
      try {
        source.stop();
      } catch (err) {}
    });
    activeSourcesRef.current = [];
    nextStartTimeRef.current = 0;

    if (ambientNoiseRef.current) {
      try {
        ambientNoiseRef.current.stop();
      } catch (err) {}
      ambientNoiseRef.current = null;
    }

    if (silenceCheckIntervalRef.current) {
      clearInterval(silenceCheckIntervalRef.current);
      silenceCheckIntervalRef.current = null;
    }

    if (latencyTimerRef.current) {
      clearInterval(latencyTimerRef.current);
      latencyTimerRef.current = null;
    }
    if (telemetryTimerRef.current) {
      clearInterval(telemetryTimerRef.current);
      telemetryTimerRef.current = null;
    }

    pingMapRef.current.clear();
    lastPacketTimeRef.current = null;
    lastDeltaRef.current = null;
    jitterSumRef.current = 0;
    jitterCountRef.current = 0;
    latencyHistoryRef.current = [];
    isToolActiveRef.current = false;
    setLatencyMs(undefined);

    if (speakerTimerRef.current) clearTimeout(speakerTimerRef.current);
    if (voiceTimerRef.current) clearTimeout(voiceTimerRef.current);

    activeVoiceDetectRef.current = false;
    activeSpeakerDetectRef.current = false;
    setActiveSpeakerDetect(false);
    setActiveVoiceDetect(false);
  };

  useEffect(() => {
    return () => {
      cleanupCallResources();
    };
  }, []);

  // Update selection if the selected persona gets deleted/edited
  useEffect(() => {
    const exists = personas.some((p) => p.id === selectedPersona.id);
    if (!exists) {
      setSelectedPersona(personas[0]);
    } else {
      const match = personas.find((p) => p.id === selectedPersona.id);
      if (match) setSelectedPersona(match);
    }
  }, [personas]);

  // Handle incoming transcripts
  const addTranscriptMessage = (role: "user" | "agent", text: string) => {
    setMessages((prev) => {
      if (prev.length === 0) {
        return [{ id: Math.random().toString(), role, text, timestamp: new Date() }];
      }

      const last = prev[prev.length - 1];
      // Append if same speaker spoke within last 12 seconds
      if (last.role === role && Date.now() - last.timestamp.getTime() < 12000) {
        const updated = [...prev];
        updated[updated.length - 1] = {
          ...last,
          text: last.text.endsWith(" ") || text.startsWith(" ") ? last.text + text : last.text + " " + text,
          timestamp: new Date()
        };
        return updated;
      }

      return [
        ...prev,
        { id: Math.random().toString(), role, text, timestamp: new Date() }
      ];
    });
  };

  // Connect to VoIP service
  const startCommunicating = async (personaConfig: Persona) => {
    cleanupCallResources();
    setCallState("calling");
    setErrorMessage("");
    setPacketCount(0);
    setCallStartTime(null);
    setMessages([]);

    try {
      // 1. Authorize micromedia standard streams
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;

      // 2. Audio playback context setup at 16kHz
      const audioCtx = new AudioContext({ sampleRate: 16000 });
      audioCtxRef.current = audioCtx;
      
      if (audioCtx.state === "suspended") {
        await audioCtx.resume();
      }

      // 3. Initiate Proxy VoIP websocket connection on backend
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/api/live`;
      console.log(`[App] Spawning VoIP route: ${wsUrl}`);
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log(`[App] Established VoIP link. Dispatching setup payload...`);
        ws.send(JSON.stringify({
          type: "setup",
          voice: personaConfig.voice,
          systemInstruction: personaConfig.systemInstruction,
          knowledgeBaseId: personaConfig.knowledgeBaseId,
          temperature: personaConfig.temperature,
          personaId: personaConfig.id,
          personaName: personaConfig.name,
        }));
      };

      ws.onmessage = (event) => {
        setPacketCount((p) => p + 1);
        try {
          const payload = JSON.parse(event.data);

          if (payload.type === "pong") {
            const sendTime = pingMapRef.current.get(payload.id);
            if (sendTime) {
              const rtt = Date.now() - sendTime;
              setLatencyMs(rtt);
              latencyHistoryRef.current.push(rtt);
              pingMapRef.current.delete(payload.id);
            }
            return;
          }

          if (payload.type === "status") {
            if (payload.message === "connected") {
              setCallState("connected");
              setCallStartTime(Date.now());
              console.log("[App] Voice line confirmed secure.");

              // Start ambient background noise loops if configured
              if (audioCtxRef.current && personaConfig.ambientSound && personaConfig.ambientSound !== "none") {
                console.log(`[App] Starting ambient noise loop: ${personaConfig.ambientSound}`);
                try {
                  ambientNoiseRef.current = startAmbientNoise(audioCtxRef.current, personaConfig.ambientSound);
                } catch (e) {
                  console.error("Failed to start ambient noise:", e);
                }
              }

              // Initialize silence timer
              lastActivityTimeRef.current = Date.now();
              const timeoutSec = personaConfig.silenceTimeout || 30;
              console.log(`[App] Silence check interval started. Timeout: ${timeoutSec}s`);
              if (silenceCheckIntervalRef.current) clearInterval(silenceCheckIntervalRef.current);
              silenceCheckIntervalRef.current = setInterval(() => {
                const elapsed = (Date.now() - lastActivityTimeRef.current) / 1000;
                if (elapsed >= timeoutSec) {
                  console.log(`[App] Silence timeout exceeded (${elapsed.toFixed(1)}s >= ${timeoutSec}s). Hanging up...`);
                  handleEndCall();
                }
              }, 1000);

              // Latency measurement loop (WebSocket RTT RTT measurement)
              let pingId = 0;
              latencyTimerRef.current = setInterval(() => {
                if (wsRef.current?.readyState === WebSocket.OPEN) {
                  const id = pingId++;
                  pingMapRef.current.set(id, Date.now());
                  wsRef.current.send(JSON.stringify({ type: "ping", id }));
                }
              }, 4000);

              // Periodic Telemetry Reporting loop (every 5 seconds)
              telemetryTimerRef.current = setInterval(() => {
                if (wsRef.current?.readyState === WebSocket.OPEN && latencyHistoryRef.current.length > 0) {
                  const avgLat = Math.round(latencyHistoryRef.current.reduce((a, b) => a + b, 0) / latencyHistoryRef.current.length);
                  const avgJitter = jitterCountRef.current > 0
                    ? Math.round(jitterSumRef.current / jitterCountRef.current)
                    : 0;

                  wsRef.current.send(JSON.stringify({
                    type: "telemetry",
                    latencyMs: avgLat,
                    jitterMs: avgJitter,
                  }));

                  // Reset trackers
                  latencyHistoryRef.current = [];
                  jitterSumRef.current = 0;
                  jitterCountRef.current = 0;
                }
              }, 5000);
            }

            if (payload.message === "tool-active") {
              isToolActiveRef.current = true;
            }
            if (payload.message === "tool-inactive") {
              isToolActiveRef.current = false;
            }
            return;
          }

          if (payload.type === "error") {
            setCallState("error");
            setErrorMessage(payload.message);
            cleanupCallResources();
            return;
          }

          if (payload.type === "output-transcription") {
            addTranscriptMessage("agent", payload.text);
            return;
          }
          if (payload.type === "input-transcription") {
            addTranscriptMessage("user", payload.text);
            return;
          }

          // Handle incoming audio stream packets (PCM)
          if (payload.type === "audio") {
            // Jitter tracking (RFC 3550 variance calculations)
            const now = Date.now();
            if (lastPacketTimeRef.current !== null) {
              const delta = now - lastPacketTimeRef.current;
              if (lastDeltaRef.current !== null) {
                const diff = Math.abs(delta - lastDeltaRef.current);
                jitterSumRef.current += diff;
                jitterCountRef.current++;
              }
              lastDeltaRef.current = delta;
            }
            lastPacketTimeRef.current = now;

            lastActivityTimeRef.current = Date.now(); // reset silence timer
            const rawAudio = payload.data;
            if (!rawAudio) return;

            const floatArr = base64ToFloat32(rawAudio);
            const audioBuffer = audioCtx.createBuffer(1, floatArr.length, 24000);
            audioBuffer.getChannelData(0).set(floatArr);

            const source = audioCtx.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioCtx.destination);

            const currentTime = audioCtx.currentTime;
            let playTime = nextStartTimeRef.current;

            if (playTime < currentTime) {
              playTime = currentTime + 0.04;
            }

            source.start(playTime);
            nextStartTimeRef.current = playTime + audioBuffer.duration;

            activeSourcesRef.current.push(source);
            source.onended = () => {
              activeSourcesRef.current = activeSourcesRef.current.filter((s) => s !== source);
            };

            const bufferDurationMs = audioBuffer.duration * 1000;
            if (!activeSpeakerDetectRef.current) {
              activeSpeakerDetectRef.current = true;
              setActiveSpeakerDetect(true);
            }

            if (speakerTimerRef.current) clearTimeout(speakerTimerRef.current);
            speakerTimerRef.current = setTimeout(() => {
              if (audioCtx.currentTime >= nextStartTimeRef.current - 0.04) {
                activeSpeakerDetectRef.current = false;
                setActiveSpeakerDetect(false);
              }
            }, bufferDurationMs);
          }

          // Interruption event trigger
          if (payload.type === "interrupted") {
            console.log("[App] User speaking interrupted active playout. Stopping source playbacks.");
            activeSourcesRef.current.forEach((src) => {
              try {
                src.stop();
              } catch (err) {}
            });
            activeSourcesRef.current = [];
            nextStartTimeRef.current = 0;
            activeSpeakerDetectRef.current = false;
            setActiveSpeakerDetect(false);
          }

        } catch (err) {
          console.error("VoIP deserialization error:", err);
        }
      };

      ws.onerror = (err) => {
        console.error("[WebSocket Error]", err);
        setCallState("error");
        setErrorMessage("VoIP carrier network error. Please confirm credentials.");
      };

      ws.onclose = (event) => {
        console.log(`[VoIP Line Disconnected] Code: ${event.code}`);
        if (callState === "connected") {
          setCallState("ended");
        }
      };

      // 4. Input stream script processor
      const micSource = audioCtx.createMediaStreamSource(stream);
      const processor = audioCtx.createScriptProcessor(1024, 1, 1);
      micProcessorRef.current = processor;

      micSource.connect(processor);
      processor.connect(audioCtx.destination);

      processor.onaudioprocess = (e) => {
        if (isMutedRef.current || isToolActiveRef.current) return;
        if (wsRef.current?.readyState !== WebSocket.OPEN) return;

        let rawData = e.inputBuffer.getChannelData(0);
        const actualRate = e.inputBuffer.sampleRate;
        if (actualRate !== 16000) {
          rawData = resampleFloat32(rawData, actualRate, 16000) as Float32Array<ArrayBuffer>;
        }

        const pcmBuffer = float32ToInt16(rawData);
        const base64Code = arrayBufferToBase64(pcmBuffer);

        wsRef.current.send(JSON.stringify({
          type: "audio",
          data: base64Code
        }));

        let sum = 0;
        for (let i = 0; i < rawData.length; i++) {
          sum += rawData[i] * rawData[i];
        }
        const rms = Math.sqrt(sum / rawData.length);

        if (rms > 0.015) {
          lastActivityTimeRef.current = Date.now(); // reset silence timer
          if (!activeVoiceDetectRef.current) {
            activeVoiceDetectRef.current = true;
            setActiveVoiceDetect(true);
          }
          if (voiceTimerRef.current) clearTimeout(voiceTimerRef.current);
          voiceTimerRef.current = setTimeout(() => {
            activeVoiceDetectRef.current = false;
            setActiveVoiceDetect(false);
          }, 450);
        }
      };

    } catch (err: any) {
      console.error("[Microphone Error]", err);
      setCallState("error");
      setErrorMessage(err?.message || "Could not spin up carrier audio device. Authorize microphone permission.");
    }
  };

  const handleDialNumber = (number: string) => {
    startCommunicating(selectedPersona);
    setActivePage("call");
  };

  const handleStartCall = () => {
    startCommunicating(selectedPersona);
    setActivePage("call");
  };

  const handleSelectPersonaByPhone = (persona: Persona) => {
    setSelectedPersona(persona);
  };

  const handleToggleMute = () => {
    setIsMuted(!isMuted);
  };

  const handleEndCall = () => {
    cleanupCallResources();
    setCallState("ended");
  };

  // Create or Update Custom Agent in MongoDB
  const handleSaveAgent = (agent: Persona) => {
    fetch("/api/personas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(agent)
    })
    .then((res) => res.json())
    .then((json) => {
      if (json.success) {
        fetchServerPersonas();
      }
    })
    .catch((err) => console.error("[Sync] Error syncing agent with database:", err));

    setSelectedPersona(agent);
    setEditingPersona(null);
    setActivePage("dashboard");
  };

  // Delete Custom Agent from MongoDB
  const handleDeleteAgent = (id: string) => {
    fetch(`/api/personas/${id}`, {
      method: "DELETE"
    })
    .then((res) => res.json())
    .then((json) => {
      if (json.success) {
        fetchServerPersonas();
      }
    })
    .catch((err) => console.error("[Sync] Error deleting agent from database:", err));

    if (selectedPersona.id === id) {
      setSelectedPersona(personas[0] || AVAILABLE_PERSONAS[0]);
    }
  };

  const handleEditAgent = (agent: Persona) => {
    setEditingPersona(agent);
    setActivePage("creator");
  };

  const triggerCallForAgent = (persona: Persona) => {
    setSelectedPersona(persona);
    startCommunicating(persona);
    setActivePage("call");
  };

  const isClientPortal = window.location.pathname === "/client";

  if (isClientPortal) {
    return (
      <div className="min-h-screen bg-[#070301] text-white flex flex-col font-sans relative antialiased select-none">
        
        {/* Cinematic Ambient Glow Layers (Immersive UI specification) */}
        <div className="absolute inset-0 z-0 opacity-40 pointer-events-none">
          <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-emerald-600/20 rounded-full blur-[140px] opacity-25"></div>
          <div className="absolute bottom-[-10%] right-[-5%] w-[500px] h-[500px] bg-blue-900/30 rounded-full blur-[120px] opacity-30"></div>
        </div>

        {/* Brand Header */}
        <header className="border-b border-white/5 bg-white/[0.01] backdrop-blur-md sticky top-0 z-50 px-6 py-4 flex items-center justify-between shadow-2xl relative">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold tracking-tight shadow-md shadow-emerald-500/10">
              CP
            </div>
            <div>
              <h1 className="text-xs sm:text-sm font-semibold tracking-wide text-zinc-100 flex items-center gap-2 font-mono uppercase">
                Grand Imperial <span className="text-[8px] font-mono font-bold uppercase py-0.5 px-2 rounded-md bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.1)]">Client Portal</span>
              </h1>
              <p className="text-[9px] font-mono text-zinc-500 tracking-widest mt-0.5 uppercase">White-Labeled AI Calling Operations</p>
            </div>
          </div>
        </header>

        {/* Main Body */}
        <main className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-6 z-10 flex flex-col justify-center">
          <ClientPortal />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070301] text-white flex flex-col font-sans relative antialiased select-none">
      
      {/* Cinematic Ambient Glow Layers (Immersive UI specification) */}
      <div className="absolute inset-0 z-0 opacity-40 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-orange-600/25 rounded-full blur-[140px] opacity-35"></div>
        <div className="absolute bottom-[-10%] right-[-5%] w-[500px] h-[500px] bg-blue-900/30 rounded-full blur-[120px] opacity-30"></div>
        <div className="absolute top-[40%] left-[30%] w-[300px] h-[300px] bg-white opacity-5 rounded-full blur-[100px]"></div>
      </div>

      {/* Top Navigation & Status Block */}
      <header className="border-b border-white/5 bg-white/[0.01] backdrop-blur-md sticky top-0 z-50 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-2xl relative">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-orange-500 to-amber-600 flex items-center justify-center text-white font-bold tracking-tight shadow-md shadow-orange-500/10">
            AI
          </div>
          <div>
            <h1 className="text-xs sm:text-sm font-semibold tracking-wide text-zinc-100 flex items-center gap-2 font-mono uppercase">
              AI Voice Studio <span className="text-[8px] font-mono font-bold uppercase py-0.5 px-2 rounded-md bg-orange-500/15 text-orange-400 border border-orange-500/20 shadow-[0_0_10px_rgba(249,115,22,0.1)]">v3.1-Live</span>
            </h1>
            <p className="text-[9px] font-mono text-zinc-500 tracking-widest mt-0.5 uppercase">Low-Latency Duplex Customization Center</p>
          </div>
        </div>

        {/* Navigation Tabs - Supporting multipage workflow */}
        <div className="flex items-center gap-1.5 bg-black/60 border border-white/5 p-1 rounded-2xl">
          <button
            onClick={() => setActivePage("dashboard")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono uppercase tracking-wider transition-all cursor-pointer ${
              activePage === "dashboard"
                ? "bg-white/10 text-white border border-white/10 shadow-lg"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <Users className="w-3.5 h-3.5 text-orange-400" />
            <span>Agent Profile</span>
          </button>
          <button
            onClick={() => setActivePage("knowledge")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono uppercase tracking-wider transition-all cursor-pointer ${
              activePage === "knowledge"
                ? "bg-white/10 text-white border border-white/10 shadow-lg"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <Database className="w-3.5 h-3.5 text-orange-400" />
            <span>Knowledge Bases</span>
          </button>
          <button
            onClick={() => setActivePage("call")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono uppercase tracking-wider transition-all relative cursor-pointer ${
              activePage === "call"
                ? "bg-white/10 text-white border border-white/10 shadow-lg"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <PhoneCall className="w-3.5 h-3.5 text-orange-400" />
            <span>VoIP Calling Terminal</span>
            {callState === "connected" && (
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
              </span>
            )}
          </button>
          <button
            onClick={() => setActivePage("analytics")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono uppercase tracking-wider transition-all cursor-pointer ${
              activePage === "analytics"
                ? "bg-white/10 text-white border border-white/10 shadow-lg"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5 text-orange-400" />
            <span>Analytics</span>
          </button>
          <button
            onClick={() => setActivePage("outbound")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono uppercase tracking-wider transition-all cursor-pointer ${
              activePage === "outbound"
                ? "bg-white/10 text-white border border-white/10 shadow-lg"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <PhoneOutgoing className="w-3.5 h-3.5 text-emerald-400" />
            <span>Outbound Call</span>
          </button>
        </div>

        {/* Global telemetry status lines */}
        <div className="hidden xl:flex items-center gap-4 text-[9px] font-mono text-zinc-400 uppercase tracking-widest leading-none">
          <div className="flex items-center gap-1.5 border border-white/5 bg-white/[0.01] px-2.5 py-1.5 rounded-lg">
            <span className="w-2 h-2 bg-green-500 rounded-full shadow-[0_0_8px_#22c55e]"></span>
            <span>Realtime Node Cluster</span>
          </div>
        </div>
      </header>

      {/* Main Container - Renders dynamic page views */}
      <main className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-6 z-10 flex flex-col justify-center">

        {/* 1. AGENT DASHBOARD */}
        {activePage === "dashboard" && (
          <div className="space-y-4">

            {/* Active Agent Profile Card */}
            {selectedPersona && (
              <div className="relative overflow-hidden bg-gradient-to-r from-orange-950/30 via-amber-950/10 to-transparent border border-orange-500/10 rounded-3xl p-5 shadow-2xl">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-3xl shrink-0">
                      {selectedPersona.avatar || "🤖"}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[9px] font-mono uppercase bg-orange-500/15 text-orange-400 border border-orange-500/20 px-2 py-0.5 rounded font-bold tracking-widest">Active</span>
                        <span className="text-[8px] font-mono text-zinc-500">{selectedPersona.voice}</span>
                      </div>
                      <h2 className="text-xl font-semibold tracking-tight text-white">{selectedPersona.name}</h2>
                      <p className="text-[11px] text-zinc-400 font-mono tracking-widest uppercase">{selectedPersona.role}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 w-full md:w-auto">
                    <button onClick={() => handleEditAgent(selectedPersona)} className="flex-1 md:flex-none px-4 py-2.5 rounded-xl border border-white/10 hover:border-white/20 bg-white/[0.02] hover:bg-white/[0.06] text-zinc-200 hover:text-white text-[10px] font-mono uppercase tracking-wider cursor-pointer transition">Configure</button>
                    <button onClick={() => triggerCallForAgent(selectedPersona)} className="flex-1 md:flex-none px-5 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-400 hover:to-amber-500 text-white font-medium text-[10px] font-mono uppercase tracking-wider cursor-pointer transition">Start Call</button>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 border-t border-white/5 pt-4">
                  <div className="md:col-span-2">
                    <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest block mb-1">System Prompt</span>
                    <p className="text-[11px] text-zinc-300 leading-relaxed font-mono bg-black/45 border border-white/5 p-3 rounded-xl max-h-24 overflow-y-auto custom-scrollbar whitespace-pre-wrap">
                      {selectedPersona.systemInstruction}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 font-mono text-[11px] text-zinc-400 bg-black/25 border border-white/5 rounded-xl p-3">
                    <div><span className="text-zinc-500">Temp</span><br /><span className="text-orange-400 font-bold">{(selectedPersona.temperature ?? 0.7).toFixed(2)}</span></div>
                    <div><span className="text-zinc-500">Timeout</span><br /><span className="text-zinc-200 font-bold">{selectedPersona.silenceTimeout ?? 30}s</span></div>
                    <div><span className="text-zinc-500">Noise</span><br /><span className="text-zinc-200 font-bold uppercase text-[9px]">{selectedPersona.ambientSound ?? "none"}</span></div>
                    <div><span className="text-zinc-500">Phone</span><br /><span className="text-indigo-400 font-bold">{selectedPersona.phoneNumber ?? "N/A"}</span></div>
                  </div>
                </div>
              </div>
            )}

            {/* Integrations Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 shadow-xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="flex items-center gap-1.5 text-[9px] font-mono font-bold uppercase tracking-widest text-zinc-500">
                    <Database className="w-3 h-3 text-emerald-400" /> Database
                  </span>
                  <div className="flex items-center gap-1.5">
                    {dbStatus === "connected" && <><span className="w-2 h-2 bg-emerald-500 rounded-full shadow-[0_0_6px_#10b981]"></span><span className="text-[10px] font-mono text-emerald-400">Connected</span></>}
                    {dbStatus === "connecting" && <><span className="w-2 h-2 bg-amber-500 rounded-full animate-bounce"></span><span className="text-[10px] font-mono text-amber-400">Connecting...</span></>}
                    {dbStatus === "error" && <><span className="w-2 h-2 bg-red-500 rounded-full"></span><span className="text-[10px] font-mono text-red-400">Error</span></>}
                  </div>
                </div>
              </div>

              <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 shadow-xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="flex items-center gap-1.5 text-[9px] font-mono font-bold uppercase tracking-widest text-zinc-500">
                    <Sparkles className="w-3 h-3 text-indigo-400" /> Google Workspace
                  </span>
                  <span className="text-[10px] font-mono text-zinc-500">{googleConnections.length} linked</span>
                </div>
                <form onSubmit={(e) => { e.preventDefault(); const f = e.currentTarget; const i = f.elements.namedItem("k") as HTMLInputElement; window.open(`/api/auth/google?phone=${encodeURIComponent(i.value.trim() || "default")}`, "_blank"); i.value = ""; }} className="flex gap-2">
                  <input name="k" type="text" placeholder="Phone key" className="flex-1 bg-black/60 border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] font-mono text-white focus:outline-none focus:border-indigo-500 placeholder:text-zinc-600" />
                  <button type="submit" className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[9px] font-mono uppercase tracking-widest font-bold cursor-pointer whitespace-nowrap">Link</button>
                </form>
              </div>
            </div>

            {/* PSTN / SIP Integration Hub */}
            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 shadow-xl">
              <div className="flex items-center gap-1.5 mb-3">
                <span className="flex items-center gap-1.5 text-[9px] font-mono font-bold uppercase tracking-widest text-zinc-500">
                  <PhoneCall className="w-3 h-3 text-indigo-400" /> PSTN / SIP
                </span>
                <div className="flex gap-1 ml-auto">
                  {(["sip","vobiz","asterisk","twilio"] as const).map((t) => (
                    <button key={t} onClick={() => setSipTutorialTab(t)} className={`px-2.5 py-1 rounded-lg text-[9px] font-mono uppercase tracking-wider cursor-pointer transition ${sipTutorialTab === t ? "bg-indigo-600 text-white" : "text-zinc-400 hover:text-white hover:bg-white/5"}`}>
                      {t === "sip" ? "Universal SIP" : t === "vobiz" ? "Vobiz" : t === "asterisk" ? "Asterisk" : "Twilio"}
                    </button>
                  ))}
                </div>
              </div>

              {sipTutorialTab === "sip" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div className="bg-black/40 border border-white/5 rounded-xl p-3">
                    <div className="text-[8px] font-mono text-zinc-500 uppercase tracking-widest mb-1">WebSocket URI</div>
                    <code className="text-[10px] font-mono text-emerald-400 break-all">{(window.location.protocol === "https:" ? "wss:" : "ws:") + "//" + window.location.host + "/api/sip/live?personaId=" + selectedPersona.id}</code>
                  </div>
                  <div className="bg-black/40 border border-white/5 rounded-xl p-3">
                    <div className="text-[8px] font-mono text-zinc-500 uppercase tracking-widest mb-1">Webhook XML</div>
                    <code className="text-[10px] font-mono text-orange-400 break-all">{window.location.origin + "/api/sip/incoming-call?personaId=" + selectedPersona.id}</code>
                  </div>
                </div>
              )}

              {sipTutorialTab === "vobiz" && (
                <div className="bg-black/40 border border-white/5 rounded-xl p-3">
                  <div className="text-[8px] font-mono text-zinc-500 uppercase tracking-widest mb-1">Vobiz Webhook URL</div>
                  <code className="text-[10px] font-mono text-orange-400 break-all">{window.location.origin + "/api/twilio/incoming-call?personaId=" + selectedPersona.id}</code>
                </div>
              )}

              {sipTutorialTab === "asterisk" && (
                <div>
                  <div className="bg-black/40 border border-white/5 rounded-xl p-3 mb-2">
                    <div className="text-[8px] font-mono text-zinc-500 uppercase tracking-widest mb-1">Dialplan (extensions.conf)</div>
                    <pre className="text-[10px] font-mono text-zinc-300 bg-black/60 p-2 rounded-lg border border-white/5 overflow-x-auto max-h-24">
{`[from-sip-trunk]
exten => _X.,1,Answer()
 same => n,Jack(connect-stream,url=wss://${window.location.host}/api/sip/live?personaId=${selectedPersona.id})
 same => n,Hangup()`}
                    </pre>
                  </div>
                </div>
              )}

              {sipTutorialTab === "twilio" && (
                <div className="bg-black/40 border border-white/5 rounded-xl p-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[8px] font-mono text-zinc-500 uppercase tracking-widest mb-1">Twilio Webhook</div>
                    <code className="text-[10px] font-mono text-orange-400 break-all">{window.location.origin + "/api/twilio/incoming-call?personaId=" + selectedPersona.id}</code>
                  </div>
                  <button onClick={() => { navigator.clipboard.writeText(window.location.origin + "/api/twilio/incoming-call?personaId=" + selectedPersona.id); }} className="shrink-0 px-3 py-1.5 border border-white/10 hover:bg-white/5 text-zinc-300 hover:text-white rounded-lg text-[9px] font-mono uppercase tracking-widest cursor-pointer transition">Copy</button>
                </div>
              )}
            </div>

          </div>
        )}

        {/* 2. AGENT BUILDER WIZARD */}
        {activePage === "creator" && (
          <div className="h-full">
            <AgentCreator
              onSaveAgent={handleSaveAgent}
              onCancel={() => {
                setEditingPersona(null);
                setActivePage("dashboard");
              }}
              editingPersona={editingPersona}
            />
          </div>
        )}

        {/* 3. IMMERSIVE DUPLEX CALLING WORKSPACE */}
        {activePage === "call" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            
            {/* Left Side: Directory of Personas (4 columns) */}
            {/* Left Side: Active Dial pad & call console (6 columns) */}
            <section className="lg:col-span-6 flex flex-col h-[650px]">
              {callState === "idle" || callState === "ended" ? (
                <DialPad
                  onStartCallWithNumber={handleDialNumber}
                  personas={personas}
                  onSelectPersonaByPhone={handleSelectPersonaByPhone}
                  callState={callState}
                />
              ) : (
                <CallConsole
                  callState={callState}
                  persona={selectedPersona}
                  isMuted={isMuted}
                  onToggleMute={handleToggleMute}
                  onEndCall={handleEndCall}
                  errorMessage={errorMessage}
                  activeSpeakerDetect={activeSpeakerDetect}
                  activeVoiceDetect={activeVoiceDetect}
                  latencyMs={latencyMs}
                />
              )}
            </section>

            {/* Right Side: Transcription chat feed (6 columns) */}
            <section className="lg:col-span-6 flex flex-col h-[650px]">
              <TranscriptList
                messages={messages}
                persona={selectedPersona}
                callState={callState}
              />
            </section>

            {/* Bottom Panel: Telemetry Dashboard (Full width - 12 columns) */}
            <section className="lg:col-span-12 mt-2">
              <CallStats
                callState={callState}
                persona={selectedPersona}
                packetCount={packetCount}
                callStartTime={callStartTime}
              />
            </section>
          </div>
        )}

        {/* 4. KNOWLEDGE BASE MANAGER */}
        {activePage === "knowledge" && (
          <div className="h-full">
            <KnowledgeBaseManager
              onBack={() => setActivePage("dashboard")}
            />
          </div>
        )}

        {/* 5. ANALYTICS DASHBOARD */}
        {activePage === "analytics" && (
          <AnalyticsDashboard />
        )}

        {/* 6. OUTBOUND CALLING */}
        {activePage === "outbound" && (
          <OutboundCaller />
        )}

      </main>

      {/* Humble Footer */}
      <footer className="border-t border-white/5 py-6 px-8 text-center text-xs text-zinc-500 bg-transparent z-10 flex flex-col sm:flex-row items-center justify-between gap-3 max-w-7xl mx-auto w-full font-sans">
        <p className="font-serif italic text-zinc-450 text-sm">"Designed for real-time natural dialogues."</p>
        <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-zinc-650">UTILITY PROTOCOL // SECURE HANDSHAKES ACTIVE</p>
      </footer>
    </div>
  );
}
