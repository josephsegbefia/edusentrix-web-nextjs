/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { formatMoney } from "@/lib/fees/money";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  CheckCircle2,
  History,
  Paperclip,
  ReceiptText,
  Undo2,
  XCircle,
} from "lucide-react";
import { usePaymentDetail } from "@/hooks/admin/usePaymentDetail";
import { useReviewPayment } from "@/hooks/admin/useReviewPayment";

function statusBadge(p: any) {
  if (p?.approvalStatus === "pending")
    return (
      <Badge
        className="border-amber-400/25 bg-amber-500/10 text-amber-200"
        variant="outline"
      >
        Pending approval
      </Badge>
    );
  if (p?.approvalStatus === "approved")
    return (
      <Badge
        className="border-emerald-400/25 bg-emerald-500/10 text-emerald-200"
        variant="outline"
      >
        Approved
      </Badge>
    );
  if (p?.approvalStatus === "rejected")
    return (
      <Badge
        className="border-red-400/25 bg-red-500/10 text-red-200"
        variant="outline"
      >
        Rejected
      </Badge>
    );
  if (p?.status === "reversed")
    return (
      <Badge
        className="border-white/10 bg-white/5 text-white/70"
        variant="outline"
      >
        Reversed
      </Badge>
    );
  if (p?.status === "failed")
    return (
      <Badge
        className="border-red-400/25 bg-red-500/10 text-red-200"
        variant="outline"
      >
        Failed
      </Badge>
    );
  if (p?.status === "completed")
    return (
      <Badge
        className="border-emerald-400/25 bg-emerald-500/10 text-emerald-200"
        variant="outline"
      >
        Completed
      </Badge>
    );
  return (
    <Badge
      className="border-white/10 bg-white/5 text-white/70"
      variant="outline"
    >
      Posted
    </Badge>
  );
}

function reconciliationBadge(value: string | null | undefined) {
  const status = String(value || "unmatched");
  const label = status.replaceAll("_", " ");
  const classNameMap: Record<string, string> = {
    fully_reconciled: "border-emerald-400/25 bg-emerald-500/10 text-emerald-200",
    bank_matched: "border-cyan-400/25 bg-cyan-500/10 text-cyan-200",
    gateway_verified: "border-blue-400/25 bg-blue-500/10 text-blue-200",
    needs_review: "border-amber-400/25 bg-amber-500/10 text-amber-200",
    unmatched: "border-white/10 bg-white/5 text-white/70",
  };

  return (
    <Badge
      className={classNameMap[status] || "border-white/10 bg-white/5 text-white/70"}
      variant="outline"
    >
      {label}
    </Badge>
  );
}

function fmtDate(value: string | Date | null | undefined) {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(date);
}

function fmtDateTime(value: string | Date | null | undefined) {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function userLabel(user: any) {
  if (!user) return "—";
  const fullName = String(
    user.name || `${user.firstName || ""} ${user.lastName || ""}`.trim()
  ).trim();
  if (fullName) return fullName;
  return user.email || "—";
}

export function PaymentDetailsDrawer(props: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  paymentId: string | null;
}) {
  const { data, isLoading, isError } = usePaymentDetail(props.paymentId);
  const p = data?.payment;

  const [notes, setNotes] = React.useState("");
  React.useEffect(() => setNotes(""), [props.paymentId]);

  const review = useReviewPayment();

  const allocations = p?.allocations ?? [];
  const requested = p?.requestedAllocations ?? [];
  const allocationRows = allocations.length ? allocations : requested;
  const timeline = Array.isArray(p?.timeline) ? p.timeline : [];

  const canApprove = p?.approvalStatus === "pending" && p?.status === "pending";
  const canReverse =
    p?.status === "completed" && p?.approvalStatus !== "pending";
  const studentName = `${p?.studentId?.firstName || ""} ${
    p?.studentId?.lastName || ""
  }`.trim();
  const periodLabel = p?.invoiceId?.academicPeriodId?.yearLabel
    ? `${p.invoiceId.academicPeriodId.yearLabel} • ${p.invoiceId.academicPeriodId.term}`
    : "—";
  const attachments = React.useMemo(() => {
    const raw = Array.isArray(p?.attachments) ? p.attachments : [];
    return raw
      .map((item: any, index: number) => {
        if (typeof item === "string") {
          return {
            url: item,
            label: `Attachment ${index + 1}`,
            type: "file",
          };
        }
        const url = item?.url || item?.href;
        if (!url) return null;
        return {
          url,
          label: item?.label || item?.name || `Attachment ${index + 1}`,
          type: item?.type || "file",
        };
      })
      .filter(Boolean) as Array<{ url: string; label: string; type: string }>;
  }, [p?.attachments]);

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent
        showCloseButton={false}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        className="max-w-[calc(100%-1rem)] border-white/10 bg-[#0b1220] p-0 text-white sm:max-w-3xl"
        overlayClassName="bg-black/70 backdrop-blur-sm"
      >
        <DialogHeader className="border-b border-white/10 px-4 py-4 sm:px-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
                <ReceiptText className="h-5 w-5 text-white/70" />
                Payment Details
              </DialogTitle>
              <DialogDescription className="mt-1 text-xs text-white/60 sm:text-sm">
                Review payment, allocations, audit trail, and approval actions.
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              {p ? statusBadge(p) : null}
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-white/15 bg-white/5 text-white hover:bg-white/10"
                onClick={() => props.onOpenChange(false)}
              >
                Close
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="max-h-[76vh] space-y-4 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
          {isLoading ? (
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-muted-foreground">
              Loading…
            </div>
          ) : isError || !p ? (
            <div className="rounded-xl border border-red-500/30 bg-red-950/20 p-4 text-sm text-red-200">
              Unable to load payment.
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-white/90">
                    Transaction Snapshot
                  </div>
                  {reconciliationBadge(p.reconciliationStatus)}
                </div>
                <Separator className="mb-3 bg-white/10" />
                <div className="grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-3">
                  <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                    <div className="text-white/50">Amount</div>
                    <div className="mt-1 font-semibold text-emerald-200">
                      {formatMoney(p.amountMinor)}
                    </div>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                    <div className="text-white/50">Payment Date</div>
                    <div className="mt-1 font-medium text-white/85">
                      {fmtDate(p.paymentDate)}
                    </div>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                    <div className="text-white/50">Method</div>
                    <div className="mt-1 font-medium text-white/85">
                      {String(p.paymentMethod || "").replaceAll("_", " ") || "—"}
                    </div>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                    <div className="text-white/50">Internal Reference</div>
                    <div className="mt-1 font-mono text-sm font-medium text-white/85">
                      {p.internalReference || "—"}
                    </div>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                    <div className="text-white/50">Receipt / External Ref</div>
                    <div className="mt-1 font-medium text-white/85">
                      {p.receiptNumber || p.externalReference || "—"}
                    </div>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                    <div className="text-white/50">Gateway Reference</div>
                    <div className="mt-1 break-all font-medium text-white/85">
                      {p.paystackReference || p.paystackTransactionId || "—"}
                    </div>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                    <div className="text-white/50">Payment ID</div>
                    <div className="mt-1 break-all font-medium text-white/85">
                      {String(p._id)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="mb-3 text-sm font-semibold text-white/90">
                  Context & Audit Trail
                </div>
                <Separator className="mb-3 bg-white/10" />
                <div className="grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-3">
                  <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                    <div className="text-white/50">Student</div>
                    <div className="mt-1 font-medium text-white/85">
                      {studentName || "—"}
                    </div>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                    <div className="text-white/50">Admission No.</div>
                    <div className="mt-1 font-medium text-white/85">
                      {p.studentId?.admissionNo || "—"}
                    </div>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                    <div className="text-white/50">Invoice</div>
                    <div className="mt-1 font-medium text-white/85">
                      {p.invoiceId?.invoiceNumber || "—"}
                    </div>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                    <div className="text-white/50">Academic Period</div>
                    <div className="mt-1 font-medium text-white/85">
                      {periodLabel}
                    </div>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                    <div className="text-white/50">Recorded By</div>
                    <div className="mt-1 font-medium text-white/85">
                      {userLabel(p.receivedBy)}
                    </div>
                    <div className="mt-1 text-[11px] text-white/50">
                      {fmtDateTime(p.createdAt)}
                    </div>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                    <div className="text-white/50">Reviewed By</div>
                    <div className="mt-1 font-medium text-white/85">
                      {userLabel(p.reviewedBy)}
                    </div>
                    <div className="mt-1 text-[11px] text-white/50">
                      {fmtDateTime(p.reviewedAt)}
                    </div>
                  </div>
                </div>
                {p.notes ? (
                  <div className="mt-3 rounded-lg border border-white/10 bg-black/20 p-3 text-xs">
                    <div className="text-white/50">Payment Notes</div>
                    <div className="mt-1 whitespace-pre-wrap text-white/75">
                      {p.notes}
                    </div>
                  </div>
                ) : null}
                {p.reviewNotes ? (
                  <div className="mt-3 rounded-lg border border-white/10 bg-black/20 p-3 text-xs">
                    <div className="text-white/50">Review Notes</div>
                    <div className="mt-1 whitespace-pre-wrap text-white/75">
                      {p.reviewNotes}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white/90">
                  <History className="h-4 w-4 text-white/70" />
                  Immutable Timeline
                </div>
                <Separator className="mb-3 bg-white/10" />
                {timeline.length > 0 ? (
                  <div className="space-y-2 text-xs">
                    {timeline.map((entry: any) => (
                      <div
                        key={entry._id}
                        className="rounded-lg border border-white/10 bg-black/20 px-3 py-2"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="font-medium text-white/85">
                            {entry.title || "Event"}
                          </div>
                          <div className="text-[11px] text-white/50">
                            {fmtDateTime(entry.createdAt)}
                          </div>
                        </div>
                        {entry.description ? (
                          <div className="mt-1 text-white/65">
                            {entry.description}
                          </div>
                        ) : null}
                        <div className="mt-1 text-[11px] text-white/45">
                          {entry.actorLabel || "System"}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-white/55">
                    No timeline events available for this payment yet.
                  </div>
                )}
              </div>

              {attachments.length ? (
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Paperclip className="h-4 w-4 text-white/70" />
                    Attachments
                  </div>
                  <div className="mt-3 space-y-2">
                    {attachments.map((a) => (
                      <a
                        key={a.url}
                        href={a.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block rounded-lg border border-white/10 bg-black/10 px-3 py-2 text-xs text-white/75 hover:border-white/20"
                      >
                        {a.label || "Proof"}{" "}
                        <span className="text-white/30">•</span>{" "}
                        <span className="text-muted-foreground">
                          {a.type || "file"}
                        </span>
                      </a>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold">Allocation</div>
                  <Badge
                    variant="outline"
                    className="border-white/10 bg-white/5 text-white/70"
                  >
                    {allocations.length
                      ? "Posted allocations"
                      : requested.length
                      ? "Requested allocations"
                      : "None"}
                  </Badge>
                </div>
                <Separator className="my-3 bg-white/10" />
                <div className="space-y-2 text-xs">
                  {allocationRows.length ? (
                    allocationRows.map((a: any, idx: number) => (
                      <div
                        key={a._id || idx}
                        className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/10 px-3 py-2"
                      >
                        <div className="text-white/75">
                          {a.invoiceLineItemId?.name || "Line item"}
                          {a.installmentNumber ? (
                            <span className="text-white/30"> • </span>
                          ) : null}
                          {a.installmentNumber ? (
                            <span className="text-muted-foreground">
                              Installment #{a.installmentNumber}
                            </span>
                          ) : null}
                        </div>
                        <div className="font-medium text-white/80">
                          {formatMoney(a.amountMinor)}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-muted-foreground">No allocations.</div>
                  )}
                </div>
              </div>

              {canApprove || canReverse ? (
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <AlertCircle className="h-4 w-4 text-white/70" />
                    Actions
                  </div>

                  <div className="mt-3 space-y-3">
                    <Textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Optional reviewer notes…"
                      className="min-h-[90px] border-white/10 bg-black/20"
                    />

                    {canApprove ? (
                      <div className="flex gap-2">
                        <Button
                          className="w-full"
                          variant="outline"
                          disabled={review.isPending}
                          onClick={() =>
                            review.mutate({
                              paymentId: p._id,
                              action: "approve_proof",
                              reviewNotes: notes || undefined,
                            })
                          }
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          Approve
                        </Button>
                        <Button
                          className="w-full"
                          variant="outline"
                          disabled={review.isPending}
                          onClick={() =>
                            review.mutate({
                              paymentId: p._id,
                              action: "reject_proof",
                              reviewNotes: notes || undefined,
                            })
                          }
                        >
                          <XCircle className="h-4 w-4" />
                          Reject
                        </Button>
                      </div>
                    ) : null}

                    {canReverse ? (
                      <div
                        className={cn(
                          "flex items-center justify-between gap-3",
                          canApprove ? "pt-3 border-t border-white/10" : ""
                        )}
                      >
                        <div className="text-xs text-muted-foreground">
                          Reverse creates an audit event and rolls back
                          allocations.
                        </div>
                        <Button
                          variant="outline"
                          disabled={review.isPending}
                          onClick={() =>
                            review.mutate({
                              paymentId: p._id,
                              action: "reverse",
                              reviewNotes: notes || undefined,
                            })
                          }
                        >
                          <Undo2 className="h-4 w-4" />
                          Reverse
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}

              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  className="border-white/15 bg-white/5 text-white hover:bg-white/10"
                  onClick={() => props.onOpenChange(false)}
                >
                  Close
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
