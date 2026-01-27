/**
 * Connection History Tracker
 * Stores connection events for debugging and user visibility
 */

import type { NetworkQuality } from "@/hooks/useNetworkHealth";

export type ConnectionEvent = {
  id: string;
  type: "quality_change" | "offline" | "online" | "sse_disconnect" | "sse_connect" | "probe_failed";
  quality?: NetworkQuality;
  timestamp: number;
  details?: string;
};

const STORAGE_KEY = "edusentrix_connection_history";
const MAX_HISTORY_SIZE = 100;
const HISTORY_RETENTION_MS = 24 * 60 * 60 * 1000; // 24 hours

type Listener = (events: ConnectionEvent[]) => void;

class ConnectionHistoryTracker {
  private events: ConnectionEvent[] = [];
  private listeners: Set<Listener> = new Set();

  constructor() {
    if (typeof window !== "undefined") {
      this.loadFromStorage();
      this.pruneOldEvents();
    }
  }

  private loadFromStorage() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.events = JSON.parse(stored);
      }
    } catch (e) {
      console.warn("Failed to load connection history:", e);
      this.events = [];
    }
  }

  private saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.events));
    } catch (e) {
      console.warn("Failed to save connection history:", e);
    }
  }

  private pruneOldEvents() {
    const cutoff = Date.now() - HISTORY_RETENTION_MS;
    this.events = this.events.filter((e) => e.timestamp > cutoff);
    this.saveToStorage();
  }

  private notify() {
    this.listeners.forEach((listener) => listener(this.getEvents()));
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.getEvents());
    return () => {
      this.listeners.delete(listener);
    };
  }

  getEvents(): ConnectionEvent[] {
    return [...this.events].reverse(); // Most recent first
  }

  addEvent(
    type: ConnectionEvent["type"],
    quality?: NetworkQuality,
    details?: string
  ): void {
    // Limit history size
    if (this.events.length >= MAX_HISTORY_SIZE) {
      this.events.shift();
    }

    const event: ConnectionEvent = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      type,
      quality,
      timestamp: Date.now(),
      details,
    };

    this.events.push(event);
    this.saveToStorage();
    this.notify();
  }

  // Convenience methods
  recordQualityChange(from: NetworkQuality, to: NetworkQuality) {
    this.addEvent(
      "quality_change",
      to,
      `Changed from ${from} to ${to}`
    );
  }

  recordOffline() {
    this.addEvent("offline", "offline", "Lost internet connection");
  }

  recordOnline(quality: NetworkQuality) {
    this.addEvent("online", quality, "Internet connection restored");
  }

  recordSSEDisconnect() {
    this.addEvent("sse_disconnect", undefined, "Live updates disconnected");
  }

  recordSSEConnect() {
    this.addEvent("sse_connect", undefined, "Live updates connected");
  }

  recordProbeFailed(details?: string) {
    this.addEvent("probe_failed", undefined, details || "Network probe failed");
  }

  clear() {
    this.events = [];
    this.saveToStorage();
    this.notify();
  }

  // Get summary stats
  getSummary(): {
    totalEvents: number;
    offlineCount: number;
    lastOffline: number | null;
    avgQuality: string;
  } {
    const offlineEvents = this.events.filter((e) => e.type === "offline");
    const qualityEvents = this.events.filter(
      (e) => e.type === "quality_change" || e.type === "online"
    );

    // Calculate average quality (simple weighted approach)
    const qualityScores: Record<NetworkQuality, number> = {
      good: 3,
      degraded: 2,
      poor: 1,
      offline: 0,
    };

    let totalScore = 0;
    let count = 0;
    qualityEvents.forEach((e) => {
      if (e.quality) {
        totalScore += qualityScores[e.quality];
        count++;
      }
    });

    const avgScore = count > 0 ? totalScore / count : 3;
    let avgQuality = "good";
    if (avgScore < 1) avgQuality = "poor";
    else if (avgScore < 2) avgQuality = "degraded";
    else if (avgScore < 2.5) avgQuality = "fair";

    return {
      totalEvents: this.events.length,
      offlineCount: offlineEvents.length,
      lastOffline:
        offlineEvents.length > 0
          ? offlineEvents[offlineEvents.length - 1].timestamp
          : null,
      avgQuality,
    };
  }
}

// Singleton instance
export const connectionHistory =
  typeof window !== "undefined" ? new ConnectionHistoryTracker() : null;

export function getConnectionHistory(): ConnectionHistoryTracker | null {
  return connectionHistory;
}
