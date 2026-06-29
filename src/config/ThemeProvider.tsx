import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import clientConfig, { type ClientConfig } from "./clientConfig";

interface ClientConfigContextType extends ClientConfig {
  refreshConfig: () => Promise<void>;
  configLoaded: boolean;
}

const ClientConfigContext = createContext<ClientConfigContextType>({
  ...clientConfig,
  refreshConfig: async () => {},
  configLoaded: false,
});

export function ClientConfigProvider({ children, config }: { children: React.ReactNode; config?: Partial<ClientConfig> }) {
  const [serverConfig, setServerConfig] = useState<Partial<ClientConfig> | null>(null);
  const [configLoaded, setConfigLoaded] = useState(false);

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/settings");
      const json = await res.json();
      if (json.success && json.data) {
        const d = json.data;
        const fetched: Partial<ClientConfig> = {
          brand: {
            name: d.brand?.name || clientConfig.brand.name,
            tagline: d.brand?.tagline || clientConfig.brand.tagline,
            logoInitials: d.brand?.logoInitials || clientConfig.brand.logoInitials,
            logoUrl: d.brand?.logoUrl || clientConfig.brand.logoUrl,
            accentColor: d.brand?.accentColor || clientConfig.brand.accentColor,
            accentColorLight: d.brand?.accentColorLight || clientConfig.brand.accentColorLight,
            accentGradientFrom: d.brand?.accentGradientFrom || clientConfig.brand.accentGradientFrom,
            accentGradientTo: d.brand?.accentGradientTo || clientConfig.brand.accentGradientTo,
            sidebarBg: clientConfig.brand.sidebarBg,
            sidebarBorder: clientConfig.brand.sidebarBorder,
          },
          features: {
            ...clientConfig.features,
            ...(d.features || {}),
          },
          credits: {
            total: d.credits?.walletBalance ?? clientConfig.credits.total,
            used: 0, // Will be computed from analytics
            label: d.credits?.label || clientConfig.credits.label,
          },
          user: {
            name: d.user?.name || clientConfig.user.name,
            email: d.user?.email || clientConfig.user.email,
            role: d.user?.role || clientConfig.user.role,
            avatar: d.user?.avatar || clientConfig.user.avatar,
          },
        };
        setServerConfig(fetched);
      }
    } catch (err) {
      console.warn("[ThemeProvider] Could not fetch settings from server, using defaults.", err);
    } finally {
      setConfigLoaded(true);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  // Merge: clientConfig defaults < server config < prop overrides
  const base = serverConfig || {};
  const propOverrides = config || {};

  const merged: ClientConfig = {
    brand: { ...clientConfig.brand, ...(base.brand || {}), ...(propOverrides.brand || {}) },
    features: { ...clientConfig.features, ...(base.features || {}), ...(propOverrides.features || {}) },
    credits: { ...clientConfig.credits, ...(base.credits || {}), ...(propOverrides.credits || {}) },
    user: { ...clientConfig.user, ...(base.user || {}), ...(propOverrides.user || {}) },
  };

  const contextValue: ClientConfigContextType = {
    ...merged,
    refreshConfig: fetchConfig,
    configLoaded,
  };

  return (
    <ClientConfigContext.Provider value={contextValue}>
      {children}
    </ClientConfigContext.Provider>
  );
}

export function useClientConfig(): ClientConfigContextType {
  return useContext(ClientConfigContext);
}
