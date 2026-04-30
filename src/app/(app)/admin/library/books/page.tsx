"use client";

import * as React from "react";
import Link from "next/link";
import {
  BookMarked,
  Library,
  Loader2,
  Plus,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Badge } from "@/components/ui/badge";
import { useLibraryBooksQuery, useLibraryCapabilitiesQuery } from "@/hooks/admin/useLibraryAdmin";
import { format } from "date-fns";
import {
  LibraryBackLink,
  LibraryEmptyState,
  libraryGlassPanel,
  LibraryPageHeader,
  LibraryPageShell,
} from "@/components/admin/library/LibraryAdminChrome";

export default function AdminLibraryBooksPage() {
  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState<"active" | "archived" | "all">("active");
  const [sortBy, setSortBy] = React.useState<"updatedAt" | "createdAt" | "title">("updatedAt");
  const [sortOrder, setSortOrder] = React.useState<"asc" | "desc">("desc");
  const [draftSearch, setDraftSearch] = React.useState("");

  const { data, isLoading } = useLibraryBooksQuery({
    page,
    limit: 20,
    search: search || undefined,
    status,
    sortBy,
    sortOrder,
  });

  const { data: capsRes } = useLibraryCapabilitiesQuery();
  const canCreateBook = capsRes?.data?.booksCreate ?? false;

  const items = data?.data?.items ?? [];
  const pg = data?.data?.pagination;

  return (
    <LibraryPageShell>
      <LibraryBackLink href="/admin/library" label="Library home" />
      <LibraryPageHeader
        icon={Library}
        title="Books"
        description="Search, filter, and open catalogue records to manage metadata and copies."
        actions={
          canCreateBook ? (
            <Button
              asChild
              className="bg-linear-to-r from-teal-500 to-cyan-600 text-white shadow-lg shadow-teal-500/25 hover:from-teal-600 hover:to-cyan-700"
            >
              <Link href="/admin/library/books/new">
                <Plus className="mr-2 h-4 w-4" />
                New book
              </Link>
            </Button>
          ) : null
        }
      />

      <div className="relative overflow-hidden rounded-xl border border-white/10 bg-linear-to-br from-slate-900/80 via-slate-950/90 to-black p-3 shadow-2xl shadow-black/40 backdrop-blur-xl sm:rounded-2xl">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,var(--tw-gradient-stops))] from-teal-500/5 via-transparent to-transparent"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/15 to-transparent"
          aria-hidden="true"
        />
        <div className="relative z-10 flex flex-wrap items-center gap-3">
        <div className="flex min-w-[200px] flex-1 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3">
          <Search className="h-4 w-4 shrink-0 text-white/40" />
          <Input
            value={draftSearch}
            onChange={(e) => setDraftSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setSearch(draftSearch.trim());
                setPage(1);
              }
            }}
            placeholder="Search catalogue…"
            className="border-0 bg-transparent text-white placeholder:text-white/35 focus-visible:ring-0"
          />
        </div>
        <Button
          type="button"
          variant="secondary"
          className="bg-white/10 text-white hover:bg-white/15"
          onClick={() => {
            setSearch(draftSearch.trim());
            setPage(1);
          }}
        >
          Search
        </Button>
        <PremiumSelect
          value={status}
          onValueChange={(v) => {
            setStatus(v as typeof status);
            setPage(1);
          }}
        >
          <PremiumSelectTrigger className="w-[160px] border-white/15 bg-white/[0.05] text-white">
            <PremiumSelectValue placeholder="Status" />
          </PremiumSelectTrigger>
          <PremiumSelectContent>
            <PremiumSelectItem value="active">Active</PremiumSelectItem>
            <PremiumSelectItem value="archived">Archived</PremiumSelectItem>
            <PremiumSelectItem value="all">All</PremiumSelectItem>
          </PremiumSelectContent>
        </PremiumSelect>
        <PremiumSelect
          value={sortBy}
          onValueChange={(v) => {
            setSortBy(v as typeof sortBy);
            setPage(1);
          }}
        >
          <PremiumSelectTrigger className="w-[180px] border-white/15 bg-white/[0.05] text-white">
            <PremiumSelectValue placeholder="Sort by" />
          </PremiumSelectTrigger>
          <PremiumSelectContent>
            <PremiumSelectItem value="updatedAt">Last updated</PremiumSelectItem>
            <PremiumSelectItem value="createdAt">Date added</PremiumSelectItem>
            <PremiumSelectItem value="title">Title A–Z</PremiumSelectItem>
          </PremiumSelectContent>
        </PremiumSelect>
        <PremiumSelect
          value={sortOrder}
          onValueChange={(v) => {
            setSortOrder(v as typeof sortOrder);
            setPage(1);
          }}
        >
          <PremiumSelectTrigger className="w-[140px] border-white/15 bg-white/[0.05] text-white">
            <PremiumSelectValue placeholder="Order" />
          </PremiumSelectTrigger>
          <PremiumSelectContent>
            <PremiumSelectItem value="desc">Newest / Z→A</PremiumSelectItem>
            <PremiumSelectItem value="asc">Oldest / A→Z</PremiumSelectItem>
          </PremiumSelectContent>
        </PremiumSelect>
        </div>
      </div>

      <div className={libraryGlassPanel}>
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,var(--tw-gradient-stops))] from-cyan-500/5 via-transparent to-transparent"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/15 to-transparent"
          aria-hidden="true"
        />
        {isLoading ? (
          <div className="relative z-10 flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-white/40" />
          </div>
        ) : (
          <Table className="relative z-10">
            <TableHeader>
              <TableRow className="border-white/10 hover:bg-transparent">
                <TableHead className="text-white/70">Title</TableHead>
                <TableHead className="text-white/70">Author</TableHead>
                <TableHead className="text-white/70">Copies</TableHead>
                <TableHead className="text-white/70">Available</TableHead>
                <TableHead className="text-white/70">Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow className="border-white/10 hover:bg-transparent">
                  <TableCell colSpan={5} className="p-6">
                    <LibraryEmptyState
                      title="No matching books"
                      description="Try another search term, adjust the filters, or add a new book to the catalogue."
                      action={
                        <Button asChild className="bg-linear-to-r from-teal-500 to-cyan-600 text-white shadow-lg shadow-teal-500/25 hover:from-teal-600 hover:to-cyan-700">
                          <Link href="/admin/library/books/new">
                            <Plus className="mr-2 h-4 w-4" />
                            New book
                          </Link>
                        </Button>
                      }
                    />
                  </TableCell>
                </TableRow>
              ) : (
                items.map((b) => (
                  <TableRow key={b.id} className="border-white/10">
                    <TableCell>
                      <Link
                        href={`/admin/library/books/${b.id}`}
                        className="flex items-center gap-2 font-medium text-white hover:text-brand"
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-cyan-300/15 bg-cyan-400/10">
                          <BookMarked className="h-4 w-4 text-cyan-200" />
                        </span>
                        <span className="line-clamp-2">{b.title}</span>
                      </Link>
                    </TableCell>
                    <TableCell className="text-white/75">{b.author || "—"}</TableCell>
                    <TableCell className="text-white/75">{b.totalCopies}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="border-white/20 text-white/80">
                        {b.availableCopies}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-white/55">
                      {format(new Date(b.updatedAt), "MMM d, yyyy")}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </div>

      {pg && pg.totalPages > 1 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-linear-to-r from-white/5 to-transparent p-3 text-sm text-white/60 shadow-lg shadow-black/20 backdrop-blur-xl">
          <span>
            Page {pg.page} of {pg.totalPages} ({pg.total} titles)
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!pg.hasPreviousPage}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="border-white/20 text-white"
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!pg.hasNextPage}
              onClick={() => setPage((p) => p + 1)}
              className="border-white/20 text-white"
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </LibraryPageShell>
  );
}
