"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRightLeft, GraduationCap, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

type Workspace = "admin" | "teacher";

type WorkspaceSwitcherProps = {
  current: Workspace;
  collapsed?: boolean;
  className?: string;
};

type MeResponse = {
  user?: {
    workspaces?: {
      admin?: boolean;
      teacher?: boolean;
    };
  };
};

export function WorkspaceSwitcher({
  current,
  collapsed = false,
  className,
}: WorkspaceSwitcherProps) {
  const [target, setTarget] = React.useState<Workspace | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    void fetch("/api/me", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: MeResponse | null) => {
        if (cancelled) return;
        const workspaces = payload?.user?.workspaces;
        const next = current === "admin" ? "teacher" : "admin";
        if (workspaces?.[next]) setTarget(next);
      })
      .catch(() => {
        if (!cancelled) setTarget(null);
      });

    return () => {
      cancelled = true;
    };
  }, [current]);

  if (!target) return null;

  const targetLabel = target === "teacher" ? "Teacher" : "Admin";
  const TargetIcon = target === "teacher" ? GraduationCap : ShieldCheck;

  if (collapsed) {
    return (
      <Link
        href={`/${target}`}
        title={`Switch to ${targetLabel}`}
        aria-label={`Switch to ${targetLabel}`}
        className={cn(
          "mx-auto mt-2 flex h-9 w-9 items-center justify-center rounded-xl border border-(--m-border) bg-(--m-subtle) text-(--m-fg) transition hover:bg-(--m-glass)",
          className
        )}
      >
        <ArrowRightLeft className="h-4 w-4" />
      </Link>
    );
  }

  return (
    <Link
      href={`/${target}`}
      className={cn(
        "mt-2 flex items-center gap-2 rounded-xl border border-(--m-border) bg-(--m-subtle) px-3 py-2 text-xs font-semibold text-(--m-fg) transition hover:bg-(--m-glass)",
        className
      )}
    >
      <TargetIcon className="h-3.5 w-3.5 text-cyan-300" />
      <span className="min-w-0 flex-1 truncate">Switch to {targetLabel}</span>
      <ArrowRightLeft className="h-3.5 w-3.5 m-faint" />
    </Link>
  );
}
