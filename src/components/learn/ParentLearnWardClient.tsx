"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, BookOpenCheck, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { GlassPanel } from "@/components/ui/glass-panel";
import { WorkspacePageHeader } from "@/components/ui/workspace-page-header";
import { WorkspacePageShell } from "@/components/ui/workspace-page-shell";
import { glassInsetClass } from "@/lib/ui/glass-surfaces";
import { cn } from "@/lib/utils";

type Ward = {
  studentId: string;
  name: string;
  gradeName: string | null;
  classGroupName: string | null;
  eligible: boolean;
  eligibilityReason: string | null;
  account: {
    username: string;
    status: string;
    mustChangePassword: boolean;
    lastLoginAt: string | null;
  } | null;
  access: {
    source: string;
    status: string;
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

type ApiResponse =
  | {
      success: true;
      data: {
        pricePerStudentPerTermMinor: number;
        currency: "GHS";
        ward: Ward | null;
      };
    }
  | { success: false; error: string };

type CheckoutBanner = {
  tone: "blue" | "emerald" | "amber" | "red";
  title: string;
  message: string;
};

function shortDate(value: string | null) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-GH", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

async function fetchWard(studentId: string) {
  const response = await fetch(`/api/parent/learn/wards/${studentId}`, {
    cache: "no-store",
  });
  const payload = (await response.json()) as ApiResponse;
  if (!response.ok || !payload.success) {
    throw new Error(payload.success ? "Failed to load ward." : payload.error);
  }
  return payload.data.ward;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function ParentLearnWardClient({ studentId }: { studentId: string }) {
  const searchParams = useSearchParams();
  const [ward, setWard] = React.useState<Ward | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [checkoutBanner, setCheckoutBanner] = React.useState<CheckoutBanner | null>(null);

  const checkoutReference =
    searchParams.get("reference") || searchParams.get("trxref");
  const shouldVerifyCheckout = Boolean(
    checkoutReference?.startsWith("EDSX-LEARN-") ||
      searchParams.get("checkout") === "learn-paystack"
  );

  const reloadWard = React.useCallback(async () => {
    const nextWard = await fetchWard(studentId);
    setWard(nextWard);
    setError(null);
    return nextWard;
  }, [studentId]);

  React.useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const nextWard = await fetchWard(studentId);
        if (!cancelled) {
          setWard(nextWard);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load ward.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [studentId]);

  React.useEffect(() => {
    if (!checkoutReference || !shouldVerifyCheckout) return;

    let cancelled = false;
    setCheckoutBanner({
      tone: "blue",
      title: "Confirming Learn payment",
      message: "We are verifying your EduSentrix Learn payment with Paystack.",
    });

    (async () => {
      const maxAttempts = 4;
      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        if (cancelled) return;
        if (attempt > 0) await sleep(2000);

        try {
          const res = await fetch(
            `/api/parent/learn/payments/verify?reference=${encodeURIComponent(checkoutReference)}`,
            { cache: "no-store" }
          );
          const json = await res.json().catch(() => null);
          if (!res.ok || !json?.success) {
            throw new Error(json?.error || "Unable to confirm Learn payment status.");
          }

          const status = String(json.data?.status || "not_found");
          const message =
            String(json.data?.message || "").trim() ||
            "Your Learn payment status is being updated.";

          if (status === "completed") {
            if (cancelled) return;
            setCheckoutBanner({
              tone: "emerald",
              title: "Learn access activated",
              message:
                message ||
                "Payment confirmed. EduSentrix Learn access is now active for this ward.",
            });
            toast.success("EduSentrix Learn access is now active.");
            await reloadWard();
            return;
          }

          if (status === "failed") {
            if (cancelled) return;
            setCheckoutBanner({
              tone: "red",
              title: "Learn payment not completed",
              message,
            });
            await reloadWard();
            return;
          }

          if (attempt === maxAttempts - 1) {
            if (cancelled) return;
            setCheckoutBanner({
              tone: "amber",
              title: "Payment pending confirmation",
              message,
            });
          }
        } catch (statusError) {
          if (cancelled) return;
          if (attempt === maxAttempts - 1) {
            setCheckoutBanner({
              tone: "red",
              title: "Unable to confirm payment",
              message:
                statusError instanceof Error
                  ? statusError.message
                  : "We could not confirm your Learn payment yet.",
            });
          }
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [checkoutReference, shouldVerifyCheckout, reloadWard]);

  return (
    <div className="p-6 text-white md:p-8">
      <WorkspacePageShell>
        <WorkspacePageHeader
          title={ward?.name || "EduSentrix Learn"}
          subtitle="Guardian-scoped Learn access, credentials, and activity details."
          icon={BookOpenCheck}
          backHref="/parent/learn"
          backLabel="Back to Learn"
          actions={
            <Button
              asChild
              variant="outline"
              className="rounded-xl border-white/10 bg-white/5 text-white hover:bg-white/10"
            >
              <Link href="/parent/learn">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Overview
              </Link>
            </Button>
          }
        />

        {checkoutBanner ? (
          <GlassPanel
            className={cn(
              "mb-5 border p-4",
              checkoutBanner.tone === "emerald" && "border-emerald-300/25 bg-emerald-400/10",
              checkoutBanner.tone === "blue" && "border-sky-300/25 bg-sky-400/10",
              checkoutBanner.tone === "amber" && "border-amber-300/25 bg-amber-400/10",
              checkoutBanner.tone === "red" && "border-rose-300/25 bg-rose-400/10"
            )}
            glow="cyan"
          >
            <div className="flex items-start gap-3">
              {checkoutBanner.tone === "emerald" ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-200" />
              ) : checkoutBanner.tone === "red" ? (
                <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-200" />
              ) : (
                <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-teal-200" />
              )}
              <div>
                <p className="font-semibold text-white">{checkoutBanner.title}</p>
                <p className="mt-1 text-sm text-white/65">{checkoutBanner.message}</p>
              </div>
            </div>
          </GlassPanel>
        ) : null}

        {loading ? (
          <GlassPanel className="p-8 text-center" glow="cyan">
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-teal-200" />
            <p className="mt-3 text-sm text-white/55">Loading Learn detail...</p>
          </GlassPanel>
        ) : error ? (
          <GlassPanel className="p-8 text-center" glow="cyan">
            <p className="font-medium text-white">Could not load Learn detail.</p>
            <p className="mt-2 text-sm text-white/55">{error}</p>
          </GlassPanel>
        ) : ward ? (
          <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
            <GlassPanel className="p-6" glow="teal">
              <h2 className="text-lg font-semibold text-white">Access summary</h2>
              <div className="mt-4 space-y-3 text-sm text-white/65">
                <p>{[ward.gradeName, ward.classGroupName].filter(Boolean).join(" - ")}</p>
                <p>
                  Eligibility:{" "}
                  <span className={ward.eligible ? "text-emerald-200" : "text-amber-200"}>
                    {ward.eligible ? "Eligible" : ward.eligibilityReason || "Not eligible"}
                  </span>
                </p>
                <p>
                  Account:{" "}
                  <span className="text-white">
                    {ward.account ? ward.account.username : "Not created"}
                  </span>
                </p>
                <p>Active access: {ward.access ? `until ${shortDate(ward.access.expiresAt)}` : "No"}</p>
                <p>
                  Last login:{" "}
                  {ward.account?.lastLoginAt ? shortDate(ward.account.lastLoginAt) : "No login yet"}
                </p>
                {ward.latestPayment ? (
                  <p>
                    Latest payment:{" "}
                    <span className="text-white capitalize">
                      {ward.latestPayment.status.replace(/_/g, " ")}
                    </span>
                  </p>
                ) : null}
              </div>
            </GlassPanel>

            <GlassPanel className="p-6" glow="both">
              <h2 className="text-lg font-semibold text-white">Last 30 days</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Activity label="Total activity" value={ward.activity.total} />
                <Activity label="Quests completed" value={ward.activity.questsCompleted} />
                <Activity label="Leo tutor messages" value={ward.activity.leoTutorMessages} />
                <Activity label="Flashcards reviewed" value={ward.activity.flashcardsReviewed} />
              </div>
            </GlassPanel>
          </div>
        ) : (
          <GlassPanel className="p-8 text-center" glow="cyan">
            <p className="font-medium text-white">Ward not found.</p>
            <p className="mt-2 text-sm text-white/55">
              This ward is not linked to your parent account.
            </p>
          </GlassPanel>
        )}
      </WorkspacePageShell>
    </div>
  );
}

function Activity({ label, value }: { label: string; value: number }) {
  return (
    <div className={cn(glassInsetClass, "p-4")}>
      <p className="text-2xl font-semibold text-white">{value.toLocaleString()}</p>
      <p className="mt-1 text-sm text-white/50">{label}</p>
    </div>
  );
}
