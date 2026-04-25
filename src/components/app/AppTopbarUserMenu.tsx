import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";
import { Button } from "../ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { CurrentAppUser } from "@/lib/auth/get-current-user";
import { premiumMenuItem } from "../ui/premium";

export function AppTopbarUserMenu({
  user,
  initial,
  onSignOut,
}: {
  user: CurrentAppUser;
  initial: string;
  onSignOut: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="rounded-full px-3 py-1.5 bg-card hover:opacity-90 transition"
        asChild
      >
        <Button variant="ghost" className="h-9 px-2 hover:bg-neutral-900/70">
          <Avatar className="h-7 w-7">
            {user.avatarUrl ? (
              <AvatarImage src={user.avatarUrl} alt={user.name || user.email} />
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
      <DropdownMenuContent
        align="end"
        className="premiumMenuContent min-w-56 p-2"
      >
        <DropdownMenuLabel className="text-xs text-muted-foreground px-2 pb-1">
          Signed in as
        </DropdownMenuLabel>
        <div className="px-2 pb-2 text-foreground/90 text-sm">{user.email}</div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="rounded-lg premium-hover">
          <Link href="/profile">Profile</Link>
        </DropdownMenuItem>
        <DropdownMenuItem className="rounded-lg premium-hover">
          Preferences
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={onSignOut}
          className={`${premiumMenuItem} text-red-400 premium-hover`}
        >
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
