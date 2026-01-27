/**
 * SSE Connection Manager
 * Tracks real-time connection status and provides reconnection feedback
 */

export type SSEConnectionState =
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected"
  | "error";

export type SSEStatusEvent = {
  state: SSEConnectionState;
  lastConnectedAt: number | null;
  lastDisconnectedAt: number | null;
  reconnectAttempts: number;
  error?: string;
};

type Listener = (event: SSEStatusEvent) => void;

class SSEManager {
  private state: SSEConnectionState = "disconnected";
  private lastConnectedAt: number | null = null;
  private lastDisconnectedAt: number | null = null;
  private reconnectAttempts = 0;
  private error?: string;
  private listeners: Set<Listener> = new Set();

  getStatus(): SSEStatusEvent {
    return {
      state: this.state,
      lastConnectedAt: this.lastConnectedAt,
      lastDisconnectedAt: this.lastDisconnectedAt,
      reconnectAttempts: this.reconnectAttempts,
      error: this.error,
    };
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    // Immediately notify with current status
    listener(this.getStatus());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const status = this.getStatus();
    this.listeners.forEach((listener) => listener(status));
  }

  // Called when SSE starts connecting
  setConnecting() {
    this.state = "connecting";
    this.error = undefined;
    this.notify();
  }

  // Called when SSE successfully connects
  setConnected() {
    const wasDisconnected = this.state !== "connected";
    this.state = "connected";
    this.lastConnectedAt = Date.now();
    this.reconnectAttempts = 0;
    this.error = undefined;
    this.notify();

    // Return whether this was a reconnection
    return wasDisconnected && this.lastDisconnectedAt !== null;
  }

  // Called when SSE encounters an error
  setError(error?: string) {
    this.state = "error";
    this.error = error;
    this.lastDisconnectedAt = Date.now();
    this.notify();
  }

  // Called when SSE is reconnecting
  setReconnecting() {
    this.state = "reconnecting";
    this.reconnectAttempts++;
    this.lastDisconnectedAt = Date.now();
    this.notify();
  }

  // Called when SSE is disconnected
  setDisconnected() {
    this.state = "disconnected";
    this.lastDisconnectedAt = Date.now();
    this.notify();
  }

  // Reset state
  reset() {
    this.state = "disconnected";
    this.lastConnectedAt = null;
    this.lastDisconnectedAt = null;
    this.reconnectAttempts = 0;
    this.error = undefined;
    this.notify();
  }
}

// Singleton instance
export const sseManager = typeof window !== "undefined" ? new SSEManager() : null;

/**
 * Get the SSE manager instance
 */
export function getSSEManager(): SSEManager | null {
  return sseManager;
}
