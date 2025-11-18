"use client";

import React, { createContext, useContext, useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useUser, useClerk } from "@clerk/nextjs";

export type AppRole =
  | "platform_admin"
  | "school_admin"
  | "staff"
  | "teacher"
  | "parent"
  | "student";

type AppUser = {
  _id: string;
  email: string;
  name: string;
  role?: AppRole;
  schoolId?: string;
  pendingOnboarding?: boolean;
  schoolStatus?: string;
};

type AuthCtx = {
  me: AppUser | null | undefined;
  loading: boolean;
  isAuthenticated: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();
  const { isSignedIn } = useUser();
  const { signOut, openSignIn } = useClerk();

  const { data, isLoading } = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const res = await fetch("/api/me", { cache: "no-store" });
      if (res.status === 401) return null;
      if (!res.ok) throw new Error("Failed to fetch user data");
      return (await res.json()) as AppUser;
    },
  });

  const login = useCallback(async () => {
    openSignIn({ redirectUrl: "/auth/callback" });
  }, [openSignIn]);

  const logout = useCallback(async () => {
    await signOut();
    await qc.invalidateQueries({ queryKey: ["me"] });
    window.location.href = "/sign-in";
  }, [signOut, qc]);

  const refresh = useCallback(async () => {
    await qc.invalidateQueries({ queryKey: ["me"] });
  }, [qc]);

  const value = useMemo<AuthCtx>(
    () => ({
      me: data ?? null,
      loading: isLoading,
      isAuthenticated: !!isSignedIn && !!data,
      login,
      logout,
      refresh,
    }),
    [data, isLoading, isSignedIn, login, logout, refresh]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
