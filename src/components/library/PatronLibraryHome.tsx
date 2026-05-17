"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { format } from "date-fns";
import {
  BookMarked,
  BookOpen,
  BookOpenCheck,
  Bookmark,
  ChevronRight,
  Library,
  Loader2,
  Search,
  Sparkles,
  Warehouse,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  LibraryEmptyState,
  LibraryPageHeader,
  LibraryPageShell,
  LibraryStatCard,
  libraryGlassPanel,
} from "@/components/admin/library/LibraryAdminChrome";

type PatronRole = "student" | "teacher" | "parent";

type PatronBook = {
  id: string;
  title: string;
  author?: string;
  coverImageUrl?: string;
  availableCopies: number;
  totalCopies: number;
};

type LoanRow = {
  _id: string;
  book: { title: string };
  borrower?: { name: string };
  dueAt: string;
  status: string;
  daysOverdue: number;
};

type HoldRow = {
  id: string;
  bookId: string;
  bookTitle: string;
  status: string;
  queuePosition?: number;
  borrowerName?: string;
};

type Ward = { id: string; firstName: string; lastName: string };

const copy: Record<
  PatronRole,
  {
    title: string;
    description: string;
    shelfTitle: string;
    recTitle: string;
    recEmpty: string;
    noLoans: string;
    noHolds: string;
  }
> = {
  student: {
    title: "School library",
    description: "Browse the catalogue, track loans, and see announcements from your librarian.",
    shelfTitle: "My shelf",
    recTitle: "Leo picks for you",
    recEmpty: "Borrow a few titles with subjects you enjoy and similar books will appear here.",
    noLoans: "No borrowing history yet.",
    noHolds: "No active reservations. Reserve a title from its detail page.",
  },
  teacher: {
    title: "Library catalogue",
    description: "Browse available titles, manage reservations, and follow your current loans.",
    shelfTitle: "My shelf",
    recTitle: "Leo picks for you",
    recEmpty: "Borrow a few titles with subjects you enjoy and similar books will appear here.",
    noLoans: "No loans on your account.",
    noHolds: "No active reservations. Reserve a title from its detail page.",
  },
  parent: {
    title: "School library",
    description: "See your children\u2019s loans, manage holds, and browse the shared catalogue.",
    shelfTitle: "Family shelf",
    recTitle: "Leo picks for your family",
    recEmpty: "Once your children borrow a few books, similar titles will appear here.",
    noLoans: "No open loans right now.",
    noHolds: "No active reservations for your children.",
  },
};

function PanelChrome({ children, corner = "top" }: { children: React.ReactNode; corner?: "top" | "bottom" }) {
  return (
    <>
      <div
        className={
          corner === "top"
            ? "pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,var(--tw-gradient-stops))] from-cyan-500/5 via-transparent to-transparent"
            : "pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,var(--tw-gradient-stops))] from-cyan-500/5 via-transparent to-transparent"
        }
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/15 to-transparent"
        aria-hidden="true"
      />
      {children}
    </>
  );
}

function BookTile({ book, href }: { book: PatronBook; href: string }) {
  return (
    <Link
      href={href}
      className="flex min-h-[92px] gap-3 rounded-lg border border-white/10 bg-black/25 p-3 transition-colors hover:border-cyan-400/30 hover:bg-black/35"
    >
      <div className="relative h-16 w-12 shrink-0 overflow-hidden rounded-md bg-white/10">
        {book.coverImageUrl ? (
          <Image src={book.coverImageUrl} alt="" width={48} height={64} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center">
            <BookOpen className="h-6 w-6 text-white/30" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-white">{book.title}</p>
        {book.author ? <p className="truncate text-sm text-white/55">{book.author}</p> : null}
        <p className="mt-1 text-xs text-emerald-200/90">
          {book.availableCopies} available · {book.totalCopies} copies
        </p>
      </div>
      <ChevronRight className="h-5 w-5 shrink-0 text-white/30" />
    </Link>
  );
}

export function PatronLibraryHome({ role }: { role: PatronRole }) {
  const [search, setSearch] = React.useState("");
  const [books, setBooks] = React.useState<PatronBook[]>([]);
  const [loans, setLoans] = React.useState<LoanRow[]>([]);
  const [holds, setHolds] = React.useState<HoldRow[]>([]);
  const [wards, setWards] = React.useState<Ward[]>([]);
  const [recs, setRecs] = React.useState<PatronBook[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);

  const load = React.useCallback(
    async (q: string) => {
      setLoading(true);
      setErr(null);
      try {
        const qs = new URLSearchParams();
        qs.set("page", "1");
        qs.set("limit", "24");
        qs.set("sortBy", "title");
        qs.set("sortOrder", "asc");
        if (q.trim()) qs.set("search", q.trim());

        const base = `/api/${role}/library`;
        const [bRes, accountRes, hRes, rRes] = await Promise.all([
          fetch(`${base}/books?${qs}`, { cache: "no-store" }),
          fetch(role === "parent" ? `${base}/summary` : `${base}/my-loans`, { cache: "no-store" }),
          fetch(`${base}/reservations`, { cache: "no-store" }),
          fetch(`${base}/recommendations?limit=12`, { cache: "no-store" }),
        ]);

        const bJson = await bRes.json();
        const accountJson = await accountRes.json();
        const hJson = await hRes.json();
        const rJson = await rRes.json();

        if (!bRes.ok || !bJson.success) {
          throw new Error(
            (bJson?.error && typeof bJson.error === "object" && "message" in bJson.error
              ? String((bJson.error as { message?: string }).message)
              : null) || "Could not load catalogue"
          );
        }

        setBooks(bJson.data?.items ?? []);
        setRecs(rRes.ok && rJson.success ? (rJson.data?.items ?? []) : []);

        if (role === "parent") {
          setWards(accountJson.success ? (accountJson.data?.wards ?? []) : []);
          setLoans(accountJson.success ? (accountJson.data?.loans ?? []) : []);
          setHolds(
            hJson.success && Array.isArray(hJson.data?.items)
              ? hJson.data.items.map((r: Record<string, unknown>) => ({
                  id: String(r.id),
                  bookTitle: String(r.bookTitle ?? ""),
                  bookId: String(r.bookId ?? ""),
                  status: String(r.status ?? ""),
                  borrowerName: String(r.borrowerName ?? ""),
                }))
              : []
          );
        } else {
          setWards([]);
          setLoans(accountJson.success ? (accountJson.data?.items ?? []) : []);
          setHolds(hJson.success ? (hJson.data?.items ?? []) : []);
        }
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Something went wrong");
      } finally {
        setLoading(false);
      }
    },
    [role]
  );

  React.useEffect(() => {
    void load("");
  }, [load]);

  const text = copy[role];
  const hrefBase = `/${role}/library`;
  const availableCopies = books.reduce((sum, book) => sum + Number(book.availableCopies || 0), 0);
  const activeHolds = holds.filter((hold) => hold.status === "pending" || hold.status === "ready").length;

  return (
    <LibraryPageShell>
      <LibraryPageHeader
        icon={Library}
        title={text.title}
        description={text.description}
        eyebrow={role === "parent" ? "Family library" : "Library"}
        actions={
          <Button
            type="button"
            className="bg-linear-to-r from-teal-500 to-cyan-600 text-white shadow-lg shadow-teal-500/25 hover:from-teal-600 hover:to-cyan-700"
            onClick={() => void load(search)}
          >
            <Search className="mr-2 h-4 w-4" />
            Search catalogue
          </Button>
        }
      />

      {err ? (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {err}
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <LibraryStatCard
          icon={BookOpenCheck}
          label="Catalogue"
          value={loading ? <Loader2 className="h-7 w-7 animate-spin text-white/40" /> : books.length}
          helper="Titles currently visible from this account."
          tone="cyan"
        />
        <LibraryStatCard
          icon={Warehouse}
          label="Available now"
          value={loading ? <Loader2 className="h-7 w-7 animate-spin text-white/40" /> : availableCopies}
          helper="Copies ready to reserve or borrow."
          tone="emerald"
        />
        <LibraryStatCard
          icon={BookMarked}
          label="Open loans"
          value={loading ? <Loader2 className="h-7 w-7 animate-spin text-white/40" /> : loans.length}
          helper={role === "parent" ? "Current loans for linked students." : "Current loans on your account."}
          tone="violet"
        />
        <LibraryStatCard
          icon={Bookmark}
          label="Active holds"
          value={loading ? <Loader2 className="h-7 w-7 animate-spin text-white/40" /> : activeHolds}
          helper="Pending or ready reservations."
          tone="amber"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <Card className={libraryGlassPanel}>
          <PanelChrome>
            <CardHeader className="relative z-10 border-b border-white/5">
              <CardTitle className="text-base text-white">{text.shelfTitle}</CardTitle>
              <p className="text-sm text-white/55">
                {role === "parent"
                  ? "Open loans and active holds for your children in one workspace."
                  : "Loans and holds together in the same library workspace."}
              </p>
            </CardHeader>
            <CardContent className="relative z-10 grid gap-6 md:grid-cols-2">
              <section>
                <p className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-white/45">
                  <BookOpen className="h-3.5 w-3.5" />
                  Loans
                </p>
                {loading ? (
                  <Loader2 className="h-6 w-6 animate-spin text-white/40" />
                ) : role === "parent" && wards.length === 0 ? (
                  <p className="text-sm text-white/60">No linked students found.</p>
                ) : loans.length === 0 ? (
                  <p className="text-sm text-white/60">{text.noLoans}</p>
                ) : (
                  <ul className="divide-y divide-white/10 rounded-lg border border-white/10">
                    {loans.slice(0, 8).map((loan) => (
                      <li key={loan._id} className="flex flex-wrap items-center gap-2 px-3 py-2.5">
                        <span className="font-medium text-white">{loan.book.title}</span>
                        {loan.borrower?.name ? (
                          <span className="text-xs text-white/50">{loan.borrower.name}</span>
                        ) : null}
                        <span className="text-xs text-white/50">
                          Due {format(new Date(loan.dueAt), "MMM d, yyyy")}
                        </span>
                        <Badge variant="outline" className="ml-auto border-white/20 text-[10px] text-white/80">
                          {loan.status}
                          {loan.daysOverdue > 0 ? ` · ${loan.daysOverdue}d overdue` : ""}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section>
                <p className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-white/45">
                  <Bookmark className="h-3.5 w-3.5" />
                  Holds
                </p>
                {loading ? (
                  <Loader2 className="h-6 w-6 animate-spin text-white/40" />
                ) : holds.length === 0 ? (
                  <p className="text-sm text-white/60">{text.noHolds}</p>
                ) : (
                  <ul className="divide-y divide-white/10 rounded-lg border border-white/10">
                    {holds.map((hold) => (
                      <li key={hold.id} className="flex flex-wrap items-center gap-2 px-3 py-2.5">
                        <Link href={`${hrefBase}/${hold.bookId}`} className="font-medium text-white hover:text-cyan-200">
                          {hold.bookTitle}
                        </Link>
                        {hold.borrowerName ? <span className="text-xs text-white/50">{hold.borrowerName}</span> : null}
                        <Badge variant="outline" className="border-white/20 text-[10px] text-white/80">
                          {hold.status}
                        </Badge>
                        {hold.status === "pending" && hold.queuePosition ? (
                          <span className="text-xs text-white/50">Queue #{hold.queuePosition}</span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </CardContent>
          </PanelChrome>
        </Card>
      </div>

      <Card className={libraryGlassPanel}>
        <PanelChrome>
          <CardHeader className="relative z-10 border-b border-white/5">
            <CardTitle className="flex items-center gap-2 text-base text-white">
              <Sparkles className="h-4 w-4 text-violet-200" />
              {text.recTitle}
            </CardTitle>
            <p className="text-sm text-white/55">Suggestions from borrowing history and shared catalogue tags.</p>
          </CardHeader>
          <CardContent className="relative z-10">
            {loading ? (
              <Loader2 className="h-6 w-6 animate-spin text-white/40" />
            ) : recs.length === 0 ? (
              <LibraryEmptyState title="No picks yet" description={text.recEmpty} />
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {recs.map((book) => (
                  <li key={book.id}>
                    <BookTile book={book} href={`${hrefBase}/${book.id}`} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </PanelChrome>
      </Card>

      <Card className={libraryGlassPanel}>
        <PanelChrome>
          <CardHeader className="relative z-10 flex flex-col gap-3 border-b border-white/5 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-base text-white">Catalogue</CardTitle>
            <div className="flex w-full max-w-sm gap-2 sm:w-auto">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-white/40" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void load(search);
                  }}
                  placeholder="Search title, author..."
                  className="border-white/15 bg-black/30 pl-9 text-white placeholder:text-white/35"
                />
              </div>
              <Button
                type="button"
                variant="secondary"
                className="shrink-0 bg-white/15 text-white hover:bg-white/25"
                onClick={() => void load(search)}
              >
                Search
              </Button>
            </div>
          </CardHeader>
          <CardContent className="relative z-10">
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-white/40" />
              </div>
            ) : books.length === 0 ? (
              <LibraryEmptyState title="No books found" description="Try a different search term." />
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {books.map((book) => (
                  <li key={book.id}>
                    <BookTile book={book} href={`${hrefBase}/${book.id}`} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </PanelChrome>
      </Card>
    </LibraryPageShell>
  );
}
