"use client";

import * as React from "react";
import { CreditCard, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { GlassPanel } from "@/components/ui/glass-panel";
import { WorkspacePageHeader } from "@/components/ui/workspace-page-header";
import { WorkspacePageShell } from "@/components/ui/workspace-page-shell";
import { glassInsetClass } from "@/lib/ui/glass-surfaces";
import { cn } from "@/lib/utils";

type PaymentRow = {
  id: string;
  schoolName: string;
  studentName: string;
  amountMinor: number;
  currency: "GHS";
  status: string;
  paystackReference: string | null;
  createdAt: string | null;
  succeededAt: string | null;
};

type ApiResponse =
  | { success: true; data: { payments: PaymentRow[] } }
  | { success: false; error: string };

function money(minor: number, currency: string) {
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(minor / 100);
}

function shortDate(value: string | null) {
  if (!value) return "Not complete";
  return new Intl.DateTimeFormat("en-GH", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function PlatformLearnPaymentsClient() {
  const [payments, setPayments] = React.useState<PaymentRow[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch("/api/platform/learn/payments", { cache: "no-store" });
        const payload = (await response.json()) as ApiResponse;
        if (!response.ok || !payload.success) {
          throw new Error(payload.success ? "Failed to load payments." : payload.error);
        }
        if (!cancelled) setPayments(payload.data.payments);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load payments.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const revenue = payments
    .filter((payment) => payment.status === "succeeded")
    .reduce((sum, payment) => sum + payment.amountMinor, 0);

  return (
    <div className="p-6 text-white md:p-8">
      <WorkspacePageShell>
        <WorkspacePageHeader
          title="Learn payments"
          subtitle="Parent-paid EduSentrix Learn revenue, separate from school fee payments."
          icon={CreditCard}
          backHref="/platform/learn"
          backLabel="Back to Learn"
        />
        <div className="grid gap-4 md:grid-cols-3">
          <Metric label="Payments listed" value={payments.length.toLocaleString()} />
          <Metric label="Successful revenue" value={money(revenue, "GHS")} />
          <Metric
            label="Succeeded"
            value={payments.filter((payment) => payment.status === "succeeded").length.toLocaleString()}
          />
        </div>
        <GlassPanel className="p-6" glow="both">
          {loading ? (
            <p className="flex items-center gap-2 text-sm text-white/55">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading payments...
            </p>
          ) : (
            <div className="space-y-3">
              {payments.map((payment) => (
                <div key={payment.id} className={cn(glassInsetClass, "p-4")}>
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="font-semibold text-white">{payment.studentName}</p>
                      <p className="mt-1 text-sm text-white/50">{payment.schoolName}</p>
                    </div>
                    <div className="grid gap-3 text-sm sm:grid-cols-4 lg:min-w-[680px]">
                      <Info label="Amount" value={money(payment.amountMinor, payment.currency)} />
                      <Info label="Status" value={payment.status.replace(/_/g, " ")} />
                      <Info label="Created" value={shortDate(payment.createdAt)} />
                      <Info label="Reference" value={payment.paystackReference || "Not assigned"} />
                    </div>
                  </div>
                </div>
              ))}
              {!payments.length ? (
                <p className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/55">
                  No Learn payment intents found.
                </p>
              ) : null}
            </div>
          )}
        </GlassPanel>
      </WorkspacePageShell>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <GlassPanel className="p-4" glow="cyan">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/40">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
    </GlassPanel>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/35">{label}</p>
      <p className="mt-1 break-words capitalize text-white/80">{value}</p>
    </div>
  );
}
