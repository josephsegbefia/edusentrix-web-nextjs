"use client";

import * as React from "react";
import Link from "next/link";
import { format } from "date-fns";
import { AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  LibraryBackLink,
  libraryGlassPanel,
  LibraryPageHeader,
  LibraryPageShell,
} from "@/components/admin/library/LibraryAdminChrome";
import {
  useLibraryCapabilitiesQuery,
  useLibraryLoanMutations,
  useLibraryLoansQuery,
  useLibrarySendOverdueRemindersMutation,
} from "@/hooks/admin/useLibraryAdmin";
import { Badge } from "@/components/ui/badge";

export default function AdminLibraryOverduePage() {
  const { data: capsRes } = useLibraryCapabilitiesQuery();
  const caps = capsRes?.data;
  const canReadLoans = caps?.loansRead ?? false;
  const canWaive = caps?.finesWaive ?? false;

  const overdueQuery = useLibraryLoansQuery({
    page: 1,
    limit: 50,
    bucket: "overdue",
    sortBy: "dueAt",
    sortOrder: "asc",
  });
  const finesQuery = useLibraryLoansQuery({
    page: 1,
    limit: 50,
    bucket: "fines_pending",
    sortBy: "returnedAt",
    sortOrder: "desc",
  });

  const { waiveFine } = useLibraryLoanMutations();
  const sendReminders = useLibrarySendOverdueRemindersMutation();
  const overdue = overdueQuery.data?.data?.items ?? [];
  const pendingFines = finesQuery.data?.data?.items ?? [];

  async function doWaive(loanId: string) {
    try {
      await waiveFine.mutateAsync({ loanId, body: {} });
      toast.success("Fine waived");
      void finesQuery.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Waive failed");
    }
  }

  async function doSendReminders() {
    if (overdue.length === 0) return;
    try {
      const r = await sendReminders.mutateAsync({
        loanIds: overdue.map((l) => l._id).slice(0, 100),
      });
      toast.success(
        `Queued ${r.data?.enqueued ?? 0} notification(s); ${r.data?.skippedLoans ?? 0} loan(s) had no linked user`
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Reminders failed");
    }
  }

  return (
    <LibraryPageShell>
      <LibraryBackLink href="/admin/library" label="Library home" />
      <LibraryPageHeader
        icon={AlertTriangle}
        title="Overdue & fines"
        description="Open loans past their due date and closed loans with a pending fine."
      />

      {!canReadLoans ? (
        <p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">
          Your role does not include reading library loans. Ask a school admin to extend library
          delegation.
        </p>
      ) : null}

      {canReadLoans ? (
        <div className="space-y-8">
          <section className={`${libraryGlassPanel} space-y-4 p-5`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-amber-100">Open · overdue</h2>
              {overdue.length > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-amber-400/30 text-amber-100"
                  onClick={() => void doSendReminders()}
                  disabled={sendReminders.isPending}
                >
                  Send in-app reminders
                </Button>
              ) : null}
            </div>
            {overdueQuery.isLoading ? (
              <Loader2 className="h-6 w-6 animate-spin text-white/40" />
            ) : overdue.length === 0 ? (
              <p className="text-sm text-white/50">No overdue open loans.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-white/10">
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/10 hover:bg-transparent">
                      <TableHead className="text-white/70">Title</TableHead>
                      <TableHead className="text-white/70">Borrower</TableHead>
                      <TableHead className="text-white/70">Due</TableHead>
                      <TableHead className="text-white/70">Days</TableHead>
                      <TableHead className="text-right text-white/70">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {overdue.map((loan) => (
                      <TableRow key={loan._id} className="border-white/10 hover:bg-transparent">
                        <TableCell className="max-w-[200px] truncate font-medium text-white">
                          {loan.book.title}
                        </TableCell>
                        <TableCell className="text-sm text-white/75">
                          {loan.borrower.name}
                        </TableCell>
                        <TableCell className="text-xs text-white/60">
                          {format(new Date(loan.dueAt), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell className="text-xs text-amber-100/90">{loan.daysOverdue}d</TableCell>
                        <TableCell className="text-right">
                          <Button asChild size="sm" variant="outline" className="h-8 border-white/20 text-white">
                            <Link href="/admin/library/circulation">Circulation</Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </section>

          <section className={`${libraryGlassPanel} space-y-4 p-5`}>
            <h2 className="text-base font-semibold text-white">Pending fines</h2>
            {finesQuery.isLoading ? (
              <Loader2 className="h-6 w-6 animate-spin text-white/40" />
            ) : pendingFines.length === 0 ? (
              <p className="text-sm text-white/50">No pending fines.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-white/10">
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/10 hover:bg-transparent">
                      <TableHead className="text-white/70">Title</TableHead>
                      <TableHead className="text-white/70">Borrower</TableHead>
                      <TableHead className="text-white/70">Returned</TableHead>
                      <TableHead className="text-white/70">Fine</TableHead>
                      <TableHead className="text-right text-white/70">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingFines.map((loan) => (
                      <TableRow key={loan._id} className="border-white/10 hover:bg-transparent">
                        <TableCell className="max-w-[200px] truncate font-medium text-white">
                          {loan.book.title}
                        </TableCell>
                        <TableCell className="text-sm text-white/75">{loan.borrower.name}</TableCell>
                        <TableCell className="text-xs text-white/60">
                          {loan.returnedAt
                            ? format(new Date(loan.returnedAt), "MMM d, yyyy")
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm text-white">{loan.fineAmount.toFixed(2)}</span>
                            <Badge
                              variant="outline"
                              className="border-white/20 text-[10px] text-white/80"
                            >
                              {loan.fineStatus}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {canWaive ? (
                            <Button
                              size="sm"
                              variant="secondary"
                              className="h-8"
                              onClick={() => void doWaive(loan._id)}
                              disabled={waiveFine.isPending}
                            >
                              Waive
                            </Button>
                          ) : (
                            <span className="text-xs text-white/40">No waive access</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </section>
        </div>
      ) : null}
    </LibraryPageShell>
  );
}
