"use client";

import { useEffect, useRef, useState } from "react";
import { useNetworkHealth, NetworkQuality } from "@/hooks/useNetworkHealth";

/**
 * ARIA Live Region for Network Status Announcements
 * Provides screen reader announcements for network status changes
 */
export function NetworkAccessibilityAnnouncer() {
  const { quality, online, sseState } = useNetworkHealth(20000);
  const [announcement, setAnnouncement] = useState("");
  const prevQualityRef = useRef<NetworkQuality | null>(null);
  const prevOnlineRef = useRef<boolean>(true);
  const prevSSERef = useRef<string | null>(null);

  useEffect(() => {
    // Skip initial render
    if (prevQualityRef.current === null) {
      prevQualityRef.current = quality;
      prevOnlineRef.current = online;
      prevSSERef.current = sseState;
      return;
    }

    const announcements: string[] = [];

    // Offline/Online transitions (most important)
    if (!online && prevOnlineRef.current) {
      announcements.push(
        "You are now offline. Some features are unavailable until you reconnect."
      );
    } else if (online && !prevOnlineRef.current) {
      announcements.push("You are back online. All features are now available.");
    }

    // Quality changes (when online)
    if (online && prevQualityRef.current !== quality) {
      switch (quality) {
        case "good":
          if (
            prevQualityRef.current === "poor" ||
            prevQualityRef.current === "offline"
          ) {
            announcements.push("Connection quality improved to good.");
          }
          break;
        case "degraded":
          if (prevQualityRef.current === "good") {
            announcements.push(
              "Connection quality degraded. Performance may be affected."
            );
          }
          break;
        case "poor":
          announcements.push(
            "Connection is very slow. Some actions may fail."
          );
          break;
      }
    }

    // SSE status changes
    if (sseState && prevSSERef.current !== sseState) {
      if (sseState === "connected" && prevSSERef.current === "reconnecting") {
        announcements.push("Live updates reconnected.");
      } else if (
        sseState === "reconnecting" &&
        prevSSERef.current === "connected"
      ) {
        announcements.push("Live updates disconnected. Attempting to reconnect.");
      }
    }

    // Update refs
    prevQualityRef.current = quality;
    prevOnlineRef.current = online;
    prevSSERef.current = sseState;

    // Set announcement (will be read by screen reader)
    if (announcements.length > 0) {
      setAnnouncement(announcements.join(" "));
      // Clear after a delay to allow for new announcements
      const timer = setTimeout(() => setAnnouncement(""), 5000);
      return () => clearTimeout(timer);
    }
  }, [quality, online, sseState]);

  // ARIA live region - visually hidden but announced by screen readers
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
    >
      {announcement}
    </div>
  );
}
