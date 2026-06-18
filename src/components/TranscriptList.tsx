import React, { useEffect, useRef } from "react";
import { ChatMessage, Persona } from "../types";
import { MessageSquareOff, MessageSquareCode } from "lucide-react";

interface TranscriptListProps {
  messages: ChatMessage[];
  persona: Persona;
  callState: "idle" | "calling" | "connected" | "ended" | "error";
}

export const TranscriptList: React.FC<TranscriptListProps> = ({
  messages,
  persona,
  callState,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll the container to the bottom on messages update
  useEffect(() => {
    if (messages.length > 0 && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div className="flex flex-col h-full bg-white border border-zinc-200 rounded-3xl overflow-hidden shadow-sm">
      
      {/* Scrollable Transcript Header */}
      <div className="p-6 border-b border-zinc-200 bg-zinc-50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquareCode className="w-4 h-4 text-zinc-500" />
          <div>
            <h2 className="text-xs font-mono uppercase tracking-[0.2em] text-zinc-500">
              Live Speech Transcript
            </h2>
            <p className="text-xs text-zinc-500 font-serif italic mt-0.5">Real-time conversational log</p>
          </div>
        </div>
        <span className="text-[9px] uppercase font-mono bg-zinc-100 border border-zinc-200 text-zinc-650 px-2 py-0.5 rounded-md leading-none tracking-widest">
          UTILITY v3.1
        </span>
      </div>

      {/* Message Stream */}
      <div ref={containerRef} className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar bg-transparent">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-6 text-center">
            <div className="w-12 h-12 rounded-2xl bg-zinc-100 border border-zinc-200 flex items-center justify-center mb-4 shadow-sm">
              <MessageSquareOff className="w-5 h-5 text-zinc-650" />
            </div>
            <h3 className="text-xs font-mono uppercase tracking-widest text-zinc-500 font-semibold">No transcripts yet</h3>
            <p className="text-xs text-zinc-550 mt-2 max-w-[200px] leading-relaxed font-serif italic">
              When the dial connects, spoken dialogues will be transcribed and open here in real time.
            </p>
            {callState === "connected" && (
              <div className="mt-5 px-4 py-2 rounded-xl border border-zinc-200 bg-zinc-50 text-zinc-800 animate-pulse font-mono uppercase tracking-wider">
                Ask: "{persona.initialGreeting.split(".").shift()}"
              </div>
            )}
          </div>
        ) : (
          messages.map((message) => {
            const isAgent = message.role === "agent";

            return (
              <div
                key={message.id}
                className={`flex flex-col ${isAgent ? "items-start" : "items-end"} space-y-1`}
              >
                {/* Speaker bubble indicator */}
                <div className="flex items-center gap-2 px-1">
                  <span className="text-[9px] font-mono font-medium tracking-widest text-zinc-500 uppercase">
                    {isAgent ? persona.name : "You"}
                  </span>
                  <span className="text-[8px] font-mono text-zinc-600">
                    {message.timestamp.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </span>
                </div>

                {/* Speech Bubble body */}
                <div
                  className={`max-w-[90%] rounded-2xl px-4 py-3 leading-relaxed shadow-sm border ${
                    isAgent
                      ? `bg-zinc-50 border-zinc-200 text-zinc-800 rounded-tl-none font-serif text-sm italic`
                      : "bg-blue-50/50 border-blue-100 text-zinc-800 rounded-tr-none text-sm font-serif"
                  }`}
                >
                  <p className="whitespace-pre-wrap">
                    {isAgent ? `"${message.text}"` : message.text}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Suggested Openings / Quick Prompts Footer */}
      {callState === "connected" && (
        <div className="p-5 border-t border-zinc-200 bg-zinc-50">
          <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-[0.2em] block mb-2">
            Suggested Conversation Opening:
          </span>
          <div className="bg-white rounded-2xl p-4 border border-zinc-200 text-xs text-zinc-600 font-serif italic leading-relaxed">
            "{persona.initialGreeting}"
          </div>
        </div>
      )}
    </div>
  );
};
