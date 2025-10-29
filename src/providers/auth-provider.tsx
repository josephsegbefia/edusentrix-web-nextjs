"use client";
import { createContext, useContext, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

type Me = {
  userId: string;
  role:
    | "schoolAdmin"
    | "bursar"
    | "teacher"
    | "parent"
    | "student"
    | "platformAdmin";
  schoolId?: string | null;
  schoolStatus?: "active" | "suspended";
  tier?: "Basic" | "Premium";
};

type AuthContextValue = {
  me: Me | null;
  loading: boolean;
  isAuthenticated: boolean;
};

const AuthContext = createContext<AuthContextValue>({
  me: null,
  loading: true,
  isAuthenticated: false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();

  // Source of truth: /api/me (ssr-friendll later; csr for now)
  const { data, isLoading } = useQuery({
    queryKey: ["me"],
    queryFn: async (): Promise<Me | null> => {
      const res = await fetch("api/me", { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 60_000,
  });

  // refetch when supabse auth state changes (login/logout/magic link)
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      qc.invalidateQueries({ queryKey: ["me"] });
    });
    return () => subscription.unsubscribe();
  }, [qc]);

  const value = useMemo(
    () => ({
      me: data ?? null,
      loading: isLoading,
      isAuthenticated: !!data,
    }),
    [data, isLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
