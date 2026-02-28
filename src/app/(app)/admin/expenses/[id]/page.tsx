"use client";

import * as React from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns/format";
import {
  ArrowLeft,
  Receipt,
  Clock,
  CheckCircle2,
  XCircle,
  DollarSign,
  User,
  Building2,
  Calendar,
  FileText,
  Tag,
  CreditCard,
  Send,
  Check,
  X,
  Ban,
  Loader2,
  Edit,
  ExternalLink,
  ImageIcon,
  File,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ResponsiveModal } from "@/components/ui/responsive-modal";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import {
  useExpense,
  useSubmitExpense,
  useApproveExpense,
  useRejectExpense,
  useMarkExpensePaid,
  useCancelExpense,
  ExpenseDTO,
  ExpenseStatus,
  ExpensePaymentMethod,
} from "@/hooks/admin/useExpenses";
import { CreateExpenseModal } from "@/components/modals/CreateExpenseModal";
import { formatCurrency } from "@/lib/fees/money";
import { toast } from "sonner";
import Link from "next/link";

// ========================
// Helper Functions
// ========================

function getStatusConfig(status: ExpenseStatus) {
  const config: Record<
    ExpenseStatus,
    { label: string; color: string; bgColor: string; icon: React.ReactNode }
  > = {
    draft: {
      label: "Draft",
      color: "text-slate-400",
      bgColor: "bg-slate-500/10",
      icon: <Edit className="h-5 w-5" />,
    },
    submitted: {
      label: "Pending Approval",
      color: "text-amber-400",
      bgColor: "bg-amber-500/10",
      icon: <Clock className="h-5 w-5" />,
    },
    approved: {
      label: "Approved",
      color: "text-emerald-400",
      bgColor: "bg-emerald-500/10",
      icon: <CheckCircle2 className="h-5 w-5" />,
    },
    rejected: {
      label: "Rejected",
      color: "text-red-400",
      bgColor: "bg-red-500/10",
      icon: <XCircle className="h-5 w-5" />,
    },
    paid: {
      label: "Paid",
      color: "text-blue-400",
      bgColor: "bg-blue-500/10",
      icon: <DollarSign className="h-5 w-5" />,
    },
    cancelled: {
      label: "Cancelled",
      color: "text-gray-400",
      bgColor: "bg-gray-500/10",
      icon: <Ban className="h-5 w-5" />,
    },
  };
  return config[status];
}

// ========================
// Timeline Component
// ========================

function ExpenseTimeline({ expense }: { expense: ExpenseDTO }) {
  const events: Array<{
    label: string;
    date: string | null;
    user: { _id: string; name: string; email: string } | null | undefined;
    detail?: string;
    status: "complete" | "current" | "upcoming";
  }> = [];

  // Created
  events.push({
    label: "Created",
    date: expense.createdAt,
    user: expense.createdBy,
    status: "complete",
  });

  // Submitted
  if (expense.submittedAt) {
    events.push({
      label: "Submitted",
      date: expense.submittedAt,
      user: expense.submittedBy,
      status: "complete",
    });
  } else if (expense.status === "draft") {
    events.push({
      label: "Submit for Approval",
      date: null,
      user: null,
      status: "upcoming",
    });
  }

  // Approved or Rejected
  if (expense.approvedAt) {
    events.push({
      label: "Approved",
      date: expense.approvedAt,
      user: expense.approvedBy,
      detail: expense.approvalNote || undefined,
      status: "complete",
    });
  } else if (expense.rejectedAt) {
    events.push({
      label: "Rejected",
      date: expense.rejectedAt,
      user: expense.rejectedBy,
      detail: expense.rejectionReason || undefined,
      status: "complete",
    });
  } else if (expense.status === "submitted") {
    events.push({
      label: "Awaiting Approval",
      date: null,
      user: null,
      status: "current",
    });
  }

  // Paid
  if (expense.paidAt) {
    events.push({
      label: "Paid",
      date: expense.paidAt,
      user: expense.paidBy,
      detail: expense.paymentMethod
        ? `Via ${expense.paymentMethod.replace("_", " ")}`
        : undefined,
      status: "complete",
    });
  } else if (expense.status === "approved") {
    events.push({
      label: "Mark as Paid",
      date: null,
      user: null,
      status: "upcoming",
    });
  }

  // Cancelled
  if (expense.cancelledAt) {
    events.push({
      label: "Cancelled",
      date: expense.cancelledAt,
      user: expense.cancelledBy,
      detail: expense.cancellationReason || undefined,
      status: "complete",
    });
  }

  return (
    <div className="space-y-4">
      {events.map((event, idx) => (
        <div key={idx} className="flex gap-4">
          <div className="flex flex-col items-center">
            <div
              className={`h-3 w-3 rounded-full ${
                event.status === "complete"
                  ? "bg-emerald-500"
                  : event.status === "current"
                  ? "bg-amber-500 animate-pulse"
                  : "bg-white/20"
              }`}
            />
            {idx < events.length - 1 && (
              <div className="flex-1 w-px bg-white/10 my-1" />
            )}
          </div>
          <div className="flex-1 pb-4">
            <p
              className={`font-medium ${
                event.status === "upcoming" ? "text-white/40" : "text-white"
              }`}
            >
              {event.label}
            </p>
            {event.date && (
              <p className="text-xs text-white/50">
                {format(new Date(event.date), "MMM d, yyyy 'at' h:mm a")}
                {event.user && ` by ${event.user.name}`}
              </p>
            )}
            {event.detail && (
              <p className="mt-1 text-xs text-white/40 italic">
                &quot;{event.detail}&quot;
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ========================
// Main Page Component
// ========================

export default function ExpenseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = params.id as string;

  // Data fetching
  const { data: expense, isLoading, refetch } = useExpense(id);

  // Mutations
  const submitExpense = useSubmitExpense();
  const approveExpense = useApproveExpense();
  const rejectExpense = useRejectExpense();
  const markPaid = useMarkExpensePaid();
  const cancelExpense = useCancelExpense();

  // Modal states
  const [editModalOpen, setEditModalOpen] = React.useState(false);
  const [rejectModalOpen, setRejectModalOpen] = React.useState(false);
  const [cancelModalOpen, setCancelModalOpen] = React.useState(false);
  const [payModalOpen, setPayModalOpen] = React.useState(false);

  // Form states
  const [rejectReason, setRejectReason] = React.useState("");
  const [cancelReason, setCancelReason] = React.useState("");
  const [paymentMethod, setPaymentMethod] = React.useState<ExpensePaymentMethod>("bank_transfer");
  const [paymentReference, setPaymentReference] = React.useState("");

  // Check for edit param
  React.useEffect(() => {
    if (searchParams.get("edit") === "1" && expense) {
      setEditModalOpen(true);
    }
  }, [searchParams, expense]);

  // Handlers
  const handleSubmit = async () => {
    try {
      await submitExpense.mutateAsync(id);
      toast.success("Expense submitted for approval");
      refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to submit");
    }
  };

  const handleApprove = async () => {
    try {
      await approveExpense.mutateAsync({ id });
      toast.success("Expense approved");
      refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to approve");
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      toast.error("Rejection reason is required");
      return;
    }
    try {
      await rejectExpense.mutateAsync({ id, reason: rejectReason });
      toast.success("Expense rejected");
      setRejectModalOpen(false);
      setRejectReason("");
      refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to reject");
    }
  };

  const handleMarkPaid = async () => {
    try {
      await markPaid.mutateAsync({
        id,
        paymentMethod,
        paymentReference: paymentReference || undefined,
      });
      toast.success("Expense marked as paid");
      setPayModalOpen(false);
      refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to mark as paid");
    }
  };

  const handleCancel = async () => {
    if (!cancelReason.trim()) {
      toast.error("Cancellation reason is required");
      return;
    }
    try {
      await cancelExpense.mutateAsync({ id, reason: cancelReason });
      toast.success("Expense cancelled");
      setCancelModalOpen(false);
      setCancelReason("");
      refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to cancel");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen p-6 md:p-8">
        <Skeleton className="h-8 w-48 mb-6" />
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-48 rounded-2xl" />
            <Skeleton className="h-64 rounded-2xl" />
          </div>
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!expense) {
    return (
      <div className="min-h-screen p-6 md:p-8">
        <div className="text-center py-12">
          <Receipt className="mx-auto h-12 w-12 text-white/30" />
          <h2 className="mt-4 text-lg font-medium text-white">Expense not found</h2>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => router.push("/admin/expenses")}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Expenses
          </Button>
        </div>
      </div>
    );
  }

  const category =
    typeof expense.categoryId === "object" ? expense.categoryId : null;
  const vendor =
    typeof expense.vendorId === "object" && expense.vendorId
      ? expense.vendorId
      : null;
  const statusConfig = getStatusConfig(expense.status);
  const canEdit = expense.status === "draft" || expense.status === "rejected";
  const canSubmit = expense.status === "draft" || expense.status === "rejected";
  const canApprove = expense.status === "submitted";
  const canReject = expense.status === "submitted";
  const canPay = expense.status === "approved";
  const canCancel = ["draft", "submitted", "rejected"].includes(expense.status);

  const paymentMethods: { value: ExpensePaymentMethod; label: string }[] = [
    { value: "cash", label: "Cash" },
    { value: "mobile_money", label: "Mobile Money" },
    { value: "bank_transfer", label: "Bank Transfer" },
    { value: "cheque", label: "Cheque" },
    { value: "card", label: "Card" },
    { value: "other", label: "Other" },
  ];

  return (
    <div className="min-h-screen p-6 md:p-8">
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/admin/expenses")}
          className="shrink-0"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-white md:text-2xl">
              {expense.title}
            </h1>
            <span className="text-sm text-white/40">{expense.expenseNumber}</span>
          </div>
          <p className="mt-1 text-sm text-white/50">
            Created {format(new Date(expense.createdAt), "MMM d, yyyy")}
          </p>
        </div>
        {canEdit && (
          <Button
            variant="outline"
            onClick={() => setEditModalOpen(true)}
            className="border-white/10 bg-white/5 hover:bg-white/10"
          >
            <Edit className="mr-2 h-4 w-4" />
            Edit
          </Button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Status and Amount Card */}
          <Card className="overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/60 via-slate-950/60 to-black/60">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`rounded-xl p-3 ${statusConfig.bgColor}`}>
                    <span className={statusConfig.color}>{statusConfig.icon}</span>
                  </div>
                  <div>
                    <p className="text-sm text-white/50">Status</p>
                    <p className={`text-lg font-semibold ${statusConfig.color}`}>
                      {statusConfig.label}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-white/50">Amount</p>
                  <p className="text-2xl font-bold text-white">
                    {formatCurrency(expense.amountMinor, { currency: expense.currency })}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-6 flex flex-wrap gap-3">
                {canSubmit && (
                  <Button
                    onClick={handleSubmit}
                    disabled={submitExpense.isPending}
                    className="bg-linear-to-r from-amber-500 to-orange-600"
                  >
                    {submitExpense.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="mr-2 h-4 w-4" />
                    )}
                    Submit for Approval
                  </Button>
                )}
                {canApprove && (
                  <Button
                    onClick={handleApprove}
                    disabled={approveExpense.isPending}
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    {approveExpense.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="mr-2 h-4 w-4" />
                    )}
                    Approve
                  </Button>
                )}
                {canReject && (
                  <Button
                    variant="destructive"
                    onClick={() => setRejectModalOpen(true)}
                  >
                    <X className="mr-2 h-4 w-4" />
                    Reject
                  </Button>
                )}
                {canPay && (
                  <Button
                    onClick={() => setPayModalOpen(true)}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <CreditCard className="mr-2 h-4 w-4" />
                    Mark as Paid
                  </Button>
                )}
                {canCancel && (
                  <Button
                    variant="outline"
                    onClick={() => setCancelModalOpen(true)}
                    className="border-white/10 bg-white/5 hover:bg-white/10"
                  >
                    <Ban className="mr-2 h-4 w-4" />
                    Cancel
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Details Card */}
          <Card className="overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/60 via-slate-950/60 to-black/60">
            <CardHeader className="border-b border-white/5">
              <CardTitle className="text-lg text-white">Details</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                {/* Category */}
                <div className="flex items-start gap-3">
                  <Tag className="h-5 w-5 text-white/40 mt-0.5" />
                  <div>
                    <p className="text-xs text-white/40">Category</p>
                    <p className="text-white">{category?.name || "Unknown"}</p>
                  </div>
                </div>

                {/* Vendor */}
                <div className="flex items-start gap-3">
                  <Building2 className="h-5 w-5 text-white/40 mt-0.5" />
                  <div>
                    <p className="text-xs text-white/40">Vendor</p>
                    <p className="text-white">{vendor?.name || "No vendor"}</p>
                  </div>
                </div>

                {/* Date */}
                <div className="flex items-start gap-3">
                  <Calendar className="h-5 w-5 text-white/40 mt-0.5" />
                  <div>
                    <p className="text-xs text-white/40">Expense Date</p>
                    <p className="text-white">
                      {format(new Date(expense.expenseDate), "MMMM d, yyyy")}
                    </p>
                  </div>
                </div>

                {/* Cost Center */}
                {expense.costCenter && (
                  <div className="flex items-start gap-3">
                    <FileText className="h-5 w-5 text-white/40 mt-0.5" />
                    <div>
                      <p className="text-xs text-white/40">Cost Center</p>
                      <p className="text-white capitalize">
                        {expense.costCenter.replace("_", " ")}
                      </p>
                    </div>
                  </div>
                )}

                {/* Payment Method (if paid) */}
                {expense.paymentMethod && (
                  <div className="flex items-start gap-3">
                    <CreditCard className="h-5 w-5 text-white/40 mt-0.5" />
                    <div>
                      <p className="text-xs text-white/40">Payment Method</p>
                      <p className="text-white capitalize">
                        {expense.paymentMethod.replace("_", " ")}
                      </p>
                    </div>
                  </div>
                )}

                {/* Payment Reference */}
                {expense.paymentReference && (
                  <div className="flex items-start gap-3">
                    <FileText className="h-5 w-5 text-white/40 mt-0.5" />
                    <div>
                      <p className="text-xs text-white/40">Reference</p>
                      <p className="text-white">{expense.paymentReference}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Description */}
              {expense.description && (
                <>
                  <Separator className="bg-white/5" />
                  <div>
                    <p className="text-xs text-white/40 mb-2">Description</p>
                    <p className="text-white/80 text-sm">{expense.description}</p>
                  </div>
                </>
              )}

              {/* Notes */}
              {expense.notes && (
                <>
                  <Separator className="bg-white/5" />
                  <div>
                    <p className="text-xs text-white/40 mb-2">Internal Notes</p>
                    <p className="text-white/60 text-sm italic">{expense.notes}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Receipts Card */}
          {expense.receipts && expense.receipts.length > 0 && (
            <Card className="overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/60 via-slate-950/60 to-black/60">
              <CardHeader className="border-b border-white/5">
                <CardTitle className="text-lg text-white">
                  Receipts ({expense.receipts.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {expense.receipts.map((receipt, idx) => (
                    <a
                      key={idx}
                      href={receipt.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-4 transition-colors hover:bg-white/10"
                    >
                      {receipt.type === "image" ? (
                        <ImageIcon className="h-8 w-8 text-white/40" />
                      ) : (
                        <File className="h-8 w-8 text-white/40" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">
                          {receipt.name || `Receipt ${idx + 1}`}
                        </p>
                        <p className="text-xs text-white/40">
                          {format(new Date(receipt.uploadedAt), "MMM d, yyyy")}
                        </p>
                      </div>
                      <ExternalLink className="h-4 w-4 text-white/40" />
                    </a>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar - Timeline */}
        <div>
          <Card className="overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/60 via-slate-950/60 to-black/60 sticky top-24">
            <CardHeader className="border-b border-white/5">
              <CardTitle className="text-lg text-white">Timeline</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <ExpenseTimeline expense={expense} />
            </CardContent>
          </Card>

          {/* Ledger Link (if paid) */}
          {expense.financialTransactionId && (
            <Card className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/60 via-slate-950/60 to-black/60">
              <CardContent className="p-4">
                <Link
                  href={`/admin/finance/transactions/${expense.financialTransactionId}`}
                  className="flex items-center gap-3 text-white/80 hover:text-white transition-colors"
                >
                  <DollarSign className="h-5 w-5" />
                  <span className="text-sm">View Ledger Entry</span>
                  <ExternalLink className="ml-auto h-4 w-4" />
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      <CreateExpenseModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        expense={expense}
        onSuccess={() => refetch()}
      />

      {/* Reject Modal */}
      <ResponsiveModal
        open={rejectModalOpen}
        onOpenChange={setRejectModalOpen}
        title="Reject Expense"
        description="Provide a reason for rejecting this expense"
      >
        <div className="space-y-4 p-1">
          <div className="space-y-2">
            <Label className="text-white/80">Rejection Reason</Label>
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Why is this expense being rejected?"
              className="min-h-[100px] border-white/10 bg-white/5 text-white placeholder:text-white/40"
            />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
            <Button
              variant="outline"
              onClick={() => setRejectModalOpen(false)}
              className="border-white/10 bg-white/5"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={rejectExpense.isPending}
            >
              {rejectExpense.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Reject Expense
            </Button>
          </div>
        </div>
      </ResponsiveModal>

      {/* Cancel Modal */}
      <ResponsiveModal
        open={cancelModalOpen}
        onOpenChange={setCancelModalOpen}
        title="Cancel Expense"
        description="Provide a reason for cancelling this expense"
      >
        <div className="space-y-4 p-1">
          <div className="space-y-2">
            <Label className="text-white/80">Cancellation Reason</Label>
            <Textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Why is this expense being cancelled?"
              className="min-h-[100px] border-white/10 bg-white/5 text-white placeholder:text-white/40"
            />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
            <Button
              variant="outline"
              onClick={() => setCancelModalOpen(false)}
              className="border-white/10 bg-white/5"
            >
              Back
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={cancelExpense.isPending}
            >
              {cancelExpense.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Cancel Expense
            </Button>
          </div>
        </div>
      </ResponsiveModal>

      {/* Mark as Paid Modal */}
      <ResponsiveModal
        open={payModalOpen}
        onOpenChange={setPayModalOpen}
        title="Mark as Paid"
        description="Record payment details for this expense"
      >
        <div className="space-y-4 p-1">
          <div className="space-y-2">
            <Label className="text-white/80">Payment Method</Label>
            <PremiumSelect value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as ExpensePaymentMethod)}>
              <PremiumSelectTrigger>
                <PremiumSelectValue />
              </PremiumSelectTrigger>
              <PremiumSelectContent>
                {paymentMethods.map((pm) => (
                  <PremiumSelectItem key={pm.value} value={pm.value}>
                    {pm.label}
                  </PremiumSelectItem>
                ))}
              </PremiumSelectContent>
            </PremiumSelect>
          </div>

          <div className="space-y-2">
            <Label className="text-white/80">Payment Reference (Optional)</Label>
            <Input
              value={paymentReference}
              onChange={(e) => setPaymentReference(e.target.value)}
              placeholder="e.g., Cheque number, transfer reference"
              className="border-white/10 bg-white/5 text-white placeholder:text-white/40"
            />
          </div>

          <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 p-4">
            <p className="text-sm text-blue-300">
              This will create a ledger entry in the Financial Center for{" "}
              <strong>{formatCurrency(expense.amountMinor, { currency: expense.currency })}</strong>
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
            <Button
              variant="outline"
              onClick={() => setPayModalOpen(false)}
              className="border-white/10 bg-white/5"
            >
              Cancel
            </Button>
            <Button
              onClick={handleMarkPaid}
              disabled={markPaid.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {markPaid.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Confirm Payment
            </Button>
          </div>
        </div>
      </ResponsiveModal>
    </div>
  );
}
