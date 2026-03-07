"use client";

import * as React from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  ArrowLeft,
  ArrowUpRight,
  Landmark,
  Loader2,
  RefreshCw,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatMoney } from "@/lib/fees/money";

type TeacherOption = {
  id: string;
  name: string;
  payoutProfile: {
    destination: {
      method: "bank" | "mobile_money";
      accountName: string;
      accountNumber: string;
      bankName?: string | null;
      bankCode?: string | null;
      providerName?: string | null;
      notes?: string | null;
    } | null;
  } | null;
};

type VendorOption = {
  id: string;
  name: string;
  bankDetails: {
    bankName?: string | null;
    accountNumber?: string | null;
    accountName?: string | null;
  } | null;
};

type ApprovedVendorExpense = {
  id: string;
  title: string;
  amountMinor: number;
  vendorId: string | null;
  expenseNumber: string;
};

type LookupResponse = {
  teachers: TeacherOption[];
  vendors: VendorOption[];
  approvedVendorExpenses: ApprovedVendorExpense[];
};

type DisbursementRecord = {
  id: string;
  recipientType: "teacher" | "vendor";
  teacherId: string | null;
  vendorId: string | null;
  schoolExpenseId: string | null;
  recipientName: string;
  purpose: string;
  amountMinor: number;
  platformFeeMinor: number;
  processorFeeMinor: number;
  totalDebitMinor: number;
  currency: string;
  status: "queued" | "processing" | "completed" | "failed" | "cancelled";
  paymentRail: "manual" | "paystack";
  reference: string;
  notes: string | null;
  approval: {
    required: boolean;
    status: "not_required" | "pending" | "approved" | "rejected";
    requestedAt?: string | null;
    approvedAt?: string | null;
    note?: string | null;
  };
  destination: {
    method: "bank" | "mobile_money";
    accountName: string;
    accountNumber: string;
    bankName?: string | null;
    bankCode?: string | null;
    providerName?: string | null;
    notes?: string | null;
  };
  gateway: {
    recipientCode?: string | null;
    transferCode?: string | null;
    transferStatus?: string | null;
    lastError?: string | null;
  } | null;
  processedAt: string | null;
  createdAt: string | null;
};

type DisbursementListResponse = {
  data: DisbursementRecord[];
};

type LookupApiResponse = {
  data: LookupResponse;
};

type FormState = {
  recipientType: "teacher" | "vendor";
  teacherId: string;
  vendorId: string;
  schoolExpenseId: string;
  amountMinor: string;
  purpose: string;
  notes: string;
  paymentRail: "manual" | "paystack";
  destinationMethod: "bank" | "mobile_money";
  accountName: string;
  accountNumber: string;
  bankName: string;
  bankCode: string;
  providerName: string;
  destinationNotes: string;
  saveTeacherPayoutProfile: boolean;
};

function emptyForm(): FormState {
  return {
    recipientType: "vendor",
    teacherId: "",
    vendorId: "",
    schoolExpenseId: "",
    amountMinor: "",
    purpose: "",
    notes: "",
    paymentRail: "manual",
    destinationMethod: "bank",
    accountName: "",
    accountNumber: "",
    bankName: "",
    bankCode: "",
    providerName: "",
    destinationNotes: "",
    saveTeacherPayoutProfile: true,
  };
}

function statusTone(status: DisbursementRecord["status"]) {
  if (status === "completed") {
    return "border-emerald-400/20 bg-emerald-400/10 text-emerald-200";
  }
  if (status === "failed") {
    return "border-red-400/20 bg-red-400/10 text-red-200";
  }
  if (status === "cancelled") {
    return "border-white/10 bg-white/5 text-white/70";
  }
  return "border-amber-400/20 bg-amber-400/10 text-amber-200";
}

export default function FinanceDisbursementsPage() {
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [approvingId, setApprovingId] = React.useState<string | null>(null);
  const [batchingAction, setBatchingAction] = React.useState<
    "reconcile" | "retry_send" | null
  >(null);
  const [reconcilingId, setReconcilingId] = React.useState<string | null>(null);
  const [lookups, setLookups] = React.useState<LookupResponse | null>(null);
  const [rows, setRows] = React.useState<DisbursementRecord[]>([]);
  const [form, setForm] = React.useState<FormState>(emptyForm());

  const filteredExpenses = React.useMemo(() => {
    const expenses = lookups?.approvedVendorExpenses || [];
    if (form.recipientType !== "vendor" || !form.vendorId) return expenses;
    return expenses.filter((expense) => expense.vendorId === form.vendorId);
  }, [form.recipientType, form.vendorId, lookups]);

  const selectedVendor = React.useMemo(
    () => (lookups?.vendors || []).find((vendor) => vendor.id === form.vendorId) || null,
    [form.vendorId, lookups]
  );

  const selectedTeacher = React.useMemo(
    () =>
      (lookups?.teachers || []).find((teacher) => teacher.id === form.teacherId) || null,
    [form.teacherId, lookups]
  );

  const selectedExpense = React.useMemo(
    () =>
      (lookups?.approvedVendorExpenses || []).find(
        (expense) => expense.id === form.schoolExpenseId
      ) || null,
    [form.schoolExpenseId, lookups]
  );

  const loadData = React.useCallback(async () => {
    try {
      setLoading(true);
      const [lookupsRes, rowsRes] = await Promise.all([
        fetch("/api/admin/disbursements/lookups", { cache: "no-store" }),
        fetch("/api/admin/disbursements", { cache: "no-store" }),
      ]);

      const [lookupsJson, rowsJson] = await Promise.all([
        lookupsRes.json().catch(() => null),
        rowsRes.json().catch(() => null),
      ]);

      if (!lookupsRes.ok) {
        throw new Error(lookupsJson?.error || "Failed to load disbursement lookups");
      }
      if (!rowsRes.ok) {
        throw new Error(rowsJson?.error || "Failed to load disbursements");
      }

      setLookups((lookupsJson as LookupApiResponse).data);
      setRows(((rowsJson as DisbursementListResponse).data || []) as DisbursementRecord[]);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to load disbursement data"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadData();
  }, [loadData]);

  React.useEffect(() => {
    if (form.recipientType !== "vendor" || !selectedVendor) return;

    setForm((current) => {
      if (current.destinationMethod !== "bank") return current;

      const nextAccountName =
        current.accountName || selectedVendor.bankDetails?.accountName || "";
      const nextAccountNumber =
        current.accountNumber || selectedVendor.bankDetails?.accountNumber || "";
      const nextBankName =
        current.bankName || selectedVendor.bankDetails?.bankName || "";

      if (
        nextAccountName === current.accountName &&
        nextAccountNumber === current.accountNumber &&
        nextBankName === current.bankName
      ) {
        return current;
      }

      return {
        ...current,
        accountName: nextAccountName,
        accountNumber: nextAccountNumber,
        bankName: nextBankName,
      };
    });
  }, [form.recipientType, selectedVendor]);

  React.useEffect(() => {
    if (
      form.recipientType !== "teacher" ||
      !selectedTeacher?.payoutProfile?.destination
    ) {
      return;
    }

    const destination = selectedTeacher.payoutProfile.destination;

    setForm((current) => ({
      ...current,
      destinationMethod: destination.method,
      accountName: destination.accountName || "",
      accountNumber: destination.accountNumber || "",
      bankName: destination.bankName || "",
      bankCode: destination.bankCode || "",
      providerName: destination.providerName || "",
      destinationNotes: destination.notes || "",
    }));
  }, [form.recipientType, selectedTeacher]);

  React.useEffect(() => {
    if (!selectedExpense) return;

    setForm((current) => {
      const next: FormState = {
        ...current,
        vendorId: selectedExpense.vendorId || current.vendorId,
        amountMinor: String(selectedExpense.amountMinor),
        purpose: `Expense ${selectedExpense.expenseNumber}: ${selectedExpense.title}`,
      };

      return next;
    });
  }, [selectedExpense]);

  const submitDisbursement = React.useCallback(async () => {
    if (form.recipientType === "teacher" && !form.teacherId) {
      toast.error("Select a teacher.");
      return;
    }
    if (form.recipientType === "vendor" && !form.vendorId) {
      toast.error("Select a vendor.");
      return;
    }
    if (!form.amountMinor.trim() || Number(form.amountMinor) <= 0) {
      toast.error("Enter a valid amount.");
      return;
    }
    if (!form.purpose.trim()) {
      toast.error("Purpose is required.");
      return;
    }
    if (!form.accountName.trim() || !form.accountNumber.trim()) {
      toast.error("Destination account name and account number are required.");
      return;
    }
    if (form.destinationMethod === "bank" && !form.bankName.trim()) {
      toast.error("Bank name is required for bank payouts.");
      return;
    }
    if (form.destinationMethod === "mobile_money" && !form.providerName.trim()) {
      toast.error("Provider name is required for mobile money payouts.");
      return;
    }
    if (form.paymentRail === "paystack" && !form.bankCode.trim()) {
      toast.error("Routing code is required for automated payouts.");
      return;
    }

    try {
      setSaving(true);
      const res = await fetch("/api/admin/disbursements", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recipientType: form.recipientType,
          teacherId: form.recipientType === "teacher" ? form.teacherId : null,
          vendorId: form.recipientType === "vendor" ? form.vendorId : null,
          schoolExpenseId:
            form.recipientType === "vendor" && form.schoolExpenseId
              ? form.schoolExpenseId
              : null,
          amountMinor: Number(form.amountMinor),
          purpose: form.purpose.trim(),
          notes: form.notes.trim() || null,
          sendNow: form.paymentRail === "paystack",
          destination: {
            method: form.destinationMethod,
            accountName: form.accountName.trim(),
            accountNumber: form.accountNumber.trim(),
            bankName:
              form.destinationMethod === "bank" ? form.bankName.trim() || null : null,
            bankCode: form.bankCode.trim() || null,
            providerName:
              form.destinationMethod === "mobile_money"
                ? form.providerName.trim() || null
                : null,
            notes: form.destinationNotes.trim() || null,
          },
          saveTeacherPayoutProfile:
            form.recipientType === "teacher" ? form.saveTeacherPayoutProfile : false,
        }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.error || "Failed to create disbursement");
      }

      const data = json?.data as
        | {
            reference: string;
            status: string;
            totalDebitMinor: number;
            platformFeeMinor: number;
            paymentRail: "manual" | "paystack";
            approval?: {
              status: "not_required" | "pending" | "approved" | "rejected";
            };
          }
        | undefined;

      toast.success(
        data
          ? data.paymentRail === "paystack" && data.approval?.status === "pending"
            ? `Disbursement ${data.reference} created and queued for approval.`
            : `Disbursement ${data.reference} created. Total debit ${formatMoney(
                data.totalDebitMinor
              )}.`
          : "Disbursement created."
      );

      setForm((current) => ({
        ...emptyForm(),
        recipientType: current.recipientType,
        vendorId: current.recipientType === "vendor" ? current.vendorId : "",
      }));
      void loadData();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create disbursement"
      );
    } finally {
      setSaving(false);
    }
  }, [form, loadData]);

  const approveDisbursement = React.useCallback(
    async (id: string) => {
      try {
        setApprovingId(id);
        const res = await fetch(`/api/admin/disbursements/${id}/approve`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        });
        const json = await res.json().catch(() => null);

        if (!res.ok) {
          throw new Error(json?.error || "Failed to approve disbursement");
        }

        if (json?.warning) {
          toast.error(json.warning);
        } else {
          toast.success("Disbursement approved and sent to Paystack.");
        }

        void loadData();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to approve disbursement"
        );
      } finally {
        setApprovingId((current) => (current === id ? null : current));
      }
    },
    [loadData]
  );

  const reconcileDisbursement = React.useCallback(
    async (id: string) => {
      try {
        setReconcilingId(id);
        const res = await fetch(`/api/admin/disbursements/${id}/reconcile`, {
          method: "POST",
        });
        const json = await res.json().catch(() => null);

        if (!res.ok) {
          throw new Error(json?.error || "Failed to reconcile disbursement");
        }

        const data = json?.data as
          | {
              reference?: string;
              status?: string;
              processorFeeMinor?: number;
              totalDebitMinor?: number;
            }
          | undefined;

        toast.success(
          data
            ? `Reconciled ${data.reference || "disbursement"}: ${
                data.status || "updated"
              }. Total debit ${formatMoney(data.totalDebitMinor || 0)}.`
            : "Disbursement reconciled."
        );

        void loadData();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to reconcile disbursement"
        );
      } finally {
        setReconcilingId((current) => (current === id ? null : current));
      }
    },
    [loadData]
  );

  const runBatchAction = React.useCallback(
    async (action: "reconcile" | "retry_send") => {
      try {
        setBatchingAction(action);
        const res = await fetch("/api/admin/disbursements/batch", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ action }),
        });
        const json = await res.json().catch(() => null);

        if (!res.ok) {
          throw new Error(json?.error || "Failed to run batch action");
        }

        const data = json?.data as
          | {
              matched: number;
              updated: number;
              failed: number;
              skipped: number;
            }
          | undefined;

        toast.success(
          data
            ? `${action === "reconcile" ? "Batch reconcile" : "Batch retry"} complete: ${data.updated} updated, ${data.failed} failed, ${data.skipped} skipped.`
            : "Batch action completed."
        );

        void loadData();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Batch action failed");
      } finally {
        setBatchingAction((current) => (current === action ? null : current));
      }
    },
    [loadData]
  );

  return (
    <div className="min-h-screen space-y-6 p-6 md:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="w-fit px-0 text-white/70 hover:text-white"
          >
            <Link href="/admin/finance">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Financial Center
            </Link>
          </Button>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br from-blue-500/20 to-indigo-600/20">
              <Landmark className="h-6 w-6 text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white md:text-3xl">
                Disbursements
              </h1>
              <p className="mt-1 text-sm text-white/50">
                Pay teachers and vendors through EduSentrix, with outbound transaction fees tracked.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="border-white/10 bg-white/5 text-white hover:bg-white/10"
            onClick={() => void runBatchAction("retry_send")}
            disabled={batchingAction !== null}
          >
            {batchingAction === "retry_send" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            Retry Approved Sends
          </Button>
          <Button
            variant="outline"
            className="border-white/10 bg-white/5 text-white hover:bg-white/10"
            onClick={() => void runBatchAction("reconcile")}
            disabled={batchingAction !== null}
          >
            {batchingAction === "reconcile" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Batch Reconcile
          </Button>
          <Button
            variant="outline"
            className="border-white/10 bg-white/5 text-white hover:bg-white/10"
            onClick={() => void loadData()}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-100">
        Paystack disbursements now require maker-checker approval before they are sent.
        Automated payouts still require a valid routing code, and you can save teacher payout
        details for reuse from this form.
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="border-white/10 bg-linear-to-br from-slate-900 via-slate-950 to-black text-white shadow-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Send className="h-5 w-5 text-cyan-300" />
              New Disbursement
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wide text-white/50">
                  Recipient Type
                </label>
                <Select
                  value={form.recipientType}
                  onValueChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      recipientType: value as FormState["recipientType"],
                      teacherId: "",
                      vendorId: "",
                      schoolExpenseId: "",
                    }))
                  }
                >
                  <SelectTrigger className="border-white/10 bg-white/5 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-white/10 bg-slate-950 text-white">
                    <SelectItem value="vendor">Vendor</SelectItem>
                    <SelectItem value="teacher">Teacher</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wide text-white/50">
                  Payment Rail
                </label>
                <Select
                  value={form.paymentRail}
                  onValueChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      paymentRail: value as FormState["paymentRail"],
                    }))
                  }
                >
                  <SelectTrigger className="border-white/10 bg-white/5 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-white/10 bg-slate-950 text-white">
                    <SelectItem value="manual">Queue Manually</SelectItem>
                    <SelectItem value="paystack">Send via Paystack</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {form.recipientType === "vendor" ? (
              <>
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-wide text-white/50">
                    Vendor
                  </label>
                  <Select
                    value={form.vendorId}
                    onValueChange={(value) =>
                      setForm((current) => ({ ...current, vendorId: value }))
                    }
                  >
                    <SelectTrigger className="border-white/10 bg-white/5 text-white">
                      <SelectValue placeholder="Select vendor" />
                    </SelectTrigger>
                    <SelectContent className="border-white/10 bg-slate-950 text-white">
                      {(lookups?.vendors || []).map((vendor) => (
                        <SelectItem key={vendor.id} value={vendor.id}>
                          {vendor.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-wide text-white/50">
                    Approved Expense (Optional)
                  </label>
                  <Select
                    value={form.schoolExpenseId || "none"}
                    onValueChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        schoolExpenseId: value === "none" ? "" : value,
                      }))
                    }
                  >
                    <SelectTrigger className="border-white/10 bg-white/5 text-white">
                      <SelectValue placeholder="Link approved expense" />
                    </SelectTrigger>
                    <SelectContent className="border-white/10 bg-slate-950 text-white">
                      <SelectItem value="none">No linked expense</SelectItem>
                      {filteredExpenses.map((expense) => (
                        <SelectItem key={expense.id} value={expense.id}>
                          {expense.expenseNumber} • {expense.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wide text-white/50">
                  Teacher
                </label>
                <Select
                  value={form.teacherId}
                  onValueChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      teacherId: value,
                      destinationMethod: "bank",
                      accountName: "",
                      accountNumber: "",
                      bankName: "",
                      bankCode: "",
                      providerName: "",
                      destinationNotes: "",
                      saveTeacherPayoutProfile: true,
                    }))
                  }
                >
                  <SelectTrigger className="border-white/10 bg-white/5 text-white">
                    <SelectValue placeholder="Select teacher" />
                  </SelectTrigger>
                  <SelectContent className="border-white/10 bg-slate-950 text-white">
                    {(lookups?.teachers || []).map((teacher) => (
                      <SelectItem key={teacher.id} value={teacher.id}>
                        {teacher.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wide text-white/50">
                  Amount (Minor Units)
                </label>
                <Input
                  type="number"
                  min="1"
                  step="1"
                  value={form.amountMinor}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      amountMinor: event.target.value,
                    }))
                  }
                  className="border-white/10 bg-white/5 text-white"
                  placeholder="e.g. 250000"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wide text-white/50">
                  Destination Method
                </label>
                <Select
                  value={form.destinationMethod}
                  onValueChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      destinationMethod: value as FormState["destinationMethod"],
                    }))
                  }
                >
                  <SelectTrigger className="border-white/10 bg-white/5 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-white/10 bg-slate-950 text-white">
                    <SelectItem value="bank">Bank</SelectItem>
                    <SelectItem value="mobile_money">Mobile Money</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wide text-white/50">
                Purpose
              </label>
              <Input
                value={form.purpose}
                onChange={(event) =>
                  setForm((current) => ({ ...current, purpose: event.target.value }))
                }
                className="border-white/10 bg-white/5 text-white"
                placeholder="Salary advance, vendor settlement, logistics payment"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wide text-white/50">
                  Account Name
                </label>
                <Input
                  value={form.accountName}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      accountName: event.target.value,
                    }))
                  }
                  className="border-white/10 bg-white/5 text-white"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wide text-white/50">
                  Account Number
                </label>
                <Input
                  value={form.accountNumber}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      accountNumber: event.target.value,
                    }))
                  }
                  className="border-white/10 bg-white/5 text-white"
                />
              </div>
            </div>

            {form.destinationMethod === "bank" ? (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-wide text-white/50">
                    Bank Name
                  </label>
                  <Input
                    value={form.bankName}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        bankName: event.target.value,
                      }))
                    }
                    className="border-white/10 bg-white/5 text-white"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-wide text-white/50">
                    Routing Code
                  </label>
                  <Input
                    value={form.bankCode}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        bankCode: event.target.value,
                      }))
                    }
                    className="border-white/10 bg-white/5 text-white"
                    placeholder="Required for Paystack payouts"
                  />
                </div>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-wide text-white/50">
                    Provider Name
                  </label>
                  <Input
                    value={form.providerName}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        providerName: event.target.value,
                      }))
                    }
                    className="border-white/10 bg-white/5 text-white"
                    placeholder="MTN, Telecel, AirtelTigo"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-wide text-white/50">
                    Provider Code
                  </label>
                  <Input
                    value={form.bankCode}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        bankCode: event.target.value,
                      }))
                    }
                    className="border-white/10 bg-white/5 text-white"
                    placeholder="Required for Paystack payouts"
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wide text-white/50">
                Internal Notes
              </label>
              <Textarea
                value={form.notes}
                onChange={(event) =>
                  setForm((current) => ({ ...current, notes: event.target.value }))
                }
                className="border-white/10 bg-white/5 text-white"
                placeholder="Optional internal note for finance review."
              />
            </div>

            {form.recipientType === "teacher" ? (
              <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/75">
                <input
                  type="checkbox"
                  checked={form.saveTeacherPayoutProfile}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      saveTeacherPayoutProfile: event.target.checked,
                    }))
                  }
                  className="h-4 w-4 rounded border-white/20 bg-transparent"
                />
                Save this destination as the teacher payout profile
              </label>
            ) : null}

            <Button
              type="button"
              onClick={submitDisbursement}
              disabled={saving || loading}
              className="bg-linear-to-r from-blue-500 to-indigo-600 text-white hover:from-blue-600 hover:to-indigo-700"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Disbursement
                </>
              ) : (
                <>
                  <ArrowUpRight className="mr-2 h-4 w-4" />
                  Create Disbursement
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-white/5 text-white">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Recent Disbursements</CardTitle>
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-white/60">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading
              </div>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-3">
            {!loading && rows.length === 0 ? (
              <p className="text-sm text-white/60">
                No disbursements have been created yet.
              </p>
            ) : null}

            {rows.map((row) => (
              <div
                key={row.id}
                className="rounded-2xl border border-white/10 bg-black/20 p-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-white">{row.recipientName}</p>
                      <span
                        className={`rounded-full px-3 py-1 text-[11px] ${statusTone(
                          row.status
                        )}`}
                      >
                        {row.status}
                      </span>
                      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/65">
                        {row.paymentRail}
                      </span>
                      {row.paymentRail === "paystack" &&
                      row.approval?.status !== "not_required" ? (
                        <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[11px] text-cyan-200">
                          approval: {row.approval.status}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-sm text-white/60">{row.purpose}</p>
                    <p className="text-xs text-white/50">
                      {row.reference} • {row.recipientType}
                    </p>
                    {row.gateway?.lastError ? (
                      <p className="text-xs text-red-300">{row.gateway.lastError}</p>
                    ) : null}
                  </div>

                  <div className="text-right">
                    <p className="font-medium text-white">
                      {formatMoney(row.amountMinor)}
                    </p>
                    <p className="mt-1 text-xs text-white/50">
                      Platform Fee {formatMoney(row.platformFeeMinor)} • Processor Fee{" "}
                      {formatMoney(row.processorFeeMinor)} • Total{" "}
                      {formatMoney(row.totalDebitMinor)}
                    </p>
                    <p className="mt-1 text-xs text-white/50">
                      {row.createdAt
                        ? format(new Date(row.createdAt), "MMM d, yyyy h:mm a")
                        : "No timestamp"}
                    </p>
                  </div>
                </div>

                {row.paymentRail === "paystack" ? (
                  <div className="mt-4 flex flex-wrap justify-end gap-2">
                    {row.approval?.status === "pending" ? (
                      <Button
                        type="button"
                        size="sm"
                        disabled={approvingId === row.id}
                        onClick={() => void approveDisbursement(row.id)}
                        className="bg-linear-to-r from-cyan-500 to-blue-600 text-white hover:from-cyan-600 hover:to-blue-700"
                      >
                        {approvingId === row.id ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Approving
                          </>
                        ) : (
                          <>
                            <Send className="mr-2 h-4 w-4" />
                            Approve & Send
                          </>
                        )}
                      </Button>
                    ) : null}

                    {row.approval?.status !== "pending" &&
                    row.status !== "completed" &&
                    row.status !== "cancelled" ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={reconcilingId === row.id}
                      onClick={() => void reconcileDisbursement(row.id)}
                      className="border-white/10 bg-white/5 text-white hover:bg-white/10"
                    >
                      {reconcilingId === row.id ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Reconciling
                        </>
                      ) : (
                        <>
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Reconcile
                        </>
                      )}
                    </Button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
