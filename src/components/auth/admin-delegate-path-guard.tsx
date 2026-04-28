"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";

export function AdminDelegatePathGuard({
  allowedPrefixes,
  homeHref,
}: {
  allowedPrefixes: string[];
  homeHref: string;
}) {
  const pathname = usePathname();
  const router = useRouter();

  React.useEffect(() => {
    const ok = allowedPrefixes.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
    );
    if (!ok) {
      router.replace(homeHref);
    }
  }, [allowedPrefixes, pathname, router, homeHref]);

  return null;
}
