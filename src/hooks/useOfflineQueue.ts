"use client";

import { useEffect, useState, useCallback } from "react";
import {
  offlineQueue,
  type QueueStatus,
  type QueuedMutation,
} from "@/lib/network/offline-queue";

export function useOfflineQueue() {
  const [status, setStatus] = useState<QueueStatus>({
    pendingCount: 0,
    isProcessing: false,
    lastProcessedAt: null,
  });
  const [queue, setQueue] = useState<QueuedMutation[]>([]);

  useEffect(() => {
    const queue = offlineQueue;
    if (!queue) return;

    // Subscribe to status updates
    const unsubscribe = queue.subscribe((newStatus) => {
      setStatus(newStatus);
      setQueue(queue.getQueue());
    });

    return unsubscribe;
  }, []);

  const addToQueue = useCallback(
    (
      mutation: Omit<QueuedMutation, "id" | "createdAt" | "retryCount">
    ): string | null => {
      if (!offlineQueue) return null;
      return offlineQueue.add(mutation);
    },
    []
  );

  const removeFromQueue = useCallback((id: string): boolean => {
    if (!offlineQueue) return false;
    return offlineQueue.remove(id);
  }, []);

  const clearQueue = useCallback((): void => {
    if (!offlineQueue) return;
    offlineQueue.clear();
  }, []);

  const processQueue = useCallback(async (): Promise<{
    succeeded: number;
    failed: number;
  }> => {
    if (!offlineQueue) return { succeeded: 0, failed: 0 };
    return offlineQueue.processQueue();
  }, []);

  return {
    ...status,
    queue,
    addToQueue,
    removeFromQueue,
    clearQueue,
    processQueue,
  };
}

/**
 * Utility to wrap a fetch call with offline queue fallback
 * If the request fails due to network error, it's added to the queue
 */
export async function fetchWithOfflineFallback(
  url: string,
  options: RequestInit & { queueDescription?: string }
): Promise<Response> {
  const { queueDescription, ...fetchOptions } = options;

  try {
    const response = await fetch(url, fetchOptions);
    return response;
  } catch (error) {
    // Network error - queue the mutation if it's a write operation
    if (
      offlineQueue &&
      queueDescription &&
      ["POST", "PUT", "PATCH", "DELETE"].includes(
        (fetchOptions.method || "GET").toUpperCase()
      )
    ) {
      offlineQueue.add({
        url,
        method: (fetchOptions.method || "POST").toUpperCase() as
          | "POST"
          | "PUT"
          | "PATCH"
          | "DELETE",
        body: fetchOptions.body ? JSON.parse(fetchOptions.body as string) : undefined,
        headers: fetchOptions.headers as Record<string, string> | undefined,
        description: queueDescription,
        maxRetries: 3,
      });

      // Throw a specific error that can be caught by the caller
      const offlineError = new Error("Request queued for later retry");
      (offlineError as any).isOfflineQueued = true;
      throw offlineError;
    }

    throw error;
  }
}
