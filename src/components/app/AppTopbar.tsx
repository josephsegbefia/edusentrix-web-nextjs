// src/components/app/AppTopbar.tsx
"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { CurrentAppUser } from "@/lib/auth/get-current-user";
import { useClerk } from "@clerk/nextjs";

import { PanelsTopLeft, BookOpen } from "lucide-react";
import { premiumTopLink } from "@/components/ui/premium";
import { AppTopbarUserMenu } from "./AppTopbarUserMenu";
import { NetworkIndicator } from "@/components/system/NetworkIndicator";

export default function AppTopbar({ user }: { user: CurrentAppUser }) {
  const [mounted, setMounted] = useState(false);
  const { signOut } = useClerk();

  useEffect(() => {
    setMounted(true);
  }, []);

  const initial = (user.name || user.email || "?").charAt(0).toUpperCase();

  // inside your component (e.g., AppTopbarUserMenu.tsx)
  const onSignOut = async () => {
    await signOut();
    window.location.href = "/sign-in";
  };

  // Prevent hydration mismatch by ensuring consistent rendering
  if (!mounted) {
    return (
      <header className="sticky top-0 z-40 w-full border-b border-neutral-900 bg-card">
        <div className="mx-auto max-w-7xl px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <PanelsTopLeft className="h-5 w-5 text-neutral-200" />
            <Link href="/platform" className="font-semibold text-neutral-100">
              EduSentrix
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-neutral-800 animate-pulse" />
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b border-neutral-900 bg-card">
      <div className="mx-auto max-w-7xl px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <PanelsTopLeft className="h-5 w-5 text-neutral-200" />
          <Link href="/platform" className="font-semibold text-neutral-100">
            EduSentrix
          </Link>
          {/* Navigation links */}
          <nav className="ml-6 hidden md:flex items-center gap-1">
            <Link
              href="/docs"
              className={`${premiumTopLink} flex items-center gap-2`}
            >
              <BookOpen className="h-4 w-4" />
              Documentation & Help
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <NetworkIndicator />
          <AppTopbarUserMenu
            user={user}
            initial={initial}
            onSignOut={onSignOut}
          />
        </div>
      </div>
    </header>
  );
}
