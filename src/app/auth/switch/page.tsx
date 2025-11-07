"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AuthSwitchPage() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      try {
        // Wait a moment for the session to be established after callback
        await new Promise((resolve) => setTimeout(resolve, 100));

        const res = await fetch("/api/me", {
          cache: "no-store",
          credentials: "include",
        });

        if (!res.ok) {
          // If 401, user is not authenticated - redirect to login
          if (res.status === 401) {
            router.replace("/login?error=unauthorized");
            return;
          }
          throw new Error(`API error: ${res.status}`);
        }

        const payload = await res.json();

        // Check if we got a valid response with redirect
        if (payload?.ok && payload?.redirect) {
          router.replace(payload.redirect);
        } else if (payload?.ok && payload?.user) {
          // If we have user but no redirect, go to dashboard hub
          router.replace("/dashboard");
        } else {
          router.replace("/login?error=unauthorized");
        }
      } catch (error) {
        console.error("Auth switch error:", error);
        router.replace("/login?error=unauthorized");
      }
    })();
  }, [router]);

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 to-indigo-50 grid place-items-center">
      <div className="text-gray-700">Signing you in…</div>
    </div>
  );
}
