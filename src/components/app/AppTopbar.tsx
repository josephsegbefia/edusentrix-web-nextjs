// src/components/app/AppTopbar.tsx
"use client";
import Link from "next/link";
import { CurrentAppUser } from "@/lib/auth/get-current-user";
import { useClerk } from "@clerk/nextjs";

import { PanelsTopLeft } from "lucide-react";
import { premiumTopLink } from "@/components/ui/premium";
import { AppTopbarUserMenu } from "./AppTopbarUserMenu";

export default function AppTopbar({ user }: { user: CurrentAppUser }) {
  const { signOut } = useClerk();

  const initial = (user.name || user.email || "?").charAt(0).toUpperCase();

  // inside your component (e.g., AppTopbarUserMenu.tsx)
  const onSignOut = async () => {
    await signOut();
    window.location.href = "/sign-in";
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-neutral-900 bg-card">
      <div className="mx-auto max-w-7xl px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <PanelsTopLeft className="h-5 w-5 text-neutral-200" />
          <Link href="/platform" className="font-semibold text-neutral-100">
            EduSentrix
          </Link>
          {/* Example top links if/when you add them */}
          <nav className="ml-6 hidden md:flex items-center gap-1">
            <Link href="/dashboard" className={premiumTopLink}>
              Dashboard
            </Link>
            <Link href="/reports" className={premiumTopLink}>
              Reports
            </Link>
          </nav>
        </div>

        <AppTopbarUserMenu
          user={user}
          initial={initial}
          onSignOut={onSignOut}
        />
      </div>
    </header>
  );
}
