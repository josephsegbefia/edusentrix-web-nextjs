/**
 * Offline Mutation Queue
 * Stores failed mutations and retries them when connection is restored
 */

export type QueuedMutation = {
  id: string;
  url: string;
  method: "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
  description: string;
  createdAt: number;
  retryCount: number;
  maxRetries: number;
};

export type QueueStatus = {
  pendingCount: number;
  isProcessing: boolean;
  lastProcessedAt: number | null;
};

const STORAGE_KEY = "edusentrix_offline_queue";
const MAX_QUEUE_SIZE = 50;
const DEFAULT_MAX_RETRIES = 3;

class OfflineQueue {
  private queue: QueuedMutation[] = [];
  private isProcessing = false;
  private lastProcessedAt: number | null = null;
  private listeners: Set<(status: QueueStatus) => void> = new Set();

  constructor() {
    if (typeof window !== "undefined") {
      this.loadFromStorage();
      this.setupEventListeners();
    }
  }

  private loadFromStorage() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.queue = JSON.parse(stored);
      }
    } catch (e) {
      console.warn("Failed to load offline queue from storage:", e);
      this.queue = [];
    }
  }

  private saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.queue));
    } catch (e) {
      console.warn("Failed to save offline queue to storage:", e);
    }
  }

  private setupEventListeners() {
    window.addEventListener("online", () => {
      this.processQueue();
    });
  }

  private notifyListeners() {
    const status = this.getStatus();
    this.listeners.forEach((listener) => listener(status));
  }

  subscribe(listener: (status: QueueStatus) => void): () => void {
    this.listeners.add(listener);
    // Immediately notify with current status
    listener(this.getStatus());
    return () => {
      this.listeners.delete(listener);
    };
  }

  getStatus(): QueueStatus {
    return {
      pendingCount: this.queue.length,
      isProcessing: this.isProcessing,
      lastProcessedAt: this.lastProcessedAt,
    };
  }

  getQueue(): QueuedMutation[] {
    return [...this.queue];
  }

  add(mutation: Omit<QueuedMutation, "id" | "createdAt" | "retryCount">): string {
    // Limit queue size
    if (this.queue.length >= MAX_QUEUE_SIZE) {
      // Remove oldest mutation
      this.queue.shift();
    }

    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const queuedMutation: QueuedMutation = {
      ...mutation,
      id,
      createdAt: Date.now(),
      retryCount: 0,
      maxRetries: mutation.maxRetries ?? DEFAULT_MAX_RETRIES,
    };

    this.queue.push(queuedMutation);
    this.saveToStorage();
    this.notifyListeners();

    return id;
  }

  remove(id: string): boolean {
    const index = this.queue.findIndex((m) => m.id === id);
    if (index === -1) return false;

    this.queue.splice(index, 1);
    this.saveToStorage();
    this.notifyListeners();

    return true;
  }

  clear(): void {
    this.queue = [];
    this.saveToStorage();
    this.notifyListeners();
  }

  async processQueue(): Promise<{ succeeded: number; failed: number }> {
    if (this.isProcessing || this.queue.length === 0) {
      return { succeeded: 0, failed: 0 };
    }

    if (!navigator.onLine) {
      return { succeeded: 0, failed: 0 };
    }

    this.isProcessing = true;
    this.notifyListeners();

    let succeeded = 0;
    let failed = 0;

    // Process mutations in order
    const toProcess = [...this.queue];
    const stillPending: QueuedMutation[] = [];

    for (const mutation of toProcess) {
      try {
        const response = await fetch(mutation.url, {
          method: mutation.method,
          headers: {
            "Content-Type": "application/json",
            ...mutation.headers,
          },
          body: mutation.body ? JSON.stringify(mutation.body) : undefined,
        });

        if (response.ok) {
          succeeded++;
        } else if (response.status >= 500) {
          // Server error, retry later
          mutation.retryCount++;
          if (mutation.retryCount < mutation.maxRetries) {
            stillPending.push(mutation);
          } else {
            failed++;
          }
        } else {
          // Client error (4xx), don't retry
          failed++;
        }
      } catch (error) {
        // Network error, retry later if still have retries
        mutation.retryCount++;
        if (mutation.retryCount < mutation.maxRetries) {
          stillPending.push(mutation);
        } else {
          failed++;
        }
      }
    }

    this.queue = stillPending;
    this.lastProcessedAt = Date.now();
    this.isProcessing = false;
    this.saveToStorage();
    this.notifyListeners();

    return { succeeded, failed };
  }
}

// Singleton instance
export const offlineQueue =
  typeof window !== "undefined" ? new OfflineQueue() : null;

/**
 * Hook-friendly wrapper to use the offline queue
 */
export function getOfflineQueue(): OfflineQueue | null {
  return offlineQueue;
}
