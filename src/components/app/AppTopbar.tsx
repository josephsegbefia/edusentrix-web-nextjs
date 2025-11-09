// src/components/app/AppTopbar.tsx
"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CurrentAppUser } from "@/lib/auth/get-current-user";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, PanelsTopLeft } from "lucide-react";
import {
  premiumMenuContent,
  premiumMenuItem,
  premiumSeparator,
  premiumTopLink,
} from "@/components/ui/premium";

export default function AppTopbar({ user }: { user: CurrentAppUser }) {
  const router = useRouter();
  const initial = (user.name || user.email || "?").charAt(0).toUpperCase();

  const onSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-neutral-900 bg-card">
      <div className="mx-auto max-w-7xl px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <PanelsTopLeft className="h-5 w-5 text-neutral-200" />
          <Link href="/dashboard" className="font-semibold text-neutral-100">
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

        <div className="flex items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="h-9 px-2 hover:bg-neutral-900/70"
              >
                <Avatar className="h-7 w-7">
                  {user.avatarUrl ? (
                    <AvatarImage
                      src={user.avatarUrl}
                      alt={user.name || user.email}
                    />
                  ) : (
                    <AvatarFallback className="bg-neutral-800 text-neutral-200">
                      {initial}
                    </AvatarFallback>
                  )}
                </Avatar>
                <span className="ml-2 text-sm hidden md:block text-neutral-200">
                  {user.name || user.email}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className={premiumMenuContent}>
              <DropdownMenuLabel className="space-y-0.5 px-2 py-1.5">
                <div className="text-sm font-medium text-neutral-100">
                  {user.name || "User"}
                </div>
                <div className="text-xs text-neutral-400">{user.email}</div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className={premiumSeparator} />
              <DropdownMenuItem asChild className={premiumMenuItem}>
                <Link href="/settings">Settings</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator className={premiumSeparator} />
              <DropdownMenuItem
                onClick={onSignOut}
                className={`${premiumMenuItem} text-red-400 hover:text-red-300`}
              >
                <LogOut className="mr-2 h-4 w-4" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
