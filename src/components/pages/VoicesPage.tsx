import React from "react";
import { useClientConfig } from "../../config/ThemeProvider";
import { AudioLines, Play, Pause } from "lucide-react";

const VOICE_SAMPLES = [
  { id: "Zephyr", name: "Zephyr", language: "English", gender: "Neutral", accent: "American", style: "Warm & professional" },
  { id: "Puck", name: "Puck", language: "English", gender: "Male", accent: "British", style: "Friendly & upbeat" },
  { id: "Charon", name: "Charon", language: "English", gender: "Male", accent: "American", style: "Deep & authoritative" },
  { id: "Kore", name: "Kore", language: "English", gender: "Female", accent: "American", style: "Soft & empathetic" },
  { id: "Fenrir", name: "Fenrir", language: "English", gender: "Male", accent: "Nordic", style: "Bold & energetic" },
  { id: "Aoede", name: "Aoede", language: "English", gender: "Female", accent: "American", style: "Clear & articulate" },
];

export function VoicesPage() {
  const config = useClientConfig();

  return (
    <div className="placeholder-page">
      <div className="placeholder-header">
        <h2 className="placeholder-title">Voices</h2>
        <span className="voices-count-badge">
          {VOICE_SAMPLES.length} voices available
        </span>
      </div>

      <div className="voices-grid">
        {VOICE_SAMPLES.map((voice) => (
          <div key={voice.id} className="voice-card">
            <div className="voice-card-header">
              <div
                className="voice-card-avatar"
                style={{
                  background: `linear-gradient(135deg, ${config.brand.accentGradientFrom}30, ${config.brand.accentGradientTo}15)`,
                  borderColor: `${config.brand.accentColor}25`,
                }}
              >
                <AudioLines className="w-5 h-5" style={{ color: config.brand.accentColor }} />
              </div>
              <div>
                <h4 className="voice-card-name">{voice.name}</h4>
                <span className="voice-card-meta">{voice.gender} · {voice.accent}</span>
              </div>
            </div>
            <p className="voice-card-style">{voice.style}</p>
            <div className="voice-card-footer">
              <span className="voice-card-lang">{voice.language}</span>
              <button
                className="voice-card-play-btn"
                style={{ borderColor: `${config.brand.accentColor}30`, color: config.brand.accentColor }}
              >
                <Play className="w-3.5 h-3.5" />
                Preview
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
