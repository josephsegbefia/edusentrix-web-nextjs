/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import * as React from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { formatMoney } from "@/lib/fees/money";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  CheckCircle2,
  XCircle,
  Undo2,
  Paperclip,
  ReceiptText,
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
  return (
    <Badge
      className="border-white/10 bg-white/5 text-white/70"
      variant="outline"
    >
      Posted
    </Badge>
  );
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

  const canApprove = p?.approvalStatus === "pending" && p?.status === "pending";
  const canReverse =
    p?.status === "completed" && p?.approvalStatus !== "pending";

  return (
    <Sheet open={props.open} onOpenChange={props.onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl border-white/10 bg-black/60 backdrop-blur">
        <SheetHeader>
          <SheetTitle className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2">
              <ReceiptText className="h-5 w-5 text-white/70" />
              Payment details
            </span>
            {p ? statusBadge(p) : null}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-4">
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
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-white/85">
                      {formatMoney(p.amountMinor)}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Method:{" "}
                      <span className="text-white/70">
                        {String(p.paymentMethod).replaceAll("_", " ")}
                      </span>
                      <span className="text-white/30"> • </span>
                      Receipt:{" "}
                      <span className="text-white/70">
                        {p.receiptNumber || "—"}
                      </span>
                    </div>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    {new Intl.DateTimeFormat(undefined, {
                      year: "numeric",
                      month: "short",
                      day: "2-digit",
                    }).format(new Date(p.paymentDate))}
                  </div>
                </div>

                {p.notes ? (
                  <div className="mt-3 text-xs text-muted-foreground">
                    Notes: <span className="text-white/70">{p.notes}</span>
                  </div>
                ) : null}
              </div>

              {p.attachments?.length ? (
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Paperclip className="h-4 w-4 text-white/70" />
                    Attachments
                  </div>
                  <div className="mt-3 space-y-2">
                    {p.attachments.map((a: any) => (
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
                  {(allocations.length ? allocations : requested).length ? (
                    (allocations.length ? allocations : requested).map(
                      (a: any, idx: number) => (
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
                      )
                    )
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
                    {canApprove ? (
                      <>
                        <Textarea
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="Optional reviewer notes…"
                          className="min-h-[90px] border-white/10 bg-black/20"
                        />
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
                      </>
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
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
