"use client";

import { useEffect, useState, useCallback } from "react";
import {
  lowBandwidthManager,
  type LowBandwidthSettings,
} from "@/lib/network/low-bandwidth-mode";
import { useNetworkHealth } from "./useNetworkHealth";

const defaultSettings: LowBandwidthSettings = {
  enabled: false,
  autoDetect: true,
  disableAnimations: true,
  disableAutoPolling: true,
  reducedImageQuality: true,
  batchRequests: true,
};

export function useLowBandwidthMode() {
  const [settings, setSettings] = useState<LowBandwidthSettings>(defaultSettings);
  const { quality } = useNetworkHealth();

  useEffect(() => {
    if (!lowBandwidthManager) return;

    const unsubscribe = lowBandwidthManager.subscribe((newSettings) => {
      setSettings(newSettings);
    });

    return unsubscribe;
  }, []);

  // Auto-enable when connection is poor
  useEffect(() => {
    if (!lowBandwidthManager) return;
    lowBandwidthManager.setAutoEnabled(quality === "poor");
  }, [quality]);

  const setEnabled = useCallback((enabled: boolean) => {
    if (lowBandwidthManager) {
      lowBandwidthManager.setEnabled(enabled);
    }
  }, []);

  const setAutoDetect = useCallback((autoDetect: boolean) => {
    if (lowBandwidthManager) {
      lowBandwidthManager.setAutoDetect(autoDetect);
    }
  }, []);

  const updateSettings = useCallback(
    (partial: Partial<LowBandwidthSettings>) => {
      if (lowBandwidthManager) {
        lowBandwidthManager.updateSettings(partial);
      }
    },
    []
  );

  const reset = useCallback(() => {
    if (lowBandwidthManager) {
      lowBandwidthManager.reset();
    }
  }, []);

  const isEnabled =
    settings.enabled ||
    (settings.autoDetect && quality === "poor");

  return {
    settings,
    isEnabled,
    setEnabled,
    setAutoDetect,
    updateSettings,
    reset,
    // Convenience getters for individual features
    shouldDisableAnimations: isEnabled && settings.disableAnimations,
    shouldDisableAutoPolling: isEnabled && settings.disableAutoPolling,
    shouldReduceImageQuality: isEnabled && settings.reducedImageQuality,
    shouldBatchRequests: isEnabled && settings.batchRequests,
  };
}

/**
 * Simple hook to check if animations should be disabled
 */
export function useDisableAnimations(): boolean {
  const { shouldDisableAnimations } = useLowBandwidthMode();
  return shouldDisableAnimations;
}

/**
 * Hook to get appropriate polling interval (or null if disabled)
 */
export function usePollingInterval(normalInterval: number): number | null {
  const { shouldDisableAutoPolling } = useLowBandwidthMode();
  return shouldDisableAutoPolling ? null : normalInterval;
}

/**
 * Hook to get appropriate image quality setting
 */
export function useImageQuality(): "high" | "medium" | "low" {
  const { shouldReduceImageQuality } = useLowBandwidthMode();
  return shouldReduceImageQuality ? "low" : "high";
}
