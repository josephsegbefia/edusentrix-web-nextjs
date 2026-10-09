"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, ReceiptText } from "lucide-react";
import { PaymentDetailsDrawer } from "@/components/admin/fees/payments/PaymentDetailsDrawer";
import { Button } from "@/components/ui/button";
import { WorkspaceScope } from "@/components/theme/workspace-scope";
import { Skeleton } from "@/components/loading/skeleton";
import { usePayments, type Payment } from "@/hooks/admin/usePayments";
import { formatMoney } from "@/lib/fees/money";

function formatPaymentDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function methodLabel(method: string) {
  return method.replaceAll("_", " ");
}

function studentLabel(payment: Payment) {
  const student = payment.studentId;
  if (!student) return "Student";
  const name = `${student.firstName || ""} ${student.lastName || ""}`.trim();
  return name || student.admissionNo || "Student";
}

function invoiceLabel(payment: Payment) {
  return payment.invoiceId?.invoiceNumber || "—";
}

export default function FeePaymentsPage() {
  const router = useRouter();
  const [page, setPage] = React.useState(1);
  const { data, isLoading, isError } = usePayments({ page, limit: 20 });
  const [activePaymentId, setActivePaymentId] = React.useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  const payments = data?.payments ?? [];
  const pagination = data?.pagination;
  const pages = pagination?.pages ?? 0;

  function openPayment(payment: Payment) {
    setActivePaymentId(payment._id);
    setDrawerOpen(true);
  }

  return (
    <WorkspaceScope>
      <div className="space-y-6 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => router.push("/admin/fees")}
              className="h-9 w-9 border border-(--ws-line) bg-(--ws-fill) text-(--ws-fg) hover:bg-(--ws-fill-strong)"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-(--ws-fg)">
                Payments
              </h1>
              <p className="mt-1 text-sm text-(--ws-fg-70)">
                Recorded fee payments for this school.
              </p>
            </div>
          </div>
          <Button asChild className="bg-emerald-600 text-white hover:bg-emerald-500 hover:text-white">
            <Link href="/admin/fees/payments/record">
              <Plus className="mr-2 h-4 w-4" />
              Record payment
            </Link>
          </Button>
        </div>

        <div className="overflow-hidden rounded-2xl border border-(--ws-line) bg-linear-to-br from-(--ws-panel-from) via-(--ws-panel-via) to-(--ws-panel-to) shadow-[var(--ws-shadow)]">
          {isLoading ? (
            <div className="space-y-3 p-6">
              <Skeleton className="h-14" />
              <Skeleton className="h-14" />
              <Skeleton className="h-14" />
            </div>
          ) : isError ? (
            <p className="p-6 text-sm text-(--ws-rose)">
              Payments could not be loaded. Refresh the page to try again.
            </p>
          ) : payments.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-16 text-center">
              <ReceiptText className="h-8 w-8 text-(--ws-fg-70)" />
              <p className="mt-3 text-sm font-medium text-(--ws-fg)">No payments yet</p>
              <p className="mt-1 max-w-sm text-sm text-(--ws-fg-70)">
                Recorded payments will appear here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-(--ws-line) text-xs uppercase tracking-[0.14em] text-(--ws-fg-70)">
                  <tr>
                    <th className="px-4 py-3 font-medium">Student</th>
                    <th className="px-4 py-3 font-medium">Invoice</th>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Method</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment) => (
                    <tr
                      key={payment._id}
                      className="cursor-pointer border-b border-(--ws-line) last:border-0 hover:bg-(--ws-fill)"
                      onClick={() => openPayment(payment)}
                    >
                      <td className="px-4 py-3 text-(--ws-fg)">{studentLabel(payment)}</td>
                      <td className="px-4 py-3 text-(--ws-fg-70)">{invoiceLabel(payment)}</td>
                      <td className="px-4 py-3 text-(--ws-fg-70)">
                        {formatPaymentDate(payment.paymentDate)}
                      </td>
                      <td className="px-4 py-3 capitalize text-(--ws-fg-70)">
                        {methodLabel(payment.paymentMethod)}
                      </td>
                      <td className="px-4 py-3 capitalize text-(--ws-fg-70)">
                        {payment.status.replaceAll("_", " ")}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-(--ws-fg)">
                        {formatMoney(payment.amountMinor)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {pages > 1 ? (
          <div className="flex items-center justify-between text-sm text-(--ws-fg-70)">
            <span>
              Page {pagination?.page ?? page} of {pages}
            </span>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="border-(--ws-line) bg-(--ws-fill) text-(--ws-fg)"
              >
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={page >= pages}
                onClick={() => setPage((current) => current + 1)}
                className="border-(--ws-line) bg-(--ws-fill) text-(--ws-fg)"
              >
                Next
              </Button>
            </div>
          </div>
        ) : null}

        <PaymentDetailsDrawer
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          paymentId={activePaymentId}
        />
      </div>
    </WorkspaceScope>
  );
}
