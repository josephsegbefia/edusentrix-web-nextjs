"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  BadgeCheck,
  Ban,
  Loader2,
  Rocket,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BankBranchCombo } from "@/components/banks/BankBranchCombo";
import { formatMoney } from "@/lib/fees/money";
import { PHRASE_DELETE_SCHOOL_PERMANENTLY } from "@/lib/platform/school-lifecycle-constants";
import { cn } from "@/lib/utils";

type SchoolDetail = {
  id: string;
  name: string;
  status: string;
  city: string | null;
  region: string | null;
  email: string | null;
  environmentType: string;
  paymentReady: boolean;
  paymentSetup: {
    status:
      | "not_started"
      | "awaiting_billing_owner"
      | "details_submitted"
      | "pending_provisioning"
      | "review_required"
      | "provisioned"
      | "failed";
    statusLabel: string;
    statusTone: "slate" | "amber" | "blue" | "emerald" | "red";
    reviewReason: string | null;
    billingOwner: {
      name: string | null;
      email: string | null;
    };
    bank: {
      bankName: string | null;
      branchName: string | null;
      accountName: string | null;
      maskedAccountNumber: string | null;
    };
    paystack: {
      subaccountCode: string | null;
      lastError: string | null;
      lastErrorDetail: string | null;
      lastErrorAt: string | null;
    };
    pendingPlatformPayout: {
      bankName: string | null;
      branchName: string | null;
      sortCode: string | null;
      accountName: string | null;
      maskedAccountNumber: string | null;
      note: string | null;
      proposedByEmail: string | null;
      proposedAt: string | null;
    } | null;
    provisioningJob: {
      id: string;
      status: string;
      attempts: number;
      lastError: string | null;
      nextRunAt: string | null;
      createdAt: string;
      updatedAt: string;
    } | null;
  };
  subscription: {
    tierName: string | null;
    status: string;
    effectivePriceMinor: number;
    discountExposureMinor: number;
  } | null;
  usage: {
    totalEstimatedCostMinor: number;
    metricsCount: number;
  };
  events: Array<{
    id: string;
    summary: string;
    actorEmail: string | null;
    createdAt: string;
  }>;
};

export default function PlatformSchoolDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const schoolId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const [loading, setLoading] = React.useState(true);
  const [data, setData] = React.useState<SchoolDetail | null>(null);
  const [suspendOpen, setSuspendOpen] = React.useState(false);
  const [activateOpen, setActivateOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [lifecycleBusy, setLifecycleBusy] = React.useState(false);
  const [deletePhrase, setDeletePhrase] = React.useState("");
  const [deleteNameConfirm, setDeleteNameConfirm] = React.useState("");
  const [reviewNote, setReviewNote] = React.useState("");
  const [reviewAction, setReviewAction] = React.useState<"approve" | "send_back" | null>(null);
  const [proposalBank, setProposalBank] = React.useState<{
    bankName: string;
    branchName: string;
    sortCode: string;
  } | null>(null);
  const [proposalAccountName, setProposalAccountName] = React.useState("");
  const [proposalAccountNumber, setProposalAccountNumber] = React.useState("");
  const [proposalNote, setProposalNote] = React.useState("");
  const [proposalBusy, setProposalBusy] = React.useState(false);

  const loadData = React.useCallback(async () => {
    if (!schoolId) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/platform/schools/${schoolId}`, { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to load school detail");
      }
      setData(json.data as SchoolDetail);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load school detail");
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  React.useEffect(() => {
    void loadData();
  }, [loadData]);

  async function handleReview(action: "approve" | "send_back") {
    if (!schoolId || !data) return;
    if (action === "send_back" && reviewNote.trim().length < 8) {
      toast.error("Add a short reason before sending this payout setup back.");
      return;
    }

    try {
      setReviewAction(action);
      const res = await fetch(
        `/api/platform/schools/${schoolId}/payment-setup-review`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            note: reviewNote.trim() || null,
          }),
        }
      );
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to review payout setup");
      }
      toast.success(
        action === "approve"
          ? "Payout setup approved for submission"
          : "Payout setup sent back to the school"
      );
      setReviewNote("");
      await loadData();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to review payout setup"
      );
    } finally {
      setReviewAction(null);
    }
  }

  async function submitPayoutProposal() {
    if (
      !schoolId ||
      !proposalBank ||
      !proposalAccountName.trim() ||
      !proposalAccountNumber.trim()
    ) {
      toast.error("Select bank branch and enter full account details.");
      return;
    }
    try {
      setProposalBusy(true);
      const res = await fetch(`/api/platform/schools/${schoolId}/payout-proposal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bankName: proposalBank.bankName,
          branchName: proposalBank.branchName,
          accountName: proposalAccountName.trim(),
          accountNumber: proposalAccountNumber.trim(),
          note: proposalNote.trim() || null,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to submit proposal");
      }
      toast.success("Payout proposal sent. The school must approve it in Payment setup.");
      setProposalAccountName("");
      setProposalAccountNumber("");
      setProposalNote("");
      setProposalBank(null);
      await loadData();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to submit proposal");
    } finally {
      setProposalBusy(false);
    }
  }

  async function withdrawPayoutProposal() {
    if (!schoolId) return;
    try {
      setProposalBusy(true);
      const res = await fetch(`/api/platform/schools/${schoolId}/payout-proposal`, {
        method: "DELETE",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to withdraw proposal");
      }
      toast.success("Pending proposal withdrawn.");
      await loadData();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to withdraw proposal");
    } finally {
      setProposalBusy(false);
    }
  }

  async function suspendSchool() {
    if (!schoolId) return;
    try {
      setLifecycleBusy(true);
      const res = await fetch(`/api/platform/schools/${schoolId}/suspend`, {
        method: "POST",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to suspend school");
      }
      toast.success("School suspended. Sign-in is blocked for all accounts in this school.");
      setSuspendOpen(false);
      await loadData();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to suspend school");
    } finally {
      setLifecycleBusy(false);
    }
  }

  async function activateSchool() {
    if (!schoolId) return;
    try {
      setLifecycleBusy(true);
      const res = await fetch(`/api/platform/schools/${schoolId}/activate`, {
        method: "POST",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to reactivate school");
      }
      toast.success("School reactivated.");
      setActivateOpen(false);
      await loadData();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to reactivate school");
    } finally {
      setLifecycleBusy(false);
    }
  }

  async function permanentDeleteSchool() {
    if (!schoolId || !data) return;
    if (deletePhrase.trim() !== PHRASE_DELETE_SCHOOL_PERMANENTLY) {
      toast.error("Confirmation phrase does not match.");
      return;
    }
    if (deleteNameConfirm.trim() !== data.name.trim()) {
      toast.error("School name must match exactly.");
      return;
    }
    try {
      setLifecycleBusy(true);
      const res = await fetch(`/api/platform/schools/${schoolId}/permanent-delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmationPhrase: deletePhrase.trim(),
          schoolName: deleteNameConfirm.trim(),
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to delete school");
      }
      toast.success("School and linked data were permanently removed.");
      setDeleteOpen(false);
      setDeletePhrase("");
      setDeleteNameConfirm("");
      router.push("/platform/schools");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete school");
    } finally {
      setLifecycleBusy(false);
    }
  }

  function statusBadgeClass(tone: SchoolDetail["paymentSetup"]["statusTone"]) {
    if (tone === "emerald") {
      return "border-emerald-500/30 bg-emerald-500/15 text-emerald-200";
    }
    if (tone === "amber") {
      return "border-amber-500/30 bg-amber-500/15 text-amber-200";
    }
    if (tone === "blue") {
      return "border-cyan-500/30 bg-cyan-500/15 text-cyan-200";
    }
    if (tone === "red") {
      return "border-rose-500/30 bg-rose-500/15 text-rose-200";
    }
    return "border-white/10 bg-white/5 text-white/70";
  }

  return (
    <div className="space-y-6 p-2 md:p-4">
      <div className="space-y-2">
        <Button asChild variant="ghost" size="sm" className="w-fit px-0 text-white/70 hover:text-white">
          <Link href="/platform/schools">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Schools
          </Link>
        </Button>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold text-white">{data?.name || "School Overview"}</h1>
          </div>
          {schoolId ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                asChild
                size="sm"
                className="w-fit bg-brand text-black hover:bg-brand/90"
              >
                <Link href={`/platform/schools/${schoolId}/onboarding`}>
                  <Rocket className="mr-2 h-4 w-4" />
                  Assisted launch wizard
                </Link>
              </Button>
            </div>
          ) : null}
        </div>
        {data ? (
          <p className="text-sm text-white/60">
            {data.status} • {data.city || "No city"}{data.region ? `, ${data.region}` : ""}
          </p>
        ) : null}
      </div>

      {loading && !data ? (
        <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading school overview
        </div>
      ) : null}

      {data ? (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border-white/10 bg-white/5"><CardContent className="p-5"><p className="text-xs uppercase tracking-wide text-white/50">Subscription</p><p className="mt-2 text-xl font-semibold text-white">{formatMoney(data.subscription?.effectivePriceMinor || 0)}</p><p className="text-xs text-white/50">{data.subscription?.tierName || "Unassigned"}</p></CardContent></Card>
            <Card className="border-white/10 bg-white/5"><CardContent className="p-5"><p className="text-xs uppercase tracking-wide text-white/50">Attributed Cost</p><p className="mt-2 text-xl font-semibold text-white">{formatMoney(data.usage.totalEstimatedCostMinor)}</p><p className="text-xs text-white/50">{data.usage.metricsCount} metrics</p></CardContent></Card>
            <Card className="border-white/10 bg-white/5"><CardContent className="p-5"><p className="text-xs uppercase tracking-wide text-white/50">Payment Setup</p><p className="mt-2 text-xl font-semibold text-white">{data.paymentReady ? "Ready" : "Pending"}</p><p className="text-xs text-white/50">Paystack school settlement</p></CardContent></Card>
          </div>

          <Card className="border-white/10 bg-white/5 text-white">
            <CardHeader className="space-y-2">
              <CardTitle className="text-lg">School access</CardTitle>
              <p className="text-sm text-white/60">
                Suspending blocks sign-in for everyone linked to this school. Permanent deletion removes
                MongoDB data, Clerk users, and uploaded files for this school.
              </p>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {data.status !== "deactivated" ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-rose-500/40 bg-rose-500/10 text-rose-100 hover:bg-rose-500/20"
                  disabled={lifecycleBusy}
                  onClick={() => setSuspendOpen(true)}
                >
                  <Ban className="mr-2 h-4 w-4" />
                  Suspend school
                </Button>
              ) : null}
              {data.status === "deactivated" ? (
                <Button
                  type="button"
                  size="sm"
                  className="bg-emerald-600 text-white hover:bg-emerald-500"
                  disabled={lifecycleBusy}
                  onClick={() => setActivateOpen(true)}
                >
                  Reactivate school
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-white/15 text-white/90 hover:bg-white/10"
                disabled={lifecycleBusy}
                onClick={() => {
                  setDeletePhrase("");
                  setDeleteNameConfirm("");
                  setDeleteOpen(true);
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete permanently
              </Button>
            </CardContent>
          </Card>

          <Dialog open={suspendOpen} onOpenChange={setSuspendOpen}>
            <DialogContent className="border-white/10 bg-slate-950 text-white sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Suspend this school?</DialogTitle>
                <DialogDescription className="text-white/65">
                  No teacher, parent, student, or admin account for this school will be able to sign in until you
                  reactivate it.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2 sm:justify-end">
                <Button type="button" variant="ghost" onClick={() => setSuspendOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  className="bg-rose-600 text-white hover:bg-rose-500"
                  disabled={lifecycleBusy}
                  onClick={() => void suspendSchool()}
                >
                  {lifecycleBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Suspend
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={activateOpen} onOpenChange={setActivateOpen}>
            <DialogContent className="border-white/10 bg-slate-950 text-white sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Reactivate this school?</DialogTitle>
                <DialogDescription className="text-white/65">
                  Staff and families will be able to sign in again according to their roles.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2 sm:justify-end">
                <Button type="button" variant="ghost" onClick={() => setActivateOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  className="bg-emerald-600 text-white hover:bg-emerald-500"
                  disabled={lifecycleBusy}
                  onClick={() => void activateSchool()}
                >
                  {lifecycleBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Reactivate
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <DialogContent className="border-white/10 bg-slate-950 text-white sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Permanently delete school</DialogTitle>
                <DialogDescription className="text-white/65">
                  This removes all database records for this school, deletes school users from Clerk, and deletes
                  UploadThing and Cloudinary files referenced in those records. This cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <div className="rounded-lg border border-white/10 bg-black/30 p-3 font-mono text-xs text-amber-100/90">
                  {PHRASE_DELETE_SCHOOL_PERMANENTLY}
                </div>
                <div className="space-y-2">
                  <Label className="text-white/80">Type the phrase exactly</Label>
                  <Input
                    value={deletePhrase}
                    onChange={(e) => setDeletePhrase(e.target.value)}
                    className="border-white/15 bg-white/5 text-white"
                    placeholder="Confirmation phrase"
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-white/80">School name (exact match)</Label>
                  <Input
                    value={deleteNameConfirm}
                    onChange={(e) => setDeleteNameConfirm(e.target.value)}
                    className="border-white/15 bg-white/5 text-white"
                    placeholder={data?.name ?? ""}
                    autoComplete="off"
                  />
                </div>
              </div>
              <DialogFooter className="gap-2 sm:justify-end">
                <Button type="button" variant="ghost" onClick={() => setDeleteOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  className="bg-rose-600 text-white hover:bg-rose-500"
                  disabled={lifecycleBusy}
                  onClick={() => void permanentDeleteSchool()}
                >
                  {lifecycleBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Delete forever
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Card className="border-white/10 bg-linear-to-br from-slate-900 via-slate-950 to-black text-white">
            <CardHeader className="space-y-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-3 text-lg">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5">
                      <ShieldCheck className="h-4 w-4 text-cyan-300" />
                    </span>
                    School Payment Setup Review
                  </CardTitle>
                  <p className="mt-2 text-sm text-white/60">
                    Review flagged payout setup changes before the school can continue online payment activation.
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className={cn("w-fit text-[11px]", statusBadgeClass(data.paymentSetup.statusTone))}
                >
                  {data.paymentSetup.statusLabel}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {data.paymentSetup.reviewReason ? (
                <Alert className="border-amber-500/20 bg-amber-500/10 text-amber-100">
                  <AlertCircle className="h-4 w-4 text-amber-200" />
                  <AlertTitle>Flagged for manual review</AlertTitle>
                  <AlertDescription className="text-amber-100/85">
                    {data.paymentSetup.reviewReason}
                  </AlertDescription>
                </Alert>
              ) : null}

              {data.paymentSetup.paystack.lastError ? (
                <Alert className="border-rose-500/20 bg-rose-500/10 text-rose-100">
                  <AlertCircle className="h-4 w-4 text-rose-200" />
                  <AlertTitle>School-visible error</AlertTitle>
                  <AlertDescription className="text-rose-100/85">
                    {data.paymentSetup.paystack.lastError}
                  </AlertDescription>
                </Alert>
              ) : null}

              {(data.paymentSetup.paystack.lastErrorDetail ||
                data.paymentSetup.paystack.lastErrorAt ||
                data.paymentSetup.provisioningJob) && (
                <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-white/50">
                    Operator diagnostics
                  </p>
                  <p className="mt-1 text-xs text-white/45">
                    Not shown to the school. Configure{" "}
                    <code className="rounded bg-white/10 px-1">INTERNAL_CRON_SECRET</code>{" "}
                    and POST to{" "}
                    <code className="rounded bg-white/10 px-1">/api/provisioning/run</code>{" "}
                    on a schedule so queued jobs finish if the first attempt times out.
                    Optional: set{" "}
                    <code className="rounded bg-white/10 px-1">INTERNAL_CRON_URL</code>{" "}
                    when triggering from workers.
                  </p>
                  {data.paymentSetup.paystack.lastErrorAt ? (
                    <p className="mt-2 text-xs text-white/55">
                      Last error at:{" "}
                      {new Date(data.paymentSetup.paystack.lastErrorAt).toLocaleString()}
                    </p>
                  ) : null}
                  {data.paymentSetup.provisioningJob ? (
                    <p className="mt-2 text-xs text-white/55">
                      Latest job: {data.paymentSetup.provisioningJob.status} · attempts{" "}
                      {data.paymentSetup.provisioningJob.attempts}
                      {data.paymentSetup.provisioningJob.lastError
                        ? ` · ${data.paymentSetup.provisioningJob.lastError}`
                        : ""}
                    </p>
                  ) : null}
                  {data.paymentSetup.paystack.lastErrorDetail ? (
                    <pre className="mt-3 max-h-48 overflow-auto rounded-xl border border-white/10 bg-black/40 p-3 text-[11px] leading-relaxed whitespace-pre-wrap text-emerald-100/90">
                      {data.paymentSetup.paystack.lastErrorDetail}
                    </pre>
                  ) : null}
                </div>
              )}

              {data.paymentSetup.pendingPlatformPayout ? (
                <Alert className="border-sky-500/20 bg-sky-500/10 text-sky-100">
                  <AlertTitle>Pending platform proposal</AlertTitle>
                  <AlertDescription className="space-y-2 text-sky-100/85">
                    <p>
                      Awaiting school approval: {data.paymentSetup.pendingPlatformPayout.bankName}{" "}
                      — {data.paymentSetup.pendingPlatformPayout.branchName}, acct{" "}
                      {data.paymentSetup.pendingPlatformPayout.maskedAccountNumber}
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="border-white/20 text-white hover:bg-white/10"
                      disabled={proposalBusy}
                      onClick={() => void withdrawPayoutProposal()}
                    >
                      Withdraw proposal
                    </Button>
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-4">
                  <p className="text-sm font-semibold text-white">Propose payout correction</p>
                  <p className="text-xs text-white/55">
                    Submits bank details for the billing owner (or pre-live admin) to accept
                    in Admin → Settings → Payment setup. Audited.
                  </p>
                  <div className="space-y-2">
                    <Label className="text-white/70">Bank &amp; branch</Label>
                    <BankBranchCombo
                      value={
                        proposalBank
                          ? {
                              bankName: proposalBank.bankName,
                              branchName: proposalBank.branchName,
                              sortCode: proposalBank.sortCode,
                            }
                          : null
                      }
                      onChange={(v) =>
                        setProposalBank(
                          v
                            ? {
                                bankName: v.bankName,
                                branchName: v.branchName,
                                sortCode: v.sortCode,
                              }
                            : null
                        )
                      }
                      placeholder="Search Ghana bank branch…"
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-white/70">Account name</Label>
                      <Input
                        value={proposalAccountName}
                        onChange={(e) => setProposalAccountName(e.target.value)}
                        className="border-white/10 bg-black/30 text-white"
                        placeholder="As on bank records"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-white/70">Account number</Label>
                      <Input
                        value={proposalAccountNumber}
                        onChange={(e) => setProposalAccountNumber(e.target.value)}
                        className="border-white/10 bg-black/30 text-white"
                        placeholder="Full account number"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-white/70">Note to school (optional)</Label>
                    <Textarea
                      value={proposalNote}
                      onChange={(e) => setProposalNote(e.target.value)}
                      className="min-h-[80px] border-white/10 bg-black/30 text-white"
                      placeholder="Why this change is needed"
                    />
                  </div>
                  <Button
                    type="button"
                    className="bg-sky-600 text-white hover:bg-sky-500"
                    disabled={proposalBusy}
                    onClick={() => void submitPayoutProposal()}
                  >
                    {proposalBusy ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving…
                      </>
                    ) : (
                      "Submit proposal to school"
                    )}
                  </Button>
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-wide text-white/45">Bank</p>
                  <p className="mt-2 text-sm font-semibold text-white">
                    {data.paymentSetup.bank.bankName || "Not set"}
                  </p>
                  <p className="mt-1 text-xs text-white/50">
                    {data.paymentSetup.bank.branchName || "No branch"}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-wide text-white/45">Account Holder</p>
                  <p className="mt-2 text-sm font-semibold text-white">
                    {data.paymentSetup.bank.accountName || "Not set"}
                  </p>
                  <p className="mt-1 text-xs text-white/50">
                    {data.paymentSetup.bank.maskedAccountNumber || "No account"}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-wide text-white/45">Billing Owner</p>
                  <p className="mt-2 text-sm font-semibold text-white">
                    {data.paymentSetup.billingOwner.name || "Unassigned"}
                  </p>
                  <p className="mt-1 text-xs text-white/50">
                    {data.paymentSetup.billingOwner.email || "No billing owner email"}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-wide text-white/45">Settlement Rail</p>
                  <p className="mt-2 text-sm font-semibold text-white">
                    {data.paymentSetup.paystack.subaccountCode || "Not linked"}
                  </p>
                  <p className="mt-1 text-xs text-white/50">
                    {data.paymentReady ? "Checkout enabled" : "Checkout blocked"}
                  </p>
                </div>
              </div>

              {data.paymentSetup.status === "review_required" ? (
                <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-white">Review Decision</p>
                    <p className="text-sm text-white/60">
                      Approve to return this school to the normal submission path, or send it back with a clear reason.
                    </p>
                  </div>
                  <Textarea
                    value={reviewNote}
                    onChange={(event) => setReviewNote(event.target.value)}
                    placeholder="Optional approval note or required send-back reason"
                    className="mt-4 min-h-[110px] border-white/10 bg-black/20 text-white placeholder:text-white/35"
                  />
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Button
                      type="button"
                      onClick={() => void handleReview("approve")}
                      disabled={Boolean(reviewAction)}
                      className="bg-emerald-500 text-slate-950 hover:bg-emerald-400"
                    >
                      {reviewAction === "approve" ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Approving
                        </>
                      ) : (
                        <>
                          <BadgeCheck className="h-4 w-4" />
                          Approve for submission
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void handleReview("send_back")}
                      disabled={Boolean(reviewAction)}
                      className="border-rose-500/30 bg-rose-500/10 text-rose-100 hover:bg-rose-500/20"
                    >
                      {reviewAction === "send_back" ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Sending back
                        </>
                      ) : (
                        <>
                          <AlertCircle className="h-4 w-4" />
                          Send back to school
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <div className="flex flex-wrap gap-2">
            <Button asChild className="bg-cyan-600 text-white hover:bg-cyan-700"><Link href={`/platform/schools/${data.id}/subscription`}>Manage Subscription</Link></Button>
            <Button asChild variant="outline" className="border-white/10 bg-white/5 text-white hover:bg-white/10"><Link href={`/platform/schools/${data.id}/usage`}>View Usage</Link></Button>
          </div>

          <Card className="border-white/10 bg-white/5 text-white">
            <CardHeader><CardTitle className="text-base">Recent Commercial Events</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {data.events.map((event) => (
                <div key={event.id} className="rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm">
                  <p className="text-white">{event.summary}</p>
                  <p className="mt-1 text-xs text-white/50">{event.actorEmail || "System"} • {new Date(event.createdAt).toLocaleString()}</p>
                </div>
              ))}
              {data.events.length === 0 ? <p className="text-sm text-white/60">No subscription events yet.</p> : null}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
