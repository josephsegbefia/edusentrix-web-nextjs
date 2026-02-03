"use client";

import * as React from "react";
import Link from "next/link";
import { format } from "date-fns/format";
import {
  Plus,
  Calculator,
  TrendingUp,
  TrendingDown,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  CheckCircle,
  Clock,
  Archive,
  Calendar,
  DollarSign,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  PremiumDropdownMenuTrigger,
} from "@/components/ui/premium-dropdown-menu";
import {
  useBudgets,
  useBudget,
  useDeleteBudget,
  useUpdateBudget,
  BudgetListItem,
  BudgetDetail,
} from "@/hooks/admin/useBudgets";
import { ResponsiveModal } from "@/components/ui/responsive-modal";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useConfirmationDialog } from "@/hooks/useConfirmationDialog";

// ========================
// Helper Functions
// ========================

function formatCurrency(amountMinor: number, currency = "GHS") {
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amountMinor / 100);
}

function getStatusBadge(status: string) {
  switch (status) {
    case "draft":
      return (
        <Badge variant="outline" className="border-yellow-500/30 text-yellow-400 bg-yellow-500/10">
          <Clock className="mr-1 h-3 w-3" />
          Draft
        </Badge>
      );
    case "active":
      return (
        <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 bg-emerald-500/10">
          <CheckCircle className="mr-1 h-3 w-3" />
          Active
        </Badge>
      );
    case "closed":
      return (
        <Badge variant="outline" className="border-slate-500/30 text-slate-400 bg-slate-500/10">
          <Archive className="mr-1 h-3 w-3" />
          Closed
        </Badge>
      );
    default:
      return null;
  }
}

function getPeriodLabel(periodType: string) {
  const labels: Record<string, string> = {
    monthly: "Monthly",
    quarterly: "Quarterly",
    termly: "Per Term",
    yearly: "Yearly",
  };
  return labels[periodType] || periodType;
}

// ========================
// Budget Card Component
// ========================

interface BudgetCardProps {
  budget: BudgetListItem;
  onViewDetails: (id: string) => void;
  onActivate: (id: string) => void;
  onDelete: (id: string) => void;
}

function BudgetCard({ budget, onViewDetails, onActivate, onDelete }: BudgetCardProps) {
  return (
    <Card className="overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/60 via-slate-950/60 to-black/60 hover:border-white/20 transition-colors">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {getStatusBadge(budget.status)}
              <span className="text-xs text-white/40">
                {getPeriodLabel(budget.periodType)}
              </span>
            </div>
            <h3 className="font-semibold text-white truncate">{budget.name}</h3>
            <p className="text-xs text-white/50 mt-1">
              {format(new Date(budget.startDate), "MMM d, yyyy")} -{" "}
              {format(new Date(budget.endDate), "MMM d, yyyy")}
            </p>
          </div>
          <PremiumDropdownMenu>
            <PremiumDropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="shrink-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </PremiumDropdownMenuTrigger>
            <PremiumDropdownMenuContent>
              <PremiumDropdownMenuItem onClick={() => onViewDetails(budget.id)}>
                <Eye className="mr-2 h-4 w-4" />
                View Details
              </PremiumDropdownMenuItem>
              {budget.status === "draft" && (
                <>
                  <PremiumDropdownMenuItem onClick={() => onActivate(budget.id)}>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Activate
                  </PremiumDropdownMenuItem>
                  <PremiumDropdownMenuItem
                    onClick={() => onDelete(budget.id)}
                    className="text-red-400"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </PremiumDropdownMenuItem>
                </>
              )}
            </PremiumDropdownMenuContent>
          </PremiumDropdownMenu>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-white/50 mb-1">Budgeted</p>
            <p className="text-lg font-bold text-white">
              {formatCurrency(budget.totalBudgetedMinor, budget.currency)}
            </p>
          </div>
          <div>
            <p className="text-xs text-white/50 mb-1">Categories</p>
            <p className="text-lg font-bold text-white">{budget.lineItemCount}</p>
          </div>
        </div>

        <Button
          variant="ghost"
          className="w-full mt-4 text-white/60 hover:text-white hover:bg-white/5"
          onClick={() => onViewDetails(budget.id)}
        >
          View Details
        </Button>
      </CardContent>
    </Card>
  );
}

// ========================
// Budget Detail Modal
// ========================

interface BudgetDetailModalProps {
  budgetId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function BudgetDetailModal({ budgetId, open, onOpenChange }: BudgetDetailModalProps) {
  const { data: budget, isLoading } = useBudget(budgetId);

  if (!open) return null;

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title={budget?.name || "Budget Details"}
      description={
        budget
          ? `${format(new Date(budget.startDate), "MMM d, yyyy")} - ${format(new Date(budget.endDate), "MMM d, yyyy")}`
          : "Loading..."
      }
    >
      {isLoading ? (
        <div className="space-y-4 p-4">
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
        </div>
      ) : budget ? (
        <div className="space-y-6 p-1">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-xl bg-white/5 p-4 text-center">
              <p className="text-xs text-white/50 mb-1">Budgeted</p>
              <p className="text-lg font-bold text-white">
                {formatCurrency(budget.totalBudgetedMinor, budget.currency)}
              </p>
            </div>
            <div className="rounded-xl bg-white/5 p-4 text-center">
              <p className="text-xs text-white/50 mb-1">Actual</p>
              <p className="text-lg font-bold text-white">
                {formatCurrency(budget.totalActualMinor, budget.currency)}
              </p>
            </div>
            <div
              className={cn(
                "rounded-xl p-4 text-center",
                budget.totalVarianceMinor >= 0 ? "bg-emerald-500/10" : "bg-red-500/10"
              )}
            >
              <p className="text-xs text-white/50 mb-1">Variance</p>
              <p
                className={cn(
                  "text-lg font-bold",
                  budget.totalVarianceMinor >= 0 ? "text-emerald-400" : "text-red-400"
                )}
              >
                {budget.totalVarianceMinor >= 0 ? "+" : ""}
                {formatCurrency(budget.totalVarianceMinor, budget.currency)}
              </p>
            </div>
          </div>

          {/* Usage Progress */}
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-white/60">Budget Usage</span>
              <span
                className={cn(
                  "font-medium",
                  budget.percentUsed > 100
                    ? "text-red-400"
                    : budget.percentUsed > 80
                      ? "text-yellow-400"
                      : "text-emerald-400"
                )}
              >
                {budget.percentUsed}%
              </span>
            </div>
            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  budget.percentUsed > 100
                    ? "bg-red-500"
                    : budget.percentUsed > 80
                      ? "bg-yellow-500"
                      : "bg-emerald-500"
                )}
                style={{ width: `${Math.min(budget.percentUsed, 100)}%` }}
              />
            </div>
          </div>

          {/* Line Items */}
          <div>
            <h4 className="text-sm font-medium text-white/80 mb-3">Category Breakdown</h4>
            <div className="space-y-3">
              {budget.lineItems.map((item) => (
                <div
                  key={item.categoryId}
                  className="rounded-xl border border-white/10 bg-white/5 p-3"
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-medium text-white">{item.categoryName}</span>
                    <span
                      className={cn(
                        "text-xs font-medium",
                        item.percentUsed > 100
                          ? "text-red-400"
                          : item.percentUsed > 80
                            ? "text-yellow-400"
                            : "text-emerald-400"
                      )}
                    >
                      {item.percentUsed}%
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/10 overflow-hidden mb-2">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        item.percentUsed > 100
                          ? "bg-red-500"
                          : item.percentUsed > 80
                            ? "bg-yellow-500"
                            : "bg-emerald-500"
                      )}
                      style={{ width: `${Math.min(item.percentUsed, 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-white/50">
                    <span>
                      {formatCurrency(item.actualAmountMinor, budget.currency)} /{" "}
                      {formatCurrency(item.budgetedAmountMinor, budget.currency)}
                    </span>
                    <span
                      className={item.varianceMinor >= 0 ? "text-emerald-400" : "text-red-400"}
                    >
                      {item.varianceMinor >= 0 ? "+" : ""}
                      {formatCurrency(item.varianceMinor, budget.currency)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="py-8 text-center text-white/40">Budget not found</div>
      )}
    </ResponsiveModal>
  );
}

// ========================
// Main Page Component
// ========================

export default function BudgetsPage() {
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [selectedBudgetId, setSelectedBudgetId] = React.useState<string | null>(null);
  const [detailModalOpen, setDetailModalOpen] = React.useState(false);
  const { confirm, confirmationDialog } = useConfirmationDialog();

  const { data, isLoading, refetch } = useBudgets({ status: statusFilter !== "all" ? statusFilter : undefined });
  const deleteBudget = useDeleteBudget();
  const updateBudget = useUpdateBudget();

  const budgets = data?.data || [];

  const handleViewDetails = (id: string) => {
    setSelectedBudgetId(id);
    setDetailModalOpen(true);
  };

  const handleActivate = async (id: string) => {
    try {
      await updateBudget.mutateAsync({ budgetId: id, status: "active" });
      toast.success("Budget activated successfully");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to activate budget");
    }
  };

  const handleDelete = async (id: string) => {
    const decision = await confirm({
      title: "Delete Budget?",
      description: "Are you sure you want to delete this budget?",
      confirmLabel: "Delete Budget",
      cancelLabel: "Keep Budget",
      intent: "destructive",
    });
    if (decision !== "confirm") return;
    try {
      await deleteBudget.mutateAsync(id);
      toast.success("Budget deleted successfully");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete budget");
    }
  };

  return (
    <div className="min-h-screen p-6 md:p-8">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br from-violet-500/20 to-purple-600/20">
            <Calculator className="h-6 w-6 text-violet-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white md:text-3xl">Budgets</h1>
            <p className="mt-1 text-sm text-white/50">
              Plan and track expense budgets by category
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <PremiumSelect value={statusFilter} onValueChange={setStatusFilter}>
            <PremiumSelectTrigger className="w-36">
              <PremiumSelectValue placeholder="Status" />
            </PremiumSelectTrigger>
            <PremiumSelectContent>
              <PremiumSelectItem value="all">All Status</PremiumSelectItem>
              <PremiumSelectItem value="draft">Draft</PremiumSelectItem>
              <PremiumSelectItem value="active">Active</PremiumSelectItem>
              <PremiumSelectItem value="closed">Closed</PremiumSelectItem>
            </PremiumSelectContent>
          </PremiumSelect>
          <Link href="/admin/finance/budgets/create">
            <Button className="bg-linear-to-r from-violet-500 to-purple-600 text-white hover:from-violet-600 hover:to-purple-700">
              <Plus className="mr-2 h-4 w-4" />
              Create Budget
            </Button>
          </Link>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-2xl" />
          ))}
        </div>
      ) : budgets.length === 0 ? (
        <Card className="rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/60 via-slate-950/60 to-black/60">
          <CardContent className="py-12 text-center">
            <Calculator className="mx-auto h-12 w-12 text-white/20" />
            <h3 className="mt-4 text-lg font-medium text-white">No budgets yet</h3>
            <p className="mt-2 text-sm text-white/50">
              Create your first budget to start tracking expenses
            </p>
            <Link href="/admin/finance/budgets/create">
              <Button className="mt-4 bg-linear-to-r from-violet-500 to-purple-600 text-white">
                <Plus className="mr-2 h-4 w-4" />
                Create Budget
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {budgets.map((budget) => (
            <BudgetCard
              key={budget.id}
              budget={budget}
              onViewDetails={handleViewDetails}
              onActivate={handleActivate}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Detail Modal */}
      <BudgetDetailModal
        budgetId={selectedBudgetId}
        open={detailModalOpen}
        onOpenChange={setDetailModalOpen}
      />
      {confirmationDialog}
    </div>
  );
}
