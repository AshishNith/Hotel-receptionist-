import React, { useState, useEffect } from "react";
import { Persona, KnowledgeBase } from "../types";
import { Wrench, Sparkles, Wand2, Phone, Save, RotateCcw, ArrowLeft, Volume2 } from "lucide-react";

interface AgentCreatorProps {
  onSaveAgent: (newAgent: Persona) => void;
  onCancel: () => void;
  editingPersona?: Persona | null;
}

// Accent palette definitions
const ACCENT_COLORS = [
  { id: "emerald", label: "Emerald Green", class: "bg-emerald-500 border-emerald-400", hex: "#10b981" },
  { id: "amber", label: "Solar Amber", class: "bg-amber-500 border-amber-400", hex: "#f59e0b" },
  { id: "indigo", label: "Quantum Indigo", class: "bg-indigo-500 border-indigo-400", hex: "#6366f1" },
  { id: "rose", label: "Cyber Rose", class: "bg-rose-500 border-rose-400", hex: "#f43f5e" },
  { id: "cyan", label: "Neon Cyan", class: "bg-cyan-500 border-cyan-400", hex: "#06b6d4" },
  { id: "pink", label: "Bubblegum Pink", class: "bg-pink-500 border-pink-400", hex: "#ec4899" },
  { id: "green", label: "Forest Green", class: "bg-green-500 border-green-400", hex: "#22c55e" },
];

// Presets representing emojis
const AVATAR_PRESETS = [
  "🌸", "🧘‍♀️", "👩‍💻", "💼", "✨", 
  "🤖", "🐱", "🧙‍♂️", "🎙️", "👽", 
  "🍕", "🛡️", "🔥", "🦄", "🎯",
  "🤠", "🦁", "🦖", "🕶️", "🧠"
];

// Available voices in Realtime Live
const VOICE_PRESETS = [
  { id: "Zephyr", gender: "Male", desc: "Bright, energetic, modern tone with excellent clarity" },
  { id: "Puck", gender: "Female", desc: "Cheerful, warm, empathetic and highly clear voice" },
  { id: "Charon", gender: "Male", desc: "Deep, serious, steady low voice suited for logical guides" },
  { id: "Kore", gender: "Female", desc: "Intelligent, bright, standard assistant tone" },
  { id: "Fenrir", gender: "Male", desc: "Husky, dramatic, dense cinematic vocal profile" },
  { id: "Aoede", gender: "Female", desc: "Warm, melodic, expressive and relaxing vocal profile" },
];

const PRESET_TEMPLATES = [
  {
    title: "COD Confirm",
    avatar: "📞",
    role: "COD Confirmation Agent",
    description: "Calls customers to confirm details, verify the shipping address, and approve/cancel order. Speaks professionally in Hindi.",
    systemInstruction: "You are Via, the dedicated Cash on Delivery (COD) Confirmation and Address Verification Agent for VeloCart, a premium apparel and clothing brand. Your goal is to call the customer, confirm their order details (including clothing items and sizing), verify their shipping address details, and update the status of the order.\n\nRules & Behaviors:\n1. Greet the customer professionally. Say: \"नमस्ते, मैं VeloCart से वाया बात कर रही हूँ। क्या मेरी बात कस्टमर से हो रही है?\"\n2. Keep the tone professional, polite, direct, and concise (not overly friendly or warm). Speak in Hindi.\n3. If they confirm they are the customer, state the order confirmation details (value, apparel items, and sizing e.g. M, L, XL).\n4. Verify their shipping address by asking exactly in Hindi: \"यह आपके आर्डर का डिलीवरी पता है। क्या मैं इसे इसी तरह कन्फर्म कर दूँ?\"\n5. If they confirm the address is correct as read, call the `verify_shipping_address` tool with isCorrect=true. Then call the `confirm_cod_order` tool with confirmed=true. Thank them professionally and end the call.\n6. If they have address corrections, collect the corrected address and call the `verify_shipping_address` tool with isCorrect=true and correctedAddress. Then call the `confirm_cod_order` tool with confirmed=true. Thank them and end the call.\n7. If they cancel the order (No/Not planning to buy):\n   - Politely ask for the cancellation reason.\n   - Call the `confirm_cod_order` tool with confirmed=false and the reason.\n   - Acknowledge the cancellation professionally and end the call.\n8. Prioritize Hindi for the entire call. Keep statements clear and business-like.",
    initialGreeting: "नमस्ते, मैं VeloCart से वाया बात कर रही हूँ। क्या मेरी बात कस्टमर से हो रही है?",
    accentColor: "emerald"
  },
  {
    title: "Cart Recovery",
    avatar: "🛒",
    role: "Cart Recovery Specialist",
    description: "Triggers after checkout abandonment to answer objections and offer a 10% discount.",
    systemInstruction: "You are Neha, the Abandoned Cart Recovery Agent for VeloCart, a premium clothing brand. Your goal is to answer objections regarding fabric quality, size fit, return policies, or shipping costs and help them recover their checkout.\n\nRules & Behaviors:\n1. Greet the customer and mention they left clothing or apparel items in their checkout cart at VeloCart.\n2. Ask if there was any size fit anxiety, fabric choice questions, or checkout issues that prevented them from completing their order.\n3. Be helpful and resolve their objection (e.g. we offer free size exchanges within 15 days, our fabrics are 100% premium cotton, and standard shipping is free above ₹999).\n4. Offer them a limited-time 10% discount to finish the order. Use coupon code 'SAVE10'.\n5. If they accept:\n   - Call the `apply_cart_discount` tool with cartId, discountCode=\"SAVE10\", and discountValue=10.\n   - Tell them the discount has been applied to their cart, and they will receive a link to checkout via SMS/WhatsApp.\n6. If they decline:\n   - Acknowledge politely and thank them for their time.\n7. Keep messages short and conversational. Speak in Hinglish or English.",
    initialGreeting: "Hi! I noticed you were looking at some clothing items in our store but didn't finish checkout. Is there anything I can help you with?",
    accentColor: "indigo"
  },
  {
    title: "RTO Feedback",
    avatar: "📦",
    role: "RTO & Feedback Agent",
    description: "Calls after a delivery failure (NDR) to schedule a re-attempt, or post-delivery to capture satisfaction ratings.",
    systemInstruction: "You are Raj, the Post-Delivery Feedback and RTO (Return to Origin) Prevention Agent for VeloCart, a premium clothing brand.\n\nRules & Behaviors:\n1. Check the delivery status:\n   - If the delivery failed (NDR - Non-Delivery Report):\n     - Politely explain that our courier partner was unable to deliver their order.\n     - Coordinate a re-attempt date and time slot (morning/afternoon/evening) with them.\n     - Call the `schedule_redelivery` tool to log the date and time.\n     - Confirm that a delivery agent will re-attempt delivery at that time.\n   - If the order was successfully delivered:\n     - Ask them how the apparel fits (perfect, too loose, too tight) and if they are satisfied with the fabric quality.\n     - Ask them to rate their satisfaction with the product on a scale of 1 to 5.\n     - Ask if they have any feedback or issues.\n     - Call the `record_delivery_feedback` tool with their rating and comments.\n2. Be polite, reassuring, and helpful. Speak in Hindi/English.",
    initialGreeting: "Hello, this is VeloCart Delivery Support. I'm calling regarding your recent shipment.",
    accentColor: "rose"
  },
  {
    title: "Inbound Support",
    avatar: "💁‍♀️",
    role: "Support Desk Assistant",
    description: "Handles incoming customer inquiries, answers FAQs (return policies, warranty), and provides live tracking updates.",
    systemInstruction: "You are Priya, the Customer Support and Order Tracking Agent for VeloCart clothing brand.\n\nRules & Behaviors:\n1. Greet the customer. Help them with order tracking, sizing charts, fabric care, or store policy FAQs.\n2. If they ask about order tracking/status:\n   - Ask for their Order ID (e.g. OD-4821).\n   - Call the `track_order_shipment` tool to fetch tracking info.\n   - Read the status, courier details, and estimated delivery date to them.\n3. If they ask general questions (sizing charts, return and exchange policy for clothes, fabric care/washing instructions, shipping time, COD fees):\n   - Call the `get_store_faq` tool with their question to query the database.\n   - Provide the factual answer clearly.\n4. If they are frustrated, angry, or ask for a supervisor, or if their query is too complex:\n   - Reassure them and call the `escalate_to_human` tool to route them to a live support representative.\n5. Always be polite, clear, and efficient.",
    initialGreeting: "Thanks for calling VeloCart Support! How can I assist you with your order status, size exchanges, or fabric care today?",
    accentColor: "cyan"
  }
];

export const AgentCreator: React.FC<AgentCreatorProps> = ({
  onSaveAgent,
  onCancel,
  editingPersona,
}) => {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [description, setDescription] = useState("");
  const [systemInstruction, setSystemInstruction] = useState("");
  const [voice, setVoice] = useState<"Zephyr" | "Puck" | "Charon" | "Kore" | "Fenrir" | "Aoede">("Zephyr");
  const [accentColor, setAccentColor] = useState("cyan");
  const [avatar, setAvatar] = useState("🌸");
  const [initialGreeting, setInitialGreeting] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [knowledgeBaseId, setKnowledgeBaseId] = useState<string>("");
  const [ambientSound, setAmbientSound] = useState<"none" | "office" | "cafe" | "airport">("none");
  const [silenceTimeout, setSilenceTimeout] = useState<number>(30);
  const [temperature, setTemperature] = useState<number>(0.7);
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);

  // Fetch knowledge bases from server on mount
  useEffect(() => {
    async function fetchKBs() {
      try {
        const res = await fetch("/api/knowledge-bases");
        const json = await res.json();
        if (json.success && json.data) {
          setKnowledgeBases(json.data);
        }
      } catch (err) {
        console.error("Failed to fetch knowledge bases:", err);
      }
    }
    fetchKBs();
  }, []);

  // Populate form if editing
  useEffect(() => {
    if (editingPersona) {
      setName(editingPersona.name);
      setRole(editingPersona.role);
      setDescription(editingPersona.description || "");
      setSystemInstruction(editingPersona.systemInstruction);
      setVoice(editingPersona.voice);
      setAccentColor(editingPersona.accentColor);
      setAvatar(editingPersona.avatar || "🤖");
      setInitialGreeting(editingPersona.initialGreeting || "");
      setPhoneNumber(editingPersona.phoneNumber || "");
      setKnowledgeBaseId(editingPersona.knowledgeBaseId || "");
      setAmbientSound(editingPersona.ambientSound || "none");
      setSilenceTimeout(editingPersona.silenceTimeout || 30);
      setTemperature(editingPersona.temperature || 0.7);
    } else {
      // Auto generate random phone number & default values
      const randomPhone = `+1 (555) ${Math.floor(100 + Math.random() * 900)}-${Math.floor(1000 + Math.random() * 9000)}`;
      setPhoneNumber(randomPhone);
      setAvatar("🤖");
      setKnowledgeBaseId("");
      setAmbientSound("none");
      setSilenceTimeout(30);
      setTemperature(0.7);
    }
  }, [editingPersona]);

  // Apply a template
  const applyTemplate = (template: typeof PRESET_TEMPLATES[0]) => {
    setName(template.title);
    setRole(template.role);
    setDescription(template.description);
    setSystemInstruction(template.systemInstruction);
    setAccentColor(template.accentColor);
    setAvatar(template.avatar);
    setInitialGreeting(template.initialGreeting);
  };

  const handleReset = () => {
    if (editingPersona) {
      setName(editingPersona.name);
      setRole(editingPersona.role);
      setDescription(editingPersona.description || "");
      setSystemInstruction(editingPersona.systemInstruction);
      setVoice(editingPersona.voice);
      setAccentColor(editingPersona.accentColor);
      setAvatar(editingPersona.avatar || "🤖");
      setInitialGreeting(editingPersona.initialGreeting || "");
      setPhoneNumber(editingPersona.phoneNumber || "");
      setKnowledgeBaseId(editingPersona.knowledgeBaseId || "");
      setAmbientSound(editingPersona.ambientSound || "none");
      setSilenceTimeout(editingPersona.silenceTimeout || 30);
      setTemperature(editingPersona.temperature || 0.7);
    } else {
      setName("");
      setRole("");
      setDescription("");
      setSystemInstruction("");
      setVoice("Zephyr");
      setAccentColor("cyan");
      setAvatar("🌸");
      setInitialGreeting("");
      setPhoneNumber(`+1 (555) ${Math.floor(100 + Math.random() * 900)}-${Math.floor(1000 + Math.random() * 9000)}`);
      setKnowledgeBaseId("");
      setAmbientSound("none");
      setSilenceTimeout(30);
      setTemperature(0.7);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !role.trim() || !systemInstruction.trim()) {
      alert("Please fill in the Name, Role/Sub-title, and System Instructions!");
      return;
    }

    const BG_THEME_MAP: Record<string, string> = {
      emerald: "bg-emerald-500/10",
      amber: "bg-amber-500/10",
      indigo: "bg-indigo-500/10",
      rose: "bg-rose-500/10",
      cyan: "bg-cyan-500/10",
      pink: "bg-pink-500/10",
      green: "bg-green-500/10"
    };

    const BORDER_THEME_MAP: Record<string, string> = {
      emerald: "border-emerald-500/30",
      amber: "border-orange-500/30",
      indigo: "border-indigo-500/30",
      rose: "border-rose-500/30",
      cyan: "border-cyan-500/30",
      pink: "border-pink-500/30",
      green: "border-green-500/30"
    };

    const calculatedBg = BG_THEME_MAP[accentColor] || "bg-cyan-500/10";
    const calculatedBorder = BORDER_THEME_MAP[accentColor] || "border-cyan-500/30";

    const savedAgent: Persona = {
      id: editingPersona?.id || `persona_${Date.now()}`,
      name: name.trim(),
      role: role.trim(),
      description: description.trim() || `A customized conversational AI agent configured with unique dialogue profiles.`,
      voice,
      systemInstruction: systemInstruction.trim(),
      accentColor,
      bgColor: calculatedBg,
      borderColor: calculatedBorder,
      avatar,
      initialGreeting: initialGreeting.trim() || "Hello! Connected and ready.",
      phoneNumber: phoneNumber.trim() || "+1 (555) VoIP-LINK",
      knowledgeBaseId: knowledgeBaseId || undefined,
      ambientSound,
      silenceTimeout,
      temperature
    };

    onSaveAgent(savedAgent);
  };

  return (
    <div className="flex flex-col w-full text-zinc-800 p-2">
      
      {/* Header Panel */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between pb-6 border-b border-zinc-200 mb-6 gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onCancel}
            className="p-2.5 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-500 hover:text-zinc-900 transition duration-200 cursor-pointer"
            title="Go Back"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-lg font-mono uppercase tracking-[0.2em] text-zinc-900 flex items-center gap-2">
              <Wrench className="w-5 h-5 text-zinc-900" />
              Configure Agent Profile
            </h2>
            <p className="text-xs text-zinc-500 font-serif italic mt-0.5">
              Customize real-time prompt parameters, voice acoustics, and interface visuals.
            </p>
          </div>
        </div>

        {/* Quick Presets Selection */}
        <div className="flex flex-wrap items-center gap-2 bg-zinc-50 border border-zinc-200 p-2 rounded-2xl w-full lg:w-auto">
          <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 px-2 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-zinc-650 animate-pulse" /> Apply Preset:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {PRESET_TEMPLATES.map((tmpl) => (
              <button
                key={tmpl.title}
                type="button"
                onClick={() => applyTemplate(tmpl)}
                className="px-2.5 py-1.5 rounded-xl text-[11px] font-mono border border-zinc-200 bg-white hover:bg-zinc-100 hover:border-zinc-400 text-zinc-700 hover:text-zinc-900 transition duration-200 cursor-pointer flex items-center gap-1.5 shadow-sm"
              >
                <span>{tmpl.avatar}</span>
                <span>{tmpl.title}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Configuration form */}
      <form onSubmit={handleSubmit} className="space-y-6 flex-1">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* LEFT PANEL: Basic Visual Specs */}
          <div className="space-y-6">
            
            {/* Name input */}
            <div>
              <label className="block text-xs font-mono uppercase tracking-widest text-zinc-500 mb-2">
                Agent Signature Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Mentor Jordan"
                className="w-full bg-white border border-zinc-200 rounded-2xl p-3.5 text-sm text-zinc-900 focus:outline-none focus:border-zinc-950 transition duration-300 font-sans"
              />
            </div>

            {/* Role input */}
            <div>
              <label className="block text-xs font-mono uppercase tracking-widest text-zinc-500 mb-2">
                Role / Sub-line *
              </label>
              <input
                type="text"
                required
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="e.g. AI Career Coach or Spanish Teacher"
                className="w-full bg-white border border-zinc-200 rounded-2xl p-3.5 text-sm text-zinc-900 focus:outline-none focus:border-zinc-950 transition duration-300 font-sans"
              />
            </div>

            {/* Phone Number simulated */}
            <div>
              <label className="block text-xs font-mono uppercase tracking-widest text-zinc-500 mb-2">
                Simulated Calling Route No.
              </label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  type="text"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+1 (555) 012-3456"
                  className="w-full bg-white border border-zinc-200 rounded-2xl pl-10 pr-4 p-3.5 text-sm font-mono text-zinc-900 focus:outline-none focus:border-zinc-950 transition duration-300"
                />
              </div>
            </div>

            {/* Accent Theme Select */}
            <div>
              <label className="block text-xs font-mono uppercase tracking-widest text-zinc-500 mb-3">
                Card Interface Highlight Palette
              </label>
              <div className="flex items-center gap-3 bg-zinc-50 p-3 rounded-2xl border border-zinc-200">
                {ACCENT_COLORS.map((color) => {
                  const isSelected = accentColor === color.id;
                  return (
                    <button
                      key={color.id}
                      type="button"
                      onClick={() => setAccentColor(color.id)}
                      className={`w-9 h-9 rounded-xl flex items-center justify-center cursor-pointer transition-all duration-300 ${color.class} ${
                        isSelected 
                          ? "ring-2 ring-zinc-950 scale-110 shadow-sm" 
                          : "opacity-45 hover:opacity-85"
                      }`}
                      title={color.label}
                    >
                      {isSelected && (
                        <span className="text-[10px] text-white">●</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Avatar Preset Grid */}
            <div>
              <label className="block text-xs font-mono uppercase tracking-widest text-zinc-500 mb-3">
                Agent Interface Avatar
              </label>
              <div className="bg-zinc-50 p-4 rounded-2xl border border-zinc-200 max-h-[160px] overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-6 gap-2">
                  {AVATAR_PRESETS.map((av) => {
                    const isSelected = avatar === av;
                    return (
                      <button
                        key={av}
                        type="button"
                        onClick={() => setAvatar(av)}
                        className={`h-11 rounded-xl text-xl flex items-center justify-center transition-all cursor-pointer ${
                          isSelected 
                            ? "bg-white border border-zinc-300 scale-105" 
                            : "bg-white/50 hover:bg-white border border-zinc-200 text-zinc-700"
                        }`}
                      >
                        {av}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

          </div>

          {/* RIGHT PANEL: Voice & Instructions Setups */}
          <div className="space-y-6">
            
            {/* Voice select */}
            <div>
              <label className="block text-xs font-mono uppercase tracking-widest text-zinc-500 mb-2">
                Realtime Synthesizer Acoustics *
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[220px] overflow-y-auto custom-scrollbar border border-zinc-200 bg-zinc-50 p-3 rounded-2xl">
                {VOICE_PRESETS.map((v) => {
                  const isSelected = voice === v.id;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setVoice(v.id as any)}
                      className={`p-3 rounded-xl border text-left transition duration-200 cursor-pointer flex flex-col justify-between h-20 ${
                        isSelected
                          ? "bg-zinc-100 border-zinc-400"
                          : "bg-white border-zinc-200 hover:bg-zinc-50"
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="text-xs font-bold font-mono text-zinc-800 truncate">{v.id}</span>
                        <span className="text-[9px] font-mono uppercase bg-zinc-200 px-1.5 py-0.5 rounded text-zinc-650">
                          {v.gender}
                        </span>
                      </div>
                      <p className="text-[10px] text-zinc-500 leading-tight line-clamp-2 mt-1">
                        {v.desc}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Description (Card Bio) */}
            <div>
              <label className="block text-xs font-mono uppercase tracking-widest text-zinc-500 mb-2">
                Brief Directory Card Biography
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="A gentle prompt trainer who coaches healthy mental clarity."
                rows={2}
                className="w-full bg-white border border-zinc-200 rounded-2xl p-3.5 text-sm text-zinc-900 focus:outline-none focus:border-zinc-950 transition duration-300 font-sans resize-none"
              />
            </div>

            {/* Initial Greeting */}
            <div>
              <label className="block text-xs font-mono uppercase tracking-widest text-zinc-500 mb-2">
                Opening Greeting Trigger Line
              </label>
              <input
                type="text"
                value={initialGreeting}
                onChange={(e) => setInitialGreeting(e.target.value)}
                placeholder="नमस्ते! मैं आपका डिजिटल सहायक हूँ।"
                className="w-full bg-white border border-zinc-200 rounded-2xl p-3.5 text-sm text-zinc-900 focus:outline-none focus:border-zinc-950 transition duration-300 font-sans"
              />
              <p className="text-[9px] font-mono text-zinc-500 uppercase mt-1">Used to hint the caller how to start conversation immediately</p>
            </div>

            {/* Knowledge Base Link */}
            <div>
              <label className="block text-xs font-mono uppercase tracking-widest text-zinc-500 mb-2">
                Link Knowledge Base
              </label>
              <select
                value={knowledgeBaseId}
                onChange={(e) => setKnowledgeBaseId(e.target.value)}
                className="w-full bg-white border border-zinc-200 rounded-2xl p-3.5 text-sm text-zinc-800 focus:outline-none focus:border-zinc-950 transition"
              >
                <option value="">None (No custom documents linked)</option>
                {knowledgeBases.map((kb) => (
                  <option key={kb.id} value={kb.id}>
                    {kb.name} ({kb.documents.length} docs)
                  </option>
                ))}
              </select>
            </div>

            {/* Ambient Sound Dropdown */}
            <div>
              <label className="block text-xs font-mono uppercase tracking-widest text-zinc-500 mb-2">
                Ambient Background Noise
              </label>
              <select
                value={ambientSound}
                onChange={(e) => setAmbientSound(e.target.value as any)}
                className="w-full bg-white border border-zinc-200 rounded-2xl p-3.5 text-sm text-zinc-800 focus:outline-none focus:border-zinc-950 transition"
              >
                <option value="none">None (Dead Silence)</option>
                <option value="office">Office AC Hum</option>
                <option value="cafe">Cafe Crowd Murmur & Clinks</option>
                <option value="airport">Airport Terminal Wash & Chimes</option>
              </select>
            </div>

            {/* Temperature Slider */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-mono uppercase tracking-widest text-zinc-500">
                  Model Temperature: <span className="text-zinc-900 font-bold">{temperature.toFixed(2)}</span>
                </label>
                <span className="text-[10px] text-zinc-500">
                  {temperature <= 0.3 ? "Deterministic/Factual" : temperature <= 0.7 ? "Balanced" : "Creative/Playful"}
                </span>
              </div>
              <input
                type="range"
                min="0.0"
                max="1.5"
                step="0.05"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                className="w-full accent-zinc-950 bg-zinc-200 h-1.5 rounded-lg cursor-pointer"
              />
            </div>

            {/* Silence Timeout Slider */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-mono uppercase tracking-widest text-zinc-500">
                  Silence Timeout: <span className="text-zinc-900 font-bold">{silenceTimeout}s</span>
                </label>
              </div>
              <input
                type="range"
                min="5"
                max="120"
                step="5"
                value={silenceTimeout}
                onChange={(e) => setSilenceTimeout(parseInt(e.target.value))}
                className="w-full accent-zinc-950 bg-zinc-200 h-1.5 rounded-lg cursor-pointer"
              />
            </div>

          </div>

        </div>

        {/* System Instructions Prompt Box (Spans full width) */}
        <div className="mt-8 border-t border-zinc-200 pt-6">
          <label className="block text-xs font-mono uppercase tracking-widest text-zinc-500 mb-2">
            System Backstory / Prompt Instructions (Core Brain) *
          </label>
          <textarea
            required
            value={systemInstruction}
            onChange={(e) => setSystemInstruction(e.target.value)}
            placeholder="Write the core instructions for the model behavior. Example: You are a bilingual teacher..."
            rows={5}
            className="w-full bg-white border border-zinc-200 rounded-2xl p-4 text-xs font-mono leading-relaxed text-zinc-800 focus:outline-none focus:border-zinc-950 transition duration-300"
          />
          <p className="text-[10px] text-zinc-500 font-serif italic mt-1.5">
            This represents the core system prompt payload. This exact text defines the agent's tone, constraints, and operational mission when establishing the VoIP stream.
          </p>
        </div>

        {/* Controls block */}
        <div className="flex items-center justify-end gap-4 border-t border-zinc-200 pt-6">
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-2 px-6 py-3 rounded-2xl border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 hover:text-zinc-900 transition duration-200 cursor-pointer font-mono text-xs uppercase tracking-widest"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Form
          </button>
          <button
            type="submit"
            className="flex items-center gap-2 px-8 py-3.5 rounded-2xl bg-zinc-950 hover:bg-zinc-900 text-white font-semibold transition duration-200 shadow-sm cursor-pointer font-mono text-xs uppercase tracking-widest"
          >
            <Save className="w-4 h-4" />
            Save Agent
          </button>
        </div>

      </form>

    </div>
  );
};
