"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
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
import { cn } from "@/lib/utils";
import { format } from "date-fns/format";
import type { PublicApplicationDTO } from "@/lib/admissions/public-shape";
import { formatAdmissionInterviewRange } from "@/lib/admissions/interview-display";
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
  submitted: "border-blue-400/30 bg-blue-500/15 text-blue-200",
  under_review:
    "border-amber-400/30 bg-amber-500/15 text-amber-200",
  interview_scheduled:
    "border-violet-400/30 bg-violet-500/15 text-violet-200",
  accepted:
    "border-emerald-400/30 bg-emerald-500/15 text-emerald-200",
  rejected: "border-rose-400/30 bg-rose-500/15 text-rose-200",
  waitlisted:
    "border-amber-400/30 bg-amber-500/15 text-amber-200",
  withdrawn:
    "border-white/10 bg-white/5 text-white/55",
  expired: "border-white/10 bg-white/5 text-white/55",
};

export function PublicTrackerView({ token }: { token: string }) {
  const search = useSearchParams();
  const justSubmitted = search?.get("just_submitted") === "1";
  const feeQuery = search?.get("fee");
  const focusSection = search?.get("focus");
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

  React.useEffect(() => {
    if (!data || focusSection !== "fee") return;
    const el = document.getElementById("admissions-application-fee");
    window.requestAnimationFrame(() => {
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [data, focusSection]);

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
      <div className="flex min-h-screen items-center justify-center bg-[#080b12] px-4 text-white">
        <div className="flex flex-col items-center gap-2 text-sm text-white/55">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading your application…
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#080b12] px-4 py-16 text-white">
        <Card className="mx-auto max-w-md border-white/10 bg-linear-to-br from-white/10 to-transparent shadow-2xl shadow-black/30 backdrop-blur">
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <XCircle className="h-7 w-7 text-rose-500" />
            <h2 className="text-lg font-semibold text-white">
              We could not find that application
            </h2>
            <p className="text-sm text-white/55">
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
    <div className="min-h-screen bg-[#080b12] px-4 py-6 text-white sm:py-10">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        {justSubmitted ? (
          <div className="flex items-start gap-3 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm text-emerald-100 shadow-lg shadow-black/20">
            <PartyPopper className="mt-0.5 h-5 w-5" />
            <div>
              <p className="font-semibold">Your application was submitted!</p>
              <p className="text-xs text-emerald-100/80">
                Bookmark this page or save the URL. It is your private tracker.
              </p>
            </div>
          </div>
        ) : null}

        <header className="overflow-hidden rounded-3xl border border-white/10 bg-linear-to-br from-white/10 via-white/5 to-transparent p-5 shadow-2xl shadow-black/30 backdrop-blur sm:p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-200/80">
                {data.cycle.schoolName} · Admissions tracker
              </p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                {data.cycle.name}
              </h1>
              <p className="mt-2 text-sm text-white/55">
                Reference{" "}
                <span className="font-mono font-semibold text-white">
                  {data.referenceCode}
                </span>
              </p>
            </div>
            <Badge className={`${statusTone} border px-3 py-1 text-xs`}>
              {statusLabel}
            </Badge>
          </div>
        </header>

        <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
          <CardContent className="space-y-5 p-5 sm:p-7">
            {data.submittedAt ? (
              <div className="flex items-center gap-1.5 text-xs text-white/45">
                <Clock className="h-3.5 w-3.5 text-white/35" />
                Submitted{" "}
                {format(new Date(data.submittedAt), "MMM d, yyyy 'at' p")}
              </div>
            ) : null}

          <div className="grid gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 sm:grid-cols-2">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/35">
                Applicant
              </p>
              <p className="mt-1 text-sm font-medium text-white">
                {data.applicant.firstName} {data.applicant.lastName}
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/35">
                Applying for
              </p>
              <p className="mt-1 text-sm font-medium text-white">
                {data.applicant.intendedGradeName ?? "—"}
              </p>
            </div>
          </div>

          <div id="admissions-application-fee">
            <FeePaymentCard data={data} token={token} />
          </div>

          {data.interviewAt ? (
            <div className="rounded-2xl border border-violet-500/25 bg-violet-500/10 p-4 text-sm text-white">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-200/90">
                Interview / assessment
              </p>
              <p className="mt-1 font-medium">
                {formatAdmissionInterviewRange(
                  new Date(data.interviewAt),
                  data.interviewEndsAt ? new Date(data.interviewEndsAt) : null
                )}
              </p>
            </div>
          ) : null}

          {data.missingDocuments.length > 0 ? (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-500" />
                <div className="text-sm text-white">
                  <p className="font-medium">Documents still needed</p>
                  <ul className="mt-1.5 list-disc pl-5 text-xs text-white/55">
                    {data.missingDocuments.map((d) => (
                      <li key={d.id}>{d.label}</li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs text-white/55">
                    Please contact the school admissions office to upload these.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm text-emerald-200">
              <CheckCircle2 className="h-4 w-4" />
              All required documents received.
            </div>
          )}

          <Timeline status={data.status} />

          <div className="flex flex-col items-stretch gap-2 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={copyLink}
              className="border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white sm:w-auto"
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Copy tracker link
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void load()}
              className="text-white/70 hover:bg-white/10 hover:text-white sm:w-auto"
            >
              <Send className="mr-2 h-4 w-4" />
              Refresh status
            </Button>
          </div>
        </CardContent>
        </Card>

        <div className="flex flex-col items-center gap-2 text-center text-xs text-white/45">
          <Link
            href="/apply/lookup"
            className="text-white/70 underline-offset-2 hover:text-white hover:underline"
          >
            Lost your link? Find all your applications
          </Link>
          <div className="flex items-center justify-center gap-2">
            <Image
              src="/logo/edusentrix-logo-transparent.png"
              alt="EduSentrix"
              width={20}
              height={20}
              className="h-5 w-5 object-contain"
            />
            <span>Powered by EduSentrix · Keep this link private.</span>
          </div>
        </div>
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
        <div className="text-white">
          <p className="font-medium">Application fee received</p>
          <p className="text-xs text-white/55">
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
        <div className="text-white">
          <p className="font-medium">Application fee waived</p>
          <p className="text-xs text-white/55">
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
            <div className="text-sm text-white">
              <p className="font-medium">Pay your application fee</p>
              <p className="text-xs text-white/55">
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
        <div className="text-white">
          <p className="font-medium">Application fee due — {amountLabel}</p>
          {fee.instructions ? (
            <p className="mt-1 whitespace-pre-line text-xs text-white/55">
              {fee.instructions}
            </p>
          ) : (
            <p className="mt-1 text-xs text-white/55">
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
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35">
        Progress
      </p>
      <ol className="space-y-3">
        {steps.map((step, idx) => {
          const done = idx < currentIdx;
          const active = idx === currentIdx;
          return (
            <li key={step.key} className="flex items-start gap-3">
              <div
                className={cn(
                  "mt-0.5 flex h-6 w-6 items-center justify-center rounded-full border",
                  done
                    ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-300"
                    : active
                      ? "border-blue-500/30 bg-blue-500/15 text-blue-300"
                      : "border-white/10 bg-white/5 text-white/35"
                )}
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
                className={cn(
                  "text-sm",
                  done
                    ? "text-white"
                    : active
                      ? "font-medium text-white"
                      : "text-white/45"
                )}
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
