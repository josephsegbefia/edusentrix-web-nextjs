"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns/format";
import {
  ArrowLeft,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  Calendar,
  User,
  Building2,
  Tag,
  CreditCard,
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ExternalLink,
  ImageIcon,
  File,
  Hash,
  Layers,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  useFinancialTransaction,
  useApproveTransaction,
  useReconcileTransaction,
  ReconciliationProvider,
  TransactionStatus,
} from "@/hooks/admin/useFinancialCenter";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
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

function getStatusConfig(status: TransactionStatus) {
  const config: Record<
    TransactionStatus,
    { label: string; color: string; bgColor: string; icon: React.ReactNode }
  > = {
    pending: {
      label: "Pending",
      color: "text-amber-400",
      bgColor: "bg-amber-500/10",
      icon: <Clock className="h-5 w-5" />,
    },
    processing: {
      label: "Processing",
      color: "text-blue-400",
      bgColor: "bg-blue-500/10",
      icon: <RefreshCw className="h-5 w-5 animate-spin" />,
    },
    success: {
      label: "Success",
      color: "text-emerald-400",
      bgColor: "bg-emerald-500/10",
      icon: <CheckCircle2 className="h-5 w-5" />,
    },
    failed: {
      label: "Failed",
      color: "text-red-400",
      bgColor: "bg-red-500/10",
      icon: <XCircle className="h-5 w-5" />,
    },
    refunded: {
      label: "Refunded",
      color: "text-purple-400",
      bgColor: "bg-purple-500/10",
      icon: <ArrowUpRight className="h-5 w-5" />,
    },
    reversed: {
      label: "Reversed",
      color: "text-orange-400",
      bgColor: "bg-orange-500/10",
      icon: <RefreshCw className="h-5 w-5" />,
    },
    voided: {
      label: "Voided",
      color: "text-gray-400",
      bgColor: "bg-gray-500/10",
      icon: <XCircle className="h-5 w-5" />,
    },
    disputed: {
      label: "Disputed",
      color: "text-red-400",
      bgColor: "bg-red-500/10",
      icon: <AlertCircle className="h-5 w-5" />,
    },
    held: {
      label: "Held",
      color: "text-amber-400",
      bgColor: "bg-amber-500/10",
      icon: <AlertCircle className="h-5 w-5" />,
    },
  };
  return config[status] || config.pending;
}

function getCategoryLabel(category: string) {
  const labels: Record<string, string> = {
    fees: "Fees",
    store: "Store",
    fundraising: "Fundraising",
    expenses: "Expenses",
    other_income: "Other Income",
    refund: "Refund",
    adjustment: "Adjustment",
    gateway_fee: "Gateway Fee",
    bank_charge: "Bank Charge",
    penalty: "Penalty",
    discount: "Discount",
  };
  return labels[category] || category;
}

function getMethodLabel(method: string) {
  const labels: Record<string, string> = {
    cash: "Cash",
    mobile_money: "Mobile Money",
    bank_transfer: "Bank Transfer",
    card: "Card",
    cheque: "Cheque",
    other: "Other",
  };
  return labels[method] || method;
}

const RECONCILIATION_PROVIDER_OPTIONS: Array<{
  value: ReconciliationProvider;
  label: string;
}> = [
  { value: "paystack", label: "Paystack" },
  { value: "hubtel", label: "Hubtel" },
  { value: "mtn_momo", label: "MTN MoMo" },
  { value: "bank", label: "Bank Statement" },
  { value: "manual", label: "Manual Entry" },
];

function getReconciliationStatusBadge(status: string) {
  if (status === "matched") {
    return (
      <Badge
        variant="outline"
        className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300 capitalize"
      >
        Matched
      </Badge>
    );
  }
  if (status === "disputed") {
    return (
      <Badge
        variant="outline"
        className="border-red-500/30 bg-red-500/10 text-red-300 capitalize"
      >
        Disputed
      </Badge>
    );
  }
  if (status === "ignored") {
    return (
      <Badge
        variant="outline"
        className="border-slate-500/30 bg-slate-500/10 text-slate-300 capitalize"
      >
        Ignored
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="border-amber-500/30 bg-amber-500/10 text-amber-200 capitalize"
    >
      Unmatched
    </Badge>
  );
}

function getSourceModuleLink(sourceModule: string, sourceId?: string | null) {
  if (!sourceId) return null;
  
  const links: Record<string, string> = {
    expenses: `/admin/expenses/${sourceId}`,
    fees: `/admin/fees/payments/${sourceId}`,
    fundraising: `/admin/community/fundraising`,
    store: `/admin/store/orders/${sourceId}`,
  };
  
  return links[sourceModule] || null;
}

function formatDualControlTrigger(trigger: string) {
  if (trigger === "manual_entry") return "Manual entry";
  if (trigger === "high_value") return "High value";
  if (trigger === "sensitive_category") return "Sensitive category";
  return trigger.replace("_", " ");
}

// ========================
// Info Row Component
// ========================

function InfoRow({
  icon: Icon,
  label,
  value,
  subValue,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
  subValue?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="h-5 w-5 text-white/40 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-white/40">{label}</p>
        <p className="text-white">{value}</p>
        {subValue && <p className="text-xs text-white/50 mt-0.5">{subValue}</p>}
      </div>
    </div>
  );
}

// ========================
// Main Page Component
// ========================

export default function TransactionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { data: transaction, isLoading, refetch } = useFinancialTransaction(id);
  const approveTransaction = useApproveTransaction();
  const reconcileTransaction = useReconcileTransaction();

  // Approval state
  const [showApprovalForm, setShowApprovalForm] = React.useState(false);
  const [approvalAction, setApprovalAction] = React.useState<"approve" | "reject">("approve");
  const [reviewNotes, setReviewNotes] = React.useState("");
  const [showReconciliationForm, setShowReconciliationForm] = React.useState(false);
  const [reconciliationAction, setReconciliationAction] = React.useState<
    "match" | "unmatch" | "dispute" | "ignore"
  >("match");
  const [provider, setProvider] = React.useState<ReconciliationProvider>("bank");
  const [providerReference, setProviderReference] = React.useState("");
  const [settlementBatchId, setSettlementBatchId] = React.useState("");
  const [reconciliationReason, setReconciliationReason] = React.useState("");

  const handleApproval = async () => {
    try {
      await approveTransaction.mutateAsync({
        transactionId: id,
        action: approvalAction,
        reviewNotes: reviewNotes.trim() || undefined,
      });
      toast.success(
        approvalAction === "approve"
          ? "Transaction approved successfully"
          : "Transaction rejected"
      );
      setShowApprovalForm(false);
      setReviewNotes("");
      refetch();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to process approval"
      );
    }
  };

  const reconciliationStatus = transaction?.reconciliation?.status || "unmatched";
  const canMarkMatched =
    ["unmatched", "disputed", "ignored"].includes(reconciliationStatus) &&
    ["success", "refunded", "reversed"].includes(transaction?.status || "");
  const canDispute = ["unmatched", "matched"].includes(reconciliationStatus);
  const canIgnore = ["unmatched", "disputed"].includes(reconciliationStatus);
  const canUnmatch = reconciliationStatus !== "unmatched";

  const openReconciliationForm = React.useCallback(
    (action: "match" | "unmatch" | "dispute" | "ignore") => {
      setReconciliationAction(action);
      setShowReconciliationForm(true);
      if (action === "match") {
        if (transaction?.reconciliation?.provider) {
          setProvider(transaction.reconciliation.provider);
        }
        setProviderReference(transaction?.reconciliation?.providerReference || "");
        setSettlementBatchId(transaction?.reconciliation?.settlementBatchId || "");
      }
      setReconciliationReason("");
    },
    [transaction]
  );

  const handleReconciliation = async () => {
    const requiresProviderFields = reconciliationAction === "match";
    const requiresReason =
      reconciliationAction === "dispute" || reconciliationAction === "ignore";

    if (requiresProviderFields && !providerReference.trim()) {
      toast.error("Provider reference is required to mark a transaction as matched");
      return;
    }

    if (requiresReason && !reconciliationReason.trim()) {
      toast.error("Reason is required for this reconciliation action");
      return;
    }

    try {
      await reconcileTransaction.mutateAsync({
        transactionId: id,
        action: reconciliationAction,
        provider: requiresProviderFields ? provider : undefined,
        providerReference: requiresProviderFields
          ? providerReference.trim()
          : undefined,
        settlementBatchId: requiresProviderFields
          ? settlementBatchId.trim() || undefined
          : undefined,
        reason: reconciliationReason.trim() || undefined,
      });

      const successText: Record<string, string> = {
        match: "Transaction marked as matched",
        unmatch: "Transaction returned to unmatched",
        dispute: "Transaction marked as disputed",
        ignore: "Transaction marked as ignored",
      };
      toast.success(successText[reconciliationAction]);
      setShowReconciliationForm(false);
      setReconciliationReason("");
      refetch();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to update reconciliation"
      );
    }
  };

  // Check if transaction needs approval
  const needsApproval =
    transaction?.status === "pending" &&
    transaction?.sourceModule === "manual";

  const dualControlPolicy = transaction?.policy?.dualControl;
  const dualControlRequired = Boolean(dualControlPolicy?.required);
  const dualControlActorConflict = Boolean(dualControlPolicy?.actorConflict);
  const dualControlTriggers = dualControlPolicy?.triggers || [];
  const dualControlHardBlock = dualControlRequired && dualControlActorConflict;

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

  if (!transaction) {
    return (
      <div className="min-h-screen p-6 md:p-8">
        <div className="text-center py-12">
          <DollarSign className="mx-auto h-12 w-12 text-white/30" />
          <h2 className="mt-4 text-lg font-medium text-white">Transaction not found</h2>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => router.push("/admin/finance/transactions")}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Transactions
          </Button>
        </div>
      </div>
    );
  }

  const isInflow = transaction.direction === "inflow";
  const statusConfig = getStatusConfig(transaction.status);
  const sourceLink = getSourceModuleLink(transaction.sourceModule, transaction.sourceId);

  return (
    <div className="min-h-screen p-6 md:p-8">
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/admin/finance/transactions")}
          className="shrink-0"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-white md:text-2xl">
              Transaction Details
            </h1>
            {transaction.reference && (
              <span className="text-sm text-white/40">{transaction.reference}</span>
            )}
          </div>
          <p className="mt-1 text-sm text-white/50">
            {format(new Date(transaction.occurredAt), "MMMM d, yyyy 'at' h:mm a")}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Approval Action Card */}
          {needsApproval && (
            <Card className="overflow-hidden rounded-2xl border border-amber-500/30 bg-linear-to-br from-amber-500/10 via-amber-600/5 to-black/60">
              <CardHeader className="p-4 pb-2">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-amber-400" />
                  <CardTitle className="text-lg text-amber-200">
                    Pending Approval
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-2">
                <p className="text-sm text-white/60 mb-4">
                  This manual transaction requires review and approval before it becomes finalized.
                </p>
                {dualControlRequired && (
                  <div
                    className={`mb-4 rounded-xl border p-3 text-xs ${
                      dualControlHardBlock
                        ? "border-red-500/30 bg-red-500/10 text-red-100"
                        : "border-amber-500/25 bg-amber-500/10 text-amber-100"
                    }`}
                  >
                    <div className="flex items-center gap-2 font-medium">
                      <ShieldAlert className="h-4 w-4" />
                      Maker-checker pre-check
                    </div>
                    <p className="mt-1">
                      Triggered by: {dualControlTriggers.map(formatDualControlTrigger).join(", ") || "policy"}
                      {transaction
                        ? ` • Threshold: ${formatCurrency(
                            dualControlPolicy?.thresholdMinor || 0,
                            transaction.currency
                          )}`
                        : ""}
                    </p>
                    {dualControlHardBlock && (
                      <p className="mt-1">
                        You appear to be the maker/requester for this transaction. A different finance user must approve it.
                      </p>
                    )}
                  </div>
                )}
                {!showApprovalForm ? (
                  <div className="flex gap-3">
                    <Button
                      onClick={() => {
                        setApprovalAction("approve");
                        setShowApprovalForm(true);
                      }}
                      disabled={dualControlHardBlock}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Approve
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setApprovalAction("reject");
                        setShowApprovalForm(true);
                      }}
                      disabled={dualControlHardBlock}
                      className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                    >
                      <XCircle className="mr-2 h-4 w-4" />
                      Reject
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm text-white/60 mb-2 block">
                        Review Notes {approvalAction === "reject" && "(recommended for rejection)"}
                      </label>
                      <Textarea
                        value={reviewNotes}
                        onChange={(e) => setReviewNotes(e.target.value)}
                        placeholder={
                          approvalAction === "approve"
                            ? "Optional notes..."
                            : "Reason for rejection..."
                        }
                        className="min-h-[80px] border-white/10 bg-white/5 text-white"
                      />
                    </div>
                    <div className="flex gap-3">
                      <Button
                        onClick={handleApproval}
                        disabled={approveTransaction.isPending || dualControlHardBlock}
                        className={
                          approvalAction === "approve"
                            ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                            : "bg-red-600 hover:bg-red-700 text-white"
                        }
                      >
                        {approveTransaction.isPending ? (
                          <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        ) : approvalAction === "approve" ? (
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                        ) : (
                          <XCircle className="mr-2 h-4 w-4" />
                        )}
                        Confirm {approvalAction === "approve" ? "Approval" : "Rejection"}
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setShowApprovalForm(false);
                          setReviewNotes("");
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Status and Amount Card */}
          <Card className="overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/60 via-slate-950/60 to-black/60">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                {/* Status */}
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

                {/* Amount */}
                <div className="text-right">
                  <p className="text-sm text-white/50">
                    {isInflow ? "Received" : "Spent"}
                  </p>
                  <p
                    className={`text-3xl font-bold ${
                      isInflow ? "text-emerald-400" : "text-red-400"
                    }`}
                  >
                    {isInflow ? "+" : "-"}
                    {formatCurrency(transaction.netAmountMinor, transaction.currency)}
                  </p>
                  {transaction.feeAmountMinor > 0 && (
                    <p className="text-xs text-white/40 mt-1">
                      Gross: {formatCurrency(transaction.grossAmountMinor)} |{" "}
                      Fee: {formatCurrency(transaction.feeAmountMinor)}
                    </p>
                  )}
                </div>
              </div>

              {/* Direction Badge */}
              <div className="mt-6 flex items-center gap-3">
                <Badge
                  variant="outline"
                  className={`gap-1.5 ${
                    isInflow
                      ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10"
                      : "border-red-500/30 text-red-400 bg-red-500/10"
                  }`}
                >
                  {isInflow ? (
                    <ArrowDownRight className="h-3.5 w-3.5" />
                  ) : (
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  )}
                  {isInflow ? "Inflow" : "Outflow"}
                </Badge>
                <Badge variant="secondary" className="capitalize">
                  {getCategoryLabel(transaction.category)}
                </Badge>
                {sourceLink && (
                  <Link href={sourceLink}>
                    <Badge variant="outline" className="gap-1 cursor-pointer hover:bg-white/10">
                      View Source
                      <ExternalLink className="h-3 w-3" />
                    </Badge>
                  </Link>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Details Card */}
          <Card className="overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/60 via-slate-950/60 to-black/60">
            <CardHeader className="border-b border-white/5">
              <CardTitle className="text-lg text-white">Details</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                {/* Category */}
                <InfoRow
                  icon={Tag}
                  label="Category"
                  value={getCategoryLabel(transaction.category)}
                />

                {/* Source Module */}
                <InfoRow
                  icon={Layers}
                  label="Source"
                  value={<span className="capitalize">{transaction.sourceModule}</span>}
                />

                {/* Payment Method */}
                <InfoRow
                  icon={CreditCard}
                  label="Payment Method"
                  value={getMethodLabel(transaction.method)}
                />

                {/* Channel */}
                {transaction.channel && (
                  <InfoRow
                    icon={Hash}
                    label="Channel"
                    value={<span className="capitalize">{transaction.channel.replace("_", " ")}</span>}
                  />
                )}

                {/* Date */}
                <InfoRow
                  icon={Calendar}
                  label="Occurred At"
                  value={format(new Date(transaction.occurredAt), "MMMM d, yyyy")}
                  subValue={format(new Date(transaction.occurredAt), "h:mm:ss a")}
                />

                {/* Reference */}
                {transaction.reference && (
                  <InfoRow
                    icon={FileText}
                    label="Reference"
                    value={transaction.reference}
                  />
                )}
              </div>

              {/* Description */}
              {transaction.description && (
                <>
                  <Separator className="my-4 bg-white/5" />
                  <div>
                    <p className="text-xs text-white/40 mb-2">Description</p>
                    <p className="text-white/80">{transaction.description}</p>
                  </div>
                </>
              )}

              {/* Notes */}
              {transaction.notes && (
                <>
                  <Separator className="my-4 bg-white/5" />
                  <div>
                    <p className="text-xs text-white/40 mb-2">Internal Notes</p>
                    <p className="text-white/60 italic">{transaction.notes}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Party Card */}
          {transaction.party && (
            <Card className="overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/60 via-slate-950/60 to-black/60">
              <CardHeader className="border-b border-white/5">
                <CardTitle className="text-lg text-white">
                  {isInflow ? "From" : "To"}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/5">
                    {transaction.party.type === "vendor" ? (
                      <Building2 className="h-6 w-6 text-white/40" />
                    ) : (
                      <User className="h-6 w-6 text-white/40" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-white">{transaction.party.name}</p>
                    <p className="text-sm text-white/50 capitalize">
                      {transaction.party.type}
                    </p>
                  </div>
                </div>
                {transaction.party.contact && (
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {transaction.party.contact.phone && (
                      <div className="text-sm">
                        <span className="text-white/40">Phone: </span>
                        <span className="text-white">{transaction.party.contact.phone}</span>
                      </div>
                    )}
                    {transaction.party.contact.email && (
                      <div className="text-sm">
                        <span className="text-white/40">Email: </span>
                        <span className="text-white">{transaction.party.contact.email}</span>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Attachments Card */}
          {transaction.attachments && transaction.attachments.length > 0 && (
            <Card className="overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/60 via-slate-950/60 to-black/60">
              <CardHeader className="border-b border-white/5">
                <CardTitle className="text-lg text-white">
                  Attachments ({transaction.attachments.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {transaction.attachments.map((att, idx) => (
                    <a
                      key={idx}
                      href={att.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-4 transition-colors hover:bg-white/10"
                    >
                      {att.type === "image" ? (
                        <ImageIcon className="h-8 w-8 text-white/40" />
                      ) : (
                        <File className="h-8 w-8 text-white/40" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">
                          {att.name || `Attachment ${idx + 1}`}
                        </p>
                        <p className="text-xs text-white/40">
                          {format(new Date(att.uploadedAt), "MMM d, yyyy")}
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

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Reconciliation Card */}
          <Card className="overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/60 via-slate-950/60 to-black/60">
            <CardHeader className="border-b border-white/5">
              <CardTitle className="text-lg text-white">Reconciliation</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              {dualControlRequired && (
                <div
                  className={`rounded-xl border p-3 text-xs ${
                    dualControlHardBlock
                      ? "border-red-500/30 bg-red-500/10 text-red-100"
                      : "border-amber-500/25 bg-amber-500/10 text-amber-100"
                  }`}
                >
                  <div className="flex items-center gap-2 font-medium">
                    <ShieldAlert className="h-4 w-4" />
                    Maker-checker pre-check
                  </div>
                  <p className="mt-1">
                    Triggered by: {dualControlTriggers.map(formatDualControlTrigger).join(", ") || "policy"}
                    {transaction
                      ? ` • Threshold: ${formatCurrency(
                          dualControlPolicy?.thresholdMinor || 0,
                          transaction.currency
                        )}`
                      : ""}
                  </p>
                  {dualControlHardBlock && (
                    <p className="mt-1">
                      You appear to be the maker/requester for this transaction. A different finance user must reconcile it.
                    </p>
                  )}
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/50">Status</span>
                {getReconciliationStatusBadge(reconciliationStatus)}
              </div>
              {transaction.reconciliation?.provider && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white/50">Provider</span>
                  <span className="text-sm text-white capitalize">
                    {transaction.reconciliation.provider.replace("_", " ")}
                  </span>
                </div>
              )}
              {transaction.reconciliation?.providerReference && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white/50">Reference</span>
                  <span className="max-w-[180px] truncate text-sm font-mono text-white">
                    {transaction.reconciliation.providerReference}
                  </span>
                </div>
              )}
              {transaction.reconciliation?.settlementBatchId && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white/50">Settlement Batch</span>
                  <span className="max-w-[180px] truncate text-sm font-mono text-white">
                    {transaction.reconciliation.settlementBatchId}
                  </span>
                </div>
              )}

              <Separator className="bg-white/5" />

              {!showReconciliationForm ? (
                <div className="flex flex-wrap gap-2">
                  {canMarkMatched && (
                    <Button
                      size="sm"
                      onClick={() => openReconciliationForm("match")}
                      disabled={dualControlHardBlock}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      Mark Matched
                    </Button>
                  )}
                  {canDispute && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openReconciliationForm("dispute")}
                      disabled={dualControlHardBlock}
                      className="border-red-500/30 text-red-300 hover:bg-red-500/10"
                    >
                      Mark Disputed
                    </Button>
                  )}
                  {canIgnore && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openReconciliationForm("ignore")}
                      disabled={dualControlHardBlock}
                      className="border-slate-500/30 text-slate-200 hover:bg-slate-500/10"
                    >
                      Ignore
                    </Button>
                  )}
                  {canUnmatch && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openReconciliationForm("unmatch")}
                      disabled={dualControlHardBlock}
                      className="border-amber-500/30 text-amber-200 hover:bg-amber-500/10"
                    >
                      Mark Unmatched
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {reconciliationAction === "match" && (
                    <>
                      <div className="space-y-2">
                        <label className="text-xs text-white/50">Provider</label>
                        <PremiumSelect
                          value={provider}
                          onValueChange={(value) =>
                            setProvider(value as ReconciliationProvider)
                          }
                        >
                          <PremiumSelectTrigger className="w-full">
                            <PremiumSelectValue placeholder="Select provider" />
                          </PremiumSelectTrigger>
                          <PremiumSelectContent>
                            {RECONCILIATION_PROVIDER_OPTIONS.map((option) => (
                              <PremiumSelectItem
                                key={option.value}
                                value={option.value}
                              >
                                {option.label}
                              </PremiumSelectItem>
                            ))}
                          </PremiumSelectContent>
                        </PremiumSelect>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs text-white/50">
                          Provider reference
                        </label>
                        <Input
                          value={providerReference}
                          onChange={(event) =>
                            setProviderReference(event.target.value)
                          }
                          placeholder="Gateway or bank reference"
                          className="border-white/10 bg-white/5 text-white"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs text-white/50">
                          Settlement batch ID (optional)
                        </label>
                        <Input
                          value={settlementBatchId}
                          onChange={(event) =>
                            setSettlementBatchId(event.target.value)
                          }
                          placeholder="Batch or statement ID"
                          className="border-white/10 bg-white/5 text-white"
                        />
                      </div>
                    </>
                  )}

                  {(reconciliationAction === "dispute" ||
                    reconciliationAction === "ignore" ||
                    reconciliationAction === "unmatch") && (
                    <div className="space-y-2">
                      <label className="text-xs text-white/50">
                        Reason
                        {(reconciliationAction === "dispute" ||
                          reconciliationAction === "ignore") &&
                          " (required)"}
                      </label>
                      <Textarea
                        value={reconciliationReason}
                        onChange={(event) =>
                          setReconciliationReason(event.target.value)
                        }
                        placeholder="Add context for audit and review"
                        className="min-h-[88px] border-white/10 bg-white/5 text-white"
                      />
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={handleReconciliation}
                      disabled={reconcileTransaction.isPending || dualControlHardBlock}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      {reconcileTransaction.isPending ? (
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      ) : null}
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setShowReconciliationForm(false);
                        setReconciliationReason("");
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Audit Info Card */}
          <Card className="overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/60 via-slate-950/60 to-black/60">
            <CardHeader className="border-b border-white/5">
              <CardTitle className="text-lg text-white">Audit Trail</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div>
                <p className="text-xs text-white/40">Created</p>
                <p className="text-sm text-white">
                  {format(new Date(transaction.createdAt), "MMM d, yyyy 'at' h:mm a")}
                </p>
                {transaction.createdBy && (
                  <p className="text-xs text-white/50 mt-0.5">
                    by {transaction.createdBy.name}
                  </p>
                )}
              </div>
              {transaction.finalizedAt && (
                <div>
                  <p className="text-xs text-white/40">Finalized</p>
                  <p className="text-sm text-white">
                    {format(new Date(transaction.finalizedAt), "MMM d, yyyy 'at' h:mm a")}
                  </p>
                </div>
              )}
              <div>
                <p className="text-xs text-white/40">Transaction ID</p>
                <p className="text-xs text-white/60 font-mono break-all">
                  {transaction._id}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Related Transactions */}
          {(transaction._original || transaction._correction) && (
            <Card className="overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/60 via-slate-950/60 to-black/60">
              <CardHeader className="border-b border-white/5">
                <CardTitle className="text-lg text-white">Related Transactions</CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-3">
                {transaction._original && (
                  <Link
                    href={`/admin/finance/transactions/${transaction._original._id}`}
                    className="block rounded-xl border border-white/10 bg-white/5 p-4 transition-colors hover:bg-white/10"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-white/40">Original Transaction</p>
                        <p className="text-sm text-white">
                          {transaction._original.reference}
                        </p>
                      </div>
                      <ExternalLink className="h-4 w-4 text-white/40" />
                    </div>
                  </Link>
                )}
                {transaction._correction && (
                  <Link
                    href={`/admin/finance/transactions/${transaction._correction._id}`}
                    className="block rounded-xl border border-white/10 bg-white/5 p-4 transition-colors hover:bg-white/10"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-white/40">Corrected By</p>
                        <p className="text-sm text-white">
                          {transaction._correction.reference}
                        </p>
                      </div>
                      <ExternalLink className="h-4 w-4 text-white/40" />
                    </div>
                  </Link>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
