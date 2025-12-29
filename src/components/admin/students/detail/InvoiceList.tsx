/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatMoney } from "@/lib/fees/money";
import { cn } from "@/lib/utils";
import {
  FileText,
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  Calendar,
  DollarSign,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from "lucide-react";
import { useStudentInvoices } from "@/hooks/admin/useStudentInvoices";
import { InvoiceDetailDrawer } from "./InvoiceDetailDrawer";

type Props = {
  studentId: string;
  academicPeriodId?: string | null;
};

function fmtDate(iso: string | Date) {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return "N/A";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(d);
}

function statusBadge(status: string) {
  const statusMap: Record<string, { label: string; className: string; icon: any }> = {
    draft: {
      label: "Draft",
      className: "border-white/20 bg-white/5 text-white/70",
      icon: FileText,
    },
    issued: {
      label: "Issued",
      className: "border-blue-400/25 bg-blue-500/10 text-blue-200",
      icon: Clock,
    },
    paid: {
      label: "Paid",
      className: "border-emerald-400/25 bg-emerald-500/10 text-emerald-200",
      icon: CheckCircle2,
    },
    overdue: {
      label: "Overdue",
      className: "border-red-400/25 bg-red-500/10 text-red-200",
      icon: AlertCircle,
    },
    partially_paid: {
      label: "Partially Paid",
      className: "border-amber-400/25 bg-amber-500/10 text-amber-200",
      icon: Clock,
    },
  };

  const config = statusMap[status] || statusMap.draft;
  const Icon = config.icon;

  return (
    <Badge className={cn("gap-1.5", config.className)} variant="outline">
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}

export function InvoiceList({ studentId, academicPeriodId }: Props) {
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [sortBy, setSortBy] = React.useState<"date" | "amount" | "status">("date");
  const [sortOrder, setSortOrder] = React.useState<"asc" | "desc">("desc");
  const [page, setPage] = React.useState(1);
  const [selectedInvoiceId, setSelectedInvoiceId] = React.useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  const { data, isLoading, isError } = useStudentInvoices(studentId, {
    academicPeriodId: academicPeriodId || undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
    page,
    limit: 20,
  });

  const invoices = data?.invoices ?? [];
  const pagination = data?.pagination;

  // Client-side search and sorting
  const filteredAndSorted = React.useMemo(() => {
    let result = [...invoices];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (inv: any) =>
          inv.invoiceNumber?.toLowerCase().includes(query) ||
          inv.academicPeriodId?.yearLabel?.toLowerCase().includes(query) ||
          inv.academicPeriodId?.term?.toLowerCase().includes(query)
      );
    }

    // Sorting
    result.sort((a: any, b: any) => {
      let comparison = 0;
      if (sortBy === "date") {
        comparison =
          new Date(a.createdAt || 0).getTime() -
          new Date(b.createdAt || 0).getTime();
      } else if (sortBy === "amount") {
        comparison = (a.totalAmountMinor || 0) - (b.totalAmountMinor || 0);
      } else if (sortBy === "status") {
        comparison = (a.status || "").localeCompare(b.status || "");
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });

    return result;
  }, [invoices, searchQuery, sortBy, sortOrder]);

  const handleInvoiceClick = (invoiceId: string) => {
    setSelectedInvoiceId(invoiceId);
    setDrawerOpen(true);
  };

  const handleSort = (field: "date" | "amount" | "status") => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
  };

  return (
    <>
      <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
        <div
          className="pointer-events-none absolute inset-0 bg-linear-to-br from-primary/5 via-primary/2 to-transparent"
          aria-hidden="true"
        />
        <CardHeader className="relative z-10 pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-white/80">
              Invoices
            </CardTitle>
            {pagination && (
              <div className="text-xs text-muted-foreground">
                {pagination.total} total
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="relative z-10 space-y-4">
          {/* Filters */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search invoices..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-white/5 border-white/10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px] bg-white/5 border-white/10">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="issued">Issued</SelectItem>
                <SelectItem value="partially_paid">Partially Paid</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Sort controls */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Sort by:</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => handleSort("date")}
              className={cn(
                "h-7 px-2 text-xs",
                sortBy === "date"
                  ? "bg-white/10 text-white"
                  : "text-white/60 hover:text-white"
              )}
            >
              Date
              {sortBy === "date" &&
                (sortOrder === "asc" ? (
                  <ChevronUp className="ml-1 h-3 w-3" />
                ) : (
                  <ChevronDown className="ml-1 h-3 w-3" />
                ))}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => handleSort("amount")}
              className={cn(
                "h-7 px-2 text-xs",
                sortBy === "amount"
                  ? "bg-white/10 text-white"
                  : "text-white/60 hover:text-white"
              )}
            >
              Amount
              {sortBy === "amount" &&
                (sortOrder === "asc" ? (
                  <ChevronUp className="ml-1 h-3 w-3" />
                ) : (
                  <ChevronDown className="ml-1 h-3 w-3" />
                ))}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => handleSort("status")}
              className={cn(
                "h-7 px-2 text-xs",
                sortBy === "status"
                  ? "bg-white/10 text-white"
                  : "text-white/60 hover:text-white"
              )}
            >
              Status
              {sortBy === "status" &&
                (sortOrder === "asc" ? (
                  <ChevronUp className="ml-1 h-3 w-3" />
                ) : (
                  <ChevronDown className="ml-1 h-3 w-3" />
                ))}
            </Button>
          </div>

          {/* Invoice list */}
          {isLoading ? (
            <div className="flex items-center justify-center gap-3 py-10 text-sm text-muted-foreground">
              <Clock className="h-5 w-5 animate-spin" />
              Loading invoices...
            </div>
          ) : isError ? (
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-200">
              Failed to load invoices. Please try again.
            </div>
          ) : filteredAndSorted.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center">
              <FileText className="mx-auto h-12 w-12 text-white/20" />
              <p className="mt-3 text-sm font-medium text-white/80">
                No invoices found
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {searchQuery || statusFilter !== "all"
                  ? "Try adjusting your filters"
                  : "No invoices have been created yet"}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredAndSorted.map((invoice: any) => (
                <button
                  key={invoice._id}
                  type="button"
                  onClick={() => handleInvoiceClick(invoice._id)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 p-4 text-left transition-all hover:border-white/20 hover:bg-white/10"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-3">
                        <div className="font-semibold text-white/90">
                          {invoice.invoiceNumber || "N/A"}
                        </div>
                        {statusBadge(invoice.status)}
                      </div>
                      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                        {invoice.academicPeriodId && (
                          <div className="flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5" />
                            {invoice.academicPeriodId.yearLabel} •{" "}
                            {invoice.academicPeriodId.term}
                          </div>
                        )}
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5" />
                          {fmtDate(invoice.createdAt || invoice.issueDate)}
                        </div>
                        {invoice.dueDate && (
                          <div className="flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5" />
                            Due: {fmtDate(invoice.dueDate)}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-white/90">
                        {formatMoney(invoice.totalAmountMinor || 0)}
                      </div>
                      {invoice.totalOutstandingMinor > 0 && (
                        <div className="mt-1 text-xs text-amber-300">
                          Outstanding: {formatMoney(invoice.totalOutstandingMinor)}
                        </div>
                      )}
                      {invoice.totalPaidMinor > 0 && (
                        <div className="mt-1 text-xs text-emerald-300">
                          Paid: {formatMoney(invoice.totalPaidMinor)}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Pagination */}
          {pagination && pagination.pages > 1 && (
            <div className="flex items-center justify-between border-t border-white/10 pt-4">
              <div className="text-xs text-muted-foreground">
                Page {pagination.page} of {pagination.pages}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="border-white/10 bg-white/5 text-xs"
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
                  disabled={page === pagination.pages}
                  className="border-white/10 bg-white/5 text-xs"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <InvoiceDetailDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        invoiceId={selectedInvoiceId}
        studentId={studentId}
      />
    </>
  );
}
