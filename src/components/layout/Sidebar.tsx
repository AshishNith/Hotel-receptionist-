import React, { useState } from "react";
import { useClientConfig } from "../../config/ThemeProvider";
import {
  LayoutDashboard,
  Users,
  Megaphone,
  PhoneCall,
  AudioLines,
  Coins,
  Settings,
  Database,
  BarChart3,
  PhoneOutgoing,
  ChevronLeft,
  ChevronRight,
  Cpu,
} from "lucide-react";

export type SidebarPageID =
  | "dashboard"
  | "agents"
  | "campaigns"
  | "calls"
  | "voices"
  | "credits"
  | "settings"
  | "knowledge"
  | "analytics"
  | "outbound"
  | "creator"
  | "call-terminal"
  | "tools";

interface NavItem {
  id: SidebarPageID;
  label: string;
  icon: React.ReactNode;
  featureKey?: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: <LayoutDashboard className="w-[18px] h-[18px]" /> },
  { id: "agents", label: "Agents", icon: <Users className="w-[18px] h-[18px]" />, featureKey: "agents" },
  { id: "knowledge", label: "Knowledge Base", icon: <Database className="w-[18px] h-[18px]" />, featureKey: "knowledgeBases" },
  { id: "tools", label: "Tools", icon: <Cpu className="w-[18px] h-[18px]" /> },
  { id: "campaigns", label: "Campaigns", icon: <Megaphone className="w-[18px] h-[18px]" />, featureKey: "campaigns" },
  { id: "calls", label: "Calls", icon: <PhoneCall className="w-[18px] h-[18px]" />, featureKey: "calls" },
  { id: "voices", label: "Voices", icon: <AudioLines className="w-[18px] h-[18px]" />, featureKey: "voices" },
  { id: "credits", label: "Credits", icon: <Coins className="w-[18px] h-[18px]" />, featureKey: "credits" },
  { id: "settings", label: "Settings", icon: <Settings className="w-[18px] h-[18px]" />, featureKey: "settings" },
];

interface SidebarProps {
  activePage: SidebarPageID;
  onNavigate: (page: SidebarPageID) => void;
  callActive?: boolean;
}

export function Sidebar({ activePage, onNavigate, callActive }: SidebarProps) {
  const config = useClientConfig();
  const [collapsed, setCollapsed] = useState(false);

  const filteredNav = NAV_ITEMS.filter((item) => {
    if (!item.featureKey) return true;
    return config.features[item.featureKey as keyof typeof config.features] !== false;
  });

  const formatCredits = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1).replace(/\.0$/, "")}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(0)}K`;
    return n.toLocaleString();
  };

  return (
    <aside
      className={`sidebar-container ${collapsed ? "sidebar-collapsed" : ""}`}
      style={{
        width: collapsed ? 72 : 240,
        minWidth: collapsed ? 72 : 240,
      }}
    >
      {/* ─── Brand Header ─── */}
      <div className="sidebar-brand" style={{ height: "auto" }}>
        {config.brand.logoUrl ? (
          !collapsed ? (
            <div className="flex items-center justify-start py-1">
              <img 
                src={config.brand.logoUrl} 
                alt={config.brand.name} 
                className="max-h-10 max-w-[170px] object-contain transition-all duration-300"
              />
            </div>
          ) : (
            <div className="flex items-center justify-center w-full py-1">
              <span className="text-sm font-bold font-mono tracking-widest text-zinc-950 uppercase">
                {config.brand.logoInitials}
              </span>
            </div>
          )
        ) : (
          <>
            <div
              className="sidebar-logo"
              style={{
                background: `linear-gradient(135deg, ${config.brand.accentGradientFrom}, ${config.brand.accentGradientTo})`,
              }}
            >
              <span className="sidebar-logo-text">{config.brand.logoInitials}</span>
            </div>
            {!collapsed && (
              <div className="sidebar-brand-info">
                <h1 className="sidebar-brand-name">
                  {config.brand.name}
                  <span className="sidebar-brand-badge" style={{ color: config.brand.accentColor }}>AI</span>
                </h1>
              </div>
            )}
          </>
        )}
      </div>

      {/* ─── Navigation ─── */}
      <nav className="sidebar-nav">
        {filteredNav.map((item) => {
          const isActive =
            activePage === item.id ||
            (item.id === "agents" && (activePage === "creator" || activePage === "knowledge")) ||
            (item.id === "calls" && (activePage === "call-terminal" || activePage === "analytics" || activePage === "outbound"));

          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`sidebar-nav-item ${isActive ? "sidebar-nav-active" : ""}`}
              title={collapsed ? item.label : undefined}
            >
              <span className="sidebar-nav-icon" style={isActive ? { color: config.brand.accentColor } : undefined}>
                {item.icon}
              </span>
              {!collapsed && <span className="sidebar-nav-label">{item.label}</span>}
              {item.id === "calls" && callActive && (
                <span className="sidebar-call-indicator">
                  <span className="sidebar-call-ping" />
                  <span className="sidebar-call-dot" />
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* ─── Collapse Toggle ─── */}
      <button onClick={() => setCollapsed(!collapsed)} className="sidebar-collapse-btn" title={collapsed ? "Expand" : "Collapse"}>
        {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>

      {/* ─── Bottom: Credits + User ─── */}
      <div className="sidebar-bottom">
        {config.features.credits && (
          <div className="sidebar-credits">
            <span className="sidebar-credits-label">{config.credits.label}</span>
            <span className="sidebar-credits-value" style={{ color: config.brand.accentColor }}>
              {formatCredits(config.credits.total - config.credits.used)}
            </span>
          </div>
        )}
        <div className="sidebar-user">
          <div
            className="sidebar-user-avatar"
            style={{
              background: `linear-gradient(135deg, ${config.brand.accentGradientFrom}, ${config.brand.accentGradientTo})`,
            }}
          >
            {config.user.avatar ? (
              <img src={config.user.avatar} alt={config.user.name} className="sidebar-user-avatar-img" />
            ) : (
              <span>{config.user.name.charAt(0).toUpperCase()}</span>
            )}
          </div>
          {!collapsed && (
            <div className="sidebar-user-info">
              <span className="sidebar-user-name">{config.user.name}</span>
              <span className="sidebar-user-role">{config.user.role}</span>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
