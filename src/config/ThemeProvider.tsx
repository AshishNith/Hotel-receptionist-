import React, { createContext, useContext } from "react";
import clientConfig, { type ClientConfig } from "./clientConfig";

const ClientConfigContext = createContext<ClientConfig>(clientConfig);

export function ClientConfigProvider({ children, config }: { children: React.ReactNode; config?: Partial<ClientConfig> }) {
  const merged: ClientConfig = config
    ? {
        ...clientConfig,
        ...config,
        brand: { ...clientConfig.brand, ...(config.brand || {}) },
        features: { ...clientConfig.features, ...(config.features || {}) },
        credits: { ...clientConfig.credits, ...(config.credits || {}) },
        user: { ...clientConfig.user, ...(config.user || {}) },
      }
    : clientConfig;

  return (
    <ClientConfigContext.Provider value={merged}>
      {children}
    </ClientConfigContext.Provider>
  );
}

export function useClientConfig(): ClientConfig {
  return useContext(ClientConfigContext);
}
