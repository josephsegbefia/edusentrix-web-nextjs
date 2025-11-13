// src/providers/auth-provider.tsx
"use client";

import React, { createContext, useContext, useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";

type AppUser = {
  _id: string;
  email: string;
  name?: string;
  role?: string;
  schoolId?: string | null;
  pendingOnboarding?: boolean;
  schoolStatus?: string;
};

type AuthCtx = {
  // Legacy properties for compatibility
  user: AppUser | null | undefined;
  isLoading: boolean;
  // Properties expected by role-gate and other components
  me: AppUser | null | undefined;
  loading: boolean;
  isAuthenticated: boolean;
  /** Triggers Supabase email magic-link flow */
  loginWithMagicLink: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();

  // Load the "me" payload from your API (session must already be set via /auth/callback)
  const { data, isLoading } = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const res = await fetch("/api/me", { cache: "no-store" });
      if (res.status === 401) return null; // not signed in
      if (!res.ok) throw new Error("failed");
      return (await res.json()) as AppUser;
    },
  });

  /**
   * Magic link sign-in (email). This sends the user an email containing the
   * verification link that lands on /auth/callback, where you exchange the code
   * and set the auth cookies (via your server helper).
   */
  const loginWithMagicLink = useCallback(async (email: string) => {
    const redirectTo =
      typeof window !== "undefined"
        ? `${window.location.origin}/auth/callback`
        : undefined;

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectTo,
        shouldCreateUser: true, // or false if you only want existing users
      },
    });

    if (error) throw error;
    // We do NOT invalidate /api/me here because session will be created
    // only after the user clicks the magic link and returns to /auth/callback.
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    await qc.invalidateQueries({ queryKey: ["me"] });
  }, [qc]);

  const refresh = useCallback(async () => {
    await qc.invalidateQueries({ queryKey: ["me"] });
  }, [qc]);

  const isAuthenticated = data !== null && data !== undefined;

  const value = useMemo<AuthCtx>(
    () => ({
      // Legacy properties
      user: data ?? null,
      isLoading,
      // Properties expected by role-gate
      me: data ?? null,
      loading: isLoading,
      isAuthenticated,
      loginWithMagicLink,
      logout,
      refresh,
    }),
    [data, isLoading, isAuthenticated, loginWithMagicLink, logout, refresh]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
