"use client";

import { usePathname } from "next/navigation";
import TrialBanner from "@/components/billing/TrialBanner";

/**
 * Trial strip for the admin shell. Hidden on the main dashboard (`/admin`) only.
 */
export function AdminTrialBanner({ endsAt }: { endsAt: string | null }) {
  const pathname = usePathname();
  const normalized = pathname.replace(/\/$/, "") || "/";
  if (normalized === "/admin") {
    return null;
  }
  return <TrialBanner endsAt={endsAt} />;
}
