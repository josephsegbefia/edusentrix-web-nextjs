"use client";

import { useState, useEffect, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

type DemoSessionInfo = {
  sessionId: string;
  activePersonaRole: string;
  expiresAt: string;
  sandboxSchoolId: string | null;
  idleTimeoutMinutes: number;
};

const ROLE_LABELS: Record<string, string> = {
  school_admin: "School Admin",
  teacher: "Teacher",
  parent: "Parent",
  student: "Student",
  bursar: "Bursar",
};

export function DemoBanner() {
  const [session, setSession] = useState<DemoSessionInfo | null>(null);
  const [timeLeft, setTimeLeft] = useState("");
  const [switching, setSwitching] = useState(false);
  const [ending, setEnding] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch("/api/demo/session");
      if (!res.ok) return;
      const json = await res.json();
      if (json.success) setSession(json.data);
    } catch {
      /* silent */
    }
  }, []);

  const sendHeartbeat = useCallback(async () => {
    try {
      await fetch("/api/demo/heartbeat", {
        method: "POST",
        keepalive: true,
      });
    } catch {
      /* silent */
    }
  }, []);

  useEffect(() => {
    fetchSession();
    const interval = setInterval(fetchSession, 60_000);
    return () => clearInterval(interval);
  }, [fetchSession]);

  useEffect(() => {
    if (!session || !pathname) return;
    void fetch("/api/demo/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: pathname,
        title: typeof document !== "undefined" ? document.title : "",
      }),
      keepalive: true,
    }).catch(() => null);
  }, [pathname, session?.sessionId]);

  useEffect(() => {
    if (!session) return;

    const idleTimeoutMs = (session.idleTimeoutMinutes || 5) * 60_000;
    let lastInteractionAt = Date.now();
    let lastHeartbeatAt = 0;
    let ended = false;

    const recordActivity = () => {
      if (ended) return;
      lastInteractionAt = Date.now();
      if (lastInteractionAt - lastHeartbeatAt >= 45_000) {
        lastHeartbeatAt = lastInteractionAt;
        void sendHeartbeat();
      }
    };

    const idleInterval = window.setInterval(() => {
      if (ended) return;
      if (Date.now() - lastInteractionAt >= idleTimeoutMs) {
        ended = true;
        void (async () => {
          await fetch("/api/demo/end-session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reason: "idle_timeout" }),
            keepalive: true,
          }).catch(() => null);
          router.push("/");
        })();
      }
    }, 15_000);

    const activityEvents: Array<keyof WindowEventMap> = [
      "pointerdown",
      "keydown",
      "scroll",
      "touchstart",
      "focus",
    ];

    for (const eventName of activityEvents) {
      window.addEventListener(eventName, recordActivity, { passive: true });
    }

    recordActivity();

    const handlePageHide = () => {
      if (ended) return;
      ended = true;
      try {
        const body = JSON.stringify({ reason: "tab_closed" });
        if (typeof navigator !== "undefined" && navigator.sendBeacon) {
          const blob = new Blob([body], { type: "application/json" });
          navigator.sendBeacon("/api/demo/end-session", blob);
          return;
        }
      } catch {
        /* fall through */
      }
      void fetch("/api/demo/end-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "tab_closed" }),
        keepalive: true,
      }).catch(() => null);
    };

    window.addEventListener("pagehide", handlePageHide);

    return () => {
      window.clearInterval(idleInterval);
      window.removeEventListener("pagehide", handlePageHide);
      for (const eventName of activityEvents) {
        window.removeEventListener(eventName, recordActivity);
      }
    };
  }, [router, sendHeartbeat, session]);

  useEffect(() => {
    if (!session?.expiresAt) return;
    const tick = () => {
      const diff = new Date(session.expiresAt).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft("Expired");
        return;
      }
      const min = Math.floor(diff / 60_000);
      const sec = Math.floor((diff % 60_000) / 1000);
      setTimeLeft(`${min}m ${sec.toString().padStart(2, "0")}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [session?.expiresAt]);

  const switchPersona = async (role: string) => {
    setSwitching(true);
    try {
      const res = await fetch("/api/demo/switch-persona", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const json = await res.json();
      if (json.success) {
        await fetchSession();
        router.push(json.data.redirectTo);
      }
    } finally {
      setSwitching(false);
    }
  };

  const endSession = async () => {
    setEnding(true);
    try {
      await fetch("/api/demo/end-session", { method: "POST" });
      router.push("/");
    } finally {
      setEnding(false);
    }
  };

  if (!session) return null;

  const isExpired = timeLeft === "Expired";
  const currentRole = session.activePersonaRole;

  return (
    <>
      <div
        className={cn(
          "fixed top-0 left-0 right-0 z-9999 flex items-center justify-between px-4 py-1.5 text-xs font-medium",
          isExpired
            ? "bg-red-600 text-white"
            : "bg-amber-400 text-amber-950"
        )}
      >
        <div className="flex items-center gap-3">
          <span className="rounded bg-black/10 px-1.5 py-0.5 font-bold uppercase tracking-wider">
            Demo
          </span>
          <span>
            Viewing as{" "}
            <strong>{ROLE_LABELS[currentRole] || currentRole}</strong>
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            {Object.entries(ROLE_LABELS)
              .filter(([key]) => key !== currentRole)
              .map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => switchPersona(key)}
                  disabled={switching || isExpired}
                  className="rounded bg-black/10 px-2 py-0.5 transition hover:bg-black/20 disabled:opacity-50"
                >
                  {label}
                </button>
              ))}
          </div>

          <span
            className={cn(
              "tabular-nums",
              isExpired ? "font-bold" : "opacity-80"
            )}
          >
            {isExpired ? "Session expired" : timeLeft}
          </span>

          <button
            onClick={endSession}
            disabled={ending}
            className="rounded bg-black/20 px-2 py-0.5 font-semibold transition hover:bg-black/30 disabled:opacity-50"
          >
            {ending ? "Ending..." : "End demo"}
          </button>
        </div>
      </div>

      {isExpired && (
        <div className="fixed inset-0 z-9998 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="rounded-xl bg-white p-8 text-center shadow-2xl">
            <h2 className="mb-2 text-xl font-bold text-gray-900">
              Demo session expired
            </h2>
            <p className="mb-6 text-sm text-gray-600">
              Your demo session ended after inactivity. Start a new one to continue exploring.
            </p>
            <button
              onClick={() => router.push("/")}
              className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
            >
              Start a new demo
            </button>
          </div>
        </div>
      )}
    </>
  );
}
