"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function useRoleRedirect(active: boolean = true) {
  const router = useRouter();

  useEffect(() => {
    if (!active) return;

    let cancelled = false;
    (async () => {
      const res = await fetch("/api/me", { cache: "no-store" });
      if (!res.ok) return; // not signed in → do nothing
      const json = await res.json();
      if (!cancelled && json?.redirect) {
        router.replace(json.redirect);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [active, router]);
}
