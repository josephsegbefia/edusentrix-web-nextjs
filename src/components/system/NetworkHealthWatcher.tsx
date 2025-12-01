/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useRef } from "react";
import { useNetworkHealth, NetworkQuality } from "@/hooks/useNetworkHealth";
import { useToast } from "@/hooks/useToast";

// rank for comparing improvements/degradations
const rank: Record<NetworkQuality, number> = {
  offline: 0,
  poor: 1,
  degraded: 2,
  good: 3,
};

export function NetworkHealthWatcher() {
  const { info, success, error, warning } = useToast();
  const { quality, online, effectiveType, downlink, probeRtt } =
    useNetworkHealth(20000);
  const lastShown = useRef<NetworkQuality | null>(null);
  const lastAt = useRef<number>(0);

  useEffect(() => {
    const now = Date.now();

    // Avoid spamming identical state within 30s
    if (lastShown.current === quality && now - lastAt.current < 30000) return;

    const fmt = (v?: number) =>
      typeof v === "number" ? Math.round(v).toString() : "—";

    if (!online || quality === "offline") {
      error(
        "You're offline",
        {
          description:
            "No internet connection. Some features won't work until you reconnect.",
        }
      );
      lastShown.current = "offline";
      lastAt.current = now;
      return;
    }

    // Improvements/restorations
    if (lastShown.current && rank[quality] > rank[lastShown.current]) {
      if (quality === "good") {
        success(
          "Connection restored",
          {
            description: `Back online with good quality${
              effectiveType ? ` (${effectiveType})` : ""
            }.`,
          }
        );
      } else {
        // improved but not yet "good"
        info(
          "Connection improved",
          {
            description: `Quality is now ${quality}. ${
              effectiveType ? `Network: ${effectiveType}. ` : ""
            }${
              typeof downlink === "number"
                ? `Downlink: ${downlink.toFixed(1)}Mbps. `
                : ""
            }${
              typeof probeRtt === "number"
                ? `RTT: ${Math.round(probeRtt)}ms.`
                : ""
            }`,
          }
        );
      }
      lastShown.current = quality;
      lastAt.current = now;
      return;
    }

    // Degradations
    if (!lastShown.current || rank[quality] < rank[lastShown.current]) {
      if (quality === "poor") {
        warning(
          "Poor connection",
          {
            description: `Very slow network. ${effectiveType ? `(${effectiveType}) ` : ""}${
              typeof probeRtt === "number" ? `RTT ${Math.round(probeRtt)}ms.` : ""
            } Some actions may fail.`,
          }
        );
      } else if (quality === "degraded") {
        info(
          "Degraded connection",
          {
            description: `${effectiveType ? `Network: ${effectiveType}. ` : ""}${
              typeof downlink === "number"
                ? `Downlink: ${downlink.toFixed(1)}Mbps. `
                : ""
            }${typeof probeRtt === "number" ? `RTT: ${fmt(probeRtt)}ms.` : ""}`,
          }
        );
      } else if (quality === "good") {
        // First mount scenario: silently accept "good" unless coming from worse (handled above)
        // Show nothing to avoid noise.
      }
      lastShown.current = quality;
      lastAt.current = now;
      return;
    }

    // Same band but after 30s – refresh subtle info toast (for long-standing poor state)
    if (
      now - lastAt.current >= 60000 &&
      (quality === "poor" || quality === "degraded")
    ) {
      if (quality === "poor") {
        warning(
          "Still poor connection",
          {
            description: "We'll keep retrying in the background.",
          }
        );
      } else {
        info(
          "Connection still degraded",
          {
            description: "Performance may be impacted.",
          }
        );
      }
      lastShown.current = quality;
      lastAt.current = now;
    }
  }, [info, success, error, warning, quality, online, effectiveType, downlink, probeRtt]);

  return null; // Headless watcher
}
