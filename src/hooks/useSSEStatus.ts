"use client";

import { useEffect, useState } from "react";
import {
  sseManager,
  type SSEStatusEvent,
  type SSEConnectionState,
} from "@/lib/network/sse-manager";

export type { SSEConnectionState, SSEStatusEvent };

const defaultStatus: SSEStatusEvent = {
  state: "disconnected",
  lastConnectedAt: null,
  lastDisconnectedAt: null,
  reconnectAttempts: 0,
};

export function useSSEStatus() {
  const [status, setStatus] = useState<SSEStatusEvent>(defaultStatus);

  useEffect(() => {
    if (!sseManager) return;

    const unsubscribe = sseManager.subscribe((newStatus) => {
      setStatus(newStatus);
    });

    return unsubscribe;
  }, []);

  return {
    ...status,
    isConnected: status.state === "connected",
    isReconnecting: status.state === "reconnecting",
    hasError: status.state === "error",
  };
}

/**
 * Helper to format SSE status for display
 */
export function formatSSEStatus(status: SSEStatusEvent): string {
  switch (status.state) {
    case "connected":
      return "Live updates active";
    case "connecting":
      return "Connecting to live updates...";
    case "reconnecting":
      return `Reconnecting... (attempt ${status.reconnectAttempts})`;
    case "disconnected":
      return "Live updates not active";
    case "error":
      return status.error || "Live update connection error";
    default:
      return "Unknown status";
  }
}
