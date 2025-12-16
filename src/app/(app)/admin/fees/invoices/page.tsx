// src/app/(app)/admin/fees/invoices/page.tsx
"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import {
  useInvoices,
  useCreateInvoice,
  useBulkIssueInvoices,
  useBulkCancelInvoices,
  useBulkExportInvoices,
  type Invoice,
} from "@/hooks/admin/useInvoices";
import { InvoicesBulkActionsBar } from "@/components/admin/fees/InvoicesBulkActionsBar";
import { formatMoney } from "@/lib/fees/money";
import Link from "next/link";
import {
  PlusCircle,
  Search,
  ArrowRight,
  ArrowLeft,
  ChevronDown,
  Check,
} from "lucide-react";
import { Skeleton } from "@/components/loading/skeleton";
import { ResponsiveModal } from "@/components/modals/ResponsiveModal";
import CreateInvoiceModal from "@/components/modals/CreateInvoiceModal";
import { useBusyToast } from "@/hooks/useBusyToast";
import { useRouter } from "next/navigation";
import type { CreateInvoiceInput } from "@/schemas/invoice";
import { premiumMenuContent, premiumMenuItem } from "@/components/ui/premium";
import { cn } from "@/lib/utils";

function InvoiceStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    draft: "bg-gray-500/20 text-gray-300",
    issued: "bg-blue-500/20 text-blue-300",
    partially_paid: "bg-yellow-500/20 text-yellow-300",
    paid: "bg-green-500/20 text-green-300",
    overdue: "bg-red-500/20 text-red-300",
    cancelled: "bg-gray-500/20 text-gray-400",
  };

  return (
    <Badge className={colors[status] || colors.draft}>
      {status.replace("_", " ").toUpperCase()}
    </Badge>
  );
}

const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "draft", label: "Draft" },
  { value: "issued", label: "Issued" },
  { value: "partially_paid", label: "Partially Paid" },
  { value: "paid", label: "Paid" },
  { value: "overdue", label: "Overdue" },
  { value: "cancelled", label: "Cancelled" },
];

function StatusFilterDropdown({
  value,
  onValueChange,
}: {
  value: string;
  onValueChange: (value: string) => void;
}) {
  const selectedLabel =
    STATUS_OPTIONS.find((opt) => opt.value === value)?.label || "All Statuses";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="rounded-full px-3 py-1.5 bg-card hover:opacity-90 transition"
        asChild
      >
        <Button
          variant="outline"
          className={cn(
            "w-[180px] justify-between border border-white/10 bg-white/5 text-white",
            "hover:bg-white/10 hover:border-white/20"
          )}
        >
          <span>{selectedLabel}</span>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className={cn(premiumMenuContent, "min-w-56 p-2")}>
        {STATUS_OPTIONS.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => onValueChange(option.value)}
            className={cn(
              premiumMenuItem,
              "rounded-lg premium-hover",
              value === option.value && "bg-white/10"
            )}
          >
            <div className="flex items-center justify-between w-full">
              <span>{option.label}</span>
              {value === option.value && <Check className="h-4 w-4" />}
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function InvoicesPage() {
  const router = useRouter();
  const busy = useBusyToast();
  const createInvoice = useCreateInvoice();
  const bulkIssueInvoices = useBulkIssueInvoices();
  const bulkCancelInvoices = useBulkCancelInvoices();
  const bulkExportInvoices = useBulkExportInvoices();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const { data, isLoading, error } = useInvoices({
    status: statusFilter === "all" ? undefined : statusFilter,
    page,
    limit: 20,
  });

  const handleCreateInvoice = async (payload: CreateInvoiceInput) => {
    // Fix CreateInvoiceInput so it does not contain any nulls for optional fields that expect undefined
    // Especially fix: feeStructureId and other fields that should be undefined instead of null
    const fixedPayload = {
      ...payload,
      dueDate: payload.dueDate === null ? undefined : payload.dueDate,
      notes: payload.notes === null ? undefined : payload.notes,
      terms: payload.terms === null ? undefined : payload.terms,
      lineItems: payload.lineItems.map((item) => ({
        ...item,
        feeStructureId:
          item.feeStructureId === null ? undefined : item.feeStructureId,
        description: item.description === null ? undefined : item.description,
        numberOfInstallments:
          item.numberOfInstallments === null
            ? undefined
            : item.numberOfInstallments,
        installmentSchedule:
          item.installmentSchedule === null
            ? undefined
            : item.installmentSchedule,
        allowsInstallments:
          item.allowsInstallments === null
            ? undefined
            : item.allowsInstallments,
      })),
    };
    const result = (await busy.promise(
      createInvoice.mutateAsync(fixedPayload),
      {
        loading: "Creating invoice...",
        success: "Invoice created successfully",
        error: "Failed to create invoice",
      }
    )) as unknown as { invoice: { _id: string } };
    setShowCreateModal(false);
    // Navigate to the new invoice
    router.push(`/admin/fees/invoices/${result.invoice._id}`);
  };

  if (error) {
    return (
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-3xl font-bold mb-2 text-white">Invoices</h1>
          <p className="text-muted-foreground">Manage student invoices</p>
        </div>
        <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
          <CardContent className="pt-6">
            <p className="text-destructive">Failed to load invoices</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const invoices = data?.invoices || [];
  const pagination = data?.pagination;

  // Filter invoices by search
  const filteredInvoices = React.useMemo(() => {
    if (!search.trim()) return invoices;
    const searchLower = search.toLowerCase();
    return invoices.filter((invoice: Invoice) => {
      const invoiceNumber = invoice.invoiceNumber?.toLowerCase() || "";
      const studentName = `${invoice.studentId?.firstName || ""} ${
        invoice.studentId?.lastName || ""
      }`.toLowerCase();
      const admissionNo = invoice.studentId?.admissionNo?.toLowerCase() || "";
      return (
        invoiceNumber.includes(searchLower) ||
        studentName.includes(searchLower) ||
        admissionNo.includes(searchLower)
      );
    });
  }, [invoices, search]);

  const handleToggleRow = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleToggleAllVisible = () => {
    if (selectedIds.length === filteredInvoices.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredInvoices.map((inv: Invoice) => inv._id));
    }
  };

  const handleClearSelection = () => {
    setSelectedIds([]);
  };

  const handleBulkIssue = async () => {
    if (selectedIds.length === 0) return;
    try {
      const result = (await busy.promise(
        bulkIssueInvoices.mutateAsync(selectedIds),
        {
          loading: `Issuing ${selectedIds.length} invoice${
            selectedIds.length !== 1 ? "s" : ""
          }...`,
          success: `Successfully issued invoices`,
          error: "Failed to issue some invoices",
        }
      )) as unknown as {
        results: {
          succeeded: string[];
          failed: Array<{ id: string; error: string }>;
        };
      };
      if (result.results.failed.length > 0) {
        console.warn("Some invoices failed to issue:", result.results.failed);
      }
      setSelectedIds([]);
    } catch (error) {
      // Error already handled by busy toast
    }
  };

  const handleBulkCancel = async () => {
    if (selectedIds.length === 0) return;
    try {
      const result = (await busy.promise(
        bulkCancelInvoices.mutateAsync(selectedIds),
        {
          loading: `Cancelling ${selectedIds.length} invoice${
            selectedIds.length !== 1 ? "s" : ""
          }...`,
          success: `Successfully cancelled invoices`,
          error: "Failed to cancel some invoices",
        }
      )) as unknown as {
        results: {
          succeeded: string[];
          failed: Array<{ id: string; error: string }>;
        };
      };
      if (result.results.failed.length > 0) {
        console.warn("Some invoices failed to cancel:", result.results.failed);
      }
      setSelectedIds([]);
    } catch (error) {
      // Error already handled by busy toast
    }
  };

  const handleBulkExport = async () => {
    if (selectedIds.length === 0) return;
    try {
      await busy.promise(bulkExportInvoices.mutateAsync(selectedIds), {
        loading: `Exporting ${selectedIds.length} invoice${
          selectedIds.length !== 1 ? "s" : ""
        }...`,
        success: "Invoices exported successfully",
        error: "Failed to export invoices",
      });
    } catch (error) {
      // Error already handled by busy toast
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => router.push("/admin/fees")}
            className="h-9 w-9 cursor-pointer border border-white/10 bg-white/5 transition-all duration-200 hover:scale-105 hover:border-white/20 hover:bg-white/10 hover:shadow-md hover:shadow-black/20 active:scale-95"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Finance
            </p>
            <h1 className="text-3xl font-bold text-white">Invoices</h1>
            <p className="text-muted-foreground">Manage student invoices</p>
          </div>
        </div>
        <Button
          onClick={() => setShowCreateModal(true)}
          className="bg-brand hover:bg-brand/90"
        >
          <PlusCircle className="h-4 w-4 mr-2" />
          Create Invoice
        </Button>
      </div>

      {/* Filters */}
      <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
        <div
          className="pointer-events-none absolute inset-0 bg-linear-to-br from-blue-500/5 via-blue-500/2 to-transparent"
          aria-hidden="true"
        />
        <CardHeader className="relative z-10">
          <CardTitle className="text-white">Filters</CardTitle>
        </CardHeader>
        <CardContent className="relative z-10">
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by invoice number or student name..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 border-white/10 bg-white/5 text-white placeholder:text-white/40"
                />
              </div>
            </div>
            <StatusFilterDropdown
              value={statusFilter}
              onValueChange={setStatusFilter}
            />
          </div>
        </CardContent>
      </Card>

      {/* Invoices List */}
      <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
        <div
          className="pointer-events-none absolute inset-0 bg-linear-to-br from-purple-500/5 via-purple-500/2 to-transparent"
          aria-hidden="true"
        />
        <CardHeader className="relative z-10">
          <CardTitle className="text-white">Invoices</CardTitle>
        </CardHeader>
        <CardContent className="relative z-10">
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
            </div>
          ) : filteredInvoices.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No invoices found
            </p>
          ) : (
            <>
              {/* Select All Checkbox */}
              <div className="flex items-center gap-3 mb-4 pb-4 border-b border-white/10">
                <input
                  type="checkbox"
                  checked={
                    filteredInvoices.length > 0 &&
                    selectedIds.length === filteredInvoices.length
                  }
                  onChange={handleToggleAllVisible}
                  className="h-4 w-4 rounded border-white/20 bg-white/5 accent-brand cursor-pointer"
                />
                <label className="text-sm text-white/80 cursor-pointer">
                  Select all ({filteredInvoices.length} invoice
                  {filteredInvoices.length !== 1 ? "s" : ""})
                </label>
              </div>

              <div className="space-y-3">
                {filteredInvoices.map((invoice: Invoice) => (
                  <div
                    key={invoice._id}
                    className="group flex items-center my-3 justify-between p-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 transition-all duration-200"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(invoice._id)}
                        onChange={() => handleToggleRow(invoice._id)}
                        onClick={(e) => e.stopPropagation()}
                        className="h-4 w-4 rounded border-white/20 bg-white/5 accent-brand cursor-pointer shrink-0"
                      />
                      <Link
                        href={`/admin/fees/invoices/${invoice._id}`}
                        className="flex-1"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <p className="font-semibold text-white">
                                {invoice.invoiceNumber}
                              </p>
                              <InvoiceStatusBadge status={invoice.status} />
                            </div>
                            <p className="text-sm text-white/80">
                              {invoice.studentId?.firstName}{" "}
                              {invoice.studentId?.lastName}
                              {invoice.studentId?.admissionNo &&
                                ` • ${invoice.studentId.admissionNo}`}
                            </p>
                            <p className="text-xs text-white/60 mt-1">
                              {invoice.academicPeriodId?.yearLabel} •{" "}
                              {invoice.academicPeriodId?.term}
                            </p>
                          </div>
                          <div className="text-right mr-4">
                            <p className="font-semibold text-white">
                              {formatMoney(invoice.totalAmountMinor)}
                            </p>
                            <p className="text-sm text-white/60">
                              Paid: {formatMoney(invoice.totalPaidMinor)}
                            </p>
                            <p className="text-xs text-white/50">
                              Outstanding:{" "}
                              {formatMoney(invoice.totalOutstandingMinor)}
                            </p>
                          </div>
                          <ArrowRight className="h-4 w-4 text-white/40 group-hover:text-white/60 group-hover:translate-x-1 transition-all" />
                        </div>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {pagination && pagination.pages > 1 && (
                <div className="flex items-center justify-between mt-6">
                  <p className="text-sm text-white/60">
                    Page {pagination.page} of {pagination.pages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="border-white/10 bg-white/5 text-white hover:bg-white/10"
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setPage((p) => Math.min(pagination.pages, p + 1))
                      }
                      disabled={page === pagination.pages}
                      className="border-white/10 bg-white/5 text-white hover:bg-white/10"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Bulk Actions Bar */}
      {selectedIds.length > 0 && (
        <InvoicesBulkActionsBar
          selectedCount={selectedIds.length}
          onClearSelection={handleClearSelection}
          onIssue={handleBulkIssue}
          onCancel={handleBulkCancel}
          onExportSelected={handleBulkExport}
        />
      )}

      {/* Create Invoice Modal */}
      <ResponsiveModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create Invoice"
        widthClass="max-w-4xl"
      >
        <CreateInvoiceModal
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateInvoice}
          isLoading={createInvoice.isPending}
        />
      </ResponsiveModal>
    </div>
  );
}
