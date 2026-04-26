"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  CreditCard,
  ExternalLink,
  Info,
  Loader2,
  PartyPopper,
  Receipt,
  Send,
  XCircle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns/format";
import type { PublicApplicationDTO } from "@/lib/admissions/public-shape";
import { toast } from "sonner";

const STATUS_LABELS: Record<PublicApplicationDTO["status"], string> = {
  submitted: "Submitted",
  under_review: "Under review",
  interview_scheduled: "Interview scheduled",
  accepted: "Accepted",
  rejected: "Decision: Not offered",
  waitlisted: "Waitlisted",
  withdrawn: "Withdrawn",
  expired: "Expired",
};

const STATUS_TONE: Record<PublicApplicationDTO["status"], string> = {
  submitted: "bg-blue-500/15 text-blue-600 dark:text-blue-300 border-blue-500/30",
  under_review:
    "bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30",
  interview_scheduled:
    "bg-violet-500/15 text-violet-600 dark:text-violet-300 border-violet-500/30",
  accepted:
    "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30",
  rejected: "bg-rose-500/15 text-rose-600 dark:text-rose-300 border-rose-500/30",
  waitlisted:
    "bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30",
  withdrawn:
    "bg-muted text-muted-foreground border-border/60",
  expired: "bg-muted text-muted-foreground border-border/60",
};

export function PublicTrackerView({ token }: { token: string }) {
  const search = useSearchParams();
  const justSubmitted = search?.get("just_submitted") === "1";
  const feeQuery = search?.get("fee");
  const [data, setData] = React.useState<PublicApplicationDTO | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/public/admissions/applications/${token}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json?.error || "Failed to load application");
      }
      setData(json.data as PublicApplicationDTO);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load application");
    } finally {
      setLoading(false);
    }
  }, [token]);

  React.useEffect(() => {
    void load();
  }, [load]);

  // When the user is redirected back from Paystack we kick off a verify so
  // the UI updates without waiting for the webhook.
  React.useEffect(() => {
    if (feeQuery !== "processing") return;
    let cancelled = false;
    let attempts = 0;
    const verify = async () => {
      attempts += 1;
      try {
        const res = await fetch(
          `/api/public/admissions/applications/${token}/pay/verify`,
          { method: "POST" }
        );
        const json = await res.json();
        if (cancelled) return;
        if (json?.data?.feeStatus === "paid") {
          await load();
          toast.success("Payment received. Thank you!");
          return;
        }
        if (attempts < 5) {
          setTimeout(verify, 2000);
        } else {
          await load();
        }
      } catch {
        if (attempts < 3 && !cancelled) setTimeout(verify, 3000);
      }
    };
    verify();
    return () => {
      cancelled = true;
    };
  }, [feeQuery, token, load]);

  const copyLink = () => {
    if (typeof window === "undefined") return;
    void navigator.clipboard
      .writeText(window.location.href)
      .then(() => toast.success("Tracker link copied."))
      .catch(() => toast.error("Could not copy link."));
  };

  if (loading) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-md items-center justify-center px-4">
        <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading your application…
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <XCircle className="h-7 w-7 text-rose-500" />
            <h2 className="text-lg font-semibold text-foreground">
              We could not find that application
            </h2>
            <p className="text-sm text-muted-foreground">
              {error ??
                "Double-check the link, or contact the school for help."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusLabel = STATUS_LABELS[data.status];
  const statusTone = STATUS_TONE[data.status];

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:py-12">
      {justSubmitted ? (
        <div className="mb-5 flex items-start gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-700 dark:text-emerald-200">
          <PartyPopper className="mt-0.5 h-5 w-5" />
          <div>
            <p className="font-semibold">Your application was submitted!</p>
            <p className="text-xs opacity-90">
              Bookmark this page or save the URL — it is your private tracker.
            </p>
          </div>
        </div>
      ) : null}

      <Card>
        <CardContent className="space-y-5 p-6 sm:p-8">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {data.cycle.schoolName}
            </p>
            <h1 className="text-2xl font-semibold text-foreground">
              {data.cycle.name}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Application reference{" "}
              <span className="font-mono font-semibold text-foreground">
                {data.referenceCode}
              </span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Badge className={`${statusTone} border px-3 py-1 text-xs`}>
              {statusLabel}
            </Badge>
            {data.submittedAt ? (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                Submitted{" "}
                {format(new Date(data.submittedAt), "MMM d, yyyy 'at' p")}
              </span>
            ) : null}
          </div>

          <div className="grid gap-3 rounded-2xl border border-border/60 bg-muted/40 p-4 sm:grid-cols-2">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Applicant
              </p>
              <p className="mt-0.5 text-sm font-medium text-foreground">
                {data.applicant.firstName} {data.applicant.lastName}
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Applying for
              </p>
              <p className="mt-0.5 text-sm font-medium text-foreground">
                {data.applicant.intendedGradeName ?? "—"}
              </p>
            </div>
          </div>

          <FeePaymentCard data={data} token={token} />

          {data.missingDocuments.length > 0 ? (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-500" />
                <div className="text-sm text-foreground">
                  <p className="font-medium">Documents still needed</p>
                  <ul className="mt-1.5 list-disc pl-5 text-xs text-muted-foreground">
                    {data.missingDocuments.map((d) => (
                      <li key={d.id}>{d.label}</li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Please contact the school admissions office to upload these.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4" />
              All required documents received.
            </div>
          )}

          <Timeline status={data.status} />

          <div className="flex flex-col items-stretch gap-2 border-t border-border/60 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={copyLink}
              className="sm:w-auto"
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Copy tracker link
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void load()}
              className="sm:w-auto"
            >
              <Send className="mr-2 h-4 w-4" />
              Refresh status
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="mt-4 flex flex-col items-center gap-1 text-center text-xs text-muted-foreground">
        <a
          href="/apply/lookup"
          className="text-foreground/80 underline-offset-2 hover:underline"
        >
          Lost your link? Find all your applications
        </a>
        <span>Powered by EduSentrix · Keep this link private.</span>
      </div>
    </div>
  );
}

function formatMoney(amountMinor: number, currency: string): string {
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

function FeePaymentCard({
  data,
  token,
}: {
  data: PublicApplicationDTO;
  token: string;
}) {
  const [starting, setStarting] = React.useState(false);
  const fee = data.fee;

  if (fee.status === "not_required" && !fee.amountMinor) {
    return null;
  }

  if (fee.status === "paid") {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm">
        <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500" />
        <div className="text-foreground">
          <p className="font-medium">Application fee received</p>
          <p className="text-xs text-muted-foreground">
            Thank you. Your payment was confirmed
            {fee.paidAt
              ? ` on ${format(new Date(fee.paidAt), "MMM d, yyyy")}`
              : ""}
            .
          </p>
        </div>
      </div>
    );
  }

  if (fee.status === "waived") {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-blue-500/30 bg-blue-500/5 p-4 text-sm">
        <Info className="mt-0.5 h-4 w-4 text-blue-500" />
        <div className="text-foreground">
          <p className="font-medium">Application fee waived</p>
          <p className="text-xs text-muted-foreground">
            The school has waived this fee for your application.
          </p>
        </div>
      </div>
    );
  }

  // pending
  const amountLabel =
    fee.amountMinor && fee.currency
      ? formatMoney(fee.amountMinor, fee.currency)
      : "Application fee";

  if (fee.mode === "online_paystack") {
    const startPayment = async () => {
      setStarting(true);
      try {
        const res = await fetch(
          `/api/public/admissions/applications/${token}/pay/init`,
          { method: "POST" }
        );
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json?.error || "Could not start payment");
        }
        const url: string | undefined = json.data?.authorizationUrl;
        if (!url) throw new Error("Payment URL missing");
        window.location.assign(url);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not start payment");
        setStarting(false);
      }
    };

    return (
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <CreditCard className="mt-0.5 h-4 w-4 text-amber-500" />
            <div className="text-sm text-foreground">
              <p className="font-medium">Pay your application fee</p>
              <p className="text-xs text-muted-foreground">
                {amountLabel} · Secured by Paystack (card, mobile money, bank).
              </p>
            </div>
          </div>
          <Button size="sm" onClick={startPayment} disabled={starting}>
            {starting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CreditCard className="mr-2 h-4 w-4" />
            )}
            Pay {amountLabel}
          </Button>
        </div>
      </div>
    );
  }

  // manual_record fallback
  return (
    <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
      <div className="flex items-start gap-3">
        <Receipt className="mt-0.5 h-4 w-4 text-amber-500" />
        <div className="text-foreground">
          <p className="font-medium">Application fee due — {amountLabel}</p>
          {fee.instructions ? (
            <p className="mt-1 whitespace-pre-line text-xs text-muted-foreground">
              {fee.instructions}
            </p>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">
              Please contact the school admissions office for payment
              instructions.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Timeline({ status }: { status: PublicApplicationDTO["status"] }) {
  const steps = [
    { key: "submitted" as const, label: "Submitted" },
    { key: "under_review" as const, label: "Under review" },
    { key: "interview_scheduled" as const, label: "Interview / assessment" },
    { key: "accepted" as const, label: "Decision" },
  ];

  const orderIndex: Record<PublicApplicationDTO["status"], number> = {
    submitted: 0,
    under_review: 1,
    interview_scheduled: 2,
    accepted: 3,
    waitlisted: 3,
    rejected: 3,
    withdrawn: 3,
    expired: 3,
  };
  const currentIdx = orderIndex[status];

  return (
    <div>
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Progress
      </p>
      <ol className="space-y-3">
        {steps.map((step, idx) => {
          const done = idx < currentIdx;
          const active = idx === currentIdx;
          return (
            <li key={step.key} className="flex items-start gap-3">
              <div
                className={`mt-0.5 flex h-6 w-6 items-center justify-center rounded-full border ${
                  done
                    ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-500"
                    : active
                      ? "border-blue-500/30 bg-blue-500/15 text-blue-500"
                      : "border-border bg-muted text-muted-foreground"
                }`}
              >
                {done ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : active ? (
                  <Clock className="h-3.5 w-3.5" />
                ) : (
                  <span className="text-[10px]">{idx + 1}</span>
                )}
              </div>
              <p
                className={`text-sm ${
                  done
                    ? "text-foreground"
                    : active
                      ? "font-medium text-foreground"
                      : "text-muted-foreground"
                }`}
              >
                {step.label}
              </p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
