import React, { useState, useEffect, useRef } from "react";
import { useClientConfig } from "../../config/ThemeProvider";
import { AudioLines, Play, Square, RefreshCw, Sparkles, CheckCircle2, UserCheck } from "lucide-react";
import { Persona } from "../../types";
import { base64ToFloat32 } from "../../utils/audio";

const VOICE_SAMPLES = [
  { id: "Zephyr", name: "Zephyr", language: "English (US)", gender: "Male", accent: "Neutral American", style: "Bright, energetic, modern tone with excellent clarity" },
  { id: "Puck", name: "Puck", language: "English (UK)", gender: "Male", accent: "British Accent", style: "Cheerful, warm, empathetic and highly clear voice" },
  { id: "Charon", name: "Charon", language: "English (US)", gender: "Male", accent: "American Low-pitch", style: "Deep, serious, steady low voice suited for logical guides" },
  { id: "Kore", name: "Kore", language: "English (US)", gender: "Female", accent: "American Accent", style: "Intelligent, bright, standard assistant tone" },
  { id: "Fenrir", name: "Fenrir", language: "English (US)", gender: "Male", accent: "Cinematic Accent", style: "Husky, dramatic, dense cinematic vocal profile" },
  { id: "Aoede", name: "Aoede", language: "English (US)", gender: "Female", accent: "Clear Melodic", style: "Warm, melodic, expressive and relaxing vocal profile" },
];

export function VoicesPage() {
  const config = useClientConfig();
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);

  // Preview player refs
  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const previewTimeoutRef = useRef<any>(null);

  useEffect(() => {
    async function fetchPersonas() {
      try {
        const res = await fetch("/api/personas");
        const json = await res.json();
        if (json.success && json.data) {
          setPersonas(json.data);
        }
      } catch (err) {
        console.error("Failed to fetch personas for voices mapping:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchPersonas();

    return () => {
      stopVoicePreview();
    };
  }, []);

  const stopVoicePreview = () => {
    if (previewTimeoutRef.current) {
      clearTimeout(previewTimeoutRef.current);
      previewTimeoutRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
    nextStartTimeRef.current = 0;
    setPlayingVoiceId(null);
  };

  const startVoicePreview = async (voiceId: string) => {
    stopVoicePreview();
    setPlayingVoiceId(voiceId);

    try {
      // 1. Audio playback context setup at 24kHz (Gemini rate)
      const audioCtx = new AudioContext({ sampleRate: 24000 });
      audioCtxRef.current = audioCtx;
      nextStartTimeRef.current = audioCtx.currentTime;

      // 2. Open temporary WebSocket
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/api/live`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        // Send a minimal setup payload.
        // We instruct Gemini to say a fixed preview message and then shut up.
        ws.send(JSON.stringify({
          type: "setup",
          voice: voiceId,
          systemInstruction: `You are testing the voice preview. Say exactly: "Hello! I am the ${voiceId} voice. I am ready to handle your outbound client calls." and nothing else. Do not respond to further input.`,
          initialGreeting: `Hello! I am the ${voiceId} voice. I am ready to handle your outbound client calls.`,
          temperature: 0.2
        }));
      };

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === "audio" && payload.data) {
            const floatArr = base64ToFloat32(payload.data);
            const audioBuffer = audioCtx.createBuffer(1, floatArr.length, 24000);
            audioBuffer.getChannelData(0).set(floatArr);

            const source = audioCtx.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioCtx.destination);

            const currentTime = audioCtx.currentTime;
            let playTime = nextStartTimeRef.current;
            if (playTime < currentTime) {
              playTime = currentTime + 0.02;
            }
            source.start(playTime);
            nextStartTimeRef.current = playTime + audioBuffer.duration;
          }
        } catch (e) {
          console.error("Error parsing preview audio:", e);
        }
      };

      ws.onerror = (e) => {
        console.error("Voice preview socket error:", e);
        stopVoicePreview();
      };

      // Auto stop after 5.5 seconds
      previewTimeoutRef.current = setTimeout(() => {
        stopVoicePreview();
      }, 5500);

    } catch (err) {
      console.error("Failed to start voice preview:", err);
      stopVoicePreview();
    }
  };

  const togglePreview = (voiceId: string) => {
    if (playingVoiceId === voiceId) {
      stopVoicePreview();
    } else {
      startVoicePreview(voiceId);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="w-6 h-6 animate-spin text-zinc-400 mr-3" />
        <span className="text-sm font-mono text-zinc-500">Loading voice profiles...</span>
      </div>
    );
  }

  return (
    <div className="placeholder-page">
      <div className="placeholder-header flex justify-between items-center">
        <div>
          <h2 className="placeholder-title flex items-center gap-2">
            <AudioLines className="w-6 h-6 text-zinc-900" style={{ color: config.brand.accentColor }} />
            Voice Directory
          </h2>
          <p className="text-xs text-zinc-500 font-mono tracking-wider mt-1 uppercase">
            Preview Gemini Live prebuilt voices and check assignment mappings
          </p>
        </div>
        <span className="text-[10px] font-mono bg-zinc-100 border border-zinc-200 text-zinc-650 px-2.5 py-1 rounded-xl shadow-sm uppercase tracking-wider">
          {VOICE_SAMPLES.length} Gemini Voices
        </span>
      </div>

      <div className="voices-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {VOICE_SAMPLES.map((voice) => {
          const activePersonas = personas.filter((p) => p.voice === voice.id);
          const isPlaying = playingVoiceId === voice.id;

          return (
            <div key={voice.id} className="voice-card bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm hover:border-zinc-400 transition flex flex-col justify-between h-48 relative overflow-hidden">
              <div className="voice-card-header flex items-start gap-4">
                <div
                  className="voice-card-avatar w-10 h-10 rounded-xl flex items-center justify-center border shrink-0 transition"
                  style={{
                    background: `linear-gradient(135deg, ${config.brand.accentGradientFrom}15, ${config.brand.accentGradientTo}08)`,
                    borderColor: isPlaying ? config.brand.accentColor : `${config.brand.accentColor}18`,
                  }}
                >
                  <AudioLines className={`w-5 h-5 ${isPlaying ? "animate-pulse" : ""}`} style={{ color: config.brand.accentColor }} />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="voice-card-name text-sm font-bold text-zinc-950 flex items-center gap-1.5">
                    {voice.name}
                    {isPlaying && (
                      <span className="flex h-1.5 w-1.5 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                      </span>
                    )}
                  </h4>
                  <span className="voice-card-meta text-[10px] text-zinc-500 font-mono uppercase tracking-wider block">
                    {voice.gender} · {voice.accent}
                  </span>
                </div>
              </div>
              
              <p className="voice-card-style text-[11px] text-zinc-600 line-clamp-2 leading-relaxed mt-2 font-sans">
                {voice.style}
              </p>

              {/* Persona Assignments Mapping */}
              <div className="mt-3 flex flex-wrap gap-1 text-[9px] font-mono">
                {activePersonas.length > 0 ? (
                  <>
                    <span className="text-emerald-700 flex items-center gap-1 font-bold">
                      <UserCheck className="w-3 h-3" /> Active on:
                    </span>
                    {activePersonas.map(p => (
                      <span key={p.id} className="bg-emerald-50 text-emerald-800 px-1.5 py-0.5 rounded border border-emerald-100">
                        {p.name}
                      </span>
                    ))}
                  </>
                ) : (
                  <span className="text-zinc-400 italic">Not assigned to any persona</span>
                )}
              </div>

              <div className="voice-card-footer flex items-center justify-between mt-4 pt-3 border-t border-zinc-100">
                <span className="voice-card-lang text-[10px] font-mono uppercase text-zinc-400">
                  {voice.language}
                </span>
                <button
                  onClick={() => togglePreview(voice.id)}
                  className={`voice-card-play-btn px-3 py-1.5 rounded-xl border text-[10px] font-mono uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition ${
                    isPlaying 
                      ? "bg-zinc-950 text-white border-zinc-950 hover:bg-zinc-900" 
                      : "bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50"
                  }`}
                  style={!isPlaying ? { borderColor: `${config.brand.accentColor}30`, color: config.brand.accentColor } : undefined}
                >
                  {isPlaying ? (
                    <>
                      <Square className="w-3 h-3 fill-current text-white" />
                      Stop
                    </>
                  ) : (
                    <>
                      <Play className="w-3 h-3 fill-current" />
                      Preview
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
