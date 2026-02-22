"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns/format";
import {
  Plus,
  Search,
  Filter,
  ChevronDown,
  Receipt,
  Clock,
  CheckCircle2,
  XCircle,
  DollarSign,
  AlertCircle,
  MoreHorizontal,
  Eye,
  Edit,
  Send,
  Check,
  X,
  CreditCard,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import {
  PremiumDropdownMenu,
  PremiumDropdownMenuContent,
  PremiumDropdownMenuItem,
  PremiumDropdownMenuSeparator,
  PremiumDropdownMenuTrigger,
} from "@/components/ui/premium-dropdown-menu";
import { useExpenses, useExpenseCategories, useSeedDefaultCategories, ExpenseDTO, ExpenseStatus } from "@/hooks/admin/useExpenses";
import { CreateExpenseModal } from "@/components/modals/CreateExpenseModal";
import { toast } from "sonner";

// ========================
// Helper Functions
// ========================

function formatCurrency(amountMinor: number, currency = "GHS") {
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amountMinor / 100);
}

function getStatusBadge(status: ExpenseStatus) {
  const config: Record<
    ExpenseStatus,
    { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }
  > = {
    draft: {
      label: "Draft",
      variant: "secondary",
      icon: <Edit className="h-3 w-3" />,
    },
    submitted: {
      label: "Pending Approval",
      variant: "outline",
      icon: <Clock className="h-3 w-3" />,
    },
    approved: {
      label: "Approved",
      variant: "default",
      icon: <CheckCircle2 className="h-3 w-3" />,
    },
    rejected: {
      label: "Rejected",
      variant: "destructive",
      icon: <XCircle className="h-3 w-3" />,
    },
    paid: {
      label: "Paid",
      variant: "default",
      icon: <DollarSign className="h-3 w-3" />,
    },
    cancelled: {
      label: "Cancelled",
      variant: "secondary",
      icon: <X className="h-3 w-3" />,
    },
  };

  const { label, variant, icon } = config[status];
  return (
    <Badge variant={variant} className="gap-1">
      {icon}
      {label}
    </Badge>
  );
}

// ========================
// KPI Card Component
// ========================

function KPICard({
  title,
  value,
  subValue,
  icon: Icon,
  trend,
  loading,
}: {
  title: string;
  value: string;
  subValue?: string;
  icon: React.ComponentType<{ className?: string }>;
  trend?: { value: string; positive: boolean };
  loading?: boolean;
}) {
  if (loading) {
    return (
      <Card className="overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/60 via-slate-950/60 to-black/60">
        <CardContent className="p-5">
          <Skeleton className="h-4 w-24 mb-3" />
          <Skeleton className="h-8 w-32 mb-2" />
          <Skeleton className="h-3 w-20" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/60 via-slate-950/60 to-black/60 shadow-lg transition-all duration-300 hover:border-white/20 hover:shadow-xl">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-white/50">{title}</p>
          <div className="rounded-lg bg-white/5 p-2">
            <Icon className="h-4 w-4 text-white/40" />
          </div>
        </div>
        <p className="mt-2 text-2xl font-bold text-white">{value}</p>
        {subValue && (
          <p className="mt-1 text-xs text-white/40">{subValue}</p>
        )}
        {trend && (
          <p
            className={`mt-1 text-xs ${
              trend.positive ? "text-emerald-400" : "text-red-400"
            }`}
          >
            {trend.positive ? "↑" : "↓"} {trend.value}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ========================
// Expense Row Component
// ========================

function ExpenseRow({
  expense,
  onView,
  onEdit,
}: {
  expense: ExpenseDTO;
  onView: () => void;
  onEdit: () => void;
}) {
  const category =
    typeof expense.categoryId === "object"
      ? expense.categoryId
      : { name: "Unknown", code: "" };
  const vendor =
    typeof expense.vendorId === "object" && expense.vendorId
      ? expense.vendorId
      : null;

  const canEdit = expense.status === "draft" || expense.status === "rejected";

  return (
    <div className="group flex items-center gap-4 rounded-xl border border-white/5 bg-white/2 p-4 transition-all duration-200 hover:border-white/10 hover:bg-white/4">
      {/* Icon */}
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-amber-500/20 to-orange-600/20">
        <Receipt className="h-5 w-5 text-amber-400" />
      </div>

      {/* Main Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium text-white truncate">{expense.title}</p>
          <span className="text-xs text-white/30">{expense.expenseNumber}</span>
        </div>
        <div className="mt-1 flex items-center gap-3 text-xs text-white/50">
          <span>{category.name}</span>
          {vendor && (
            <>
              <span>•</span>
              <span>{vendor.name}</span>
            </>
          )}
          <span>•</span>
          <span>{format(new Date(expense.expenseDate), "MMM d, yyyy")}</span>
        </div>
      </div>

      {/* Amount */}
      <div className="text-right">
        <p className="font-semibold text-white">
          {formatCurrency(expense.amountMinor, expense.currency)}
        </p>
      </div>

      {/* Status */}
      <div className="w-32 flex justify-center">
        {getStatusBadge(expense.status)}
      </div>

      {/* Actions */}
      <PremiumDropdownMenu>
        <PremiumDropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </PremiumDropdownMenuTrigger>
        <PremiumDropdownMenuContent align="end">
          <PremiumDropdownMenuItem onClick={onView}>
            <Eye className="mr-2 h-4 w-4" />
            View Details
          </PremiumDropdownMenuItem>
          {canEdit && (
            <PremiumDropdownMenuItem onClick={onEdit}>
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </PremiumDropdownMenuItem>
          )}
        </PremiumDropdownMenuContent>
      </PremiumDropdownMenu>
    </div>
  );
}

// ========================
// Main Page Component
// ========================

export default function ExpensesListPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Filters state
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [categoryFilter, setCategoryFilter] = React.useState<string>("all");
  const [page, setPage] = React.useState(1);

  // Modals
  const [createModalOpen, setCreateModalOpen] = React.useState(false);

  // Data fetching
  const { data: categoriesData, isLoading: categoriesLoading } = useExpenseCategories();
  const seedCategories = useSeedDefaultCategories();

  const filters = React.useMemo(() => ({
    q: search || undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
    categoryId: categoryFilter !== "all" ? categoryFilter : undefined,
    page,
    limit: 20,
  }), [search, statusFilter, categoryFilter, page]);

  const { data: expensesData, isLoading: expensesLoading, refetch } = useExpenses(filters);

  const expenses = expensesData?.data || [];
  const pagination = expensesData?.pagination;
  const categories = categoriesData || [];

  // Compute KPIs
  const kpis = React.useMemo(() => {
    if (!expenses.length) {
      return {
        totalExpenses: 0,
        pendingApproval: 0,
        approved: 0,
        paid: 0,
        totalAmountPaid: 0,
      };
    }

    return {
      totalExpenses: pagination?.total || expenses.length,
      pendingApproval: expenses.filter((e) => e.status === "submitted").length,
      approved: expenses.filter((e) => e.status === "approved").length,
      paid: expenses.filter((e) => e.status === "paid").length,
      totalAmountPaid: expenses
        .filter((e) => e.status === "paid")
        .reduce((sum, e) => sum + e.amountMinor, 0),
    };
  }, [expenses, pagination]);

  // Auto-seed categories if empty
  React.useEffect(() => {
    if (!categoriesLoading && categories.length === 0) {
      seedCategories.mutate(undefined, {
        onSuccess: () => {
          toast.success("Default expense categories created");
        },
      });
    }
  }, [categoriesLoading, categories.length]);

  // Handle URL param for create modal
  React.useEffect(() => {
    if (searchParams.get("create") === "1") {
      setCreateModalOpen(true);
    }
  }, [searchParams]);

  const handleViewExpense = (id: string) => {
    router.push(`/admin/expenses/${id}`);
  };

  const handleEditExpense = (id: string) => {
    router.push(`/admin/expenses/${id}?edit=1`);
  };

  return (
    <div className="min-h-screen p-6 md:p-8">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white md:text-3xl">Expenses</h1>
          <p className="mt-1 text-sm text-white/50">
            Track and manage school operational expenses
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            onClick={() => refetch()}
            className="border-white/10 bg-white/5 hover:bg-white/10"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button
            onClick={() => setCreateModalOpen(true)}
            className="group bg-linear-to-r from-amber-500 to-orange-600 text-white hover:from-amber-600 hover:to-orange-700"
          >
            <Plus className="mr-2 h-4 w-4 transition-transform group-hover:rotate-90" />
            New Expense
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Total Expenses"
          value={String(pagination?.total || expenses.length)}
          subValue="All time"
          icon={Receipt}
          loading={expensesLoading}
        />
        <KPICard
          title="Pending Approval"
          value={String(kpis.pendingApproval)}
          subValue="Awaiting review"
          icon={Clock}
          loading={expensesLoading}
        />
        <KPICard
          title="Approved"
          value={String(kpis.approved)}
          subValue="Ready to pay"
          icon={CheckCircle2}
          loading={expensesLoading}
        />
        <KPICard
          title="Paid This View"
          value={formatCurrency(kpis.totalAmountPaid)}
          subValue={`${kpis.paid} expenses`}
          icon={DollarSign}
          loading={expensesLoading}
        />
      </div>

      {/* Filters */}
      <Card className="mb-6 overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/60 via-slate-950/60 to-black/60">
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
              <Input
                placeholder="Search expenses..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-10 border-white/10 bg-white/5 text-white placeholder:text-white/40"
              />
            </div>

            {/* Status Filter */}
            <PremiumSelect value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
              <PremiumSelectTrigger className="w-[180px]">
                <PremiumSelectValue placeholder="Status" />
              </PremiumSelectTrigger>
              <PremiumSelectContent>
                <PremiumSelectItem value="all">All Statuses</PremiumSelectItem>
                <PremiumSelectItem value="draft">Draft</PremiumSelectItem>
                <PremiumSelectItem value="submitted">Pending Approval</PremiumSelectItem>
                <PremiumSelectItem value="approved">Approved</PremiumSelectItem>
                <PremiumSelectItem value="rejected">Rejected</PremiumSelectItem>
                <PremiumSelectItem value="paid">Paid</PremiumSelectItem>
                <PremiumSelectItem value="cancelled">Cancelled</PremiumSelectItem>
              </PremiumSelectContent>
            </PremiumSelect>

            {/* Category Filter */}
            <PremiumSelect value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setPage(1); }}>
              <PremiumSelectTrigger className="w-[180px]">
                <PremiumSelectValue placeholder="Category" />
              </PremiumSelectTrigger>
              <PremiumSelectContent>
                <PremiumSelectItem value="all">All Categories</PremiumSelectItem>
                {categories.map((cat) => (
                  <PremiumSelectItem key={cat._id} value={cat._id}>
                    {cat.name}
                  </PremiumSelectItem>
                ))}
              </PremiumSelectContent>
            </PremiumSelect>
          </div>
        </CardContent>
      </Card>

      {/* Expenses List */}
      <Card className="overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/60 via-slate-950/60 to-black/60">
        <CardHeader className="border-b border-white/5 pb-4">
          <CardTitle className="text-lg font-semibold text-white">
            {statusFilter === "all" ? "All Expenses" : `${statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)} Expenses`}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          {expensesLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-4">
                  <Skeleton className="h-10 w-10 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-6 w-24" />
                  <Skeleton className="h-6 w-24" />
                </div>
              ))}
            </div>
          ) : expenses.length === 0 ? (
            <div className="py-12 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/5">
                <Receipt className="h-8 w-8 text-white/30" />
              </div>
              <h3 className="text-lg font-medium text-white">No expenses found</h3>
              <p className="mt-1 text-sm text-white/50">
                {search || statusFilter !== "all" || categoryFilter !== "all"
                  ? "Try adjusting your filters"
                  : "Create your first expense to get started"}
              </p>
              {!search && statusFilter === "all" && categoryFilter === "all" && (
                <Button
                  onClick={() => setCreateModalOpen(true)}
                  className="mt-4 bg-linear-to-r from-amber-500 to-orange-600"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create Expense
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {expenses.map((expense) => (
                <ExpenseRow
                  key={expense._id}
                  expense={expense}
                  onView={() => handleViewExpense(expense._id)}
                  onEdit={() => handleEditExpense(expense._id)}
                />
              ))}
            </div>
          )}

          {/* Pagination */}
          {pagination && pagination.pages > 1 && (
            <div className="mt-6 flex items-center justify-between border-t border-white/5 pt-4">
              <p className="text-sm text-white/50">
                Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
                {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
                {pagination.total} expenses
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="border-white/10 bg-white/5"
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
                  disabled={page === pagination.pages}
                  className="border-white/10 bg-white/5"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Expense Modal */}
      <CreateExpenseModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        onSuccess={() => refetch()}
      />
    </div>
  );
}
