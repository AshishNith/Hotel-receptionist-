import React from "react";
import { Persona } from "../types";
import { Phone, CheckCircle, Edit, Trash2 } from "lucide-react";

interface PersonaListProps {
  selectedPersona: Persona;
  onSelectPersona: (persona: Persona) => void;
  callState: "idle" | "calling" | "connected" | "ended" | "error";
  onStartCall: () => void;
  personas: Persona[];
  onEditPersona?: (persona: Persona) => void;
  onDeletePersona?: (id: string) => void;
}

export const PersonaList: React.FC<PersonaListProps> = ({
  selectedPersona,
  onSelectPersona,
  callState,
  onStartCall,
  personas,
  onEditPersona,
  onDeletePersona,
}) => {
  const isCallActive = callState === "calling" || callState === "connected";

  // Built-in systems shouldn't show delete triggers
  const isCustomAgent = (personaId: string) => {
    return personaId.startsWith("persona_");
  };

  return (
    <div className="flex flex-col h-full bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-sm">
      {/* Title Header */}
      <div className="p-5 border-b border-zinc-200 bg-white flex items-center justify-between">
        <div>
          <h2 className="text-xs font-mono uppercase tracking-[0.2em] text-zinc-500 font-bold">
            Agent Directory
          </h2>
          <p className="text-xs text-zinc-500 font-serif italic mt-0.5">Select a contact below to dial</p>
        </div>
        <span className="px-3 py-1 rounded-full text-[9px] uppercase tracking-wider font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
          {personas.length} Loaded
        </span>
      </div>

      {/* Directory Content List */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
        {personas.map((persona) => {
          const isSelected = selectedPersona.id === persona.id;

          const borderClass = isSelected
            ? "border-zinc-950 bg-zinc-50 shadow-sm"
            : "border-zinc-200 bg-white hover:bg-zinc-50 hover:border-zinc-300";

          const textClass = "text-zinc-500";

          return (
            <div
              key={persona.id}
              className={`group w-full relative transition-all duration-300 rounded-2xl border ${borderClass} ${
                isCallActive && !isSelected ? "opacity-40" : ""
              }`}
            >
              {/* Left Accent line */}
              {isSelected && (
                <div
                  className="absolute left-0 top-0 bottom-0 w-1 rounded-l-full bg-zinc-900"
                />
              )}

              {/* Editing controls for custom agents */}
              {isCustomAgent(persona.id) && !isCallActive && (
                <div className="absolute top-4 right-4 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-30">
                  {onEditPersona && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditPersona(persona);
                      }}
                      className="p-1.5 rounded-lg bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-600 hover:text-zinc-950 transition cursor-pointer"
                      title="Edit Agent Backstory"
                    >
                      <Edit className="w-3 h-3" />
                    </button>
                  )}
                  {onDeletePersona && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Are you sure you want to retire Agent ${persona.name}?`)) {
                          onDeletePersona(persona.id);
                        }
                      }}
                      className="p-1.5 rounded-lg bg-red-50 border border-red-200 hover:bg-red-100 text-red-600 hover:text-red-700 transition cursor-pointer"
                      title="Decommission Agent"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={() => !isCallActive && onSelectPersona(persona)}
                disabled={isCallActive}
                className={`w-full text-left p-4 flex items-start gap-4 cursor-pointer relative overflow-hidden`}
              >
                {/* Avatar Bubble */}
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0 border transition-all duration-300 ${
                    isSelected
                      ? `bg-zinc-100 border-zinc-300 text-zinc-900`
                      : "bg-zinc-50 border-zinc-100 text-zinc-500 group-hover:text-zinc-700"
                  }`}
                >
                  {persona.avatar || "🤖"}
                </div>

                {/* Contact Info */}
                <div className="flex-1 min-w-0 pr-10">
                  <div className="flex items-center justify-between">
                    <h3 className={`text-sm font-medium transition-colors ${isSelected ? 'text-zinc-950 font-bold' : 'text-zinc-900'}`}>
                      {persona.name}
                    </h3>
                  </div>
                  <p className={`text-[10px] font-mono tracking-widest uppercase mt-0.5 ${isSelected ? 'text-zinc-850' : 'text-zinc-500'}`}>
                    {persona.role}
                  </p>
                  <p className="text-xs text-zinc-500 mt-2 line-clamp-2 leading-relaxed font-serif italic">
                    "{persona.description || "No description provided."}"
                  </p>

                  {/* Badges */}
                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    <span className="px-2 py-0.5 rounded-md bg-zinc-100 border border-zinc-200 text-[9px] font-mono text-zinc-600 uppercase tracking-widest">
                      Voice: {persona.voice}
                    </span>
                    {persona.phoneNumber && (
                      <span className="px-2 py-0.5 rounded-md bg-zinc-100 border border-zinc-200 text-[9px] font-mono text-zinc-600 truncate max-w-[120px]">
                        {persona.phoneNumber}
                      </span>
                    )}
                    {isSelected && (
                      <span className="flex items-center gap-1 text-[9px] text-zinc-800 font-mono tracking-widest uppercase font-semibold">
                        <CheckCircle className="w-3 h-3 text-emerald-600" /> Selected
                      </span>
                    )}
                  </div>
                </div>
              </button>
            </div>
          );
        })}
      </div>

      {/* Directory Quick Call bar */}
      <div className="p-5 border-t border-zinc-200 bg-zinc-50">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-[0.2em] block">
              Routing Destination
            </span>
            <span className="text-sm font-semibold text-zinc-900 truncate block mt-0.5">
              {selectedPersona.name}
            </span>
          </div>
          <button
            onClick={onStartCall}
            disabled={isCallActive}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl font-mono text-xs uppercase tracking-widest transition-all duration-300 cursor-pointer ${
              isCallActive
                ? "bg-zinc-100 text-zinc-400 border border-zinc-200 cursor-not-allowed opacity-50 shadow-none"
                : `bg-zinc-950 hover:bg-zinc-900 text-white shadow-none active:scale-95`
            }`}
          >
            <Phone className="w-3.5 h-3.5" />
            Connect
          </button>
        </div>
      </div>
    </div>
  );
};
