import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type PlatformPageHeaderProps = {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
};

type PlatformMetricCardProps = {
  icon: LucideIcon;
  label: string;
  value: string;
  note: string;
  tone?: "cyan" | "emerald" | "amber" | "rose" | "violet";
};

type PlatformSectionProps = {
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
};

type PlatformPillProps = {
  tone?: "slate" | "cyan" | "emerald" | "amber" | "rose" | "violet";
  children: ReactNode;
  className?: string;
};

const ICON_TONE_CLASSES: Record<NonNullable<PlatformMetricCardProps["tone"]>, string> = {
  cyan: "bg-cyan-400/10 text-cyan-100",
  emerald: "bg-emerald-400/10 text-emerald-100",
  amber: "bg-amber-400/10 text-amber-100",
  rose: "bg-rose-400/10 text-rose-100",
  violet: "bg-violet-400/10 text-violet-100",
};

const PILL_TONE_CLASSES: Record<NonNullable<PlatformPillProps["tone"]>, string> = {
  slate: "border-white/10 bg-white/5 text-white/60",
  cyan: "border-cyan-400/20 bg-cyan-500/10 text-cyan-100",
  emerald: "border-emerald-400/20 bg-emerald-500/10 text-emerald-100",
  amber: "border-amber-400/20 bg-amber-500/10 text-amber-100",
  rose: "border-rose-400/20 bg-rose-500/10 text-rose-100",
  violet: "border-violet-400/20 bg-violet-500/10 text-violet-100",
};

export function PlatformPageHeader({
  eyebrow,
  title,
  description,
  actions,
}: PlatformPageHeaderProps) {
  return (
    <section className="rounded-3xl border border-white/10 bg-linear-to-br from-slate-950 via-slate-900 to-black p-6 text-white shadow-2xl">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200/70">
            {eyebrow}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-3 max-w-3xl text-sm text-white/65">{description}</p>
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </section>
  );
}

export function PlatformMetricGrid({ children }: { children: ReactNode }) {
  return <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{children}</section>;
}

export function PlatformMetricCard({
  icon: Icon,
  label,
  value,
  note,
  tone = "cyan",
}: PlatformMetricCardProps) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5 text-white">
      <div className="flex items-center justify-between gap-3">
        <span
          className={cn(
            "rounded-2xl p-3",
            ICON_TONE_CLASSES[tone]
          )}
        >
          <Icon className="h-5 w-5" />
        </span>
        <p className="text-right text-xs uppercase tracking-[0.16em] text-white/45">
          {label}
        </p>
      </div>
      <p className="mt-4 text-2xl font-semibold">{value}</p>
      <p className="mt-1 text-sm text-white/50">{note}</p>
    </div>
  );
}

export function PlatformSection({
  title,
  description,
  action,
  className,
  children,
}: PlatformSectionProps) {
  return (
    <section
      className={cn(
        "rounded-3xl border border-white/10 bg-white/5 p-5 text-white",
        className
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="mt-1 text-sm text-white/55">{description}</p>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function PlatformPill({
  tone = "slate",
  children,
  className,
}: PlatformPillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium",
        PILL_TONE_CLASSES[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

// Node.js and Chrome ICU agree on date-only and time-only formats individually,
// but differ in the connector they insert when both are combined in one call
// ("," vs " at "). Formatting them separately with a hardcoded separator is the
// only reliable way to get identical output on server and client.
const DATE_FMT = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
});
const TIME_FMT = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

export function formatTimestamp(value: Date | string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  return `${DATE_FMT.format(d)}, ${TIME_FMT.format(d)}`;
}

export function formatDate(value: Date | string | null | undefined) {
  if (!value) return "—";
  return DATE_FMT.format(new Date(value));
}
