"use client";

import * as React from "react";
import Image from "next/image";
import { Library, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LibraryBackLink,
  LibraryPageHeader,
  LibraryPageShell,
  libraryGlassPanel,
} from "@/components/admin/library/LibraryAdminChrome";

type BookDetail = {
  id: string;
  title: string;
  subtitle?: string;
  author?: string;
  isbn?: string;
  description?: string;
  coverImageUrl?: string;
  shelfLocation?: string;
  availableCopies: number;
  totalCopies: number;
  tags: string[];
};

export default function StudentLibraryBookDetailPage({
  params,
}: {
  params: Promise<{ bookId: string }>;
}) {
  const [bookId, setBookId] = React.useState<string | null>(null);
  const [book, setBook] = React.useState<BookDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);
  const [myHold, setMyHold] = React.useState<{
    id: string;
    status: string;
    queuePosition: number;
  } | null>(null);
  const [holdsLoading, setHoldsLoading] = React.useState(false);
  const [reserveBusy, setReserveBusy] = React.useState(false);

  React.useEffect(() => {
    void (async () => {
      const p = await params;
      setBookId(p.bookId);
    })();
  }, [params]);

  React.useEffect(() => {
    if (!bookId) return;
    void (async () => {
      setLoading(true);
      setErr(null);
      try {
        const res = await fetch(`/api/student/library/books/${bookId}`, { cache: "no-store" });
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json?.error?.message || "Not found");
        }
        setBook(json.data);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Error");
      } finally {
        setLoading(false);
      }
    })();
  }, [bookId]);

  const loadHolds = React.useCallback(async (bid: string) => {
    setHoldsLoading(true);
    try {
      const res = await fetch("/api/student/library/reservations", { cache: "no-store" });
      const json = await res.json();
      if (json.success && Array.isArray(json.data?.items)) {
        const hit = json.data.items.find(
          (r: { bookId?: string; status?: string }) =>
            r.bookId === bid && (r.status === "pending" || r.status === "ready")
        );
        setMyHold(
          hit
            ? {
                id: String(hit.id),
                status: String(hit.status),
                queuePosition: Number(hit.queuePosition ?? 0),
              }
            : null
        );
      } else {
        setMyHold(null);
      }
    } catch {
      setMyHold(null);
    } finally {
      setHoldsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (!bookId) return;
    void loadHolds(bookId);
  }, [bookId, loadHolds]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center rounded-2xl border border-white/10 bg-slate-950/80">
        <Loader2 className="h-8 w-8 animate-spin text-white/40" />
      </div>
    );
  }

  if (err || !book) {
    return (
      <LibraryPageShell>
        <LibraryBackLink href="/student/library" label="Catalogue" />
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {err || "Book not found"}
        </p>
      </LibraryPageShell>
    );
  }

  return (
    <LibraryPageShell>
      <LibraryBackLink href="/student/library" label="Catalogue" />
      <LibraryPageHeader
        icon={Library}
        title={book.title}
        description={book.subtitle || (book.author ? `by ${book.author}` : "Catalogue detail and reservation status.")}
        eyebrow="Library title"
      />

      <Card className={libraryGlassPanel}>
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,var(--tw-gradient-stops))] from-cyan-500/5 via-transparent to-transparent"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/15 to-transparent"
          aria-hidden="true"
        />
        <CardContent className="relative z-10 flex flex-col gap-6 p-5 sm:flex-row">
        <div className="relative mx-auto aspect-[3/4] w-40 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-white/5 sm:mx-0 sm:w-48">
          {book.coverImageUrl ? (
            <Image
              src={book.coverImageUrl}
              alt=""
              fill
              className="object-cover"
              sizes="192px"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <Library className="h-12 w-12 text-white/25" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          {book.author ? <p className="text-white/80">by {book.author}</p> : null}
          {book.isbn ? (
            <p className="text-xs text-white/45">ISBN {book.isbn}</p>
          ) : null}
          <p className="text-sm text-emerald-200/90">
            {book.availableCopies} available · {book.totalCopies} copies in library
          </p>
          {book.shelfLocation ? (
            <p className="text-sm text-white/55">Shelf: {book.shelfLocation}</p>
          ) : null}

          <div className="flex flex-wrap items-center gap-3 pt-2">
            {holdsLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-white/40" />
            ) : myHold ? (
              <>
                <Badge variant="outline" className="border-cyan-400/30 text-cyan-100">
                  Hold: {myHold.status}
                  {myHold.status === "pending" ? ` · queue #${myHold.queuePosition}` : ""}
                </Badge>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="border-white/25 bg-white/5 text-white hover:bg-white/10"
                  disabled={reserveBusy}
                  onClick={() => {
                    void (async () => {
                      setReserveBusy(true);
                      try {
                        const res = await fetch(
                          `/api/student/library/reservations/${myHold.id}/cancel`,
                          { method: "POST" }
                        );
                        const json = await res.json();
                        if (!res.ok) throw new Error(json?.error?.message || "Cancel failed");
                        toast.success("Hold cancelled");
                        setMyHold(null);
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "Failed");
                      } finally {
                        setReserveBusy(false);
                      }
                    })();
                  }}
                >
                  Cancel hold
                </Button>
              </>
            ) : (
              <Button
                type="button"
                size="sm"
                className="bg-linear-to-r from-teal-500 to-cyan-600 text-white shadow-lg shadow-teal-500/25 hover:from-teal-600 hover:to-cyan-700"
                disabled={reserveBusy}
                onClick={() => {
                  void (async () => {
                    setReserveBusy(true);
                    try {
                      const res = await fetch("/api/student/library/reservations", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ bookId: book.id }),
                      });
                      const json = await res.json();
                      if (!res.ok) throw new Error(json?.error?.message || "Could not reserve");
                      toast.success(
                        json.data?.status === "ready"
                          ? "Hold is ready — visit the library for pickup"
                          : "You are on the waitlist for this title"
                      );
                      await loadHolds(book.id);
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Failed");
                    } finally {
                      setReserveBusy(false);
                    }
                  })();
                }}
              >
                {reserveBusy ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Reserving…
                  </>
                ) : (
                  "Reserve this title"
                )}
              </Button>
            )}
          </div>
        </div>
        </CardContent>
      </Card>

      {book.description ? (
        <Card className={libraryGlassPanel}>
          <CardHeader className="relative z-10 border-b border-white/5">
            <CardTitle className="text-base text-white">About</CardTitle>
          </CardHeader>
          <CardContent className="relative z-10">
            <p className="whitespace-pre-wrap text-sm text-white/75">{book.description}</p>
          </CardContent>
        </Card>
      ) : null}

      {book.tags?.length ? (
        <Card className={libraryGlassPanel}>
          <CardHeader className="relative z-10 border-b border-white/5">
            <CardTitle className="text-base text-white">Tags</CardTitle>
          </CardHeader>
          <CardContent className="relative z-10">
            <p className="text-sm text-white/70">{book.tags.join(", ")}</p>
          </CardContent>
        </Card>
      ) : null}

      <p className="text-center text-xs text-white/45">
        Pickup is arranged with your librarian when a copy is ready.
      </p>
    </LibraryPageShell>
  );
}
