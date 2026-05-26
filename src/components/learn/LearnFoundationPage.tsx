"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircle2, CircleDashed, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlassPanel } from "@/components/ui/glass-panel";
import { WorkspacePageHeader } from "@/components/ui/workspace-page-header";
import { WorkspacePageShell } from "@/components/ui/workspace-page-shell";
import { glassInsetClass } from "@/lib/ui/glass-surfaces";
import { cn } from "@/lib/utils";

type LearnFoundationPageProps = {
  audience: "platform" | "admin" | "teacher" | "parent";
  subtitle: string;
  completedItems: string[];
  nextItems: string[];
  quickLinks?: Array<{ label: string; href: string }>;
};

const audienceLabel: Record<LearnFoundationPageProps["audience"], string> = {
  platform: "Platform management",
  admin: "School management",
  teacher: "Teacher visibility",
  parent: "Parent access",
};

export function LearnFoundationPage({
  audience,
  subtitle,
  completedItems,
  nextItems,
  quickLinks = [],
}: LearnFoundationPageProps) {
  return (
    <div className="p-6 text-white md:p-8">
      <WorkspacePageShell>
        <WorkspacePageHeader
          title="EduSentrix Learn"
          subtitle={subtitle}
          icon={Sparkles}
          badge={
            <span className="rounded-full border border-amber-300/25 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-100">
              Foundation in progress
            </span>
          }
        />

        <GlassPanel glow="both" className="p-6">
          <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
            <div className={cn(glassInsetClass, "p-5")}>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-200/70">
                {audienceLabel[audience]}
              </p>
              <h2 className="mt-3 text-xl font-semibold text-white">
                Backend contract is being established first.
              </h2>
              <p className="mt-3 text-sm leading-6 text-white/60">
                This area is intentionally not showing fake Learn counts,
                payments, credentials, or student activity. Live controls will
                appear as the scoped APIs, account creation, and payment flows
                are completed.
              </p>
              {quickLinks.length > 0 ? (
                <div className="mt-5 flex flex-wrap gap-2">
                  {quickLinks.map((link) => (
                    <Button
                      key={link.href}
                      asChild
                      size="sm"
                      className="rounded-xl bg-teal-400 text-slate-950 hover:bg-teal-300"
                    >
                      <Link href={link.href}>{link.label}</Link>
                    </Button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <StatusList title="Ready now" items={completedItems} done />
              <StatusList title="Next backend slices" items={nextItems} />
            </div>
          </div>
        </GlassPanel>
      </WorkspacePageShell>
    </div>
  );
}

function StatusList({
  title,
  items,
  done = false,
}: {
  title: string;
  items: string[];
  done?: boolean;
}) {
  const Icon = done ? CheckCircle2 : CircleDashed;

  return (
    <div className={cn(glassInsetClass, "p-5")}>
      <h3 className="text-sm font-semibold text-white">{title}</h3>
      <ul className="mt-4 space-y-3">
        {items.map((item) => (
          <li key={item} className="flex gap-3 text-sm text-white/65">
            <Icon
              className={cn(
                "mt-0.5 h-4 w-4 shrink-0",
                done ? "text-emerald-300" : "text-amber-300"
              )}
            />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
