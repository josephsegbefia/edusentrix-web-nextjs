"use client";

import * as React from "react";
import Link from "next/link";
import {
  BookOpenCheck,
  CheckCircle2,
  Clock3,
  CreditCard,
  KeyRound,
  Loader2,
  LockKeyhole,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { GlassPanel } from "@/components/ui/glass-panel";
import { WorkspacePageHeader } from "@/components/ui/workspace-page-header";
import { WorkspacePageShell } from "@/components/ui/workspace-page-shell";
import { glassInsetClass } from "@/lib/ui/glass-surfaces";
import { cn } from "@/lib/utils";

type WardSummary = {
  studentId: string;
  name: string;
  admissionNo: string | null;
  photoUrl: string | null;
  status: string | null;
  relationship: string;
  gradeName: string | null;
  classGroupName: string | null;
  eligible: boolean;
  eligibilityReason: string | null;
  account: {
    username: string;
    status: string;
    mustChangePassword: boolean;
    lastLoginAt: string | null;
    credentialsDeliveredAt: string | null;
  } | null;
  access: {
    source: string;
    status: string;
    startsAt: string | null;
    expiresAt: string | null;
  } | null;
  latestPayment: {
    amountMinor: number;
    currency: "GHS";
    status: string;
    createdAt: string | null;
  } | null;
  activity: {
    total: number;
    questsCompleted: number;
    leoTutorMessages: number;
    flashcardsReviewed: number;
    revisionSessions: number;
  };
};

type OverviewPayload = {
  pricePerStudentPerTermMinor: number;
  currency: "GHS";
  schoolEligibility: {
    eligible: boolean;
    reason?: string;
  };
  wards: WardSummary[];
};

type ApiResponse =
  | { success: true; data: OverviewPayload }
  | { success: false; error: string };

function money(minor: number, currency: string) {
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(minor / 100);
}

function shortDate(value: string | null) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-GH", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function statusText(value?: string | null) {
  if (!value) return "Not started";
  return value.replace(/_/g, " ");
}

export function ParentLearnOverviewClient() {
  const [data, setData] = React.useState<OverviewPayload | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const response = await fetch("/api/parent/learn/overview", { cache: "no-store" });
        const payload = (await response.json()) as ApiResponse;
        if (!response.ok || !payload.success) {
          throw new Error(payload.success ? "Failed to load Learn." : payload.error);
        }
        if (!cancelled) {
          setData(payload.data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load Learn.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="p-6 text-white md:p-8">
      <WorkspacePageShell>
        <WorkspacePageHeader
          title="EduSentrix Learn"
          subtitle="Manage ward Learn access, credential status, and recent learning activity."
          icon={BookOpenCheck}
          actions={
            <Button
              asChild
              variant="outline"
              className="rounded-xl border-white/10 bg-white/5 text-white hover:bg-white/10"
            >
              <Link href="/parent/learn/payments">
                <CreditCard className="mr-2 h-4 w-4" />
                Payments
              </Link>
            </Button>
          }
        />

        {loading ? (
          <GlassPanel className="p-8 text-center" glow="cyan">
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-teal-200" />
            <p className="mt-3 text-sm text-white/55">Loading ward Learn access...</p>
          </GlassPanel>
        ) : error ? (
          <GlassPanel className="p-8 text-center" glow="cyan">
            <p className="font-medium text-white">Could not load Learn.</p>
            <p className="mt-2 text-sm text-white/55">{error}</p>
          </GlassPanel>
        ) : data ? (
          <>
            <GlassPanel className="p-5" glow="teal">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/40">
                    Current term price
                  </p>
                  <p className="mt-1 text-2xl font-semibold text-white">
                    {money(data.pricePerStudentPerTermMinor, data.currency)}
                  </p>
                </div>
                <p className="max-w-xl text-sm text-white/60">
                  Learn payments are handled separately from school fees and do not affect fee
                  balances, invoices, or bursar reconciliation.
                </p>
              </div>
            </GlassPanel>

            {!data.schoolEligibility.eligible ? (
              <GlassPanel className="p-6" glow="cyan">
                <h2 className="text-lg font-semibold text-white">Learn unavailable</h2>
                <p className="mt-2 text-sm text-white/60">
                  {data.schoolEligibility.reason ||
                    "This school is not currently eligible for EduSentrix Learn."}
                </p>
              </GlassPanel>
            ) : null}

            {data.wards.length ? (
              <div className="grid gap-5 xl:grid-cols-2">
                {data.wards.map((ward) => (
                  <WardCard
                    key={ward.studentId}
                    ward={ward}
                    price={money(data.pricePerStudentPerTermMinor, data.currency)}
                  />
                ))}
              </div>
            ) : (
              <GlassPanel className="p-8 text-center" glow="cyan">
                <p className="font-medium text-white">No linked wards found.</p>
                <p className="mt-2 text-sm text-white/55">
                  EduSentrix Learn appears here after a school links you as a guardian.
                </p>
              </GlassPanel>
            )}
          </>
        ) : null}
      </WorkspacePageShell>
    </div>
  );
}

function WardCard({ ward, price }: { ward: WardSummary; price: string }) {
  const hasAccess = Boolean(ward.access);
  const [checkoutLoading, setCheckoutLoading] = React.useState(false);
  const [resetLoading, setResetLoading] = React.useState(false);
  const canPay = ward.eligible && Boolean(ward.account) && !hasAccess;

  async function startCheckout() {
    setCheckoutLoading(true);
    try {
      const response = await fetch("/api/parent/learn/payments/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: ward.studentId,
          returnPath: `/parent/learn/wards/${ward.studentId}`,
        }),
      });
      const payload = (await response.json()) as
        | { success: true; data: { authorizationUrl: string } }
        | { success: false; error: string };
      if (!response.ok || !payload.success) {
        throw new Error(payload.success ? "Checkout failed." : payload.error);
      }
      window.location.assign(payload.data.authorizationUrl);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Checkout failed.");
      setCheckoutLoading(false);
    }
  }

  async function requestReset() {
    setResetLoading(true);
    try {
      const response = await fetch(
        `/api/parent/learn/wards/${ward.studentId}/request-password-reset`,
        { method: "POST" }
      );
      const payload = (await response.json()) as
        | { success: true; data: { notifiedAdmins: number } }
        | { success: false; error: string };
      if (!response.ok || !payload.success) {
        throw new Error(payload.success ? "Reset request failed." : payload.error);
      }
      toast.success("Password reset requested");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Reset request failed.");
    } finally {
      setResetLoading(false);
    }
  }

  return (
    <GlassPanel className="p-5" glow="both">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-lg font-semibold text-white">{ward.name}</p>
          <p className="mt-1 text-sm text-white/55">
            {[ward.gradeName, ward.classGroupName, ward.admissionNo].filter(Boolean).join(" - ")}
          </p>
        </div>
        <span
          className={cn(
            "rounded-full border px-3 py-1 text-xs font-semibold capitalize",
            hasAccess
              ? "border-emerald-300/25 bg-emerald-400/10 text-emerald-100"
              : "border-amber-300/25 bg-amber-400/10 text-amber-100"
          )}
        >
          {hasAccess ? "Access active" : "No active access"}
        </span>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <MiniStat label="Quests" value={ward.activity.questsCompleted} icon={CheckCircle2} />
        <MiniStat label="Leo usage" value={ward.activity.leoTutorMessages} icon={Sparkles} />
        <MiniStat label="Flashcards" value={ward.activity.flashcardsReviewed} icon={Clock3} />
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <div className={cn(glassInsetClass, "p-4")}>
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <KeyRound className="h-4 w-4 text-teal-200" />
            Credential status
          </div>
          {ward.account ? (
            <div className="mt-3 space-y-2 text-sm text-white/60">
              <p>
                Username: <span className="font-medium text-white">{ward.account.username}</span>
              </p>
              <p className="capitalize">Status: {statusText(ward.account.status)}</p>
              <p>
                First login change:{" "}
                {ward.account.mustChangePassword ? "still required" : "completed"}
              </p>
            </div>
          ) : (
            <p className="mt-3 text-sm text-white/55">
              The school has not created a Learn account for this ward yet.
            </p>
          )}
        </div>

        <div className={cn(glassInsetClass, "p-4")}>
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <LockKeyhole className="h-4 w-4 text-emerald-200" />
            Access
          </div>
          {ward.access ? (
            <div className="mt-3 space-y-2 text-sm text-white/60">
              <p className="capitalize">Source: {statusText(ward.access.source)}</p>
              <p>Expires: {shortDate(ward.access.expiresAt)}</p>
            </div>
          ) : (
            <p className="mt-3 text-sm text-white/55">
              {ward.eligible
                ? `Payment for this ward will be ${price} once Learn checkout is enabled.`
                : ward.eligibilityReason}
            </p>
          )}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <Button
          asChild
          size="sm"
          variant="outline"
          className="rounded-xl border-white/10 bg-white/5 text-white hover:bg-white/10"
        >
          <Link href={`/parent/learn/wards/${ward.studentId}`}>View activity</Link>
        </Button>
        <Button
          size="sm"
          disabled={!canPay || checkoutLoading}
          onClick={startCheckout}
          className="rounded-xl bg-teal-400 text-slate-950 hover:bg-teal-300 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {checkoutLoading ? "Opening checkout..." : "Pay for Learn access"}
        </Button>
        <Button
          asChild
          size="sm"
          variant="outline"
          className="rounded-xl border-white/10 bg-white/5 text-white hover:bg-white/10"
        >
          <Link href="/parent/learn/credentials">View credentials</Link>
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={!ward.account || resetLoading}
          onClick={requestReset}
          className="rounded-xl border-white/10 bg-white/5 text-white hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {resetLoading ? "Requesting..." : "Request reset"}
        </Button>
      </div>
    </GlassPanel>
  );
}

function MiniStat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className={cn(glassInsetClass, "p-3")}>
      <Icon className="h-4 w-4 text-teal-200" />
      <p className="mt-2 text-xl font-semibold text-white">{value.toLocaleString()}</p>
      <p className="text-xs text-white/45">{label}</p>
    </div>
  );
}
