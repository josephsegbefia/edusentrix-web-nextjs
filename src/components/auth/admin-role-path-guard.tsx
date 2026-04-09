"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import type { AppRole } from "@/lib/roles";

const BURSAR_HOME_PATH = "/admin/finance";
const BILLING_OWNER_HOME_PATH = "/admin/settings/payment-setup";
const BURSAR_ALLOWED_PREFIXES = [
  "/admin/finance",
  "/admin/fees",
  "/admin/expenses",
  "/admin/settings/payment-setup",
];
const BILLING_OWNER_ALLOWED_PREFIXES = ["/admin/settings/payment-setup"];

function isAllowedBursarPath(pathname: string): boolean {
  if (pathname === "/admin" || pathname === "/admin/") return true;
  return BURSAR_ALLOWED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function AdminRolePathGuard({ role }: { role?: AppRole }) {
  const pathname = usePathname();
  const router = useRouter();

  React.useEffect(() => {
    if (role === "bursar") {
      if (!isAllowedBursarPath(pathname)) {
        router.replace(BURSAR_HOME_PATH);
        return;
      }
      if (pathname === "/admin" || pathname === "/admin/") {
        router.replace(BURSAR_HOME_PATH);
      }
      return;
    }

    if (role === "billing_owner") {
      const isAllowed = BILLING_OWNER_ALLOWED_PREFIXES.some(
        (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
      );
      if (!isAllowed) {
        router.replace(BILLING_OWNER_HOME_PATH);
        return;
      }
      if (pathname === "/admin" || pathname === "/admin/") {
        router.replace(BILLING_OWNER_HOME_PATH);
      }
    }
  }, [role, pathname, router]);

  return null;
}
