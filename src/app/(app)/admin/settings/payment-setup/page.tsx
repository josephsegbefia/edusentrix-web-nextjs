"use client";

import * as React from "react";
import Link from "next/link";
import { formatDistanceToNowStrict, parseISO } from "date-fns";
import {
  AlertCircle,
  ArrowLeft,
  BadgeCheck,
  Building2,
  CreditCard,
  Landmark,
  Loader2,
  Mail,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  Wallet,
} from "lucide-react";
import { BankBranchCombo } from "@/components/banks/BankBranchCombo";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  type SchoolPaymentSetupDTO,
  useSchoolPaymentSetup,
  useStartSchoolPaymentProvisioning,
  useUpdateSchoolPaymentSetup,
  useInviteBillingOwner,
  useInviteFinanceDelegate,
  useRemoveFinanceDelegate,
} from "@/hooks/admin/useSchoolPaymentSetup";
import { useBusyToast } from "@/hooks/useBusyToast";
import { cn } from "@/lib/utils";

function statusBadgeClasses(tone: "slate" | "amber" | "blue" | "emerald" | "red") {
  switch (tone) {
    case "emerald":
      return "border-emerald-500/30 bg-emerald-500/15 text-emerald-200";
    case "amber":
      return "border-amber-500/30 bg-amber-500/15 text-amber-200";
    case "blue":
      return "border-cyan-500/30 bg-cyan-500/15 text-cyan-200";
    case "red":
      return "border-rose-500/30 bg-rose-500/15 text-rose-200";
    case "slate":
    default:
      return "border-white/15 bg-white/5 text-white/70";
  }
}

function relativeTime(value: string | null) {
  if (!value) return "Not recorded";
  return formatDistanceToNowStrict(parseISO(value), { addSuffix: true });
}

function accessModeLabel(
  value:
    | "billing_owner"
    | "finance_delegate"
    | "school_creator"
    | "admin_fallback"
    | "school_admin_readonly"
) {
  switch (value) {
    case "billing_owner":
      return "Billing owner access";
    case "finance_delegate":
      return "Finance delegate access";
    case "school_creator":
      return "Original school setup owner";
    case "admin_fallback":
      return "Temporary admin fallback";
    case "school_admin_readonly":
      return "School admin status view";
    default:
      return "Payment setup access";
  }
}

function readOnlyStatusSummary(data: SchoolPaymentSetupDTO) {
  if (data.paymentReady) {
    return "Online payments are live. The school's billing owner is managing the payout account.";
  }

  switch (data.status) {
    case "pending_provisioning":
      return "A billing owner has already submitted payout details. Online checkout will turn on after provisioning finishes.";
    case "details_submitted":
      return "Payout details are already on file, but online checkout is not live yet.";
    case "awaiting_billing_owner":
      return "Payment setup is waiting for the billing owner to accept or finish the handoff.";
    case "review_required":
      return "Payment setup is paused for review before online checkout can go live.";
    case "failed":
      return "The last setup attempt failed. The billing owner needs to review and retry it.";
    case "not_started":
    default:
      return "A billing owner controls this school's payout setup. Sensitive payout details are hidden from school admins after handoff.";
  }
}

function ReadOnlyPaymentSetupView({ data }: { data: SchoolPaymentSetupDTO }) {
  const statusBadgeClass = statusBadgeClasses(data.statusTone);

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-linear-to-br from-slate-950 via-slate-900 to-cyan-950/30 p-6 text-white shadow-2xl shadow-black/30">
        <div
          className="pointer-events-none absolute -left-14 -top-10 h-44 w-44 rounded-full bg-cyan-500/10 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute right-0 top-0 h-56 w-56 rounded-full bg-emerald-500/10 blur-3xl"
          aria-hidden="true"
        />
        <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-400/10 shadow-lg shadow-cyan-950/20">
              <Wallet className="h-7 w-7 text-cyan-100" />
            </div>
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="bg-gradient-to-r from-white via-cyan-100 to-emerald-100 bg-clip-text text-3xl font-extrabold tracking-tight text-transparent lg:text-4xl">
                  Payment Setup
                </h1>
                <Badge variant="outline" className={cn("px-3 py-1 text-xs", statusBadgeClass)}>
                  <Sparkles className="mr-1 h-3 w-3" />
                  {data.statusLabel}
                </Badge>
              </div>
              <p className="max-w-2xl text-sm text-white/65">
                Billing-owner authority has been handed off for {data.schoolName}. This page now shows readiness only.
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            className="border-white/15 bg-white/5 text-white hover:bg-white/10"
            asChild
          >
            <Link href="/admin/settings">
              <ArrowLeft className="h-4 w-4" />
              Back to Settings
            </Link>
          </Button>
        </div>
      </div>

      <Alert className="border-cyan-500/20 bg-cyan-500/10 text-cyan-100">
        <ShieldCheck className="h-4 w-4 text-cyan-200" />
        <AlertTitle>Payout details are managed by the billing owner</AlertTitle>
        <AlertDescription className="text-cyan-100/85">
          School admins can monitor payment readiness here, but bank details, account numbers, and payout-edit actions are hidden after handoff is accepted.
        </AlertDescription>
      </Alert>

      {data.paystackKeyMode === "test" && (
        <Alert className="border-amber-500/30 bg-amber-500/10 text-amber-100">
          <AlertCircle className="h-4 w-4 text-amber-200" />
          <AlertTitle>Paystack test mode</AlertTitle>
          <AlertDescription className="text-amber-100/90">
            This deployment uses a Paystack test secret key. Subaccounts and payments show up only
            in the Paystack dashboard when Test mode is on — they will not appear in live mode.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="border-white/10 bg-linear-to-br from-emerald-500/10 via-transparent to-transparent text-white">
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-white/45">Status</p>
            <p className="mt-3 text-2xl font-bold text-white">{data.statusLabel}</p>
            <p className="mt-2 text-sm text-white/60">{data.statusDescription}</p>
          </CardContent>
        </Card>
        <Card className="border-white/10 bg-linear-to-br from-cyan-500/10 via-transparent to-transparent text-white">
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-white/45">Online Checkout</p>
            <p className="mt-3 text-lg font-semibold text-white">
              {data.paymentReady ? "Enabled" : "Not enabled"}
            </p>
            <p className="mt-2 text-sm text-white/60">
              {data.paymentReady
                ? "Parents can pay online now."
                : "Parents still need offline payment until setup is complete."}
            </p>
          </CardContent>
        </Card>
        <Card className="border-white/10 bg-linear-to-br from-amber-500/10 via-transparent to-transparent text-white">
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-white/45">Control</p>
            <p className="mt-3 text-lg font-semibold text-white">Billing owner assigned</p>
            <p className="mt-2 text-sm text-white/60">
              Payout details are locked to the school's billing owner or finance delegate.
            </p>
          </CardContent>
        </Card>
        <Card className="border-white/10 bg-linear-to-br from-white/8 via-transparent to-transparent text-white">
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-white/45">Last Updated</p>
            <p className="mt-3 text-lg font-semibold text-white">
              {relativeTime(data.timestamps.lastUpdatedAt)}
            </p>
            <p className="mt-2 text-sm text-white/60">
              {accessModeLabel(data.accessMode)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-white/10 bg-linear-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5">
              <Building2 className="h-5 w-5 text-white/80" />
            </div>
            <div>
              <CardTitle className="text-xl text-white">Setup progress</CardTitle>
              <CardDescription className="text-white/60">
                Readiness and activity remain visible even after payout control is handed off.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-sm font-medium text-white">Current state</p>
            <p className="mt-2 text-sm text-white/65">{readOnlyStatusSummary(data)}</p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-white/40">Last submitted</p>
              <p className="mt-2 text-sm font-medium text-white">
                {relativeTime(data.timestamps.submittedAt)}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-white/40">Last approved</p>
              <p className="mt-2 text-sm font-medium text-white">
                {relativeTime(data.timestamps.approvedAt)}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-white/40">Provisioning</p>
              <p className="mt-2 text-sm font-medium text-white capitalize">
                {data.provisioning?.status.replace("_", " ") || "No active job"}
              </p>
              <p className="mt-1 text-xs text-white/50">
                {data.provisioning
                  ? `Updated ${relativeTime(data.provisioning.updatedAt)}`
                  : "Provisioning starts once the billing owner submits setup."}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function PaymentSetupPage() {
  const { data, isLoading, isError, error, refetch } = useSchoolPaymentSetup();
  const updateSetup = useUpdateSchoolPaymentSetup();
  const startProvisioning = useStartSchoolPaymentProvisioning();
  const inviteBillingOwner = useInviteBillingOwner();
  const inviteFinanceDelegate = useInviteFinanceDelegate();
  const removeFinanceDelegate = useRemoveFinanceDelegate();
  const busy = useBusyToast();

  const [bankSelection, setBankSelection] = React.useState<{
    bankName: string;
    branchName: string;
    sortCode: string;
  } | null>(null);
  const [accountName, setAccountName] = React.useState("");
  const [accountNumber, setAccountNumber] = React.useState("");
  const [ownerName, setOwnerName] = React.useState("");
  const [ownerEmail, setOwnerEmail] = React.useState("");
  const [delegateName, setDelegateName] = React.useState("");
  const [delegateEmail, setDelegateEmail] = React.useState("");

  React.useEffect(() => {
    if (!data) return;
    setBankSelection(
      data.bank.bankName && data.bank.branchName && data.bank.sortCode
        ? {
            bankName: data.bank.bankName,
            branchName: data.bank.branchName,
            sortCode: data.bank.sortCode,
          }
        : null
    );
    setAccountName(data.bank.accountName || "");
    setAccountNumber(data.bank.accountNumber || "");
    setOwnerName(data.pendingInvitations.billingOwner?.name || "");
    setOwnerEmail(data.pendingInvitations.billingOwner?.email || "");
    setDelegateName(data.pendingInvitations.financeDelegate?.name || "");
    setDelegateEmail(data.pendingInvitations.financeDelegate?.email || "");
  }, [data]);

  const isDirty = Boolean(
    data &&
      ((bankSelection?.bankName || "") !== data.bank.bankName ||
        (bankSelection?.branchName || "") !== data.bank.branchName ||
        accountName !== (data.bank.accountName || "") ||
        accountNumber !== (data.bank.accountNumber || ""))
  );

  const canSave =
    Boolean(bankSelection?.bankName && bankSelection?.branchName) &&
    accountName.trim().length >= 2 &&
    accountNumber.trim().length >= 6;
  const canInviteOwner = Boolean(
    data &&
      data.capabilities.canInviteOwner &&
      ownerName.trim().length >= 2 &&
      /\S+@\S+\.\S+/.test(ownerEmail.trim()) &&
      !data.pendingInvitations.billingOwner
  );
  const canInviteDelegate = Boolean(
    data &&
      data.capabilities.canManageDelegate &&
      delegateName.trim().length >= 2 &&
      /\S+@\S+\.\S+/.test(delegateEmail.trim()) &&
      !data.pendingInvitations.financeDelegate &&
      !data.financeDelegate.email
  );

  async function handleSave() {
    if (!bankSelection || !canSave) return;

    await busy.promise(
      updateSetup.mutateAsync({
        bankName: bankSelection.bankName,
        branchName: bankSelection.branchName,
        accountName: accountName.trim(),
        accountNumber: accountNumber.trim(),
      }),
      {
        loading: "Saving payout details...",
        success: "Payout details saved.",
        error: (saveError) =>
          saveError.message || "Failed to save payout details",
      }
    );
  }

  async function handleStartProvisioning() {
    busy.show("Starting online payment setup...");
    try {
      const result = await startProvisioning.mutateAsync();
      busy.hide();
      busy.success(
        result.status === "provisioned"
          ? "Online payments are ready."
          : "Paystack was not reachable on the first try; automatic retries are queued. Check the error on this card if it persists."
      );
    } catch (startError) {
      busy.hide();
      busy.error(
        startError instanceof Error
          ? startError.message
          : "Failed to start payment setup"
      );
    }
  }

  async function handleInviteOwner() {
    if (!canInviteOwner) return;

    await busy.promise(
      inviteBillingOwner.mutateAsync({
        ownerName: ownerName.trim(),
        ownerEmail: ownerEmail.trim(),
      }),
      {
        loading: "Sending billing owner invite...",
        success: "Billing owner invitation sent.",
        error: (inviteError) =>
          inviteError.message || "Failed to invite billing owner",
      }
    );
    await refetch();
  }

  async function handleInviteDelegate() {
    if (!canInviteDelegate) return;

    await busy.promise(
      inviteFinanceDelegate.mutateAsync({
        delegateName: delegateName.trim(),
        delegateEmail: delegateEmail.trim(),
      }),
      {
        loading: "Sending finance delegate invite...",
        success: "Finance delegate invitation sent.",
        error: (inviteError) =>
          inviteError.message || "Failed to invite finance delegate",
      }
    );
  }

  async function handleRemoveDelegate() {
    await busy.promise(removeFinanceDelegate.mutateAsync(), {
      loading: "Removing finance delegate...",
      success: "Finance delegate access cleared.",
      error: (removeError) =>
        removeError.message || "Failed to remove finance delegate",
    });
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-36 rounded-3xl border border-white/10 bg-white/5 animate-pulse" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-28 rounded-2xl border border-white/10 bg-white/5 animate-pulse"
            />
          ))}
        </div>
        <div className="grid gap-6 xl:grid-cols-[1.45fr_1fr]">
          <div className="h-[30rem] rounded-3xl border border-white/10 bg-white/5 animate-pulse" />
          <div className="space-y-6">
            <div className="h-64 rounded-3xl border border-white/10 bg-white/5 animate-pulse" />
            <div className="h-64 rounded-3xl border border-white/10 bg-white/5 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (isError || !data) {
    const message = error instanceof Error ? error.message : "Failed to load payment setup";
    const forbidden = /forbidden/i.test(message);

    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <Card className="overflow-hidden border-white/10 bg-linear-to-br from-slate-950 via-slate-900 to-black text-white">
          <CardHeader className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                <ShieldCheck className="h-6 w-6 text-white/75" />
              </div>
              <div>
                <CardTitle className="text-2xl text-white">
                  {forbidden ? "Payment Setup Restricted" : "Payment Setup Unavailable"}
                </CardTitle>
                <CardDescription className="text-white/60">
                  {forbidden
                    ? "This area is reserved for the billing owner, finance delegate, or the admin still controlling setup."
                    : "We could not load your school's payment setup details."}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert className="border-white/10 bg-white/5 text-white">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>{forbidden ? "Access required" : "Try again"}</AlertTitle>
              <AlertDescription className="text-white/70">
                {forbidden
                  ? "If another person controls school payout details, they should open this section from their own account."
                  : message}
              </AlertDescription>
            </Alert>
            <div className="flex flex-wrap gap-3">
              <Button asChild variant="outline" className="border-white/15 bg-white/5 text-white hover:bg-white/10">
                <Link href="/admin/settings">
                  <ArrowLeft className="h-4 w-4" />
                  Back to Settings
                </Link>
              </Button>
              {!forbidden && (
                <Button
                  type="button"
                  onClick={() => refetch()}
                  className="bg-white text-slate-950 hover:bg-white/90"
                >
                  Retry
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusBadgeClass = statusBadgeClasses(data.statusTone);
  if (!data.capabilities.canManage) {
    return <ReadOnlyPaymentSetupView data={data} />;
  }
  const payoutSummary = data.bank.maskedAccountNumber
    ? `${data.bank.bankName} • ${data.bank.maskedAccountNumber}`
    : "Not configured";

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-linear-to-br from-slate-950 via-emerald-950/40 to-cyan-950/30 p-6 text-white shadow-2xl shadow-black/30">
        <div
          className="pointer-events-none absolute -left-14 -top-10 h-44 w-44 rounded-full bg-emerald-500/15 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute right-0 top-0 h-56 w-56 rounded-full bg-cyan-500/10 blur-3xl"
          aria-hidden="true"
        />
        <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/10 shadow-lg shadow-emerald-900/20">
              <Wallet className="h-7 w-7 text-emerald-200" />
            </div>
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="bg-gradient-to-r from-white via-emerald-100 to-cyan-200 bg-clip-text text-3xl font-extrabold tracking-tight text-transparent lg:text-4xl">
                  Payment Setup
                </h1>
                <Badge variant="outline" className={cn("px-3 py-1 text-xs", statusBadgeClass)}>
                  <Sparkles className="mr-1 h-3 w-3" />
                  {data.statusLabel}
                </Badge>
              </div>
              <p className="max-w-2xl text-sm text-white/65">
                Configure how {data.schoolName} receives online fee payments and
                keep the school's payout rail ready for parent checkout.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="outline"
              className="border-white/15 bg-white/5 text-white hover:bg-white/10"
              asChild
            >
              <Link href="/admin/settings">
                <ArrowLeft className="h-4 w-4" />
                Back to Settings
              </Link>
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={!isDirty || !canSave || updateSetup.isPending}
              className="bg-white text-slate-950 hover:bg-white/90"
            >
              {updateSetup.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving
                </>
              ) : (
                <>
                  <BadgeCheck className="h-4 w-4" />
                  Save Details
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="border-white/10 bg-linear-to-br from-emerald-500/10 via-transparent to-transparent text-white">
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-white/45">Status</p>
            <p className="mt-3 text-2xl font-bold text-white">{data.statusLabel}</p>
            <p className="mt-2 text-sm text-white/60">{data.statusDescription}</p>
          </CardContent>
        </Card>
        <Card className="border-white/10 bg-linear-to-br from-cyan-500/10 via-transparent to-transparent text-white">
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-white/45">Payout Account</p>
            <p className="mt-3 text-lg font-semibold text-white">{payoutSummary}</p>
            <p className="mt-2 text-sm text-white/60">
              {data.bank.accountName || "Account holder name not set"}
            </p>
          </CardContent>
        </Card>
        <Card className="border-white/10 bg-linear-to-br from-amber-500/10 via-transparent to-transparent text-white">
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-white/45">Gateway Rail</p>
            <p className="mt-3 text-lg font-semibold text-white">
              {data.paystack.subaccountCode ? "Paystack linked" : "Awaiting link"}
            </p>
            <p className="mt-2 text-sm text-white/60">
              {data.paystack.subaccountCode
                ? data.paystack.subaccountCode
                : "No school settlement subaccount yet"}
            </p>
          </CardContent>
        </Card>
        <Card className="border-white/10 bg-linear-to-br from-white/8 via-transparent to-transparent text-white">
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-white/45">Authority</p>
            <p className="mt-3 text-lg font-semibold text-white">
              {accessModeLabel(data.accessMode)}
            </p>
            <p className="mt-2 text-sm text-white/60">
              {data.billingOwner.email || "Billing owner not yet assigned"}
            </p>
          </CardContent>
        </Card>
      </div>

      {data.paystackKeyMode === "test" && (
        <Alert className="border-amber-500/30 bg-amber-500/10 text-amber-100">
          <AlertCircle className="h-4 w-4 text-amber-200" />
          <AlertTitle>Paystack test mode</AlertTitle>
          <AlertDescription className="text-amber-100/90">
            This deployment uses a Paystack test secret key. Subaccounts and payments show up only
            in the Paystack dashboard when Test mode is on — they will not appear in live mode.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.45fr_1fr]">
        <Card className="overflow-hidden border-white/10 bg-linear-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
          <CardHeader className="border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-400/10">
                <Landmark className="h-5 w-5 text-cyan-200" />
              </div>
              <div>
                <CardTitle className="text-xl text-white">Payout account details</CardTitle>
                <CardDescription className="text-white/60">
                  These details are used to create and maintain the school's Paystack settlement subaccount.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6 p-6">
            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label className="text-white/75">Bank and branch</Label>
                <BankBranchCombo
                  value={bankSelection}
                  onChange={setBankSelection}
                  placeholder="Search and select the school's bank branch"
                />
                {bankSelection?.sortCode ? (
                  <p className="text-xs text-white/45">
                    Sort code: {bankSelection.sortCode}
                  </p>
                ) : (
                  <p className="text-xs text-white/45">
                    Choose the exact branch so EduSentrix can derive the correct settlement code.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-white/75">Account name</Label>
                <Input
                  value={accountName}
                  onChange={(event) => setAccountName(event.target.value)}
                  placeholder="School account name"
                  className="border-white/10 bg-white/5 text-white placeholder:text-white/30"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-white/75">Account number</Label>
                <Input
                  value={accountNumber}
                  onChange={(event) => setAccountNumber(event.target.value)}
                  inputMode="numeric"
                  placeholder="Settlement account number"
                  className="border-white/10 bg-white/5 text-white placeholder:text-white/30"
                />
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-white">Current readiness</p>
                  <p className="mt-1 text-sm text-white/60">
                    {data.paymentReady
                      ? "Parents can pay online because the school's payout rail is active."
                      : "Online payment stays off until payout details are saved and provisioning succeeds."}
                  </p>
                </div>
                <Badge variant="outline" className={cn("px-3 py-1", statusBadgeClass)}>
                  {data.statusLabel}
                </Badge>
              </div>
              {data.missingFields.length > 0 && (
                <p className="mt-3 text-xs text-amber-200/90">
                  Missing: {data.missingFields.join(", ")}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          {data.reviewReason && (
            <Alert className="border-amber-500/20 bg-amber-500/10 text-amber-100">
              <AlertCircle className="h-4 w-4 text-amber-200" />
              <AlertTitle>Manual review required</AlertTitle>
              <AlertDescription className="text-amber-100/85">
                {data.reviewReason}
              </AlertDescription>
            </Alert>
          )}

          {!data.capabilities.canApprovePayoutChange && (
            <Alert className="border-cyan-500/20 bg-cyan-500/10 text-cyan-100">
              <ShieldCheck className="h-4 w-4 text-cyan-200" />
              <AlertTitle>Restricted payout-change authority</AlertTitle>
              <AlertDescription className="text-cyan-100/85">
                You can help manage payment setup, but only the billing owner can
                approve payout destination changes after online payments are live.
              </AlertDescription>
            </Alert>
          )}

          {(data.paystack.lastError || data.provisioning?.lastError) && (
            <Alert className="border-rose-500/20 bg-rose-500/10 text-rose-100">
              <AlertCircle className="h-4 w-4 text-rose-200" />
              <AlertTitle>Last setup error</AlertTitle>
              <AlertDescription className="text-rose-100/85">
                {data.paystack.lastError || data.provisioning?.lastError}
              </AlertDescription>
            </Alert>
          )}

          <Card className="border-white/10 bg-linear-to-br from-emerald-500/10 via-slate-950 to-slate-950 text-white">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-400/10">
                  <CreditCard className="h-5 w-5 text-emerald-200" />
                </div>
                <div>
                  <CardTitle className="text-lg text-white">Launch online payments</CardTitle>
                  <CardDescription className="text-white/60">
                    Submit or retry the Paystack settlement setup for this school.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                {[
                  {
                    label: "Payout details saved",
                    done:
                      Boolean(data.bank.bankName) &&
                      Boolean(data.bank.branchName) &&
                      Boolean(data.bank.accountName) &&
                      Boolean(data.bank.accountNumber),
                  },
                  {
                    label: "Paystack subaccount",
                    done:
                      data.status === "pending_provisioning" ||
                      data.status === "provisioned",
                  },
                  {
                    label: "Parent checkout enabled",
                    done: data.paymentReady,
                  },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-3">
                    <div
                      className={cn(
                        "flex h-6 w-6 items-center justify-center rounded-full border text-[10px] font-semibold",
                        item.done
                          ? "border-emerald-400/30 bg-emerald-400/15 text-emerald-200"
                          : "border-white/10 bg-white/5 text-white/50"
                      )}
                    >
                      {item.done ? "✓" : "•"}
                    </div>
                    <span className={cn("text-sm", item.done ? "text-white" : "text-white/60")}>
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>

              <Separator className="bg-white/10" />

              <Button
                type="button"
                onClick={handleStartProvisioning}
                disabled={!data.canSubmitSetup || startProvisioning.isPending}
                className="w-full bg-emerald-500 text-slate-950 hover:bg-emerald-400"
              >
                {startProvisioning.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Contacting Paystack
                  </>
                ) : data.status === "failed" ? (
                  <>
                    <RefreshCcw className="h-4 w-4" />
                    Retry setup
                  </>
                ) : data.status === "pending_provisioning" ? (
                  <>
                    <RefreshCcw className="h-4 w-4" />
                    Retry Paystack setup
                  </>
                ) : data.status === "review_required" ? (
                  <>
                    <AlertCircle className="h-4 w-4" />
                    Awaiting review
                  </>
                ) : data.paymentReady ? (
                  <>
                    <BadgeCheck className="h-4 w-4" />
                    Online payments ready
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-4 w-4" />
                    Start setup
                  </>
                )}
              </Button>
              <p className="text-xs text-white/45">
                {data.status === "review_required"
                  ? "This payout setup is paused until the flagged details are reviewed."
                  : data.status === "pending_provisioning"
                  ? "Each click calls Paystack immediately. “Queued” only means a background job will also retry if Paystack was unreachable — you do not have to wait for it."
                  : data.canSubmitSetup
                  ? "Use this after saving the correct school payout account. EduSentrix calls Paystack right away; the background job only retries if that request fails or times out."
                  : "Complete and save payout details first."}
              </p>
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-linear-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5">
                  <Building2 className="h-5 w-5 text-white/80" />
                </div>
                <div>
                  <CardTitle className="text-lg text-white">Authority and activity</CardTitle>
                  <CardDescription className="text-white/60">
                    The account currently trusted to manage school payout setup.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-white/40">Access mode</p>
                <p className="mt-2 text-base font-semibold text-white">
                  {accessModeLabel(data.accessMode)}
                </p>
                <div className="mt-3 flex items-center gap-2 text-sm text-white/60">
                  <Mail className="h-4 w-4" />
                  <span>{data.billingOwner.email || "No billing owner email recorded yet"}</span>
                </div>
                <div className="mt-3 text-sm text-white/60">
                  Finance delegate:{" "}
                  <span className="text-white">
                    {data.financeDelegate.email || "Not assigned"}
                  </span>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-white/40">Last updated</p>
                  <p className="mt-2 text-sm font-medium text-white">
                    {relativeTime(data.timestamps.lastUpdatedAt)}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-white/40">Last submitted</p>
                  <p className="mt-2 text-sm font-medium text-white">
                    {relativeTime(data.timestamps.submittedAt)}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-white/40">Last approved</p>
                  <p className="mt-2 text-sm font-medium text-white">
                    {relativeTime(data.timestamps.approvedAt)}
                  </p>
                  <p className="mt-1 text-xs text-white/50">
                    {data.audit.approvedByEmail || "No approver recorded yet"}
                  </p>
                </div>
              </div>
              {data.provisioning && (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-white/40">
                    Provisioning activity
                  </p>
                  <p className="mt-2 text-base font-semibold text-white capitalize">
                    {data.provisioning.status.replace("_", " ")}
                  </p>
                  <p className="mt-1 text-sm text-white/60">
                    Attempts: {data.provisioning.attempts} • updated{" "}
                    {relativeTime(data.provisioning.updatedAt)}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {(data.capabilities.canManageDelegate ||
            data.financeDelegate.email ||
            data.pendingInvitations.financeDelegate) && (
            <Card className="border-white/10 bg-linear-to-br from-cyan-500/10 via-slate-950 to-slate-950 text-white">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-400/10">
                    <ShieldCheck className="h-5 w-5 text-cyan-200" />
                  </div>
                  <div>
                    <CardTitle className="text-lg text-white">Finance delegate</CardTitle>
                    <CardDescription className="text-white/60">
                      Optionally add a finance delegate who can help manage payment
                      setup without taking over billing owner authority.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {(data.financeDelegate.email || data.pendingInvitations.financeDelegate) && (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/65">
                    <p className="font-medium text-white">
                      {data.financeDelegate.email
                        ? "Active finance delegate"
                        : "Pending finance delegate invite"}
                    </p>
                    <p className="mt-1">
                      {data.financeDelegate.name ||
                        data.pendingInvitations.financeDelegate?.name ||
                        "Finance delegate"}
                    </p>
                    <p className="text-white/50">
                      {data.financeDelegate.email ||
                        data.pendingInvitations.financeDelegate?.email}
                    </p>
                  </div>
                )}

                {data.capabilities.canManageDelegate && !data.financeDelegate.email && !data.pendingInvitations.financeDelegate && (
                  <>
                    <div className="space-y-2">
                      <Label className="text-white/75">Delegate name</Label>
                      <Input
                        value={delegateName}
                        onChange={(event) => setDelegateName(event.target.value)}
                        placeholder="Bursar or finance lead"
                        className="border-white/10 bg-white/5 text-white placeholder:text-white/30"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-white/75">Delegate email</Label>
                      <Input
                        value={delegateEmail}
                        onChange={(event) => setDelegateEmail(event.target.value)}
                        inputMode="email"
                        placeholder="finance@school.edu.gh"
                        className="border-white/10 bg-white/5 text-white placeholder:text-white/30"
                      />
                    </div>
                    <Button
                      type="button"
                      onClick={handleInviteDelegate}
                      disabled={!canInviteDelegate || inviteFinanceDelegate.isPending}
                      className="w-full bg-cyan-300 text-slate-950 hover:bg-cyan-200"
                    >
                      {inviteFinanceDelegate.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Sending invite
                        </>
                      ) : (
                        <>
                          <Mail className="h-4 w-4" />
                          Invite finance delegate
                        </>
                      )}
                    </Button>
                  </>
                )}

                {data.capabilities.canManageDelegate &&
                  (data.financeDelegate.email || data.pendingInvitations.financeDelegate) && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleRemoveDelegate}
                      disabled={removeFinanceDelegate.isPending}
                      className="w-full border-white/15 bg-white/5 text-white hover:bg-white/10"
                    >
                      {removeFinanceDelegate.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Clearing delegate
                        </>
                      ) : (
                        <>
                          <ArrowLeft className="h-4 w-4" />
                          Clear delegate access
                        </>
                      )}
                    </Button>
                  )}
              </CardContent>
            </Card>
          )}

          {data.capabilities.canInviteOwner && (
            <Card className="border-white/10 bg-linear-to-br from-amber-500/10 via-slate-950 to-slate-950 text-white">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-400/20 bg-amber-400/10">
                    <Mail className="h-5 w-5 text-amber-200" />
                  </div>
                  <div>
                    <CardTitle className="text-lg text-white">
                      {data.accessMode === "billing_owner"
                        ? "Replace billing owner"
                        : "Assign billing owner"}
                    </CardTitle>
                    <CardDescription className="text-white/60">
                      {data.accessMode === "billing_owner"
                        ? "Transfer billing-owner authority to another financial decision maker."
                        : "Hand off payment setup to the person authorized to control the school's payout account."}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-white/75">Owner name</Label>
                  <Input
                    value={ownerName}
                    onChange={(event) => setOwnerName(event.target.value)}
                    placeholder="School owner or financial authority"
                    className="border-white/10 bg-white/5 text-white placeholder:text-white/30"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-white/75">Owner email</Label>
                  <Input
                    value={ownerEmail}
                    onChange={(event) => setOwnerEmail(event.target.value)}
                    inputMode="email"
                    placeholder="owner@school.edu.gh"
                    className="border-white/10 bg-white/5 text-white placeholder:text-white/30"
                  />
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/60">
                  {data.pendingInvitations.billingOwner
                    ? `A ${data.pendingInvitations.billingOwner.mode === "replacement" ? "replacement" : "handoff"} invite is already pending for ${data.pendingInvitations.billingOwner.email}.`
                    : data.accessMode === "billing_owner"
                      ? "The current billing owner keeps access until the replacement accepts the invite."
                      : "This admin keeps control of payout setup until the invited billing owner accepts the handoff."}
                </div>
                <Button
                  type="button"
                  onClick={handleInviteOwner}
                  disabled={!canInviteOwner || inviteBillingOwner.isPending}
                  className="w-full bg-amber-400 text-slate-950 hover:bg-amber-300"
                >
                  {inviteBillingOwner.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Sending invite
                    </>
                  ) : (
                    <>
                      <Mail className="h-4 w-4" />
                      {data.accessMode === "billing_owner"
                        ? "Send replacement invite"
                        : "Send billing owner invite"}
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
