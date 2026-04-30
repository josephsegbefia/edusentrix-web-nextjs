"use client";

import * as React from "react";
import { format } from "date-fns";
import { Bookmark, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  LibraryBackLink,
  libraryGlassPanel,
  LibraryPageHeader,
  LibraryPageShell,
} from "@/components/admin/library/LibraryAdminChrome";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useLibraryCapabilitiesQuery,
  useLibraryReservationCancelMutation,
  useLibraryReservationCreateMutation,
  useLibraryReservationFulfillMutation,
  useLibraryReservationsQuery,
  useLibraryBorrowersSearch,
} from "@/hooks/admin/useLibraryAdmin";

export default function AdminLibraryReservationsPage() {
  const { data: capsRes } = useLibraryCapabilitiesQuery();
  const caps = capsRes?.data;
  const canRead = caps?.reservationsRead ?? false;
  const canManage = caps?.reservationsManage ?? false;

  const [page, setPage] = React.useState(1);
  const [statusFilter, setStatusFilter] = React.useState<
    "all" | "pending" | "ready" | "fulfilled" | "cancelled" | "expired"
  >("all");
  const listParams = React.useMemo(
    () => ({
      page,
      limit: 25,
      ...(statusFilter !== "all" ? { status: statusFilter } : {}),
    }),
    [page, statusFilter]
  );
  const listQ = useLibraryReservationsQuery(listParams, canRead);

  const createM = useLibraryReservationCreateMutation();
  const cancelM = useLibraryReservationCancelMutation();
  const fulfillM = useLibraryReservationFulfillMutation();

  const [bookId, setBookId] = React.useState("");
  const [borrowerType, setBorrowerType] = React.useState<"student" | "teacher" | "staff">(
    "student"
  );
  const [borrowerId, setBorrowerId] = React.useState("");
  const [borrowerSearchInput, setBorrowerSearchInput] = React.useState("");
  const [debouncedBorrowerQ, setDebouncedBorrowerQ] = React.useState("");
  const [selectedBorrowerHint, setSelectedBorrowerHint] = React.useState("");

  React.useEffect(() => {
    const t = window.setTimeout(() => setDebouncedBorrowerQ(borrowerSearchInput), 350);
    return () => window.clearTimeout(t);
  }, [borrowerSearchInput]);

  const borrowerSearchQ = useLibraryBorrowersSearch(
    debouncedBorrowerQ,
    "student,teacher,staff",
    12,
    Boolean(canManage && debouncedBorrowerQ.trim().length >= 2)
  );

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!bookId.trim() || !borrowerId.trim()) {
      toast.error("Enter a book id and choose a borrower (search or paste id below)");
      return;
    }
    try {
      await createM.mutateAsync({
        bookId: bookId.trim(),
        borrowerType,
        borrowerId: borrowerId.trim(),
      });
      toast.success("Reservation created");
      setBookId("");
      setBorrowerId("");
      setBorrowerSearchInput("");
      setSelectedBorrowerHint("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  const items = listQ.data?.data?.items ?? [];
  const pag = listQ.data?.data?.pagination;

  return (
    <LibraryPageShell>
      <LibraryBackLink href="/admin/library" label="Library home" />
      <LibraryPageHeader
        icon={Bookmark}
        title="Reservations"
        description="Hold queue by title. Ready holds can be checked out as loans if you can issue loans."
      />

      {!canRead ? (
        <p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">
          You do not have permission to view reservations.
        </p>
      ) : null}

      {canRead ? (
        <div className={`${libraryGlassPanel} space-y-4 p-5`}>
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <Label className="text-white/80">Status</Label>
              <PremiumSelect
                value={statusFilter}
                onValueChange={(v) => {
                  setStatusFilter(v as typeof statusFilter);
                  setPage(1);
                }}
              >
                <PremiumSelectTrigger className="w-[200px] border-white/15 bg-white/5 text-white">
                  <PremiumSelectValue />
                </PremiumSelectTrigger>
                <PremiumSelectContent>
                  <PremiumSelectItem value="all">All</PremiumSelectItem>
                  <PremiumSelectItem value="pending">Pending</PremiumSelectItem>
                  <PremiumSelectItem value="ready">Ready</PremiumSelectItem>
                  <PremiumSelectItem value="fulfilled">Fulfilled</PremiumSelectItem>
                  <PremiumSelectItem value="cancelled">Cancelled</PremiumSelectItem>
                  <PremiumSelectItem value="expired">Expired</PremiumSelectItem>
                </PremiumSelectContent>
              </PremiumSelect>
            </div>
          </div>

          {canManage ? (
            <form onSubmit={onCreate} className="grid gap-3 border-t border-white/10 pt-4 md:grid-cols-4">
              <div className="relative space-y-2 md:col-span-4">
                <Label className="text-white/80">Find borrower</Label>
                <Input
                  value={borrowerSearchInput}
                  onChange={(e) => setBorrowerSearchInput(e.target.value)}
                  placeholder="Type name — at least 2 characters"
                  className="border-white/15 bg-white/5 text-white"
                  autoComplete="off"
                />
                {borrowerSearchQ.data?.data?.items &&
                borrowerSearchQ.data.data.items.length > 0 &&
                debouncedBorrowerQ.trim().length >= 2 ? (
                  <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-white/15 bg-slate-950 py-1 shadow-lg">
                    {borrowerSearchQ.data.data.items.map((h) => (
                      <li key={`${h.borrowerType}-${h.borrowerId}`}>
                        <button
                          type="button"
                          className="w-full px-3 py-2 text-left text-sm text-white/90 hover:bg-white/10"
                          onClick={() => {
                            setBorrowerType(h.borrowerType);
                            setBorrowerId(h.borrowerId);
                            setSelectedBorrowerHint(`${h.name} (${h.borrowerType})`);
                            setBorrowerSearchInput("");
                          }}
                        >
                          <span className="font-medium">{h.name}</span>
                          <span className="ml-2 text-xs text-white/50">{h.borrowerType}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {selectedBorrowerHint ? (
                  <p className="text-xs text-emerald-200/80">Selected: {selectedBorrowerHint}</p>
                ) : null}
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label className="text-white/80">New hold — book id</Label>
                <Input
                  value={bookId}
                  onChange={(e) => setBookId(e.target.value)}
                  placeholder="Mongo id of the book"
                  className="border-white/15 bg-white/5 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-white/80">Borrower type</Label>
                <PremiumSelect
                  value={borrowerType}
                  onValueChange={(v) => setBorrowerType(v as typeof borrowerType)}
                >
                  <PremiumSelectTrigger className="border-white/15 bg-white/5 text-white">
                    <PremiumSelectValue />
                  </PremiumSelectTrigger>
                  <PremiumSelectContent>
                    <PremiumSelectItem value="student">Student</PremiumSelectItem>
                    <PremiumSelectItem value="teacher">Teacher</PremiumSelectItem>
                    <PremiumSelectItem value="staff">Staff</PremiumSelectItem>
                  </PremiumSelectContent>
                </PremiumSelect>
              </div>
              <div className="space-y-2">
                <Label className="text-white/80">Borrower id</Label>
                <Input
                  value={borrowerId}
                  onChange={(e) => setBorrowerId(e.target.value)}
                  placeholder="Student / teacher / user id"
                  className="border-white/15 bg-white/5 text-white"
                />
              </div>
              <div className="md:col-span-4">
                <Button type="submit" disabled={createM.isPending}>
                  {createM.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    "Create hold"
                  )}
                </Button>
              </div>
            </form>
          ) : null}

          {listQ.isLoading ? (
            <div className="flex items-center gap-2 py-8 text-white/60">
              <Loader2 className="h-5 w-5 animate-spin" /> Loading…
            </div>
          ) : items.length === 0 ? (
            <p className="py-6 text-sm text-white/55">No reservations match this filter.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-white/10 hover:bg-transparent">
                  <TableHead className="text-white/80">Book</TableHead>
                  <TableHead className="text-white/80">Patron</TableHead>
                  <TableHead className="text-white/80">Status</TableHead>
                  <TableHead className="text-white/80">Queue</TableHead>
                  <TableHead className="text-white/80">Copy</TableHead>
                  <TableHead className="text-white/80">Reserved</TableHead>
                  <TableHead className="text-right text-white/80">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((row) => (
                  <TableRow key={row.id} className="border-white/10 hover:bg-white/[0.03]">
                    <TableCell className="max-w-[180px]">
                      <div className="truncate font-medium text-white">{row.bookTitle}</div>
                      <div className="truncate text-xs text-white/45">{row.bookId}</div>
                    </TableCell>
                    <TableCell className="text-sm text-white/80">
                      <div>{row.borrowerName}</div>
                      <div className="text-xs text-white/45">
                        {row.borrowerType} · {row.borrowerId}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="border-white/20 text-[10px] text-white/85">
                        {row.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-white/75">{row.queuePosition}</TableCell>
                    <TableCell className="text-xs text-white/60">
                      {row.copyCode ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs text-white/60">
                      {format(new Date(row.reservedAt), "MMM d, yyyy HH:mm")}
                    </TableCell>
                    <TableCell className="text-right">
                      {canManage && (row.status === "pending" || row.status === "ready") ? (
                        <div className="flex flex-wrap justify-end gap-2">
                          {row.status === "ready" ? (
                            <Button
                              size="sm"
                              variant="secondary"
                              className="h-8"
                              disabled={fulfillM.isPending}
                              onClick={() => {
                                void (async () => {
                                  try {
                                    await fulfillM.mutateAsync(row.id);
                                    toast.success("Checked out from hold");
                                  } catch (err) {
                                    toast.error(err instanceof Error ? err.message : "Failed");
                                  }
                                })();
                              }}
                            >
                              Fulfill
                            </Button>
                          ) : null}
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 border-white/20 text-white"
                            disabled={cancelM.isPending}
                            onClick={() => {
                              void (async () => {
                                try {
                                  await cancelM.mutateAsync(row.id);
                                  toast.success("Hold cancelled");
                                } catch (err) {
                                  toast.error(err instanceof Error ? err.message : "Failed");
                                }
                              })();
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {pag && pag.totalPages > 1 ? (
            <div className="flex items-center justify-between gap-2 border-t border-white/10 pt-4 text-sm text-white/70">
              <span>
                Page {pag.page} of {pag.totalPages} ({pag.total} total)
              </span>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="border-white/20 text-white"
                  disabled={!pag.hasPreviousPage}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="border-white/20 text-white"
                  disabled={!pag.hasNextPage}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </LibraryPageShell>
  );
}
