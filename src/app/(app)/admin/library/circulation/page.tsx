"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { BookOpenCheck, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  LibraryBackLink,
  libraryGlassPanel,
  LibraryPageHeader,
  LibraryPageShell,
} from "@/components/admin/library/LibraryAdminChrome";
import {
  useLibraryBooksQuery,
  useLibraryBorrowersSearch,
  useLibraryCapabilitiesQuery,
  useLibraryCopiesQuery,
  useLibraryLoanMutations,
  useLibraryLoansQuery,
  useLibrarySettingsQuery,
} from "@/hooks/admin/useLibraryAdmin";
import type { LibraryBorrowerSearchHit } from "@/lib/library/library-borrower.service";
import { Badge } from "@/components/ui/badge";
import type { LibraryLoanListDTO } from "@/lib/library/library.serialize";

type LoanReturnMutation = ReturnType<typeof useLibraryLoanMutations>["returnLoan"];
type LoanRenewMutation = ReturnType<typeof useLibraryLoanMutations>["renewLoan"];
type LoanMarkLostMutation = ReturnType<typeof useLibraryLoanMutations>["markLoanLost"];
type LoanMarkDamagedMutation = ReturnType<typeof useLibraryLoanMutations>["markLoanDamaged"];

export default function AdminLibraryCirculationPage() {
  const searchParams = useSearchParams();
  const bookIdFromUrl = searchParams.get("bookId");
  const copyIdFromUrl = searchParams.get("copyId");

  const { data: capsRes } = useLibraryCapabilitiesQuery();
  const caps = capsRes?.data;
  const canIssue = caps?.loansIssue ?? false;
  const canReturn = caps?.loansReturn ?? false;
  const canRenew = caps?.loansRenew ?? false;
  const canMarkLost = caps?.loansMarkLost ?? false;
  const canMarkDamaged = caps?.loansMarkDamaged ?? false;
  const canRead = caps?.loansRead ?? false;

  const { data: settingsRes } = useLibrarySettingsQuery();
  const settings = settingsRes?.data;

  const [borrowerQ, setBorrowerQ] = React.useState("");
  const borrowerEnabled = borrowerQ.trim().length >= 2;
  const { data: brRes, isFetching: brLoading } = useLibraryBorrowersSearch(
    borrowerQ,
    "student,teacher,staff",
    14,
    borrowerEnabled
  );
  const borrowerHits = brRes?.data?.items ?? [];

  const [borrower, setBorrower] = React.useState<LibraryBorrowerSearchHit | null>(null);

  const [catalogSearch, setCatalogSearch] = React.useState("");
  const { data: booksRes, isLoading: booksLoading } = useLibraryBooksQuery({
    page: 1,
    limit: 20,
    search: catalogSearch.trim() || undefined,
    status: "active",
    sortBy: "title",
    sortOrder: "asc",
  });
  const catalogBooks = booksRes?.data?.items ?? [];

  const [bookId, setBookId] = React.useState("");
  const { data: copiesRes, isLoading: copiesLoading } = useLibraryCopiesQuery(
    bookId || undefined,
    false
  );
  const copies = copiesRes?.data?.items ?? [];
  const availableCopies = copies.filter((c) => c.status === "available");

  const [copyId, setCopyId] = React.useState("");
  const [dueDateStr, setDueDateStr] = React.useState("");
  const [lookupCode, setLookupCode] = React.useState("");
  const [lookupLoading, setLookupLoading] = React.useState(false);

  React.useEffect(() => {
    if (bookIdFromUrl) setBookId(bookIdFromUrl);
    if (copyIdFromUrl) setCopyId(copyIdFromUrl);
  }, [bookIdFromUrl, copyIdFromUrl]);

  React.useEffect(() => {
    if (!borrower || !settings) return;
    const days =
      borrower.borrowerType === "student"
        ? Number(settings.defaultLoanDaysStudent)
        : borrower.borrowerType === "teacher"
          ? Number(settings.defaultLoanDaysTeacher)
          : Number(settings.defaultLoanDaysStaff);
    const d = new Date();
    d.setDate(d.getDate() + Math.max(1, days || 14));
    setDueDateStr(d.toISOString().slice(0, 10));
  }, [borrower, settings]);

  React.useEffect(() => {
    setCopyId("");
  }, [bookId]);

  const { issueLoan, returnLoan, renewLoan, markLoanLost, markLoanDamaged } =
    useLibraryLoanMutations();

  async function runCopyLookup() {
    const raw = lookupCode.trim();
    if (!raw) {
      toast.error("Enter a copy code, barcode, or QR value");
      return;
    }
    setLookupLoading(true);
    try {
      const res = await fetch(
        `/api/admin/library/copies/lookup?code=${encodeURIComponent(raw)}`,
        { cache: "no-store" }
      );
      const json = (await res.json()) as {
        success?: boolean;
        error?: { message?: string };
        data?: {
          copy?: { id: string; bookId: string; status: string };
          book?: { id: string; title: string };
        };
      };
      if (!res.ok) throw new Error(json?.error?.message || "Lookup failed");
      const copy = json.data?.copy;
      const book = json.data?.book;
      if (!copy || !book) throw new Error("Invalid lookup response");
      setBookId(book.id);
      setCopyId(copy.id);
      setCatalogSearch(book.title ?? "");
      setLookupCode("");
      if (copy.status !== "available") {
        toast.message(`Selected ${book.title} — copy is ${copy.status}`, {
          description: "Issue is only available when the copy is on the shelf (available).",
        });
      } else {
        toast.success(`Selected ${book.title}`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Lookup failed");
    } finally {
      setLookupLoading(false);
    }
  }

  const loansQuery = useLibraryLoansQuery({
    page: 1,
    limit: 30,
    bucket: "open",
    sortBy: "dueAt",
    sortOrder: "asc",
  });
  const openLoans = loansQuery.data?.data?.items ?? [];

  async function submitIssue() {
    if (!borrower || !bookId || !copyId || !dueDateStr) {
      toast.error("Choose borrower, book, copy, and due date");
      return;
    }
    try {
      await issueLoan.mutateAsync({
        bookId,
        bookCopyId: copyId,
        borrowerType: borrower.borrowerType,
        borrowerId: borrower.borrowerId,
        dueAt: new Date(`${dueDateStr}T12:00:00.000Z`),
      });
      toast.success("Loan issued");
      setCopyId("");
      void loansQuery.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Issue failed");
    }
  }

  return (
    <LibraryPageShell>
      <LibraryBackLink href="/admin/library" label="Library home" />
      <LibraryPageHeader
        icon={RefreshCw}
        title="Circulation"
        description="Issue copies to borrowers, track open loans, return and renew in place."
      />

      {!canRead ? (
        <p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">
          Your role does not include reading library loans. Ask a school admin to extend library
          delegation.
        </p>
      ) : null}

      {canRead ? (
        <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <section className={`${libraryGlassPanel} space-y-4 p-5`}>
            <div className="flex items-center gap-2">
              <BookOpenCheck className="h-5 w-5 text-cyan-200" />
              <h2 className="text-base font-semibold text-white">Issue a copy</h2>
            </div>
            {!canIssue ? (
              <p className="text-sm text-white/50">You do not have permission to issue loans.</p>
            ) : (
              <>
                <div className="space-y-2 border-b border-white/10 pb-4">
                  <Label className="text-white/80">Scan or enter copy code</Label>
                  <div className="flex flex-wrap gap-2">
                    <Input
                      value={lookupCode}
                      onChange={(e) => setLookupCode(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void runCopyLookup();
                      }}
                      placeholder="Copy code, barcode, or EDU:… value"
                      className="min-w-[200px] flex-1 border-white/15 bg-white/[0.05] text-white"
                      autoComplete="off"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      className="bg-white/10 text-white hover:bg-white/15"
                      disabled={lookupLoading}
                      onClick={() => void runCopyLookup()}
                    >
                      {lookupLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Lookup"
                      )}
                    </Button>
                  </div>
                  <p className="text-[11px] text-white/40">
                    Keyboard wedges usually send Enter after the scan — same as Lookup.{" "}
                    <Link href="/admin/library/scan" className="text-cyan-200/90 hover:underline">
                      Full-screen scan helper
                    </Link>
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="text-white/80">Find borrower</Label>
                  <Input
                    value={borrowerQ}
                    onChange={(e) => setBorrowerQ(e.target.value)}
                    placeholder="Type at least 2 characters"
                    className="border-white/15 bg-white/[0.05] text-white"
                  />
                  {borrower ? (
                    <div className="flex flex-wrap items-center gap-2 text-sm text-white/80">
                      <span>
                        Selected: <strong className="text-white">{borrower.name}</strong> (
                        {borrower.borrowerType})
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-white/60 hover:text-white"
                        onClick={() => setBorrower(null)}
                      >
                        Clear
                      </Button>
                    </div>
                  ) : null}
                  {brLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin text-white/40" />
                  ) : (
                    <div className="flex max-h-36 flex-col gap-1 overflow-y-auto">
                      {borrowerHits.map((h) => (
                        <button
                          key={`${h.borrowerType}:${h.borrowerId}`}
                          type="button"
                          className="rounded-lg border border-white/10 px-3 py-2 text-left text-sm text-white/80 hover:border-cyan-300/30 hover:bg-white/5"
                          onClick={() => setBorrower(h)}
                        >
                          {h.name}{" "}
                          <span className="text-xs text-white/40">({h.borrowerType})</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-white/80">Catalogue search</Label>
                  <Input
                  value={catalogSearch}
                  onChange={(e) => setCatalogSearch(e.target.value)}
                  placeholder="Search books…"
                  className="border-white/15 bg-white/[0.05] text-white"
                  />
                  {booksLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin text-white/40" />
                  ) : (
                    <div className="flex max-h-36 flex-col gap-1 overflow-y-auto">
                      {catalogBooks.map((b) => (
                        <button
                          key={b.id}
                          type="button"
                          className={`rounded-lg border px-3 py-2 text-left text-sm ${
                            bookId === b.id
                              ? "border-cyan-400/40 bg-cyan-500/10 text-white"
                              : "border-white/10 text-white/80 hover:border-white/20 hover:bg-white/5"
                          }`}
                          onClick={() => setBookId(b.id)}
                        >
                          {b.title}{" "}
                          <span className="text-xs text-white/40">
                            · {b.availableCopies} available
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-white/80">Available copy</Label>
                    {copiesLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin text-white/40" />
                    ) : (
                      <PremiumSelect
                        value={copyId}
                        onValueChange={setCopyId}
                        disabled={!bookId || availableCopies.length === 0}
                      >
                        <PremiumSelectTrigger className="border-white/15 bg-white/[0.05] text-white">
                          <PremiumSelectValue placeholder="Select copy" />
                        </PremiumSelectTrigger>
                        <PremiumSelectContent>
                          {availableCopies.map((c) => (
                            <PremiumSelectItem key={c.id} value={c.id}>
                              {c.copyCode} ({c.condition})
                            </PremiumSelectItem>
                          ))}
                        </PremiumSelectContent>
                      </PremiumSelect>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-white/80">Due date</Label>
                    <Input
                      type="date"
                      value={dueDateStr}
                      onChange={(e) => setDueDateStr(e.target.value)}
                      className="border-white/15 bg-white/[0.05] text-white"
                    />
                  </div>
                </div>

                <Button
                  type="button"
                  className="bg-linear-to-r from-teal-500 to-cyan-600 text-white shadow-lg shadow-teal-500/25 hover:from-teal-600 hover:to-cyan-700"
                  onClick={() => void submitIssue()}
                  disabled={issueLoan.isPending}
                >
                  {issueLoan.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Issue loan
                </Button>
              </>
            )}
          </section>

          <section className={`${libraryGlassPanel} space-y-4 p-5`}>
            <h2 className="text-base font-semibold text-white">Open loans</h2>
            {loansQuery.isLoading ? (
              <Loader2 className="h-6 w-6 animate-spin text-white/40" />
            ) : openLoans.length === 0 ? (
              <p className="text-sm text-white/50">No open loans.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-white/10">
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/10 hover:bg-transparent">
                      <TableHead className="text-white/70">Title</TableHead>
                      <TableHead className="text-white/70">Borrower</TableHead>
                      <TableHead className="text-white/70">Due</TableHead>
                      <TableHead className="text-white/70">Status</TableHead>
                      <TableHead className="text-right text-white/70">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {openLoans.map((loan) => (
                      <OpenLoanRow
                        key={loan._id}
                        loan={loan}
                        canReturn={canReturn}
                        canMarkLost={canMarkLost}
                        canMarkDamaged={canMarkDamaged}
                        canRenew={canRenew}
                        settings={settings}
                        onReturn={returnLoan}
                        onRenew={renewLoan}
                        onMarkLost={markLoanLost}
                        onMarkDamaged={markLoanDamaged}
                        onDone={() => void loansQuery.refetch()}
                      />
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </section>
        </div>
      ) : null}

      <p className="text-center text-xs text-white/40">
        Need another title?{" "}
        <Link href="/admin/library/books" className="text-cyan-200 underline-offset-4 hover:underline">
          Browse books
        </Link>
      </p>
    </LibraryPageShell>
  );
}

function OpenLoanRow({
  loan,
  canReturn,
  canMarkLost,
  canMarkDamaged,
  canRenew,
  settings,
  onReturn,
  onRenew,
  onMarkLost,
  onMarkDamaged,
  onDone,
}: {
  loan: LibraryLoanListDTO;
  canReturn: boolean;
  canMarkLost: boolean;
  canMarkDamaged: boolean;
  canRenew: boolean;
  settings: Record<string, unknown> | undefined;
  onReturn: LoanReturnMutation;
  onRenew: LoanRenewMutation;
  onMarkLost: LoanMarkLostMutation;
  onMarkDamaged: LoanMarkDamagedMutation;
  onDone: () => void;
}) {
  const [returnCond, setReturnCond] = React.useState<
    "new" | "good" | "fair" | "damaged" | "lost"
  >("good");

  const maxRenewals = settings ? Number(settings.maxRenewals) : 0;
  const renewalDays = settings ? Number(settings.renewalDays) : 7;
  const canRenewThis =
    canRenew &&
    Boolean(settings && settings.allowRenewals) &&
    loan.renewalCount < maxRenewals;
  const markOnly = !canReturn && (canMarkLost || canMarkDamaged);

  async function doReturn() {
    try {
      await onReturn.mutateAsync({
        loanId: loan._id,
        body: { returnCondition: returnCond, createFeeCharge: false },
      });
      toast.success("Copy returned");
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Return failed");
    }
  }

  async function doMarkLost() {
    try {
      await onMarkLost.mutateAsync({
        loanId: loan._id,
        body: { createFeeCharge: false },
      });
      toast.success("Marked lost");
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    }
  }

  async function doMarkDamaged() {
    try {
      await onMarkDamaged.mutateAsync({
        loanId: loan._id,
        body: { createFeeCharge: false },
      });
      toast.success("Marked damaged");
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    }
  }

  async function doRenew() {
    const next = new Date(loan.dueAt);
    next.setDate(next.getDate() + Math.max(1, renewalDays || 7));
    try {
      await onRenew.mutateAsync({
        loanId: loan._id,
        body: { newDueAt: next },
      });
      toast.success("Loan renewed");
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Renew failed");
    }
  }

  return (
    <TableRow className="border-white/10 hover:bg-transparent">
      <TableCell className="max-w-[160px] truncate font-medium text-white">
        {loan.book.title}
      </TableCell>
      <TableCell className="text-sm text-white/75">
        {loan.borrower.name}
        <span className="ml-1 text-xs text-white/40">({loan.borrower.type})</span>
      </TableCell>
      <TableCell className="text-xs text-white/60">
        {format(new Date(loan.dueAt), "MMM d, yyyy")}
      </TableCell>
      <TableCell>
        <Badge variant="outline" className="border-white/20 text-[10px] text-white/80">
          {loan.status}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex flex-wrap items-center justify-end gap-2">
          {canReturn ? (
            <>
              <PremiumSelect value={returnCond} onValueChange={(v) => setReturnCond(v as typeof returnCond)}>
                <PremiumSelectTrigger className="h-8 w-[110px] border-white/15 bg-white/[0.05] text-white text-xs">
                  <PremiumSelectValue />
                </PremiumSelectTrigger>
                <PremiumSelectContent>
                  <PremiumSelectItem value="good">Good</PremiumSelectItem>
                  <PremiumSelectItem value="fair">Fair</PremiumSelectItem>
                  <PremiumSelectItem value="damaged">Damaged</PremiumSelectItem>
                  <PremiumSelectItem value="lost">Lost</PremiumSelectItem>
                </PremiumSelectContent>
              </PremiumSelect>
              <Button
                size="sm"
                variant="outline"
                className="h-8 border-white/20 text-white"
                onClick={() => void doReturn()}
                disabled={onReturn.isPending}
              >
                Return
              </Button>
            </>
          ) : null}
          {markOnly && canMarkLost ? (
            <Button
              size="sm"
              variant="outline"
              className="h-8 border-amber-400/30 text-amber-100"
              onClick={() => void doMarkLost()}
              disabled={onMarkLost.isPending}
            >
              Mark lost
            </Button>
          ) : null}
          {markOnly && canMarkDamaged ? (
            <Button
              size="sm"
              variant="outline"
              className="h-8 border-orange-400/30 text-orange-100"
              onClick={() => void doMarkDamaged()}
              disabled={onMarkDamaged.isPending}
            >
              Mark damaged
            </Button>
          ) : null}
          {canRenewThis ? (
            <Button
              size="sm"
              variant="secondary"
              className="h-8"
              onClick={() => void doRenew()}
              disabled={onRenew.isPending}
            >
              Renew
            </Button>
          ) : null}
        </div>
      </TableCell>
    </TableRow>
  );
}
