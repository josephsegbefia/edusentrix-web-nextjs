"use client";

import * as React from "react";
import { WorkspaceScope } from "@/components/theme/workspace-scope";
import { BarChart2, Loader2 } from "lucide-react";
import {
  LibraryBackLink,
  libraryGlassPanel,
  LibraryPageHeader,
  LibraryPageShell,
} from "@/components/admin/library/LibraryAdminChrome";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useLibraryCapabilitiesQuery, useLibraryReportQuery } from "@/hooks/admin/useLibraryAdmin";
import type { LibraryReportResult } from "@/lib/library/library-report.service";

const REPORT_TYPES: LibraryReportResult["type"][] = [
  "overdue",
  "most_borrowed",
  "inventory_value",
  "active_readers",
  "lost_damaged",
  "category_usage",
  "class_activity",
];

export default function AdminLibraryReportsPage() {
  const { data: capsRes } = useLibraryCapabilitiesQuery();
  const caps = capsRes?.data;
  const canView = caps?.reportsView ?? false;

  const [type, setType] = React.useState<LibraryReportResult["type"]>("most_borrowed");
  const [fromStr, setFromStr] = React.useState("");
  const [toStr, setToStr] = React.useState("");
  const [limit, setLimit] = React.useState("25");

  const params = React.useMemo(
    () => ({
      type,
      from: fromStr ? new Date(`${fromStr}T12:00:00.000Z`) : undefined,
      to: toStr ? new Date(`${toStr}T12:00:00.000Z`) : undefined,
      limit: Number(limit) || 25,
    }),
    [type, fromStr, toStr, limit]
  );

  const { data, isFetching, refetch } = useLibraryReportQuery(params, canView);

  const report = data?.data;

  return (
    <WorkspaceScope>
      <LibraryPageShell>
      <LibraryBackLink href="/admin/library" label="Library home" />
      <LibraryPageHeader
        icon={BarChart2}
        title="Library reports"
        description="Operational views: popular titles, inventory value, readers, and more."
      />

      {!canView ? (
        <p className="rounded-2xl border border-(--ws-line) bg-(--ws-fill) px-4 py-3 text-sm text-(--ws-fg-70)">
          You do not have permission to view library reports.
        </p>
      ) : null}

      {canView ? (
        <div className={`${libraryGlassPanel} space-y-4 p-5`}>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label className="text-(--ws-fg-80)">Report type</Label>
              <PremiumSelect
                value={type}
                onValueChange={(v) => setType(v as LibraryReportResult["type"])}
              >
                <PremiumSelectTrigger className="border-(--ws-line-strong) bg-(--ws-fill) text-(--ws-fg)">
                  <PremiumSelectValue />
                </PremiumSelectTrigger>
                <PremiumSelectContent>
                  {REPORT_TYPES.map((t) => (
                    <PremiumSelectItem key={t} value={t}>
                      {t.replace(/_/g, " ")}
                    </PremiumSelectItem>
                  ))}
                </PremiumSelectContent>
              </PremiumSelect>
            </div>
            <div className="space-y-2">
              <Label className="text-(--ws-fg-80)">From (optional)</Label>
              <Input
                type="date"
                value={fromStr}
                onChange={(e) => setFromStr(e.target.value)}
                className="border-(--ws-line-strong) bg-(--ws-fill) text-(--ws-fg)"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-(--ws-fg-80)">To (optional)</Label>
              <Input
                type="date"
                value={toStr}
                onChange={(e) => setToStr(e.target.value)}
                className="border-(--ws-line-strong) bg-(--ws-fill) text-(--ws-fg)"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-(--ws-fg-80)">Limit</Label>
              <Input
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
                className="border-(--ws-line-strong) bg-(--ws-fill) text-(--ws-fg)"
              />
            </div>
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={() => void refetch()}
            disabled={isFetching}
          >
            {isFetching ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading
              </>
            ) : (
              "Run report"
            )}
          </Button>

          <div className="overflow-x-auto rounded-xl border border-(--ws-line)">
            {report?.type === "most_borrowed" ? (
              <Table>
                <TableHeader>
                  <TableRow className="border-(--ws-line) hover:bg-transparent">
                    <TableHead className="text-(--ws-fg-70)">Title</TableHead>
                    <TableHead className="text-(--ws-fg-70)">Borrows</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.rows.map((r) => (
                    <TableRow key={r.bookId} className="border-(--ws-line)">
                      <TableCell className="text-(--ws-fg)">{r.title}</TableCell>
                      <TableCell className="text-(--ws-fg-80)">{r.borrowCount}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : null}

            {report?.type === "overdue" ? (
              <Table>
                <TableHeader>
                  <TableRow className="border-(--ws-line) hover:bg-transparent">
                    <TableHead className="text-(--ws-fg-70)">Title</TableHead>
                    <TableHead className="text-(--ws-fg-70)">Borrower</TableHead>
                    <TableHead className="text-(--ws-fg-70)">Days</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.items.map((r) => (
                    <TableRow key={r._id} className="border-(--ws-line)">
                      <TableCell className="text-(--ws-fg)">{r.book.title}</TableCell>
                      <TableCell className="text-(--ws-fg-80)">{r.borrower.name}</TableCell>
                      <TableCell className="text-(--ws-amber)">{r.daysOverdue}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : null}

            {report?.type === "inventory_value" ? (
              <div className="p-6 text-(--ws-fg-80)">
                <p>Copies with cost on file: {report.totalCopiesValued}</p>
                <p className="mt-2 text-lg font-semibold text-(--ws-fg)">
                  Estimated acquisition value: {report.estimatedValue.toFixed(2)}
                </p>
              </div>
            ) : null}

            {report?.type === "active_readers" ? (
              <Table>
                <TableHeader>
                  <TableRow className="border-(--ws-line) hover:bg-transparent">
                    <TableHead className="text-(--ws-fg-70)">Borrower</TableHead>
                    <TableHead className="text-(--ws-fg-70)">Loans</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.rows.map((r) => (
                    <TableRow
                      key={`${r.borrowerType}-${r.borrowerId}`}
                      className="border-(--ws-line)"
                    >
                      <TableCell className="text-(--ws-fg)">
                        {r.borrowerType} · {r.nameHint}
                      </TableCell>
                      <TableCell className="text-(--ws-fg-80)">{r.loanCount}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : null}

            {report?.type === "lost_damaged" ? (
              <div className="p-6 text-(--ws-fg-80) space-y-2">
                <p>Copies marked lost (rows): {report.lostCopies}</p>
                <p>Copies marked damaged (rows): {report.damagedCopies}</p>
                <p>Book counter — lost: {report.bookCounterLost}</p>
                <p>Book counter — damaged: {report.bookCounterDamaged}</p>
              </div>
            ) : null}

            {report?.type === "category_usage" ? (
              <Table>
                <TableHeader>
                  <TableRow className="border-(--ws-line) hover:bg-transparent">
                    <TableHead className="text-(--ws-fg-70)">Category</TableHead>
                    <TableHead className="text-(--ws-fg-70)">Loan events</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.rows.map((r) => (
                    <TableRow key={r.category} className="border-(--ws-line)">
                      <TableCell className="text-(--ws-fg)">{r.category}</TableCell>
                      <TableCell className="text-(--ws-fg-80)">{r.loanCount}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : null}

            {report?.type === "class_activity" ? (
              <Table>
                <TableHeader>
                  <TableRow className="border-(--ws-line) hover:bg-transparent">
                    <TableHead className="text-(--ws-fg-70)">Class</TableHead>
                    <TableHead className="text-(--ws-fg-70)">Loan events</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.rows.map((r) => (
                    <TableRow key={r.classGroupId} className="border-(--ws-line)">
                      <TableCell className="text-(--ws-fg)">{r.className}</TableCell>
                      <TableCell className="text-(--ws-fg-80)">{r.loanCount}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : null}

            {!report && !isFetching ? (
              <p className="p-6 text-sm text-(--ws-fg-50)">Run a report to see results here.</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </LibraryPageShell>
    </WorkspaceScope>
  );
}
