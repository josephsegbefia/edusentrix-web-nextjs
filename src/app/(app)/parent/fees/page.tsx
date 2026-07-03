// src/app/(app)/parent/fees/page.tsx
"use client";

import * as React from "react";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  DollarSign,
  AlertTriangle,
  Users,
  ChevronRight,
  CreditCard,
  CheckCircle2,
  Clock,
  AlertCircle,
  Sparkles,
  Wallet,
  Receipt,
  TrendingUp,
  Download,
  Eye,
} from "lucide-react";
import { useParentFees } from "@/hooks/parent/useParentFees";
import type { WardFeeSummary, PendingInvoice, RecentPayment, FeeStatus } from "@/hooks/parent/useParentFees";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { formatCurrencyFromMajor, formatMoney } from "@/lib/fees/money";
import type { PaystackKeyMode } from "@/types/paystack-key-mode";
import { showPaymentReceiptToast } from "@/components/parent/PaymentReceiptToast";

/* --------------------------------------------------------------------------------
   Helpers
-------------------------------------------------------------------------------- */
function initialsFromName(fullName: string) {
  const parts = fullName.trim().split(/\s+/);
  if (!parts.length) return "";
  if (parts.length === 1) return parts[0]!.charAt(0)?.toUpperCase() ?? "";
  return (
    (parts[0]?.charAt(0)?.toUpperCase() ?? "") +
    (parts[parts.length - 1]?.charAt(0)?.toUpperCase() ?? "")
  );
}
function getStatusColor(status: FeeStatus): string {
  const colors: Record<FeeStatus, string> = {
    clear: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    partial: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    owing: "bg-red-500/20 text-red-300 border-red-500/30",
  };
  return colors[status];
}

/* --------------------------------------------------------------------------------
   Summary Cards
-------------------------------------------------------------------------------- */
function SummaryCard({
  icon: Icon,
  label,
  value,
  subLabel,
  tone,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  subLabel?: string;
  tone: "emerald" | "blue" | "amber" | "red" | "purple" | "cyan";
  onClick?: () => void;
}) {
  const tones = {
    emerald: {
      gradient: "from-emerald-500/15 via-emerald-500/5 to-transparent",
      iconBg: "bg-emerald-500/20 border-emerald-500/30",
      iconColor: "text-emerald-300",
    },
    blue: {
      gradient: "from-blue-500/15 via-blue-500/5 to-transparent",
      iconBg: "bg-blue-500/20 border-blue-500/30",
      iconColor: "text-blue-300",
    },
    amber: {
      gradient: "from-amber-500/15 via-amber-500/5 to-transparent",
      iconBg: "bg-amber-500/20 border-amber-500/30",
      iconColor: "text-amber-300",
    },
    red: {
      gradient: "from-red-500/15 via-red-500/5 to-transparent",
      iconBg: "bg-red-500/20 border-red-500/30",
      iconColor: "text-red-300",
    },
    purple: {
      gradient: "from-purple-500/15 via-purple-500/5 to-transparent",
      iconBg: "bg-purple-500/20 border-purple-500/30",
      iconColor: "text-purple-300",
    },
    cyan: {
      gradient: "from-cyan-500/15 via-cyan-500/5 to-transparent",
      iconBg: "bg-cyan-500/20 border-cyan-500/30",
      iconColor: "text-cyan-300",
    },
  };

  const style = tones[tone];
  const Wrapper: React.ElementType = onClick ? "button" : "div";

  return (
    <Wrapper
      onClick={onClick}
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/80 to-black p-5 shadow-lg shadow-black/30 backdrop-blur-xl",
        onClick && "text-left cursor-pointer hover:-translate-y-0.5 hover:shadow-xl transition-all duration-200"
      )}
    >
      <div
        className={cn(
          "pointer-events-none absolute inset-0 bg-linear-to-br opacity-60",
          style.gradient
        )}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/15 to-transparent"
        aria-hidden="true"
      />

      <div className="relative z-10 space-y-3">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-xl border",
              style.iconBg
            )}
          >
            <Icon className={cn("h-5 w-5", style.iconColor)} />
          </div>
          <span className="text-xs font-medium uppercase tracking-widest text-white/50">
            {label}
          </span>
        </div>
        <div className="text-2xl font-bold tracking-tight text-white">
          {value}
        </div>
        {subLabel && <p className="text-xs text-white/50">{subLabel}</p>}
      </div>
    </Wrapper>
  );
}

/* --------------------------------------------------------------------------------
   Ward Fee Card
-------------------------------------------------------------------------------- */
function WardFeeCard({
  ward,
  onClick,
}: {
  ward: WardFeeSummary;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group relative w-full overflow-hidden rounded-xl border border-white/10 bg-linear-to-br from-white/5 to-transparent p-4 text-left transition-all duration-200 hover:border-white/20 hover:shadow-lg hover:scale-[1.01]"
    >
      <div className="flex items-center gap-4">
        {/* Avatar */}
        <Avatar className="h-14 w-14 border-2 border-white/20">
          {ward.photoUrl ? (
            <AvatarImage src={ward.photoUrl} alt={ward.wardName} />
          ) : null}
          <AvatarFallback className="bg-linear-to-br from-emerald-600/40 to-teal-600/40 text-lg font-bold text-white">
            {initialsFromName(ward.wardName)}
          </AvatarFallback>
        </Avatar>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-white truncate">{ward.wardName}</h3>
            {ward.status === "clear" && (
              <Sparkles className="h-4 w-4 text-emerald-400" />
            )}
          </div>
          <p className="text-sm text-white/60">{ward.classGroup}</p>
          <div className="flex items-center gap-3 mt-2">
            <Badge variant="outline" className={getStatusColor(ward.status)}>
              {ward.status === "clear" ? (
                <CheckCircle2 className="h-3 w-3 mr-1" />
              ) : ward.status === "partial" ? (
                <Clock className="h-3 w-3 mr-1" />
              ) : (
                <AlertCircle className="h-3 w-3 mr-1" />
              )}
              {ward.status === "clear" ? "Paid" : ward.status === "partial" ? "Partial" : "Owing"}
            </Badge>
            {ward.overdueInvoices > 0 && (
              <span className="flex items-center gap-1 text-xs text-red-300">
                <AlertCircle className="h-3 w-3" />
                {ward.overdueInvoices} overdue
              </span>
            )}
          </div>
        </div>

        {/* Amount & Progress */}
        <div className="text-right shrink-0">
          <div className={cn("text-xl font-bold", ward.balanceDue > 0 ? "text-red-300" : "text-emerald-300")}>
            {formatCurrencyFromMajor(ward.balanceDue)}
          </div>
          <p className="text-xs text-white/50 mt-1">
            of {formatCurrencyFromMajor(ward.totalFees)}
          </p>
          <div className="mt-2 w-24">
            <Progress value={ward.paymentProgress} className="h-1.5" />
          </div>
        </div>

        <ChevronRight className="h-5 w-5 text-white/40 transition-transform group-hover:translate-x-0.5" />
      </div>
    </button>
  );
}

/* --------------------------------------------------------------------------------
   Pending Invoice Card
-------------------------------------------------------------------------------- */
function InvoiceCard({
  invoice,
  onView,
  onPay,
  isPaying,
}: {
  invoice: PendingInvoice;
  onView: () => void;
  onPay: () => void;
  isPaying: boolean;
}) {
  return (
    <div
      className={cn(
        "w-full rounded-lg border px-3 py-3 transition-all hover:shadow-md",
        invoice.isOverdue
          ? "border-red-500/30 bg-red-500/10 hover:bg-red-500/15"
          : "border-white/10 bg-white/5 hover:bg-white/10"
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
              invoice.isOverdue ? "bg-red-500/30" : "bg-amber-500/20"
            )}
          >
            <Receipt
              className={cn(
                "h-5 w-5",
                invoice.isOverdue ? "text-red-300" : "text-amber-300"
              )}
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">
              {invoice.title}
            </p>
            <p className="text-xs text-white/50 truncate">{invoice.wardName}</p>
            <p
              className={cn(
                "text-xs mt-0.5",
                invoice.isOverdue ? "text-red-300" : "text-white/50"
              )}
            >
              Due: {format(parseISO(invoice.dueDate), "MMM d, yyyy")}
              {invoice.isOverdue && " (Overdue)"}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 sm:justify-end">
          <div className="text-right">
            <p
              className={cn(
                "text-lg font-bold",
                invoice.isOverdue ? "text-red-200" : "text-white"
              )}
            >
              {formatCurrencyFromMajor(invoice.balanceDue)}
            </p>
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] mt-1",
                invoice.isOverdue
                  ? "border-red-500/50 bg-red-500/20 text-red-200"
                  : invoice.status === "partial"
                    ? "border-amber-500/50 bg-amber-500/20 text-amber-200"
                    : "border-blue-500/50 bg-blue-500/20 text-blue-200"
              )}
            >
              {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
            </Badge>
          </div>

          <div className="flex flex-col gap-2 sm:items-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 px-3 text-xs text-white/70 hover:text-white"
              onClick={onView}
            >
              View Child
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-8 px-3 text-xs rounded-lg bg-emerald-600 hover:bg-emerald-700"
              onClick={onPay}
              disabled={!invoice.canPayOnline || isPaying}
            >
              {isPaying ? "Opening..." : "Pay Now"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------------------
   Recent Payment Card
-------------------------------------------------------------------------------- */
function PaymentCard({ payment }: { payment: RecentPayment }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2.5">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20">
          <CreditCard className="h-4 w-4 text-emerald-300" />
        </div>
        <div>
          <p className="text-sm font-medium text-white">{formatCurrencyFromMajor(payment.amount)}</p>
          <p className="text-xs text-white/50">{payment.wardName}</p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-xs text-white/60">
          {format(parseISO(payment.date), "MMM d")}
        </p>
        <p className="text-[10px] text-white/40 capitalize">{payment.method}</p>
      </div>
    </div>
  );
}

type CheckoutPreview = {
  invoiceId: string;
  invoiceNumber: string;
  title: string;
  wardName: string;
  amountMinor: number;
  parentPayableMinor: number;
  platformFeeMinor: number;
  estimatedSchoolNetMinor: number;
  processorFeeNote: string;
  payerMode?: "payer_pays" | "school_absorbs" | "waived";
  paystackKeyMode: PaystackKeyMode;
};

/* --------------------------------------------------------------------------------
   Main Content
-------------------------------------------------------------------------------- */
function FeesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data, isLoading, error, refetch } = useParentFees();
  const [payingInvoiceId, setPayingInvoiceId] = React.useState<string | null>(null);
  const [checkoutBanner, setCheckoutBanner] = React.useState<{
    tone: "blue" | "emerald" | "amber" | "red";
    title: string;
    message: string;
    receiptViewUrl?: string | null;
    receiptDownloadUrl?: string | null;
  } | null>(null);
  const [checkoutPreview, setCheckoutPreview] =
    React.useState<CheckoutPreview | null>(null);
  const [checkoutSubmitting, setCheckoutSubmitting] = React.useState(false);
  const [storedCheckoutReference, setStoredCheckoutReference] = React.useState<string | null>(null);

  const checkoutReference =
    searchParams.get("reference") || searchParams.get("trxref");
  const effectiveCheckoutReference = checkoutReference || storedCheckoutReference;

  React.useEffect(() => {
    if (checkoutReference) return;
    try {
      const stored = window.sessionStorage.getItem("edusentrix:lastPaystackReference");
      if (stored) setStoredCheckoutReference(stored);
    } catch {
      // Storage may be unavailable; query params remain the primary path.
    }
  }, [checkoutReference]);

  React.useEffect(() => {
    if (!effectiveCheckoutReference) {
      return;
    }

    // Total poll budget: ~60s with progressive backoff. Paystack callbacks
    // usually beat the parent back to this page, but for local dev (no public
    // webhook reachability) the server-side fallback in checkout-status needs
    // a moment to verify with Paystack and post into the school ledger.
    const POLL_DELAYS_MS = [
      0, 1500, 2000, 2500, 3000, 3500, 4000, 4500, 5000, 6000, 7000, 8000, 9000, 10000,
    ];
    const MAX_ATTEMPTS = POLL_DELAYS_MS.length;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let toastFired = false;

    setCheckoutBanner({
      tone: "blue",
      title: "Confirming Payment",
      message: "We are checking the status of your recent payment.",
    });

    const stripCheckoutParams = () => {
      try {
        const url = new URL(window.location.href);
        let touched = false;
        for (const key of ["reference", "trxref", "checkout"]) {
          if (url.searchParams.has(key)) {
            url.searchParams.delete(key);
            touched = true;
          }
        }
        if (touched) {
          const next = `${url.pathname}${
            url.searchParams.toString() ? `?${url.searchParams.toString()}` : ""
          }`;
          window.history.replaceState({}, "", next);
        }
        window.sessionStorage.removeItem("edusentrix:lastPaystackReference");
      } catch {
        // ignore — non-fatal
      }
    };

    const pollOnce = async (attempt: number) => {
      if (cancelled) return;
      try {
        const res = await fetch(
          `/api/parent/payments/checkout-status?reference=${encodeURIComponent(
            effectiveCheckoutReference
          )}`,
          { cache: "no-store" }
        );
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.success) {
          throw new Error(json?.error || "Unable to confirm payment status");
        }

        if (cancelled) return;

        const status = String(json.data?.status || "not_found");
        const message =
          String(json.data?.message || "").trim() ||
          "Your payment status is being updated.";

        if (status === "completed") {
          const receiptViewUrl =
            typeof json.data?.receiptViewUrl === "string"
              ? json.data.receiptViewUrl
              : null;
          const receiptDownloadUrl =
            typeof json.data?.receiptDownloadUrl === "string"
              ? json.data.receiptDownloadUrl
              : null;
          const paidAmountMinor = Number(json.data?.amountMinor || 0);

          setCheckoutBanner({
            tone: "emerald",
            title: "Payment Confirmed",
            message:
              "Your payment was received successfully. The fees summary is refreshing now.",
            receiptViewUrl,
            receiptDownloadUrl,
          });

          if (!toastFired) {
            toastFired = true;
            showPaymentReceiptToast({
              title: "Payment confirmed",
              description: "We received your school fee payment. Your receipt is ready.",
              amountMinor: paidAmountMinor || null,
              receiptViewUrl,
              receiptDownloadUrl,
            });
          }

          void refetch();
          stripCheckoutParams();
          return;
        }

        if (status === "failed") {
          setCheckoutBanner({
            tone: "red",
            title: "Payment Not Completed",
            message,
          });
          if (!toastFired) {
            toastFired = true;
            toast.error("Payment not completed", { description: message });
          }
          stripCheckoutParams();
          return;
        }

        // Still pending — show progress and keep polling
        setCheckoutBanner({
          tone: status === "pending" ? "amber" : "blue",
          title:
            status === "pending"
              ? "Payment Pending Confirmation"
              : "Awaiting Confirmation",
          message,
        });

        if (attempt + 1 >= MAX_ATTEMPTS) {
          setCheckoutBanner({
            tone: "amber",
            title: "Still Confirming",
            message:
              "Your payment is taking longer than usual to confirm. It will appear here as soon as the gateway responds — refresh if it does not show shortly.",
          });
          return;
        }

        const nextDelay = POLL_DELAYS_MS[attempt + 1] ?? 5000;
        timer = setTimeout(() => void pollOnce(attempt + 1), nextDelay);
      } catch (statusError) {
        if (cancelled) return;
        if (attempt + 1 >= MAX_ATTEMPTS) {
          setCheckoutBanner({
            tone: "red",
            title: "Unable to Confirm Payment",
            message:
              statusError instanceof Error
                ? statusError.message
                : "We could not confirm your payment yet. Please refresh in a moment.",
          });
          return;
        }
        const nextDelay = POLL_DELAYS_MS[attempt + 1] ?? 5000;
        timer = setTimeout(() => void pollOnce(attempt + 1), nextDelay);
      }
    };

    timer = setTimeout(() => void pollOnce(0), POLL_DELAYS_MS[0] ?? 0);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [effectiveCheckoutReference, refetch]);

  // Silent reconciliation: when the page mounts (and we're NOT actively
  // confirming a fresh callback), reach out to the server to verify any
  // payment intents that are still `awaiting_webhook`. This covers the
  // case where the Paystack webhook never reached the platform (e.g.
  // local dev / Paystack retry pending) or the parent closed the tab
  // before the callback redirect.
  React.useEffect(() => {
    if (checkoutReference) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/parent/payments/reconcile-pending", {
          cache: "no-store",
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.success) return;
        if (cancelled) return;

        const reconciled: Array<{
          reference: string;
          paymentId: string;
          amountMinor?: number;
          receiptViewUrl?: string;
          receiptDownloadUrl?: string;
        }> = Array.isArray(json.data?.reconciled) ? json.data.reconciled : [];

        if (reconciled.length === 0) return;

        for (const item of reconciled) {
          showPaymentReceiptToast({
            title: "Payment confirmed",
            description: "We located a recent school fee payment and added it to your account.",
            amountMinor: Number(item.amountMinor || 0) || null,
            receiptReference: item.reference,
            receiptViewUrl: item.receiptViewUrl ?? null,
            receiptDownloadUrl: item.receiptDownloadUrl ?? null,
          });
        }

        void refetch();
      } catch {
        // best-effort background reconciliation — never surface errors
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [checkoutReference, refetch]);

  const handleWardClick = (wardId: string) => {
    router.push(`/parent/wards/${wardId}?tab=fees`);
  };

  const handlePayInvoice = React.useCallback(async (invoice: PendingInvoice) => {
    try {
      setPayingInvoiceId(invoice.id);
      setCheckoutBanner(null);
      setCheckoutPreview(null);

      const res = await fetch("/api/parent/payments/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          invoiceId: invoice.id,
          preview: true,
        }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to load checkout details");
      }

      setCheckoutPreview({
        invoiceId: String(json.data?.invoiceId || invoice.id),
        invoiceNumber: String(
          json.data?.invoiceNumber || invoice.invoiceNumber || "School Fees"
        ),
        title: invoice.title,
        wardName: invoice.wardName,
        amountMinor: Number(json.data?.amountMinor || invoice.balanceDueMinor || 0),
        parentPayableMinor: Number(
          json.data?.parentPayableMinor || invoice.balanceDueMinor || 0
        ),
        platformFeeMinor: Number(json.data?.platformFeeMinor || 0),
        estimatedSchoolNetMinor: Number(
          json.data?.estimatedSchoolNetMinor || invoice.balanceDueMinor || 0
        ),
        processorFeeNote: String(json.data?.processorFeeNote || ""),
        payerMode: (json.data?.payerMode as "payer_pays" | "school_absorbs" | "waived") ?? "school_absorbs",
        paystackKeyMode: (json.data?.paystackKeyMode || "unset") as PaystackKeyMode,
      });
    } catch (checkoutError) {
      const message =
        checkoutError instanceof Error
          ? checkoutError.message
          : "Unable to load checkout details";
      toast.error(message);
      setCheckoutBanner({
        tone: "red",
        title: "Checkout Unavailable",
        message,
      });
    } finally {
      setPayingInvoiceId(null);
    }
  }, []);

  const handleConfirmCheckout = React.useCallback(async () => {
    if (!checkoutPreview) return;

    try {
      setCheckoutSubmitting(true);
      setCheckoutBanner({
        tone: "blue",
        title: "Opening Secure Checkout",
        message: "Redirecting you to Paystack to complete this payment.",
      });

      const res = await fetch("/api/parent/payments/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          invoiceId: checkoutPreview.invoiceId,
        }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to start checkout");
      }

      const authorizationUrl = String(json.data?.authorizationUrl || "");
      if (!authorizationUrl) {
        throw new Error("Missing Paystack authorization URL");
      }

      window.location.assign(authorizationUrl);
    } catch (checkoutError) {
      const message =
        checkoutError instanceof Error
          ? checkoutError.message
          : "Unable to start checkout";
      toast.error(message);
      setCheckoutBanner({
        tone: "red",
        title: "Checkout Unavailable",
        message,
      });
    } finally {
      setCheckoutSubmitting(false);
    }
  }, [checkoutPreview]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="relative overflow-hidden rounded-2xl border border-red-500/30 bg-linear-to-br from-red-950/40 to-transparent p-8 text-center">
        <AlertTriangle className="mx-auto h-12 w-12 text-red-300/60 mb-4" />
        <p className="text-red-200/80">Failed to load fees data. Please try again.</p>
      </Card>
    );
  }

  const {
    wards = [],
    pendingInvoices = [],
    overallSummary,
    recentPayments = [],
    paystackKeyMode = "unset",
    onlinePaymentsReady = false,
  } = data || {};

  const hasData = wards.length > 0;

  return (
    <div className="space-y-6">
      <Dialog
        open={Boolean(checkoutPreview)}
        onOpenChange={(open) => {
          if (!open && !checkoutSubmitting) {
            setCheckoutPreview(null);
          }
        }}
      >
        <DialogContent className="max-w-xl border border-white/10 bg-linear-to-br from-slate-900 via-slate-950 to-black text-white shadow-2xl">
          <DialogHeader>
            <DialogTitle>Review Checkout</DialogTitle>
            <DialogDescription className="text-white/60">
              Confirm the payment breakdown before you continue to the secure Paystack page.
            </DialogDescription>
          </DialogHeader>

          {checkoutPreview && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-sm font-medium text-white">
                  {checkoutPreview.title}
                </p>
                <p className="mt-1 text-xs text-white/50">
                  {checkoutPreview.wardName} • {checkoutPreview.invoiceNumber}
                </p>
              </div>

              {checkoutPreview.payerMode === "payer_pays" ? (
                <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between gap-4 text-sm">
                    <span className="text-white/60">School charge</span>
                    <span className="font-semibold text-white">
                      {formatMoney(checkoutPreview.amountMinor)}
                    </span>
                  </div>
                  {checkoutPreview.platformFeeMinor > 0 && (
                    <div className="flex items-center justify-between gap-4 text-sm">
                      <span className="text-white/60">EduSentrix service fee</span>
                      <span className="font-medium text-amber-200">
                        {formatMoney(checkoutPreview.platformFeeMinor)}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-4 border-t border-white/10 pt-3 text-sm">
                    <span className="font-medium text-white">Total to pay</span>
                    <span className="text-lg font-bold text-white">
                      {formatMoney(checkoutPreview.parentPayableMinor)}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between gap-4 text-sm">
                    <span className="text-white/60">Total to pay</span>
                    <span className="text-lg font-bold text-white">
                      {formatMoney(checkoutPreview.parentPayableMinor)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="border-white/10 bg-white/5 text-white hover:bg-white/10"
              onClick={() => setCheckoutPreview(null)}
              disabled={checkoutSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-emerald-600 text-white hover:bg-emerald-700"
              onClick={handleConfirmCheckout}
              disabled={checkoutSubmitting}
            >
              {checkoutSubmitting ? "Opening..." : "Continue to Paystack"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Page Header */}
      <div className="relative">
        <div
          className="pointer-events-none absolute -left-20 -top-20 h-56 w-56 rounded-full bg-emerald-500/10 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -right-10 top-10 h-40 w-40 rounded-full bg-teal-500/10 blur-3xl"
          aria-hidden="true"
        />

	      <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h1 className="bg-linear-to-r from-emerald-200 via-teal-200 to-cyan-300 bg-clip-text text-3xl font-extrabold tracking-tight text-transparent lg:text-4xl">
                Fees & Payments
              </h1>
              {hasData && overallSummary?.totalBalance === 0 && (
                <div className="flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                  <Sparkles className="h-3 w-3" />
                  All Clear
                </div>
              )}
            </div>
            <p className="text-sm text-white/60">
              Manage school fees and view payment history
            </p>
          </div>

          <Button asChild className="gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700">
            <Link href="/parent/payments">
              <Receipt className="h-4 w-4" />
              Payment History
            </Link>
          </Button>
        </div>
      </div>

	      {!hasData ? (
        <Card className="relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/80 to-black shadow-2xl p-12 text-center">
          <div className="relative z-10 flex flex-col items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-linear-to-br from-emerald-500/20 to-teal-500/20">
              <Wallet className="h-8 w-8 text-emerald-300" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-semibold text-white">No Fee Records Yet</h3>
              <p className="text-sm text-white/60 max-w-md">
                Fee information will appear here once the school creates invoices for your children.
              </p>
            </div>
            <Button asChild variant="outline" className="mt-4 gap-2 rounded-xl">
              <Link href="/parent/wards">
                <Users className="h-4 w-4" />
                View My Children
              </Link>
            </Button>
          </div>
        </Card>
	      ) : (
	        <>
	          {checkoutBanner && (
	            <Card
	              className={cn(
	                "relative overflow-hidden rounded-xl border p-4",
	                checkoutBanner.tone === "emerald" &&
	                  "border-emerald-500/30 bg-emerald-500/10",
	                checkoutBanner.tone === "blue" &&
	                  "border-blue-500/30 bg-blue-500/10",
	                checkoutBanner.tone === "amber" &&
	                  "border-amber-500/30 bg-amber-500/10",
	                checkoutBanner.tone === "red" &&
	                  "border-red-500/30 bg-red-500/10"
	              )}
	            >
	              <div className="flex items-start gap-3">
	                <div
	                  className={cn(
	                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border",
	                    checkoutBanner.tone === "emerald" &&
	                      "border-emerald-500/30 bg-emerald-500/20",
	                    checkoutBanner.tone === "blue" &&
	                      "border-blue-500/30 bg-blue-500/20",
	                    checkoutBanner.tone === "amber" &&
	                      "border-amber-500/30 bg-amber-500/20",
	                    checkoutBanner.tone === "red" &&
	                      "border-red-500/30 bg-red-500/20"
	                  )}
	                >
	                  {checkoutBanner.tone === "emerald" ? (
	                    <CheckCircle2 className="h-5 w-5 text-emerald-300" />
	                  ) : checkoutBanner.tone === "red" ? (
	                    <AlertTriangle className="h-5 w-5 text-red-300" />
	                  ) : (
	                    <Clock
	                      className={cn(
	                        "h-5 w-5",
	                        checkoutBanner.tone === "amber"
	                          ? "text-amber-300"
	                          : "text-blue-300"
	                      )}
	                    />
	                  )}
	                </div>
	                <div className="flex-1">
	                  <h4 className="font-medium text-white">
	                    {checkoutBanner.title}
	                  </h4>
	                  <p className="mt-1 text-sm text-white/70">
	                    {checkoutBanner.message}
	                  </p>
	                  {checkoutBanner.tone === "emerald" &&
	                    (checkoutBanner.receiptViewUrl || checkoutBanner.receiptDownloadUrl) && (
	                      <div className="mt-3 flex flex-wrap gap-2">
	                        {checkoutBanner.receiptViewUrl && (
	                          <Button
	                            asChild
	                            size="sm"
	                            variant="outline"
	                            className="h-8 gap-2 border-white/15 bg-white/5 text-xs text-white hover:bg-white/10"
	                          >
	                            <Link href={checkoutBanner.receiptViewUrl} target="_blank">
	                              <Eye className="h-3.5 w-3.5" />
	                              View receipt
	                            </Link>
	                          </Button>
	                        )}
	                        {checkoutBanner.receiptDownloadUrl && (
	                          <Button
	                            asChild
	                            size="sm"
	                            className="h-8 gap-2 bg-emerald-600 text-xs text-white hover:bg-emerald-700"
	                          >
	                            <Link href={checkoutBanner.receiptDownloadUrl}>
	                              <Download className="h-3.5 w-3.5" />
	                              Download PDF
	                            </Link>
	                          </Button>
	                        )}
	                      </div>
	                    )}
	                </div>
	              </div>
	            </Card>
	          )}

	          {/* Summary Cards */}
	          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <SummaryCard
              icon={DollarSign}
              label="Total Fees"
              value={formatCurrencyFromMajor(overallSummary?.totalFees || 0)}
              subLabel="Across all children"
              tone="blue"
            />
            <SummaryCard
              icon={CheckCircle2}
              label="Total Paid"
              value={formatCurrencyFromMajor(overallSummary?.totalPaid || 0)}
              subLabel={`${overallSummary?.paymentProgress?.toFixed(0) || 0}% complete`}
              tone="emerald"
            />
            <SummaryCard
              icon={Wallet}
              label="Outstanding"
              value={formatCurrencyFromMajor(overallSummary?.totalBalance || 0)}
              subLabel={`${overallSummary?.pendingCount || 0} pending invoices`}
              tone={overallSummary?.totalBalance && overallSummary.totalBalance > 0 ? "red" : "emerald"}
            />
            <SummaryCard
              icon={AlertCircle}
              label="Overdue"
              value={String(overallSummary?.overdueCount || 0)}
              subLabel="Require attention"
              tone={overallSummary?.overdueCount && overallSummary.overdueCount > 0 ? "red" : "emerald"}
            />
          </div>

          {/* Overall Progress */}
          <Card className="relative overflow-hidden rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-white/60 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Overall Payment Progress
              </span>
              <span className="text-sm font-medium text-white">
                {overallSummary?.paymentProgress?.toFixed(1) || 0}%
              </span>
            </div>
            <Progress value={overallSummary?.paymentProgress || 0} className="h-2" />
          </Card>

          {/* Main Grid */}
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Ward Cards & Pending Invoices */}
            <div className="lg:col-span-2 space-y-6">
              {/* Ward Fee Cards */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                    <Users className="h-5 w-5 text-white/60" />
                    Fees by Child
                  </h2>
                </div>

                <div className="space-y-3">
                  {wards.map((ward) => (
                    <WardFeeCard
                      key={ward.wardId}
                      ward={ward}
                      onClick={() => handleWardClick(ward.wardId)}
                    />
                  ))}
                </div>
              </div>

              {/* Pending Invoices */}
              {pendingInvoices.length > 0 && (
                <Card className="relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/80 to-black shadow-lg">
                  <div
                    className="pointer-events-none absolute -left-10 -top-10 h-32 w-32 rounded-full bg-amber-500/10 blur-3xl"
                    aria-hidden="true"
                  />
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm font-semibold text-white/80">
                      <Receipt className="h-4 w-4 text-amber-300" />
                      Pending Invoices
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="relative z-10 space-y-2">
	                    {pendingInvoices.map((invoice) => (
	                      <InvoiceCard
	                        key={invoice.id}
	                        invoice={invoice}
	                        onView={() => handleWardClick(invoice.wardId)}
	                        onPay={() => handlePayInvoice(invoice)}
	                        isPaying={payingInvoiceId === invoice.id}
	                      />
	                    ))}
	                  </CardContent>
                </Card>
              )}
            </div>

            {/* Recent Payments */}
            <Card className="relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/80 to-black shadow-lg backdrop-blur-xl h-fit">
              <div
                className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-emerald-500/10 blur-3xl"
                aria-hidden="true"
              />
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold text-white/80">
                    <CreditCard className="h-4 w-4 text-emerald-300" />
                    Recent Payments
                  </CardTitle>
                  <Button asChild variant="ghost" size="sm" className="gap-1 text-xs text-brand">
                    <Link href="/parent/payments">
                      View All
                      <ChevronRight className="h-3 w-3" />
                    </Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="relative z-10 space-y-2">
                {recentPayments.length > 0 ? (
                  recentPayments.map((payment) => (
                    <PaymentCard key={payment.id} payment={payment} />
                  ))
                ) : (
                  <p className="text-xs text-white/50 text-center py-4">No recent payments</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Payment Info Banner */}
          {overallSummary?.totalBalance && overallSummary.totalBalance > 0 && (
            <Card className="relative overflow-hidden rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 border border-amber-500/30">
                  <AlertCircle className="h-5 w-5 text-amber-300" />
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-amber-200">Outstanding Balance</h4>
	                  <p className="text-sm text-amber-200/70 mt-1">
	                    You have an outstanding balance of{" "}
	                    <span className="font-semibold">
	                      {formatCurrencyFromMajor(overallSummary.totalBalance)}
	                    </span>
	                    . You can pay eligible invoices online from the pending
	                    invoice list below, or contact the school for offline
	                    payment options.
	                  </p>
	                </div>
	              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

/* --------------------------------------------------------------------------------
   Page Export
-------------------------------------------------------------------------------- */
export default function ParentFeesPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div className="space-y-2">
            <Skeleton className="h-9 w-64" />
            <Skeleton className="h-4 w-96" />
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-32 rounded-2xl" />
            ))}
          </div>
        </div>
      }
    >
      <FeesPageContent />
    </Suspense>
  );
}
