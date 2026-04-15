"use client";

import { useEffect } from "react";
import { toast } from "sonner";

/**
 * Intercepts `DemoActionBlockedError` responses (HTTP 403 with
 * `code: "DEMO_ACTION_BLOCKED"`) and shows a user-friendly toast.
 *
 * Mount once in the demo layout — it patches the global fetch to
 * detect demo-blocked responses.
 */
export function DemoBlockedInterceptor() {
  useEffect(() => {
    const originalFetch = window.fetch;

    window.fetch = async function (...args) {
      const response = await originalFetch.apply(this, args);

      if (response.status === 403 || response.status === 400) {
        const cloned = response.clone();
        try {
          const json = await cloned.json();
          if (
            json?.code === "DEMO_ACTION_BLOCKED" ||
            (json?.error && typeof json.error === "string" && json.error.includes("demo mode"))
          ) {
            toast.error("Action blocked in demo", {
              description:
                json.error || "This action is not available in demo mode.",
              duration: 5000,
            });
          }
        } catch {
          /* not JSON — ignore */
        }
      }

      return response;
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  return null;
}
