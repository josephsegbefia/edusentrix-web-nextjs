// src/components/demo/DemoBanner.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Clock, Phone, LogOut, AlertTriangle, X, Loader2 } from "lucide-react";
import { useDemoSession } from "@/hooks/useDemoSession";
import { useDemo } from "./DemoContext";

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

/**
 * Persistent banner for demo mode - shows session info and CTAs
 */
export function DemoBanner() {
  const router = useRouter();
  const { isDemo, showContactSales } = useDemo();
  const { session, isAuthenticated, remaining, endSession, isEndingSession, refreshSession } =
    useDemoSession();
  const [dismissed, setDismissed] = useState(false);

  // Refresh session on user activity
  useEffect(() => {
    if (!isDemo || !isAuthenticated) return;

    const handleActivity = () => refreshSession();
    const events = ["click", "keypress", "scroll", "mousemove"];

    // Throttle to once per minute
    let lastRefresh = Date.now();
    const throttledRefresh = () => {
      if (Date.now() - lastRefresh > 60000) {
        lastRefresh = Date.now();
        handleActivity();
      }
    };

    events.forEach((event) => window.addEventListener(event, throttledRefresh, { passive: true }));
    return () => {
      events.forEach((event) => window.removeEventListener(event, throttledRefresh));
    };
  }, [isDemo, isAuthenticated, refreshSession]);

  if (!isDemo || !isAuthenticated || !session || dismissed) return null;

  const isLowTime = (remaining?.hardLimitSeconds || 0) < 15 * 60; // Less than 15 minutes
  const isCritical = (remaining?.hardLimitSeconds || 0) < 5 * 60; // Less than 5 minutes

  return (
    <div
      className={`sticky top-0 z-50 px-4 py-2 text-sm transition-colors ${
        isCritical
          ? "bg-gradient-to-r from-red-600 to-orange-600"
          : isLowTime
          ? "bg-gradient-to-r from-amber-500 to-orange-500"
          : "bg-gradient-to-r from-indigo-600 to-purple-600"
      } text-white`}
    >
      <div className="container mx-auto flex items-center justify-between gap-4">
        {/* Left: Demo info */}
        <div className="flex items-center gap-4">
          <span className="font-semibold flex items-center gap-1.5">
            🎓 Demo Mode
          </span>
          <span className="hidden sm:inline text-white/80">
            {session.fullName} • {session.organization}
          </span>
        </div>

        {/* Right: Timer and actions */}
        <div className="flex items-center gap-3">
          {/* Timer */}
          <div
            className={`flex items-center gap-1.5 px-2 py-1 rounded-full ${
              isCritical
                ? "bg-white/20 animate-pulse"
                : isLowTime
                ? "bg-white/20"
                : "bg-white/10"
            }`}
          >
            <Clock className="h-3.5 w-3.5" />
            <span className="font-medium">
              {isCritical && <AlertTriangle className="h-3 w-3 inline mr-1" />}
              {formatTime(remaining?.hardLimitSeconds || 0)}
            </span>
          </div>

          {/* Contact Sales */}
          <Button
            size="sm"
            variant="ghost"
            className="text-white hover:bg-white/20 hidden sm:inline-flex"
            onClick={showContactSales}
          >
            <Phone className="h-4 w-4 mr-1.5" />
            Contact Sales
          </Button>

          {/* End Session */}
          <Button
            size="sm"
            variant="ghost"
            className="text-white hover:bg-white/20"
            onClick={() => endSession()}
            disabled={isEndingSession}
          >
            {isEndingSession ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <LogOut className="h-4 w-4 sm:mr-1.5" />
                <span className="hidden sm:inline">End Demo</span>
              </>
            )}
          </Button>

          {/* Dismiss (mobile only) */}
          <button
            onClick={() => setDismissed(true)}
            className="text-white/60 hover:text-white sm:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
