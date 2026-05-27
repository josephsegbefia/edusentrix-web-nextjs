"use client";

import type { ComponentType } from "react";
import Image from "next/image";
import { EDUSENTRIX_WORDMARK_GRADIENT_STYLE } from "@/lib/branding";
import { cn } from "@/lib/utils";

const LEARN_SIDEBAR_HREFS = [
  "/admin/learn",
  "/teacher/learn",
  "/parent/learn",
  "/platform/learn",
] as const;

export function isLearnSidebarHref(href: string) {
  return LEARN_SIDEBAR_HREFS.some(
    (learnHref) => href === learnHref || href.startsWith(`${learnHref}/`)
  );
}

/** Larger Learn mark for sidebar nav (fills icon slot). */
export function SidebarLearnNavIcon({ className }: { className?: string }) {
  return (
    <Image
      src="/logo/learn/logo-mark-leo-learning.png"
      alt=""
      aria-hidden="true"
      width={28}
      height={28}
      className={cn("h-7 w-7 shrink-0 object-cover", className)}
    />
  );
}

/** Premium wordmark gradient for the Learn nav label. */
export function SidebarLearnNavLabel({ className }: { className?: string }) {
  return (
    <span
      className={cn("truncate font-normal", className)}
      style={EDUSENTRIX_WORDMARK_GRADIENT_STYLE}
    >
      EduSentrix Learn
    </span>
  );
}

export function SidebarNavItemIcon({
  href,
  icon: Icon,
  className,
}: {
  href: string;
  icon: ComponentType<{ className?: string }>;
  className?: string;
}) {
  if (isLearnSidebarHref(href)) {
    return <SidebarLearnNavIcon />;
  }
  return <Icon className={className} />;
}

export function SidebarNavItemLabel({
  href,
  label,
  className,
}: {
  href: string;
  label: string;
  className?: string;
}) {
  if (isLearnSidebarHref(href)) {
    return <SidebarLearnNavLabel className={className} />;
  }
  return <span className={cn("truncate", className)}>{label}</span>;
}
