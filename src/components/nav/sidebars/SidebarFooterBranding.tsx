"use client";

import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

type SidebarFooterBrandingProps = {
  collapsed?: boolean;
  className?: string;
};

export function SidebarFooterBranding({
  collapsed = false,
  className,
}: SidebarFooterBrandingProps) {
  if (collapsed) {
    return (
      <Link
        href="/"
        className={cn(
          "mx-auto inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white/3 transition-colors hover:bg-white/6",
          className
        )}
        title="EduSentrix by Appsentrix"
      >
        <Image
          src="/logo/edusentrix-logo-transparent.png"
          alt="EduSentrix"
          width={24}
          height={24}
          className="object-contain"
        />
      </Link>
    );
  }

  return (
    <div
      className={cn(
        "rounded-2xl bg-white/3 p-3",
        className
      )}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-violet-500/10 to-cyan-500/10">
          <Image
            src="/logo/edusentrix-logo-transparent.png"
            alt="EduSentrix"
            width={22}
            height={22}
            className="object-contain"
          />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold tracking-wide text-white/50">
            Powered by EduSentrix
          </p>
          <p className="text-[10px] leading-4 text-white/30">
            Built by Appsentrix
          </p>
        </div>
      </div>
    </div>
  );
}
