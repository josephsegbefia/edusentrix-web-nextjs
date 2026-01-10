// src/hooks/useDemoSession.ts
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useCallback, useEffect } from "react";

interface DemoSessionStatus {
  authenticated: boolean;
  reason?: string;
  session?: {
    demoTenantId: string;
    email: string;
    fullName: string;
    organization: string;
    role: string;
  };
  remaining?: {
    inactivitySeconds: number;
    hardLimitSeconds: number;
  };
}

/**
 * Hook to manage demo session state
 */
export function useDemoSession() {
  const router = useRouter();
  const queryClient = useQueryClient();

  // Query session status
  const {
    data: session,
    isLoading,
    error,
    refetch,
  } = useQuery<DemoSessionStatus>({
    queryKey: ["demo-session"],
    queryFn: async () => {
      const res = await fetch("/api/demo/session");
      if (!res.ok) throw new Error("Failed to get session");
      return res.json();
    },
    staleTime: 60 * 1000, // 1 minute
    refetchInterval: 60 * 1000, // Refetch every minute to check expiry
  });

  // Refresh session (extends inactivity timeout)
  const refreshMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/demo/session", { method: "PATCH" });
      if (!res.ok) throw new Error("Failed to refresh session");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["demo-session"] });
    },
  });

  // End session
  const endSessionMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/demo/session", { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to end session");
      return res.json();
    },
    onSuccess: () => {
      queryClient.clear();
      router.push("/demo/session-ended");
    },
  });

  // Auto-refresh on user activity
  const refreshSession = useCallback(() => {
    if (session?.authenticated) {
      refreshMutation.mutate();
    }
  }, [session?.authenticated, refreshMutation]);

  // Handle expired session
  useEffect(() => {
    if (session && !session.authenticated && session.reason === "session_expired") {
      router.push("/demo/session-ended?reason=expired");
    }
  }, [session, router]);

  return {
    session: session?.session,
    isAuthenticated: session?.authenticated ?? false,
    isLoading,
    error,
    remaining: session?.remaining,
    refreshSession,
    endSession: endSessionMutation.mutate,
    isEndingSession: endSessionMutation.isPending,
    refetch,
  };
}

/**
 * Hook to track demo activity (page views, actions)
 */
export function useDemoTracking() {
  const trackEvent = useCallback(
    async (
      type: "page_view" | "feature_explore" | "action_attempted" | "action_blocked" | "cta_click",
      metadata: Record<string, unknown>
    ) => {
      try {
        await fetch("/api/demo/track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type, metadata }),
        });
      } catch {
        // Silent fail for tracking
      }
    },
    []
  );

  const trackPageView = useCallback(
    (path: string) => trackEvent("page_view", { path }),
    [trackEvent]
  );

  const trackFeatureExplore = useCallback(
    (feature: string) => trackEvent("feature_explore", { feature }),
    [trackEvent]
  );

  const trackActionAttempted = useCallback(
    (action: string, blocked: boolean) =>
      trackEvent(blocked ? "action_blocked" : "action_attempted", { action }),
    [trackEvent]
  );

  const trackCtaClick = useCallback(
    (cta: string) => trackEvent("cta_click", { cta }),
    [trackEvent]
  );

  return {
    trackPageView,
    trackFeatureExplore,
    trackActionAttempted,
    trackCtaClick,
  };
}
