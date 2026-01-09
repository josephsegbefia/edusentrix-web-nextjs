"use client";

import { useEffect, useState, useCallback } from "react";
import {
  connectionHistory,
  type ConnectionEvent,
} from "@/lib/network/connection-history";

export function useConnectionHistory() {
  const [events, setEvents] = useState<ConnectionEvent[]>([]);
  const [summary, setSummary] = useState<{
    totalEvents: number;
    offlineCount: number;
    lastOffline: number | null;
    avgQuality: string;
  }>({
    totalEvents: 0,
    offlineCount: 0,
    lastOffline: null,
    avgQuality: "good",
  });

  useEffect(() => {
    const history = connectionHistory;
    if (!history) return;

    const unsubscribe = history.subscribe((newEvents) => {
      setEvents(newEvents);
      setSummary(history.getSummary());
    });

    return unsubscribe;
  }, []);

  const clearHistory = useCallback(() => {
    if (connectionHistory) {
      connectionHistory.clear();
    }
  }, []);

  return {
    events,
    summary,
    clearHistory,
  };
}
