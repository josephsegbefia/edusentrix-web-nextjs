"use client";

import * as React from "react";
import { WorkspaceScope } from "@/components/theme/workspace-scope";
import { format } from "date-fns";
import { History, Loader2 } from "lucide-react";
import {
  LibraryBackLink,
  libraryGlassPanel,
  LibraryPageHeader,
  LibraryPageShell,
} from "@/components/admin/library/LibraryAdminChrome";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  useLibraryBorrowersSearch,
  useLibraryCapabilitiesQuery,
  useBorrowerHistoryQuery,
} from "@/hooks/admin/useLibraryAdmin";
import type { LibraryBorrowerSearchHit } from "@/lib/library/library-borrower.service";
import { Badge } from "@/components/ui/badge";

export default function AdminLibraryBorrowingHistoryPage() {
  const { data: capsRes } = useLibraryCapabilitiesQuery();
  const caps = capsRes?.data;
  const canRead = caps?.loansRead ?? false;

  const [q, setQ] = React.useState("");
  const enabled = q.trim().length >= 2;
  const { data: brRes, isFetching: brLoading } = useLibraryBorrowersSearch(
    q,
    "student,teacher,staff",
    12,
    enabled && canRead
  );
  const hits = brRes?.data?.items ?? [];

  const [selected, setSelected] = React.useState<LibraryBorrowerSearchHit | null>(null);
  const hist = useBorrowerHistoryQuery(
    selected?.borrowerType,
    selected?.borrowerId,
    1,
    40
  );
  const loans = hist.data?.data?.items ?? [];

  return (
    <WorkspaceScope>
      <LibraryPageShell>
      <LibraryBackLink href="/admin/library" label="Library home" />
      <LibraryPageHeader
        icon={History}
        title="Borrowing history"
        description="Search for a borrower, then view their loan timeline."
      />

      {!canRead ? (
        <p className="rounded-2xl border border-(--ws-line) bg-(--ws-fill) px-4 py-3 text-sm text-(--ws-fg-70)">
          You do not have permission to read loan history.
        </p>
      ) : null}

      {canRead ? (
        <div className="space-y-6">
          <section className={`${libraryGlassPanel} space-y-3 p-5`}>
            <Label className="text-(--ws-fg-80)">Find borrower</Label>
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Type at least 2 characters"
              className="border-(--ws-line-strong) bg-(--ws-fill) text-(--ws-fg)"
            />
            {brLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-(--ws-fg-40)" />
            ) : (
              <div className="flex max-h-40 flex-col gap-1 overflow-y-auto">
                {hits.map((h) => (
                  <button
                    key={`${h.borrowerType}:${h.borrowerId}`}
                    type="button"
                    className="rounded-lg border border-(--ws-line) px-3 py-2 text-left text-sm text-(--ws-fg-80) hover:bg-(--ws-fill)"
                    onClick={() => setSelected(h)}
                  >
                    <span className="font-medium text-(--ws-fg)">{h.name}</span>{" "}
                    <span className="text-(--ws-fg)/45">({h.borrowerType})</span>
                  </button>
                ))}
              </div>
            )}
            {selected ? (
              <div className="flex flex-wrap items-center gap-2 text-sm text-(--ws-fg)/75">
                <span>
                  Selected: <strong className="text-(--ws-fg)">{selected.name}</strong>
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-(--ws-fg)/55"
                  onClick={() => setSelected(null)}
                >
                  Clear
                </Button>
              </div>
            ) : null}
          </section>

          {selected ? (
            <section className={`${libraryGlassPanel} p-5`}>
              {hist.isLoading ? (
                <Loader2 className="h-6 w-6 animate-spin text-(--ws-fg-40)" />
              ) : loans.length === 0 ? (
                <p className="text-sm text-(--ws-fg-50)">No loans for this borrower.</p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-(--ws-line)">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-(--ws-line) hover:bg-transparent">
                        <TableHead className="text-(--ws-fg-70)">Title</TableHead>
                        <TableHead className="text-(--ws-fg-70)">Issued</TableHead>
                        <TableHead className="text-(--ws-fg-70)">Due</TableHead>
                        <TableHead className="text-(--ws-fg-70)">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loans.map((loan) => (
                        <TableRow key={loan._id} className="border-(--ws-line)">
                          <TableCell className="text-(--ws-fg)">{loan.book.title}</TableCell>
                          <TableCell className="text-xs text-(--ws-fg-60)">
                            {format(new Date(loan.issuedAt), "MMM d, yyyy")}
                          </TableCell>
                          <TableCell className="text-xs text-(--ws-fg-60)">
                            {format(new Date(loan.dueAt), "MMM d, yyyy")}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className="border-(--ws-line-strong) text-[10px] text-(--ws-fg-80)"
                            >
                              {loan.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </section>
          ) : null}
        </div>
      ) : null}
    </LibraryPageShell>
    </WorkspaceScope>
  );
}
