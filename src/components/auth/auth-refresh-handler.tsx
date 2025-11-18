"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";

/**
 * Client component that refreshes auth state when coming from a successful login
 * This handles the case where cookies are set but React Query cache hasn't updated yet
 */
export function AuthRefreshHandler() {
  const searchParams = useSearchParams();
  const { refresh } = useAuth();
  const authSuccess = searchParams.get("auth");

  useEffect(() => {
    // If we're coming from a successful login, refresh the auth state
    if (authSuccess === "success") {
      // Small delay to ensure cookies are fully synced
      const timer = setTimeout(() => {
        refresh();
        // Remove the query parameter from URL without reload
        const url = new URL(window.location.href);
        url.searchParams.delete("auth");
        window.history.replaceState({}, "", url.toString());
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [authSuccess, refresh]);

  return null;
}
