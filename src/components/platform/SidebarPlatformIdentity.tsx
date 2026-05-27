"use client";

import Image from "next/image";
import Link from "next/link";
import { Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EduSentrixWordmark } from "@/components/brand/EduSentrixWordmark";
import { EDUSENTRIX_LOGO_ALT, EDUSENTRIX_LOGO_PATH } from "@/lib/branding";
import { cn } from "@/lib/utils";

type SidebarPlatformIdentityProps = {
  href?: string;
  collapsed?: boolean;
  className?: string;
};

function LogoFrame({ collapsed }: { collapsed: boolean }) {
  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-2xl shadow-lg shadow-black/30",
        "bg-linear-to-br from-slate-800/80 via-slate-900 to-slate-950",
        "ring-1 ring-white/8",
        collapsed ? "h-11 w-11" : "h-12 w-12"
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-linear-to-br from-white/8 via-transparent to-cyan-400/8"
      />
      <Image
        src={EDUSENTRIX_LOGO_PATH}
        alt={EDUSENTRIX_LOGO_ALT}
        fill
        sizes={collapsed ? "44px" : "48px"}
        className="object-contain p-1.5"
      />
      {collapsed ? (
        <div className="absolute -bottom-0.5 -right-0.5 rounded-full border border-slate-950 bg-card px-1 py-0.5 text-[8px] font-bold tracking-wider text-white/70">
          PA
        </div>
      ) : null}
    </div>
  );
}

export function SidebarPlatformIdentity({
  href = "/platform",
  collapsed = false,
  className,
}: SidebarPlatformIdentityProps) {
  if (collapsed) {
    return (
      <Link
        href={href}
        className={cn("inline-flex rounded-2xl transition-opacity hover:opacity-90", className)}
        title="EduSentrix platform admin"
      >
        <LogoFrame collapsed />
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className={cn(
        "group block w-full rounded-2xl bg-white/3 p-3.5 text-left transition-all duration-200 hover:bg-white/5",
        className
      )}
    >
      <div className="flex items-center gap-3">
        <LogoFrame collapsed={false} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] tracking-tight text-white">
            <EduSentrixWordmark className="text-[13px]" /> Platform
          </p>
          <p className="mt-0.5 truncate text-[11px] leading-4 text-white/40">
            Cross-school operations and controls
          </p>
          <div className="mt-1.5 flex items-center gap-1.5">
            <Badge
              variant="outline"
              className="rounded-full border-cyan-400/20 bg-cyan-500/10 px-2 py-0.5 text-[9px] font-semibold tracking-wider text-cyan-100"
            >
              Platform Admin
            </Badge>
            <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] font-medium tracking-wider text-white/45">
              <Shield className="h-2.5 w-2.5" />
              Live Ops
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
