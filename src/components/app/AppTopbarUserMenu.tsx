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

const menuItemClass =
  "cursor-pointer rounded-lg text-(--m-fg)! focus:bg-(--m-subtle)! focus:text-(--m-fg)!";

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
        className="rounded-full bg-transparent px-3 py-1.5 transition hover:opacity-90"
        asChild
      >
        <Button
          variant="ghost"
          className="h-9 border border-(--m-border) bg-(--m-subtle) px-2 text-(--m-fg) hover:bg-(--m-glass)"
        >
          <Avatar className="h-7 w-7">
            {user.avatarUrl ? (
              <AvatarImage src={user.avatarUrl} alt={user.name || user.email} />
            ) : (
              <AvatarFallback className="bg-(--m-glass) text-(--m-fg)">
                {initial}
              </AvatarFallback>
            )}
          </Avatar>
          <span className="ml-2 hidden text-sm text-(--m-fg) md:block">
            {user.name || user.email}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="min-w-56 border-(--m-border)! bg-(--m-glass-strong)! p-2 text-(--m-fg)! shadow-lg backdrop-blur-xl"
      >
        <DropdownMenuLabel className="px-2 pb-1 text-xs m-muted">
          Signed in as
        </DropdownMenuLabel>
        <div className="px-2 pb-2 text-sm text-(--m-fg)">{user.email}</div>
        <DropdownMenuSeparator className="bg-(--m-border)!" />
        <DropdownMenuItem asChild className={menuItemClass}>
          <Link href="/profile">Profile</Link>
        </DropdownMenuItem>
        <DropdownMenuItem className={menuItemClass}>
          Preferences
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-(--m-border)!" />
        <DropdownMenuItem
          onClick={onSignOut}
          className={`${menuItemClass} text-rose-700! focus:text-rose-800! dark:text-rose-300! dark:focus:text-rose-200!`}
        >
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
