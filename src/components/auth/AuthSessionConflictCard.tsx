"use client";

import Link from "next/link";
import Image from "next/image";
import { AlertTriangle, ArrowRightLeft, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EDUSENTRIX_LOGO_ALT, EDUSENTRIX_LOGO_PATH } from "@/lib/branding";

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
    <div className="min-h-screen bg-bg px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            "radial-gradient(60% 40% at 70% 10%, #0ea5e9 0%, transparent 60%), radial-gradient(50% 50% at 20% 20%, #6d28d9 0%, transparent 60%)",
          filter: "blur(60px)",
        }}
      />
      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-5rem)] max-w-xl items-center">
        <div className="w-full overflow-hidden rounded-3xl border border-white/10 bg-card/95 shadow-2xl backdrop-blur-xl">
          <div className="border-b border-white/10 bg-gradient-to-r from-white/10 via-white/5 to-transparent px-10 py-8">
            <div className="mb-2 flex items-center gap-3">
              <Image
                src={EDUSENTRIX_LOGO_PATH}
                alt={EDUSENTRIX_LOGO_ALT}
                width={32}
                height={32}
                className="rounded-md"
              />
              <h1 className="text-3xl font-bold text-white">{title}</h1>
            </div>
            <p className="text-sm text-white/60">{description}</p>
          </div>

          <div className="space-y-6 px-10 py-8">
            <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="font-medium">A session is already active in this browser.</p>
                  <p className="mt-1 text-amber-100/80">
                    EduSentrix is currently using a single active Clerk session in this browser profile.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">
                Active Account
              </p>
              <p className="mt-2 text-base font-semibold text-white">{activeName}</p>
              {activeEmail ? (
                <p className="mt-1 text-sm text-white/55">{activeEmail}</p>
              ) : null}
            </div>

            {note ? (
              <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100/85">
                {note}
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <Button
                asChild
                className="h-auto min-h-12 whitespace-normal rounded-2xl bg-white px-5 py-3 text-left text-black hover:bg-white/90"
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
                className="h-auto min-h-12 whitespace-normal rounded-2xl border-white/10 bg-white/5 px-5 py-3 text-left text-white hover:bg-white/10"
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

            <p className="text-xs text-white/40">
              If you need both accounts open at the same time, use a private window or a separate browser profile.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
