"use client";

import * as React from "react";
import Image from "next/image";
import { Library, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LibraryBackLink,
  LibraryPageHeader,
  LibraryPageShell,
  libraryGlassPanel,
} from "@/components/admin/library/LibraryAdminChrome";

type Ward = { id: string; firstName: string; lastName: string };

type HoldRow = {
  id: string;
  bookId: string;
  borrowerId: string;
  borrowerName: string;
  status: string;
  queuePosition: number;
};

export default function ParentLibraryBookPage({
  params,
}: {
  params: Promise<{ bookId: string }>;
}) {
  const [bookId, setBookId] = React.useState<string | null>(null);
  const [book, setBook] = React.useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);

  const [wards, setWards] = React.useState<Ward[]>([]);
  const [selectedStudentId, setSelectedStudentId] = React.useState<string>("");
  const [holds, setHolds] = React.useState<HoldRow[]>([]);
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
        const res = await fetch(`/api/parent/library/books/${bookId}`, { cache: "no-store" });
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json?.error?.message || "Not found");
        setBook(json.data);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Error");
      } finally {
        setLoading(false);
      }
    })();
  }, [bookId]);

  const loadHoldsForBook = React.useCallback(async (bid: string) => {
    setHoldsLoading(true);
    try {
      const res = await fetch(
        `/api/parent/library/reservations?bookId=${encodeURIComponent(bid)}`,
        { cache: "no-store" }
      );
      const json = await res.json();
      if (!json.success || !json.data) {
        setWards([]);
        setHolds([]);
        return;
      }
      setWards(Array.isArray(json.data.wards) ? json.data.wards : []);
      const items: HoldRow[] = (json.data.items ?? []).map((r: Record<string, unknown>) => ({
        id: String(r.id),
        bookId: String(r.bookId),
        borrowerId: String(r.borrowerId),
        borrowerName: String(r.borrowerName ?? ""),
        status: String(r.status),
        queuePosition: Number(r.queuePosition ?? 0),
      }));
      setHolds(items);
      const w = json.data.wards as Ward[] | undefined;
      setSelectedStudentId((cur) => {
        if (!w?.length) return "";
        if (cur && w.some((x) => x.id === cur)) return cur;
        return w[0].id;
      });
    } catch {
      setHolds([]);
    } finally {
      setHoldsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (!bookId) return;
    void loadHoldsForBook(bookId);
  }, [bookId, loadHoldsForBook]);

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
        <LibraryBackLink href="/parent/library" label="Library" />
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {err}
        </p>
      </LibraryPageShell>
    );
  }

  const title = String(book.title ?? "");
  const author = book.author ? String(book.author) : "";
  const cover = book.coverImageUrl ? String(book.coverImageUrl) : "";
  const description = book.description ? String(book.description) : "";

  const holdsHere = holds;
  const activeForSelected = holdsHere.find(
    (h) =>
      h.borrowerId === selectedStudentId &&
      (h.status === "pending" || h.status === "ready")
  );

  return (
    <LibraryPageShell>
      <LibraryBackLink href="/parent/library" label="Library" />
      <LibraryPageHeader
        icon={Library}
        title={title}
        description={author ? `by ${author}` : "Family reservation details and catalogue availability."}
        eyebrow="Family library"
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
          {cover ? (
            <Image src={cover} alt="" fill className="object-cover" sizes="192px" />
          ) : (
            <div className="flex h-full items-center justify-center">
              <Library className="h-12 w-12 text-white/25" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          {author ? <p className="text-white/80">{author}</p> : null}
          <p className="mt-2 text-sm text-emerald-200/90">
            {Number(book.availableCopies)} available · {Number(book.totalCopies)} copies
          </p>

          {wards.length > 0 ? (
            <div className="mt-4 space-y-3">
              <div className="space-y-1">
                <p className="text-xs font-medium text-white/60">Reserve for</p>
                <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                  <SelectTrigger className="w-[260px] border-white/15 bg-black/30 text-white">
                    <SelectValue placeholder="Choose child" />
                  </SelectTrigger>
                  <SelectContent>
                    {wards.map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.firstName} {w.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {holdsLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-white/40" />
                ) : activeForSelected ? (
                  <>
                    <Badge variant="outline" className="border-cyan-400/30 text-cyan-100">
                      Hold: {activeForSelected.status}
                      {activeForSelected.status === "pending"
                        ? ` · queue #${activeForSelected.queuePosition}`
                        : ""}
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
                              `/api/parent/library/reservations/${activeForSelected.id}/cancel`,
                              { method: "POST" }
                            );
                            const json = await res.json();
                            if (!res.ok) {
                              throw new Error(json?.error?.message || "Cancel failed");
                            }
                            toast.success("Hold cancelled");
                            if (bookId) await loadHoldsForBook(bookId);
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
                    disabled={reserveBusy || !selectedStudentId}
                    onClick={() => {
                      void (async () => {
                        setReserveBusy(true);
                        try {
                          const res = await fetch("/api/parent/library/reservations", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              bookId: String(bookId),
                              studentId: selectedStudentId,
                            }),
                          });
                          const json = await res.json();
                          if (!res.ok) {
                            throw new Error(json?.error?.message || "Could not reserve");
                          }
                          toast.success(
                            json.data?.status === "ready"
                              ? "Hold is ready — your child can pick it up at the library"
                              : "Your child is on the waitlist for this title"
                          );
                          if (bookId) await loadHoldsForBook(bookId);
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
                      "Request hold"
                    )}
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-white/60">Link a student to place holds from this account.</p>
          )}
        </div>
        </CardContent>
      </Card>
      {description ? (
        <Card className={libraryGlassPanel}>
          <CardContent className="relative z-10 p-5">
            <p className="whitespace-pre-wrap text-sm leading-6 text-white/75">{description}</p>
          </CardContent>
        </Card>
      ) : null}
    </LibraryPageShell>
  );
}
