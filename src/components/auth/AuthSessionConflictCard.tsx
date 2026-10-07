"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRightLeft, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/brand/BrandMark";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { authPageGlowStyle } from "@/components/auth/auth-surfaces";

type Props = {
  title: string;
  description: string;
  primaryHref?: string;
  primaryLabel: string;
  secondaryLabel: string;
  onSecondary: () => void | Promise<void>;
  secondaryBusy?: boolean;
  activeName: string;
  activeEmail?: string | null;
  note?: string;
};

export function AuthSessionConflictCard({
  title,
  description,
  primaryHref = "/auth/callback",
  primaryLabel,
  secondaryLabel,
  onSecondary,
  secondaryBusy = false,
  activeName,
  activeEmail,
  note,
}: Props) {
  return (
    <div className="m-page relative min-h-screen overflow-hidden px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={authPageGlowStyle}
      />
      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-5rem)] max-w-xl items-center">
        <div className="m-card-strong w-full overflow-hidden rounded-3xl backdrop-blur-xl">
          <div className="flex items-start justify-between gap-4 border-b border-(--m-border) px-6 py-6 sm:px-10 sm:py-8">
            <div className="min-w-0">
              <BrandMark size="sm" />
              <h1 className="mt-4 text-3xl font-bold text-(--m-fg)">{title}</h1>
              <p className="mt-2 text-sm m-muted">{description}</p>
            </div>
            <ThemeToggle className="shrink-0" />
          </div>

          <div className="space-y-6 px-6 py-6 sm:px-10 sm:py-8">
            <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="font-medium">A session is already active in this browser.</p>
                  <p className="mt-1 text-amber-800 dark:text-amber-100/80">
                    EduSentrix is currently using a single active Clerk session in this browser profile.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-(--m-border) bg-(--m-subtle) px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] m-faint">
                Active Account
              </p>
              <p className="mt-2 text-base font-semibold text-(--m-fg)">{activeName}</p>
              {activeEmail ? (
                <p className="mt-1 text-sm m-muted">{activeEmail}</p>
              ) : null}
            </div>

            {note ? (
              <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-900 dark:text-cyan-100">
                {note}
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <Button
                asChild
                className="h-auto min-h-12 whitespace-normal rounded-2xl bg-brand px-5 py-3 text-left text-black hover:bg-sky-300"
              >
                <Link href={primaryHref}>
                  <span className="flex w-full min-w-0 items-center justify-start gap-2 text-left">
                    <ShieldCheck className="h-4 w-4 shrink-0" />
                    <span className="min-w-0 whitespace-normal break-words leading-snug">
                      {primaryLabel}
                    </span>
                  </span>
                </Link>
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => void onSecondary()}
                disabled={secondaryBusy}
                className="h-auto min-h-12 whitespace-normal rounded-2xl border-(--m-border) bg-(--m-subtle) px-5 py-3 text-left text-(--m-fg) hover:bg-(--m-glass)"
              >
                <span className="flex w-full min-w-0 items-center justify-start gap-2 text-left">
                  {secondaryBusy ? (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                  ) : (
                    <ArrowRightLeft className="h-4 w-4 shrink-0" />
                  )}
                  <span className="min-w-0 whitespace-normal break-words leading-snug">
                    {secondaryLabel}
                  </span>
                </span>
              </Button>
            </div>

            <p className="text-xs m-faint">
              If you need both accounts open at the same time, use a private window or a separate browser profile.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
