"use client";

import { useEffect, useRef } from "react";
import { useNetworkHealth, NetworkQuality } from "@/hooks/useNetworkHealth";
import { connectionHistory } from "@/lib/network/connection-history";
import { lowBandwidthManager } from "@/lib/network/low-bandwidth-mode";

/**
 * Headless component that watches network health and:
 * - Records connection events to history
 * - Updates low bandwidth mode based on connection quality
 *
 * Note: Toasts have been removed in favor of the NetworkStatusBanner component
 */
export function NetworkHealthWatcher() {
  const { quality, online, sseState } = useNetworkHealth(20000);
  const lastQuality = useRef<NetworkQuality | null>(null);
  const lastSseState = useRef<string | null>(null);

  // Track quality changes in connection history
  useEffect(() => {
    const history = connectionHistory;
    if (!history) return;

    // Record quality transitions (skip initial mount)
    if (lastQuality.current !== null && lastQuality.current !== quality) {
      if (quality === "offline" || !online) {
        history.recordOffline();
      } else if (lastQuality.current === "offline") {
        history.recordOnline(quality);
      } else {
        history.recordQualityChange(lastQuality.current, quality);
      }
    }

    lastQuality.current = quality;
  }, [quality, online]);

  // Track SSE state changes
  useEffect(() => {
    const history = connectionHistory;
    if (!history || !sseState) return;

    if (lastSseState.current !== null && lastSseState.current !== sseState) {
      if (sseState === "connected" && lastSseState.current !== "connected") {
        history.recordSSEConnect();
      } else if (sseState === "disconnected" || sseState === "error") {
        history.recordSSEDisconnect();
      }
    }

    lastSseState.current = sseState;
  }, [sseState]);

  // Update low bandwidth mode based on quality
  useEffect(() => {
    const manager = lowBandwidthManager;
    if (!manager) return;
    manager.setAutoEnabled(quality === "poor");
  }, [quality]);

  return null; // Headless watcher
}
