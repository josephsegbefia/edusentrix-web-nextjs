"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Banknote, CalendarCheck2, FileSearch, Plus, ShieldCheck } from "lucide-react";
import { PaymentDetailsDrawer } from "@/components/admin/fees/payments/PaymentDetailsDrawer";
import { PendingApprovalsCard } from "@/components/admin/fees/payments/PendingApprovalsCard";
import { Button } from "@/components/ui/button";

export default function FinancePaymentsPage() {
  const [activePaymentId, setActivePaymentId] = React.useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  function openPayment(paymentId: string) {
    setActivePaymentId(paymentId);
    setDrawerOpen(true);
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-col gap-4 border-b border-white/10 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Button asChild variant="ghost" className="mb-3 px-0 text-white/60 hover:bg-transparent hover:text-white">
            <Link href="/admin/finance">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Finance
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04]">
              <Banknote className="h-5 w-5 text-emerald-200" />
            </span>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-white">Payment Inbox</h1>
              <p className="mt-1 text-sm text-white/55">
                Review pending payments, run reconciliation checks, inspect evidence, and close
                cash without mixing this work into the broader fees page.
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild className="bg-emerald-600 text-white hover:bg-emerald-500">
            <Link href="/admin/fees/payments/record">
              <Plus className="mr-2 h-4 w-4" />
              Record Payment
            </Link>
          </Button>
          <Button asChild variant="outline" className="border-white/10 bg-white/[0.04] text-white">
            <Link href="/admin/finance/cash-close">
              <CalendarCheck2 className="mr-2 h-4 w-4" />
              Cash Close
            </Link>
          </Button>
          <Button asChild variant="outline" className="border-white/10 bg-white/[0.04] text-white">
            <Link href="/admin/finance/reconciliation/sessions">
              <FileSearch className="mr-2 h-4 w-4" />
              Reconciliation
            </Link>
          </Button>
        </div>
      </div>

      <section className="rounded-xl border border-emerald-300/15 bg-emerald-500/10 p-4 text-emerald-50">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-100" />
          <div>
            <p className="text-sm font-semibold">Payment control workflow</p>
            <p className="mt-1 text-sm leading-6 text-emerald-50/75">
              Payments are reviewed here before they become trusted finance evidence. Leo can help
              explain risk, but approval, rejection, reversal, reconciliation, and cash closure must
              remain human-confirmed actions.
            </p>
          </div>
        </div>
      </section>

      <PendingApprovalsCard onOpenPayment={openPayment} />

      <PaymentDetailsDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        paymentId={activePaymentId}
      />
    </div>
  );
}
