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

export default function AppTopbar({ user }: { user: CurrentAppUser }) {
  const router = useRouter();
  const initial = (user.name || user.email || "?").charAt(0).toUpperCase();

  const onSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <header className="sticky top-0 z-40 w-full  bg-card">
      <div className="mx-auto max-w-7xl px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <PanelsTopLeft className="h-5 w-5" />
          <Link href="/dashboard" className="font-semibold">
            EduSentrix
          </Link>
        </div>

        <div className="flex items-center gap-3">
          {/* Optional: Cmd+K search can go here */}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-9 px-2">
                <Avatar className="h-7 w-7">
                  {user.avatarUrl ? (
                    <AvatarImage
                      src={user.avatarUrl}
                      alt={user.name || user.email}
                    />
                  ) : (
                    <AvatarFallback>{initial}</AvatarFallback>
                  )}
                </Avatar>
                <span className="ml-2 text-sm hidden md:block">
                  {user.name || user.email}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="space-y-0.5">
                <div className="text-sm font-medium">{user.name || "User"}</div>
                <div className="text-xs text-muted-foreground">
                  {user.email}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/settings">Settings</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={onSignOut}
                className="text-destructive"
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
