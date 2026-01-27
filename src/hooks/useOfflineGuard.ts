"use client";

import { useCallback } from "react";
import { useNetworkHealth } from "./useNetworkHealth";
import { useBusyToast } from "./useBusyToast";

export type OfflineGuardOptions = {
  /** Custom message to show when offline */
  message?: string;
  /** Allow action even when degraded (default: true) */
  allowDegraded?: boolean;
  /** Allow action even when poor (default: false) */
  allowPoor?: boolean;
};

const defaultOptions: OfflineGuardOptions = {
  message: "This action requires an internet connection",
  allowDegraded: true,
  allowPoor: false,
};

/**
 * Hook to guard actions against offline/poor network conditions
 * Returns utilities to check network status and block actions when offline
 */
export function useOfflineGuard(options: OfflineGuardOptions = {}) {
  const { quality, online } = useNetworkHealth();
  const toast = useBusyToast();

  const { message, allowDegraded, allowPoor } = { ...defaultOptions, ...options };

  const isOffline = !online || quality === "offline";
  const isPoor = quality === "poor";
  const isDegraded = quality === "degraded";

  // Determine if action is blocked
  const isBlocked =
    isOffline ||
    (isPoor && !allowPoor) ||
    (isDegraded && !allowDegraded);

  /**
   * Wrap an async action with offline guard
   * Shows an error toast and returns early if blocked
   */
  const guard = useCallback(
    async <T>(action: () => Promise<T>): Promise<T | null> => {
      if (isOffline) {
        toast.error("You're offline", {
          description: message,
        });
        return null;
      }

      if (isPoor && !allowPoor) {
        toast.warning("Poor connection", {
          description: "This action may fail due to slow network. Try again when connection improves.",
        });
        // Still allow the action for poor connection, just warn
      }

      try {
        return await action();
      } catch (error) {
        // Check if it's a network error
        if (error instanceof Error && error.message.includes("network")) {
          toast.error("Network error", {
            description: "Failed to complete action. Please check your connection.",
          });
          return null;
        }
        throw error;
      }
    },
    [isOffline, isPoor, allowPoor, message, toast]
  );

  /**
   * Check if action can proceed (for button disabled states)
   */
  const canProceed = !isBlocked;

  /**
   * Get a descriptive status message
   */
  const getStatusMessage = useCallback((): string | null => {
    if (isOffline) {
      return "Unavailable offline";
    }
    if (isPoor && !allowPoor) {
      return "Connection too slow";
    }
    return null;
  }, [isOffline, isPoor, allowPoor]);

  /**
   * Show a blocking error if offline (for onClick handlers)
   */
  const showOfflineError = useCallback(() => {
    if (isOffline) {
      toast.error("You're offline", {
        description: message,
      });
      return true;
    }
    if (isPoor && !allowPoor) {
      toast.warning("Connection is poor", {
        description: "This action may take longer or fail.",
      });
    }
    return false;
  }, [isOffline, isPoor, allowPoor, message, toast]);

  return {
    isOffline,
    isPoor,
    isDegraded,
    isBlocked,
    canProceed,
    quality,
    guard,
    getStatusMessage,
    showOfflineError,
  };
}

/**
 * Simple hook to just check if offline (for quick checks)
 */
export function useIsOffline(): boolean {
  const { online, quality } = useNetworkHealth();
  return !online || quality === "offline";
}

/**
 * Simple hook to check if connection is good enough for mutations
 */
export function useCanMutate(): boolean {
  const { online, quality } = useNetworkHealth();
  return online && quality !== "offline";
}
