// src/components/demo/DemoContext.tsx
"use client";

import React, { createContext, useContext, useCallback, useEffect, useState } from "react";
import { DEMO_FEATURES, isDemoMode } from "@/lib/demo/config";
import type { DemoFeatureConfig } from "@/types/demo";

interface DemoContextValue {
  isDemo: boolean;
  checkFeature: (feature: string) => DemoFeatureConfig | undefined;
  isFeatureAllowed: (feature: string) => boolean;
  isSimulated: (feature: string) => boolean;
  getRestrictionMessage: (feature: string) => string | undefined;
  trackAction: (action: string, blocked?: boolean) => void;
  showContactSales: () => void;
}

const DemoContext = createContext<DemoContextValue | null>(null);

export function DemoProvider({ children }: { children: React.ReactNode }) {
  const [isDemo] = useState(() => isDemoMode());

  const checkFeature = useCallback((feature: string): DemoFeatureConfig | undefined => {
    if (!isDemo) return undefined;
    return DEMO_FEATURES.find((f) => f.feature === feature);
  }, [isDemo]);

  const isFeatureAllowed = useCallback((feature: string): boolean => {
    if (!isDemo) return true;
    const config = checkFeature(feature);
    return config?.allowed ?? true;
  }, [isDemo, checkFeature]);

  const isSimulated = useCallback((feature: string): boolean => {
    if (!isDemo) return false;
    const config = checkFeature(feature);
    return config?.simulateAction ?? false;
  }, [isDemo, checkFeature]);

  const getRestrictionMessage = useCallback((feature: string): string | undefined => {
    if (!isDemo) return undefined;
    const config = checkFeature(feature);
    if (config?.allowed) return undefined;
    return config?.message || "This feature is restricted in demo mode.";
  }, [isDemo, checkFeature]);

  const trackAction = useCallback((action: string, blocked = false) => {
    if (!isDemo) return;
    fetch("/api/demo/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: blocked ? "action_blocked" : "action_attempted",
        metadata: { action },
      }),
    }).catch(() => {});
  }, [isDemo]);

  const showContactSales = useCallback(() => {
    if (!isDemo) return;
    fetch("/api/demo/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "cta_click",
        metadata: { cta: "contact_sales" },
      }),
    }).catch(() => {});
    window.open("/demo/schedule-call", "_blank");
  }, [isDemo]);

  return (
    <DemoContext.Provider
      value={{
        isDemo,
        checkFeature,
        isFeatureAllowed,
        isSimulated,
        getRestrictionMessage,
        trackAction,
        showContactSales,
      }}
    >
      {children}
    </DemoContext.Provider>
  );
}

export function useDemo() {
  const context = useContext(DemoContext);
  if (!context) {
    // Return a non-demo context if not wrapped in provider
    return {
      isDemo: false,
      checkFeature: () => undefined,
      isFeatureAllowed: () => true,
      isSimulated: () => false,
      getRestrictionMessage: () => undefined,
      trackAction: () => {},
      showContactSales: () => {},
    };
  }
  return context;
}

export function useDemoFeature(feature: string) {
  const { isDemo, isFeatureAllowed, isSimulated, getRestrictionMessage, trackAction } = useDemo();

  return {
    isDemo,
    allowed: isFeatureAllowed(feature),
    simulated: isSimulated(feature),
    message: getRestrictionMessage(feature),
    onAttempt: () => trackAction(feature, !isFeatureAllowed(feature)),
  };
}
