// src/lib/auth/guards.ts
import "server-only";
import { redirect } from "next/navigation";
import type { AppRole } from "@/lib/roles";
import type { CurrentAppUser } from "./get-current-user";

export function assertRole(user: CurrentAppUser | null, allowed: AppRole[]) {
  if (!user) redirect("/login");
  if (!user.role || !allowed.includes(user.role)) {
    // Optional: send to a nicer 403 page
    redirect("/dashboard");
  }
}
