"use client";

import * as React from "react";
import Link from "next/link";
import {
  BookMarked,
  BookOpenCheck,
  ChevronRight,
  Clock3,
  Library,
  Loader2,
  Plus,
  Settings,
  TrendingUp,
  Warehouse,
  Banknote,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLibraryCapabilitiesQuery, useLibraryDashboardQuery } from "@/hooks/admin/useLibraryAdmin";
import { format } from "date-fns";
import {
  LibraryEmptyState,
  libraryGlassPanel,
  LibraryPageHeader,
  LibraryPageShell,
  LibraryStatCard,
} from "@/components/admin/library/LibraryAdminChrome";

export default function AdminLibraryDashboardPage() {
  const { data: dashRes, isLoading } = useLibraryDashboardQuery();
  const { data: capsRes } = useLibraryCapabilitiesQuery();
  const dash = dashRes?.data;
  const caps = capsRes?.data;

  const canSettings = caps?.settingsManage ?? false;
  const canCreateBook = caps?.booksCreate ?? false;
  const hasLoanRead = caps?.loansRead ?? false;
  const canNotices = caps?.noticesManage ?? false;
  const canReservations = caps?.reservationsRead ?? false;

  const stats = dash?.stats;

  return (
    <LibraryPageShell>
      <LibraryPageHeader
        icon={Library}
        title="Library"
        description="Catalogue titles, track copies, and run circulation from one workspace."
        actions={
          <>
            {canSettings ? (
              <Button
                asChild
                variant="outline"
                className="border-white/10 bg-white/5 text-white/80 hover:border-white/20 hover:bg-white/10 hover:text-white"
              >
                <Link href="/admin/library/settings">
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </Link>
              </Button>
            ) : null}
            {canCreateBook ? (
              <Button
                asChild
                className="bg-linear-to-r from-teal-500 to-cyan-600 text-white shadow-lg shadow-teal-500/25 hover:from-teal-600 hover:to-cyan-700"
              >
                <Link href="/admin/library/books/new">
                  <Plus className="mr-2 h-4 w-4" />
                  New book
                </Link>
              </Button>
            ) : null}
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
        <LibraryStatCard
          icon={BookOpenCheck}
          label="Active titles"
          value={
            isLoading ? (
              <Loader2 className="h-7 w-7 animate-spin text-white/40" />
            ) : (
              (stats?.totalBooks ?? 0)
            )
          }
          helper="Books in the active catalogue."
          tone="cyan"
        />
        <LibraryStatCard
          icon={Warehouse}
          label="Total copies"
          value={
            isLoading ? (
              <Loader2 className="h-7 w-7 animate-spin text-white/40" />
            ) : (
              (stats?.totalCopies ?? 0)
            )
          }
          helper="All inventory rows for active titles."
          tone="violet"
        />
        <LibraryStatCard
          icon={Clock3}
          label="Available now"
          value={
            isLoading ? (
              <Loader2 className="h-7 w-7 animate-spin text-white/40" />
            ) : (
              (stats?.availableCopies ?? 0)
            )
          }
          helper="Copies ready to issue."
          tone="emerald"
        />
        <LibraryStatCard
          icon={Clock3}
          label="Overdue loans"
          value={
            isLoading ? (
              <Loader2 className="h-7 w-7 animate-spin text-white/40" />
            ) : (
              (stats?.overdueLoans ?? 0)
            )
          }
          helper="Open loans past due date."
          tone="amber"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
        <LibraryStatCard
          icon={TrendingUp}
          label="Loans (all time)"
          value={
            isLoading ? (
              <Loader2 className="h-7 w-7 animate-spin text-white/40" />
            ) : (
              (stats?.totalLoansAllTime ?? 0)
            )
          }
          helper="Historical loan records for this school."
          tone="violet"
        />
        <LibraryStatCard
          icon={Banknote}
          label="Pending fines"
          value={
            isLoading ? (
              <Loader2 className="h-7 w-7 animate-spin text-white/40" />
            ) : (
              (stats?.pendingFinesTotal ?? 0).toFixed(2)
            )
          }
          helper="Sum of outstanding fine amounts on closed loans."
          tone="amber"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <Card className={libraryGlassPanel}>
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,var(--tw-gradient-stops))] from-cyan-500/5 via-transparent to-transparent"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/15 to-transparent"
            aria-hidden="true"
          />
          <CardHeader className="relative z-10 flex flex-row items-center justify-between border-b border-white/5 pb-4">
            <CardTitle className="text-base text-white">Recently issued</CardTitle>
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="text-white/70 hover:bg-white/5 hover:text-white"
            >
              <Link href="/admin/library/circulation">Circulation</Link>
            </Button>
          </CardHeader>
          <CardContent className="relative z-10">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-white/40" />
              </div>
            ) : !hasLoanRead || !(dash?.recentLoans?.length) ? (
              <LibraryEmptyState
                title={hasLoanRead ? "No loan activity yet" : "Loans hidden"}
                description={
                  hasLoanRead
                    ? "Issue a copy from Circulation to see recent activity here."
                    : "Your library access does not include reading loan records."
                }
                action={
                  hasLoanRead ? (
                    <Button
                      asChild
                      className="bg-linear-to-r from-teal-500 to-cyan-600 text-white shadow-lg shadow-teal-500/25 hover:from-teal-600 hover:to-cyan-700"
                    >
                      <Link href="/admin/library/circulation">Open circulation</Link>
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <ul className="divide-y divide-white/10">
                {dash!.recentLoans.slice(0, 8).map((loan) => (
                  <li key={loan._id}>
                    <div className="flex flex-wrap items-center gap-3 py-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-cyan-300/15 bg-cyan-400/10">
                        <BookMarked className="h-4 w-4 text-cyan-200" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-white">{loan.book.title}</p>
                        <p className="text-xs text-white/50">
                          {loan.borrower.name} · {loan.copy.copyCode} · Due{" "}
                          {format(new Date(loan.dueAt), "MMM d")}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className="border-white/20 text-[10px] text-white/80"
                      >
                        {loan.status}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className={libraryGlassPanel}>
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,var(--tw-gradient-stops))] from-teal-500/5 via-transparent to-transparent"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/15 to-transparent"
            aria-hidden="true"
          />
          <CardHeader className="relative z-10 border-b border-white/5">
            <CardTitle className="text-base text-white">Quick actions</CardTitle>
          </CardHeader>
          <CardContent className="relative z-10 flex flex-col gap-2 text-sm">
            <Link
              href="/admin/library/books"
              className="rounded-lg border border-white/10 px-3 py-2 text-white/80 transition-colors hover:border-white/20 hover:bg-white/5"
            >
              All books — search, filter, open a title
            </Link>
            <Link
              href="/admin/library/circulation"
              className="rounded-lg border border-white/10 px-3 py-2 text-white/80 transition-colors hover:border-white/20 hover:bg-white/5"
            >
              Circulation — issue, return, renew
            </Link>
            {hasLoanRead ? (
              <Link
                href="/admin/library/overdue"
                className="rounded-lg border border-amber-400/20 px-3 py-2 text-amber-100/90 transition-colors hover:border-amber-400/35 hover:bg-amber-400/10"
              >
                Overdue & fines — follow up and waive
              </Link>
            ) : null}
            {caps?.reportsView ? (
              <Link
                href="/admin/library/reports"
                className="rounded-lg border border-white/10 px-3 py-2 text-white/80 transition-colors hover:border-white/20 hover:bg-white/5"
              >
                Reports — circulation and inventory insights
              </Link>
            ) : null}
            {canCreateBook ? (
              <Link
                href="/admin/library/imports"
                className="rounded-lg border border-white/10 px-3 py-2 text-white/80 transition-colors hover:border-white/20 hover:bg-white/5"
              >
                CSV import — bulk books and copies
              </Link>
            ) : null}
            {hasLoanRead ? (
              <Link
                href="/admin/library/history"
                className="rounded-lg border border-white/10 px-3 py-2 text-white/80 transition-colors hover:border-white/20 hover:bg-white/5"
              >
                Borrowing history — by student, teacher, or staff
              </Link>
            ) : null}
            {canReservations ? (
              <Link
                href="/admin/library/reservations"
                className="rounded-lg border border-white/10 px-3 py-2 text-white/80 transition-colors hover:border-white/20 hover:bg-white/5"
              >
                Reservations — holds and pickup queue
              </Link>
            ) : null}
            {canNotices ? (
              <Link
                href="/admin/communications"
                className="rounded-lg border border-white/10 px-3 py-2 text-white/80 transition-colors hover:border-white/20 hover:bg-white/5"
              >
                Communications — notices and announcements
              </Link>
            ) : null}
            {canSettings ? (
              <Link
                href="/admin/library/settings"
                className="rounded-lg border border-white/10 px-3 py-2 text-white/80 transition-colors hover:border-white/20 hover:bg-white/5"
              >
                Loan defaults, limits, reminders
              </Link>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {hasLoanRead && dash?.overdue && dash.overdue.length > 0 ? (
        <Card className={libraryGlassPanel}>
          <CardHeader className="relative z-10 border-b border-white/5">
            <CardTitle className="text-base text-amber-100">Attention: overdue</CardTitle>
          </CardHeader>
          <CardContent className="relative z-10">
            <ul className="divide-y divide-white/10">
              {dash.overdue.slice(0, 6).map((loan) => (
                <li key={loan._id} className="py-3">
                  <Link
                    href="/admin/library/overdue"
                    className="flex flex-wrap items-center gap-3 transition-colors hover:text-white"
                  >
                    <span className="font-medium text-white">{loan.book.title}</span>
                    <span className="text-xs text-white/50">
                      {loan.borrower.name} · {loan.daysOverdue}d overdue
                    </span>
                    <ChevronRight className="ml-auto h-4 w-4 text-white/30" />
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </LibraryPageShell>
  );
}
