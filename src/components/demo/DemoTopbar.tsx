// src/components/demo/DemoTopbar.tsx
"use client";

import { useEffect, useState, startTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PanelsTopLeft, BookOpen, Clock, LogOut, User, Calendar } from "lucide-react";
import { premiumTopLink } from "@/components/ui/premium";
import { NetworkIndicator } from "@/components/system/NetworkIndicator";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import type { DemoUser } from "@/lib/demo/auth";

interface DemoTopbarProps {
  user: DemoUser;
}

export function DemoTopbar({ user }: DemoTopbarProps) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [remainingTime, setRemainingTime] = useState<number>(0);

  useEffect(() => {
    startTransition(() => {
      setMounted(true);
    });
  }, []);

  // Calculate remaining time
  useEffect(() => {
    const calculateRemaining = () => {
      const hardExpiry = new Date(user.demoSessionData.hardExpiresAt).getTime();
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((hardExpiry - now) / 1000));
      setRemainingTime(remaining);

      if (remaining === 0) {
        router.push("/demo/session-ended");
      }
    };

    calculateRemaining();
    const interval = setInterval(calculateRemaining, 1000);
    return () => clearInterval(interval);
  }, [user.demoSessionData.hardExpiresAt, router]);

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const initial = (user.name || user.email || "?").charAt(0).toUpperCase();

  const handleEndDemo = async () => {
    try {
      await fetch("/api/demo/session", { method: "DELETE" });
      router.push("/demo/session-ended");
    } catch (error) {
      console.error("Failed to end demo:", error);
    }
  };

  const handleScheduleCall = () => {
    router.push("/demo/schedule-call");
  };

  if (!mounted) {
    return (
      <header className="fixed top-0 left-0 right-0 z-50 w-full border-b border-neutral-900 bg-card/95 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <PanelsTopLeft className="h-5 w-5 text-neutral-200" />
            <span className="font-semibold text-neutral-100">EduSentrix</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-neutral-800 animate-pulse" />
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-50 w-full border-b border-neutral-900 bg-card/95 backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <PanelsTopLeft className="h-5 w-5 text-neutral-200" />
          <Link href="/demo/admin" className="font-semibold text-neutral-100">
            EduSentrix
          </Link>
          <Badge variant="outline" className="ml-2 border-amber-500/50 text-amber-400 text-xs">
            DEMO
          </Badge>

          {/* Navigation links */}
          <nav className="ml-6 hidden md:flex items-center gap-1">
            <Link
              href="/docs"
              className={`${premiumTopLink} flex items-center gap-2`}
            >
              <BookOpen className="h-4 w-4" />
              Documentation
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {/* Session timer */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-md bg-neutral-800/50 border border-neutral-700">
            <Clock className="h-4 w-4 text-amber-400" />
            <span className="text-sm font-mono text-neutral-300">
              {formatTime(remainingTime)}
            </span>
          </div>

          {/* Schedule Call CTA */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleScheduleCall}
            className="hidden md:flex items-center gap-2 border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10"
          >
            <Calendar className="h-4 w-4" />
            Schedule Demo
          </Button>

          <NetworkIndicator />

          {/* User menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-amber-500/20 text-amber-400">
                    {initial}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col">
                  <span className="font-medium">{user.name}</span>
                  <span className="text-xs text-muted-foreground">{user.email}</span>
                  <Badge variant="outline" className="mt-1 w-fit text-xs border-amber-500/50 text-amber-400">
                    Demo Account
                  </Badge>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleScheduleCall}>
                <Calendar className="mr-2 h-4 w-4" />
                Schedule a Call
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleEndDemo} className="text-red-400">
                <LogOut className="mr-2 h-4 w-4" />
                End Demo Session
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
