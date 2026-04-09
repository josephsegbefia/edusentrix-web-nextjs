"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AlertCircle, ArrowLeft, BadgeCheck, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { formatMoney } from "@/lib/fees/money";
import { cn } from "@/lib/utils";

type SchoolDetail = {
  id: string;
  name: string;
  status: string;
  city: string | null;
  region: string | null;
  email: string | null;
  paymentReady: boolean;
  paymentSetup: {
    status:
      | "not_started"
      | "awaiting_billing_owner"
      | "details_submitted"
      | "pending_provisioning"
      | "review_required"
      | "provisioned"
      | "failed";
    statusLabel: string;
    statusTone: "slate" | "amber" | "blue" | "emerald" | "red";
    reviewReason: string | null;
    billingOwner: {
      name: string | null;
      email: string | null;
    };
    bank: {
      bankName: string | null;
      branchName: string | null;
      accountName: string | null;
      maskedAccountNumber: string | null;
    };
    paystack: {
      subaccountCode: string | null;
      lastError: string | null;
    };
  };
  subscription: {
    tierName: string | null;
    status: string;
    effectivePriceMinor: number;
    discountExposureMinor: number;
  } | null;
  usage: {
    totalEstimatedCostMinor: number;
    metricsCount: number;
  };
  events: Array<{
    id: string;
    summary: string;
    actorEmail: string | null;
    createdAt: string;
  }>;
};

export default function PlatformSchoolDetailPage() {
  const params = useParams<{ id: string }>();
  const schoolId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const [loading, setLoading] = React.useState(true);
  const [data, setData] = React.useState<SchoolDetail | null>(null);
  const [reviewNote, setReviewNote] = React.useState("");
  const [reviewAction, setReviewAction] = React.useState<"approve" | "send_back" | null>(null);

  const loadData = React.useCallback(async () => {
    if (!schoolId) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/platform/schools/${schoolId}`, { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to load school detail");
      }
      setData(json.data as SchoolDetail);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load school detail");
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  React.useEffect(() => {
    void loadData();
  }, [loadData]);

  async function handleReview(action: "approve" | "send_back") {
    if (!schoolId || !data) return;
    if (action === "send_back" && reviewNote.trim().length < 8) {
      toast.error("Add a short reason before sending this payout setup back.");
      return;
    }

    try {
      setReviewAction(action);
      const res = await fetch(
        `/api/platform/schools/${schoolId}/payment-setup-review`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            note: reviewNote.trim() || null,
          }),
        }
      );
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to review payout setup");
      }
      toast.success(
        action === "approve"
          ? "Payout setup approved for submission"
          : "Payout setup sent back to the school"
      );
      setReviewNote("");
      await loadData();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to review payout setup"
      );
    } finally {
      setReviewAction(null);
    }
  }

  function statusBadgeClass(tone: SchoolDetail["paymentSetup"]["statusTone"]) {
    if (tone === "emerald") {
      return "border-emerald-500/30 bg-emerald-500/15 text-emerald-200";
    }
    if (tone === "amber") {
      return "border-amber-500/30 bg-amber-500/15 text-amber-200";
    }
    if (tone === "blue") {
      return "border-cyan-500/30 bg-cyan-500/15 text-cyan-200";
    }
    if (tone === "red") {
      return "border-rose-500/30 bg-rose-500/15 text-rose-200";
    }
    return "border-white/10 bg-white/5 text-white/70";
  }

  return (
    <div className="space-y-6 p-2 md:p-4">
      <div className="space-y-2">
        <Button asChild variant="ghost" size="sm" className="w-fit px-0 text-white/70 hover:text-white">
          <Link href="/platform/schools">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Schools
          </Link>
        </Button>
        <h1 className="text-3xl font-semibold text-white">{data?.name || "School Overview"}</h1>
        {data ? (
          <p className="text-sm text-white/60">
            {data.status} • {data.city || "No city"}{data.region ? `, ${data.region}` : ""}
          </p>
        ) : null}
      </div>

      {loading && !data ? (
        <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading school overview
        </div>
      ) : null}

      {data ? (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border-white/10 bg-white/5"><CardContent className="p-5"><p className="text-xs uppercase tracking-wide text-white/50">Subscription</p><p className="mt-2 text-xl font-semibold text-white">{formatMoney(data.subscription?.effectivePriceMinor || 0)}</p><p className="text-xs text-white/50">{data.subscription?.tierName || "Unassigned"}</p></CardContent></Card>
            <Card className="border-white/10 bg-white/5"><CardContent className="p-5"><p className="text-xs uppercase tracking-wide text-white/50">Attributed Cost</p><p className="mt-2 text-xl font-semibold text-white">{formatMoney(data.usage.totalEstimatedCostMinor)}</p><p className="text-xs text-white/50">{data.usage.metricsCount} metrics</p></CardContent></Card>
            <Card className="border-white/10 bg-white/5"><CardContent className="p-5"><p className="text-xs uppercase tracking-wide text-white/50">Payment Setup</p><p className="mt-2 text-xl font-semibold text-white">{data.paymentReady ? "Ready" : "Pending"}</p><p className="text-xs text-white/50">Paystack school settlement</p></CardContent></Card>
          </div>

          <Card className="border-white/10 bg-linear-to-br from-slate-900 via-slate-950 to-black text-white">
            <CardHeader className="space-y-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-3 text-lg">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5">
                      <ShieldCheck className="h-4 w-4 text-cyan-300" />
                    </span>
                    School Payment Setup Review
                  </CardTitle>
                  <p className="mt-2 text-sm text-white/60">
                    Review flagged payout setup changes before the school can continue online payment activation.
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className={cn("w-fit text-[11px]", statusBadgeClass(data.paymentSetup.statusTone))}
                >
                  {data.paymentSetup.statusLabel}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {data.paymentSetup.reviewReason ? (
                <Alert className="border-amber-500/20 bg-amber-500/10 text-amber-100">
                  <AlertCircle className="h-4 w-4 text-amber-200" />
                  <AlertTitle>Flagged for manual review</AlertTitle>
                  <AlertDescription className="text-amber-100/85">
                    {data.paymentSetup.reviewReason}
                  </AlertDescription>
                </Alert>
              ) : null}

              {data.paymentSetup.paystack.lastError ? (
                <Alert className="border-rose-500/20 bg-rose-500/10 text-rose-100">
                  <AlertCircle className="h-4 w-4 text-rose-200" />
                  <AlertTitle>School-visible error</AlertTitle>
                  <AlertDescription className="text-rose-100/85">
                    {data.paymentSetup.paystack.lastError}
                  </AlertDescription>
                </Alert>
              ) : null}

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-wide text-white/45">Bank</p>
                  <p className="mt-2 text-sm font-semibold text-white">
                    {data.paymentSetup.bank.bankName || "Not set"}
                  </p>
                  <p className="mt-1 text-xs text-white/50">
                    {data.paymentSetup.bank.branchName || "No branch"}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-wide text-white/45">Account Holder</p>
                  <p className="mt-2 text-sm font-semibold text-white">
                    {data.paymentSetup.bank.accountName || "Not set"}
                  </p>
                  <p className="mt-1 text-xs text-white/50">
                    {data.paymentSetup.bank.maskedAccountNumber || "No account"}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-wide text-white/45">Billing Owner</p>
                  <p className="mt-2 text-sm font-semibold text-white">
                    {data.paymentSetup.billingOwner.name || "Unassigned"}
                  </p>
                  <p className="mt-1 text-xs text-white/50">
                    {data.paymentSetup.billingOwner.email || "No billing owner email"}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-wide text-white/45">Settlement Rail</p>
                  <p className="mt-2 text-sm font-semibold text-white">
                    {data.paymentSetup.paystack.subaccountCode || "Not linked"}
                  </p>
                  <p className="mt-1 text-xs text-white/50">
                    {data.paymentReady ? "Checkout enabled" : "Checkout blocked"}
                  </p>
                </div>
              </div>

              {data.paymentSetup.status === "review_required" ? (
                <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-white">Review Decision</p>
                    <p className="text-sm text-white/60">
                      Approve to return this school to the normal submission path, or send it back with a clear reason.
                    </p>
                  </div>
                  <Textarea
                    value={reviewNote}
                    onChange={(event) => setReviewNote(event.target.value)}
                    placeholder="Optional approval note or required send-back reason"
                    className="mt-4 min-h-[110px] border-white/10 bg-black/20 text-white placeholder:text-white/35"
                  />
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Button
                      type="button"
                      onClick={() => void handleReview("approve")}
                      disabled={Boolean(reviewAction)}
                      className="bg-emerald-500 text-slate-950 hover:bg-emerald-400"
                    >
                      {reviewAction === "approve" ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Approving
                        </>
                      ) : (
                        <>
                          <BadgeCheck className="h-4 w-4" />
                          Approve for submission
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void handleReview("send_back")}
                      disabled={Boolean(reviewAction)}
                      className="border-rose-500/30 bg-rose-500/10 text-rose-100 hover:bg-rose-500/20"
                    >
                      {reviewAction === "send_back" ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Sending back
                        </>
                      ) : (
                        <>
                          <AlertCircle className="h-4 w-4" />
                          Send back to school
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <div className="flex flex-wrap gap-2">
            <Button asChild className="bg-cyan-600 text-white hover:bg-cyan-700"><Link href={`/platform/schools/${data.id}/subscription`}>Manage Subscription</Link></Button>
            <Button asChild variant="outline" className="border-white/10 bg-white/5 text-white hover:bg-white/10"><Link href={`/platform/schools/${data.id}/usage`}>View Usage</Link></Button>
          </div>

          <Card className="border-white/10 bg-white/5 text-white">
            <CardHeader><CardTitle className="text-base">Recent Commercial Events</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {data.events.map((event) => (
                <div key={event.id} className="rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm">
                  <p className="text-white">{event.summary}</p>
                  <p className="mt-1 text-xs text-white/50">{event.actorEmail || "System"} • {new Date(event.createdAt).toLocaleString()}</p>
                </div>
              ))}
              {data.events.length === 0 ? <p className="text-sm text-white/60">No subscription events yet.</p> : null}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
