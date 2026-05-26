"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type WorkspacePageShellProps = {
  children: React.ReactNode;
  className?: string;
  /** Show ambient teal/cyan blurs behind content (default true). */
  ambient?: boolean;
};

export function WorkspacePageShell({
  children,
  className,
  ambient = true,
}: WorkspacePageShellProps) {
  return (
    <div className={cn("relative", className)}>
      {ambient ? (
        <>
          <div
            className="pointer-events-none absolute -left-20 -top-20 h-56 w-56 rounded-full bg-teal-500/10 blur-3xl"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute -right-10 top-24 h-40 w-40 rounded-full bg-cyan-500/10 blur-3xl"
            aria-hidden="true"
          />
        </>
      ) : null}
      <div className="relative z-10 space-y-6">{children}</div>
    </div>
  );
}
