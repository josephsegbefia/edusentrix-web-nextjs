"use client";

import React, { createContext, useCallback, useContext, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useUser, useClerk } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import type { AppRole } from "@/lib/roles";

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

  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

type QueryError = Error & { status?: number };

const Ctx = createContext<AuthCtx | null>(null);

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createQueryError(message: string, status?: number): QueryError {
  const err = new Error(message) as QueryError;
  if (typeof status === "number") {
    err.status = status;
  }
  return err;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();
  const router = useRouter();
  const { isSignedIn, isLoaded, user } = useUser();
  const { signOut } = useClerk();

  const { data, isLoading } = useQuery<AppUser | null, QueryError>({
    queryKey: ["me", user?.id ?? "signed-out"],
    enabled: isLoaded,
    queryFn: async () => {
      if (!isSignedIn) return null;

      const fetchMe = () => fetch("/api/me", { cache: "no-store" });

      // Session cookies can lag briefly right after login redirect.
      let res = await fetchMe();
      if (res.status === 401) {
        await wait(200);
        res = await fetchMe();
      }

      if (res.status === 401) {
        throw createQueryError("Unauthorized", 401);
      }
      if (!res.ok) {
        throw createQueryError("Failed to fetch user data", res.status);
      }
      return (await res.json()) as AppUser;
    },
    retry: (failureCount, error) => {
      if (!isSignedIn) return false;
      const status = error?.status;
      if (status === 401) return failureCount < 2;
      if (typeof status === "number" && status >= 500) return failureCount < 2;
      return false;
    },
    retryDelay: (attemptIndex) => Math.min(200 * 2 ** attemptIndex, 1000),
    staleTime: 0,
    refetchOnMount: "always",
  });

  const logout = useCallback(async () => {
    await signOut();
    await qc.invalidateQueries({ queryKey: ["me"] });
    await qc.invalidateQueries({ queryKey: ["school"] });
    router.push("/sign-in");
  }, [signOut, qc, router]);

  const refresh = useCallback(async () => {
    await qc.invalidateQueries({ queryKey: ["me"] });
  }, [qc]);

  const value = useMemo<AuthCtx>(
    () => ({
      me: data ?? null,
      loading: !isLoaded || isLoading,
      isAuthenticated: !!isSignedIn && !!data,
      logout,
      refresh,
    }),
    [data, isLoaded, isLoading, isSignedIn, logout, refresh]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
