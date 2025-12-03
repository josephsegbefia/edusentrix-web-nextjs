/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useRef } from "react";
import { useNetworkHealth, NetworkQuality } from "@/hooks/useNetworkHealth";
import { useToast } from "@/hooks/useToast";

export function NetworkHealthWatcher() {
  const { success, error, warning } = useToast();
  const { quality, online, effectiveType, probeRtt } = useNetworkHealth(20000);
  const lastShown = useRef<NetworkQuality | null>(null);
  const lastAt = useRef<number>(0);

  useEffect(() => {
    const now = Date.now();
    const COOLDOWN_MS = 180000; // 3 minutes cooldown for repeated states

    // Avoid spamming identical state within cooldown period
    if (lastShown.current === quality && now - lastAt.current < COOLDOWN_MS) {
      return;
    }

    // CRITICAL TRANSITIONS ONLY:
    // 1. Offline → Online (or any online state)
    if (!online || quality === "offline") {
      // Only show if we weren't already offline
      if (lastShown.current !== "offline") {
        error("You're offline", {
          description:
            "No internet connection. Some features won't work until you reconnect.",
        });
        lastShown.current = "offline";
        lastAt.current = now;
      }
      return;
    }

    // 2. Online → Good (restoration from offline/poor)
    if (quality === "good" && lastShown.current && lastShown.current !== "good") {
      // Only show if coming from offline or poor (not from degraded)
      if (lastShown.current === "offline" || lastShown.current === "poor") {
        success("Connection restored", {
          description: `Back online with good quality${
            effectiveType ? ` (${effectiveType})` : ""
          }.`,
        });
        lastShown.current = "good";
        lastAt.current = now;
      }
      return;
    }

    // 3. Good → Poor (critical degradation)
    if (quality === "poor" && lastShown.current === "good") {
      warning("Poor connection", {
        description: `Very slow network. ${
          effectiveType ? `(${effectiveType}) ` : ""
        }${
          typeof probeRtt === "number" ? `RTT ${Math.round(probeRtt)}ms.` : ""
        } Some actions may fail.`,
      });
      lastShown.current = "poor";
      lastAt.current = now;
      return;
    }

    // Silently track state changes for degraded and other transitions
    // (no toasts, but update lastShown for future comparisons)
    if (lastShown.current !== quality) {
      lastShown.current = quality;
      // Only update timestamp if we showed a toast, otherwise keep old timestamp
      // to allow showing toast if state persists and then changes
    }
  }, [success, error, warning, quality, online, effectiveType, probeRtt]);

  return null; // Headless watcher
}
