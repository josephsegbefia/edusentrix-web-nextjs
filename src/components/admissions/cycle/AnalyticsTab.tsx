"use client";

import * as React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Receipt,
  RefreshCcw,
  ShieldAlert,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useAdmissionAnalytics } from "@/hooks/admissions/useAdmissionAnalytics";
import type {
  ChannelBreakdown,
  CycleAnalyticsSnapshot,
  GradeRow,
} from "@/lib/admissions/analytics";

const CHANNEL_LABELS: Record<string, string> = {
  public_link: "Public link",
  embed: "Embed",
  qr: "QR code",
  direct_invite: "Direct invite",
  whatsapp: "WhatsApp",
  internal: "Staff entry",
};

const FUNNEL_TONES = [
  "from-cyan-500/40 to-cyan-400/15",
  "from-violet-500/40 to-violet-400/15",
  "from-amber-500/40 to-amber-400/15",
  "from-emerald-500/40 to-emerald-400/15",
  "from-rose-500/40 to-rose-400/15",
] as const;

function pct(value: number | null | undefined, fractionDigits = 0): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${(value * 100).toFixed(fractionDigits)}%`;
}

function money(amountMinor: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-GH", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amountMinor / 100);
  } catch {
    return `${currency} ${(amountMinor / 100).toFixed(2)}`;
  }
}

function durationFromHours(hours: number | null): string {
  if (hours == null || !Number.isFinite(hours)) return "—";
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  if (hours < 48) return `${hours.toFixed(1)} hrs`;
  const days = hours / 24;
  if (days < 14) return `${days.toFixed(1)} days`;
  return `${Math.round(days)} days`;
}

export function AnalyticsTab({ cycleId }: { cycleId: string }) {
  const { data, isLoading, isError, error, refetch, isFetching } =
    useAdmissionAnalytics(cycleId);

  if (isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-2xl border border-white/10 bg-slate-950/60"
          />
        ))}
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-5 text-sm text-rose-100">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-4 w-4" />
          <div>
            <p className="font-semibold">Couldn’t load analytics</p>
            <p className="text-xs text-rose-100/80">
              {error?.message ?? "Try again in a moment."}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="ml-auto"
            onClick={() => refetch()}
          >
            <RefreshCcw className="mr-1.5 h-3 w-3" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const snap = data.data;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">Pipeline analytics</h3>
          <p className="text-xs text-white/55">
            Live snapshot of conversion, capacity, and operational SLAs.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          {isFetching ? (
            <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
          ) : (
            <RefreshCcw className="mr-1.5 h-3 w-3" />
          )}
          Refresh
        </Button>
      </div>

      <SummaryGrid snap={snap} />
      <FunnelSection snap={snap} />
      <div className="grid gap-5 lg:grid-cols-3">
        <CapacitySection rows={snap.byGrade} className="lg:col-span-2" />
        <ChannelSection breakdown={snap.byChannel} />
      </div>
      <FeeSection snap={snap} />
    </div>
  );
}

// -------------------------------------------------------------------------
// Summary
// -------------------------------------------------------------------------

function SummaryGrid({ snap }: { snap: CycleAnalyticsSnapshot }) {
  const submittedToProvisioned = snap.totals.applications
    ? snap.funnel[snap.funnel.length - 1].count / snap.totals.applications
    : 0;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <SummaryCard
        icon={<Users className="h-3.5 w-3.5" />}
        label="Applications"
        value={String(snap.totals.applications)}
        helper={`${snap.totals.submittedThisWeek} new this week`}
      />
      <SummaryCard
        icon={<TrendingUp className="h-3.5 w-3.5" />}
        label="End-to-end conversion"
        value={pct(submittedToProvisioned, 1)}
        helper="Submitted → enrolled"
      />
      <SummaryCard
        icon={<Zap className="h-3.5 w-3.5" />}
        label="Median decision time"
        value={durationFromHours(snap.decisionVelocity.medianHours)}
        helper={`${snap.decisionVelocity.pendingDecisions} pending`}
      />
      <SummaryCard
        icon={<Receipt className="h-3.5 w-3.5" />}
        label="Fee status"
        value={
          snap.fee.enabled
            ? `${snap.fee.paid} paid · ${snap.fee.pending} pending`
            : "Not collected"
        }
        helper={
          snap.fee.enabled
            ? `${money(snap.fee.amountMinor, snap.fee.currency)} per applicant`
            : "Fee not enabled on this cycle"
        }
      />
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  helper,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  helper?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">
        <span className="text-white/55">{icon}</span>
        {label}
      </div>
      <div className="mt-2 text-lg font-semibold text-white">{value}</div>
      {helper ? (
        <div className="mt-1 text-xs text-white/55">{helper}</div>
      ) : null}
    </div>
  );
}

// -------------------------------------------------------------------------
// Funnel
// -------------------------------------------------------------------------

function FunnelSection({ snap }: { snap: CycleAnalyticsSnapshot }) {
  const max = Math.max(...snap.funnel.map((f) => f.count), 1);

  return (
    <section className="rounded-2xl border border-white/10 bg-slate-950/60 p-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">Conversion funnel</h3>
          <p className="text-xs text-white/55">
            How applicants flow from submission to enrolment.
          </p>
        </div>
        <Badge
          variant="outline"
          className="border-white/10 bg-white/5 text-white/65"
        >
          {snap.totals.applications} total
        </Badge>
      </div>

      <ol className="mt-5 space-y-2.5">
        {snap.funnel.map((stage, idx) => {
          const widthPct = (stage.count / max) * 100;
          const tone = FUNNEL_TONES[idx] ?? FUNNEL_TONES[0];
          const dropOff =
            idx > 0 && snap.funnel[idx - 1].count > 0
              ? snap.funnel[idx - 1].count - stage.count
              : 0;
          return (
            <li key={stage.id} className="space-y-1">
              <div className="flex items-baseline justify-between text-xs">
                <span className="font-semibold text-white/85">{stage.label}</span>
                <span className="text-white/55">
                  {stage.count}
                  {idx > 0 && stage.conversionFromPrev != null ? (
                    <>
                      <span className="px-1.5 text-white/30">·</span>
                      {pct(stage.conversionFromPrev, 0)} of prev
                    </>
                  ) : null}
                  {dropOff > 0 ? (
                    <>
                      <span className="px-1.5 text-white/30">·</span>
                      <span className="text-rose-200">−{dropOff}</span>
                    </>
                  ) : null}
                </span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-white/5">
                <div
                  className={cn(
                    "h-full rounded-full bg-gradient-to-r transition-all",
                    tone
                  )}
                  style={{ width: `${Math.max(widthPct, stage.count > 0 ? 4 : 0)}%` }}
                />
              </div>
            </li>
          );
        })}
      </ol>

      <div className="mt-4 grid grid-cols-3 gap-3 border-t border-white/10 pt-4">
        <FunnelStat label="This week — submitted" value={snap.totals.submittedThisWeek} />
        <FunnelStat label="This week — decided" value={snap.totals.decidedThisWeek} />
        <FunnelStat
          label="This week — provisioned"
          value={snap.totals.provisionedThisWeek}
        />
      </div>
    </section>
  );
}

function FunnelStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">
        {label}
      </p>
      <p className="mt-1 text-base font-semibold text-white">{value}</p>
    </div>
  );
}

// -------------------------------------------------------------------------
// Capacity heatmap
// -------------------------------------------------------------------------

function CapacitySection({
  rows,
  className,
}: {
  rows: GradeRow[];
  className?: string;
}) {
  if (rows.length === 0) {
    return (
      <section
        className={cn(
          "rounded-2xl border border-white/10 bg-slate-950/60 p-5",
          className
        )}
      >
        <h3 className="text-sm font-semibold text-white">Capacity by grade</h3>
        <p className="mt-2 text-xs text-white/55">
          Applications haven’t been mapped to a grade yet.
        </p>
      </section>
    );
  }

  return (
    <section
      className={cn(
        "rounded-2xl border border-white/10 bg-slate-950/60 p-5",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">Capacity by grade</h3>
          <p className="text-xs text-white/55">
            Accepted versus declared capacity. Colour intensity shows fill rate.
          </p>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-white/10">
        <table className="w-full text-xs">
          <thead className="bg-white/5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45">
            <tr>
              <th className="px-3 py-2 text-left">Grade</th>
              <th className="px-3 py-2 text-right">In progress</th>
              <th className="px-3 py-2 text-right">Waitlist</th>
              <th className="px-3 py-2 text-right">Accepted</th>
              <th className="px-3 py-2 text-right">Enrolled</th>
              <th className="px-3 py-2 text-right">Capacity</th>
              <th className="px-3 py-2 text-left">Fill</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.gradeId ?? "_unassigned"} className="border-t border-white/5">
                <td className="px-3 py-2 text-white/85">
                  <div className="flex items-center gap-2">
                    <span>{row.gradeName}</span>
                    {row.atCapacity ? (
                      <Badge
                        variant="outline"
                        className="border-amber-500/30 bg-amber-500/10 text-[10px] text-amber-100"
                      >
                        Full
                      </Badge>
                    ) : null}
                  </div>
                </td>
                <td className="px-3 py-2 text-right text-white/70">{row.inProgress}</td>
                <td className="px-3 py-2 text-right text-white/70">{row.waitlisted}</td>
                <td className="px-3 py-2 text-right font-medium text-emerald-100">
                  {row.accepted}
                </td>
                <td className="px-3 py-2 text-right text-white/70">{row.provisioned}</td>
                <td className="px-3 py-2 text-right text-white/55">
                  {row.capacity == null ? "—" : row.capacity}
                </td>
                <td className="px-3 py-2 text-left">
                  <FillBar
                    fill={row.fillRate}
                    accepted={row.accepted}
                    capacity={row.capacity}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function FillBar({
  fill,
  accepted,
  capacity,
}: {
  fill: number | null;
  accepted: number;
  capacity: number | null;
}) {
  if (capacity == null) {
    return (
      <span className="text-[11px] text-white/40">No capacity set</span>
    );
  }
  const clamped = Math.min(1, Math.max(0, fill ?? 0));
  const tone =
    clamped >= 0.95
      ? "from-rose-500 to-rose-400"
      : clamped >= 0.75
        ? "from-amber-500 to-amber-400"
        : clamped >= 0.4
          ? "from-cyan-500 to-cyan-400"
          : "from-emerald-500 to-emerald-400";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/5">
        <div
          className={cn("h-full rounded-full bg-gradient-to-r", tone)}
          style={{ width: `${Math.max(clamped * 100, accepted > 0 ? 4 : 0)}%` }}
        />
      </div>
      <span className="text-[11px] text-white/55">{pct(clamped, 0)}</span>
    </div>
  );
}

// -------------------------------------------------------------------------
// Channel mix
// -------------------------------------------------------------------------

function ChannelSection({ breakdown }: { breakdown: ChannelBreakdown }) {
  const total = breakdown.reduce((sum, row) => sum + row.total, 0);
  return (
    <section className="rounded-2xl border border-white/10 bg-slate-950/60 p-5">
      <h3 className="text-sm font-semibold text-white">Channel mix</h3>
      <p className="text-xs text-white/55">
        Where applications are coming from.
      </p>
      {total === 0 ? (
        <p className="mt-3 text-xs text-white/55">No applications yet.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {breakdown
            .slice()
            .sort((a, b) => b.total - a.total)
            .map((row) => {
              const share = row.total / total;
              return (
                <li key={row.channel} className="space-y-1">
                  <div className="flex items-baseline justify-between text-xs">
                    <span className="font-medium text-white/85">
                      {CHANNEL_LABELS[row.channel] ?? row.channel}
                    </span>
                    <span className="text-white/55">
                      {row.total} · {pct(share, 0)}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-cyan-500/70 to-violet-500/70"
                      style={{ width: `${Math.max(share * 100, 4)}%` }}
                    />
                  </div>
                  <div className="text-[11px] text-white/45">
                    {row.accepted} accepted · {pct(row.acceptanceRate, 0)} acceptance
                  </div>
                </li>
              );
            })}
        </ul>
      )}
    </section>
  );
}

// -------------------------------------------------------------------------
// Fee section
// -------------------------------------------------------------------------

function FeeSection({ snap }: { snap: CycleAnalyticsSnapshot }) {
  if (!snap.fee.enabled) {
    return null;
  }
  const total = snap.fee.paid + snap.fee.pending + snap.fee.waived;
  const collected = snap.fee.paid * snap.fee.amountMinor;
  const pendingValue = snap.fee.pending * snap.fee.amountMinor;
  return (
    <section className="rounded-2xl border border-white/10 bg-slate-950/60 p-5">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">Application fees</h3>
          <p className="text-xs text-white/55">
            {snap.fee.mode === "online_paystack"
              ? "Collected automatically via Paystack."
              : "Recorded manually by staff."}
          </p>
        </div>
        <Badge
          variant="outline"
          className="border-white/10 bg-white/5 text-white/65"
        >
          {money(snap.fee.amountMinor, snap.fee.currency)} fee
        </Badge>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <FeeCard
          tone="emerald"
          icon={<CheckCircle2 className="h-3.5 w-3.5" />}
          label="Collected"
          value={money(collected, snap.fee.currency)}
          helper={`${snap.fee.paid} of ${total || 1} paid`}
        />
        <FeeCard
          tone="amber"
          icon={<ShieldAlert className="h-3.5 w-3.5" />}
          label="Outstanding"
          value={money(pendingValue, snap.fee.currency)}
          helper={`${snap.fee.pending} awaiting payment`}
        />
        <FeeCard
          tone="cyan"
          icon={<Receipt className="h-3.5 w-3.5" />}
          label="Waived"
          value={String(snap.fee.waived)}
          helper="Manually waived by staff"
        />
      </div>
    </section>
  );
}

function FeeCard({
  tone,
  icon,
  label,
  value,
  helper,
}: {
  tone: "emerald" | "amber" | "cyan";
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  helper?: React.ReactNode;
}) {
  const toneClasses: Record<typeof tone, string> = {
    emerald: "border-emerald-500/30 bg-emerald-500/5 text-emerald-100",
    amber: "border-amber-500/30 bg-amber-500/5 text-amber-100",
    cyan: "border-cyan-500/30 bg-cyan-500/5 text-cyan-100",
  };
  return (
    <div className={cn("rounded-2xl border p-4", toneClasses[tone])}>
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] opacity-80">
        {icon}
        {label}
      </div>
      <div className="mt-2 text-base font-semibold">{value}</div>
      {helper ? <div className="mt-1 text-xs opacity-70">{helper}</div> : null}
    </div>
  );
}
