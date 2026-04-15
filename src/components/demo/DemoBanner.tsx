"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

type DemoSessionInfo = {
  sessionId: string;
  activePersonaRole: string;
  expiresAt: string;
  sandboxSchoolId: string | null;
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

  useEffect(() => {
    fetchSession();
    const interval = setInterval(fetchSession, 60_000);
    return () => clearInterval(interval);
  }, [fetchSession]);

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
              Your 90-minute demo session has ended. Start a new one to
              continue exploring.
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
