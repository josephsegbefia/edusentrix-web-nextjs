// src/components/app/AppTopbar.tsx
"use client";
import { useEffect, useState, startTransition } from "react";
import Link from "next/link";
import { CurrentAppUser } from "@/lib/auth/get-current-user";
import { useClerk } from "@clerk/nextjs";

import { BookOpen } from "lucide-react";
import { premiumTopLink } from "@/components/ui/premium";
import { AppTopbarUserMenu } from "./AppTopbarUserMenu";
import { NetworkIndicator } from "@/components/system/NetworkIndicator";
import { SchoolBrand } from "@/components/brand/SchoolBrand";
import { CurrentSchemeWeekBadge } from "@/components/schemes/CurrentSchemeWeekBadge";

export default function AppTopbar({ user }: { user: CurrentAppUser }) {
  const [mounted, setMounted] = useState(false);
  const { signOut } = useClerk();

  useEffect(() => {
    startTransition(() => {
      setMounted(true);
    });
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
      <header className="fixed top-0 left-0 right-0 z-50 w-full border-b border-neutral-900 bg-card/95 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <SchoolBrand size="sm" showName href="/admin" />
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
        <div className="flex items-center gap-3 min-w-0">
          <SchoolBrand size="sm" showName href="/admin" />
          <CurrentSchemeWeekBadge compact className="hidden sm:inline-flex shrink-0" />
          {/* Navigation links */}
          <nav className="ml-3 hidden lg:flex items-center gap-1">
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
