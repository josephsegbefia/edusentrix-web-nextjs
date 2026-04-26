"use client";

import * as React from "react";
import {
  CalendarDays,
  CheckCircle2,
  ExternalLink,
  FileText,
  Loader2,
  Mail,
  MailCheck,
  MessageCircle,
  Paperclip,
  Phone,
  Send,
  User,
  XCircle,
} from "lucide-react";
import { format } from "date-fns/format";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CustomDatePicker } from "@/components/ui/custom-date-picker";
import { formatAdmissionInterviewRange } from "@/lib/admissions/interview-display";
import { admissionsAdminFieldClass } from "@/components/admissions/admissions-admin-ui";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import {
  useAdmissionApplication,
  useRequestSupplementalAdmissionDocument,
  useResendAdmissionInterviewEmail,
  useResendAdmissionPipelineReminder,
  useResendAdmissionReceivedEmail,
  useResendTrackerLink,
  useSendAdmissionFeeLinkEmail,
  useUpdateAdmissionApplication,
  useWithdrawAdmissionApplication,
  type AdmissionApplicationDetail,
  type UpdateApplicationInput,
} from "@/hooks/admissions/useAdmissionApplications";
import { useConfirmationDialog } from "@/hooks/useConfirmationDialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { DecisionPanel } from "./DecisionPanel";
import { LeoAdmissionsGuide } from "@/components/admissions/leo/LeoAdmissionsGuide";

function combineLocalDateAndTime(date: Date, timeHm: string): Date | null {
  const trimmed = timeHm.trim();
  if (!/^\d{1,2}:\d{2}$/.test(trimmed)) return null;
  const [hh, mm] = trimmed.split(":").map((x) => parseInt(x, 10));
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  const d = new Date(date);
  d.setHours(hh, mm, 0, 0);
  return d;
}

const STATUS_OPTIONS: Array<{
  value: "submitted" | "under_review" | "interview_scheduled";
  label: string;
}> = [
  { value: "submitted", label: "Submitted" },
  { value: "under_review", label: "Under review" },
  { value: "interview_scheduled", label: "Interview scheduled" },
];

const STATUS_BADGES: Record<AdmissionApplicationDetail["status"], string> = {
  submitted: "border-yellow-500/30 bg-yellow-500/15 text-yellow-200",
  under_review: "border-sky-500/30 bg-sky-500/15 text-sky-200",
  interview_scheduled: "border-violet-500/30 bg-violet-500/15 text-violet-200",
  accepted: "border-emerald-500/30 bg-emerald-500/15 text-emerald-200",
  rejected: "border-rose-500/30 bg-rose-500/15 text-rose-200",
  waitlisted: "border-amber-500/30 bg-amber-500/15 text-amber-200",
  withdrawn: "border-white/10 bg-white/[0.06] text-white/60",
  expired: "border-zinc-500/30 bg-zinc-500/15 text-zinc-200",
};

type ApplicationDetailDrawerProps = {
  applicationId: string | null;
  onClose: () => void;
};

export function ApplicationDetailDrawer({
  applicationId,
  onClose,
}: ApplicationDetailDrawerProps) {
  const { data, isLoading, isError, error } = useAdmissionApplication(applicationId);
  const update = useUpdateAdmissionApplication();
  const withdraw = useWithdrawAdmissionApplication();
  const resend = useResendTrackerLink();
  const [notifyPipeline, setNotifyPipeline] = React.useState(true);
  const { confirm, confirmationDialog } = useConfirmationDialog();
  const detail = data?.data ?? null;
  const [notes, setNotes] = React.useState("");

  React.useEffect(() => {
    setNotes(detail?.notesPrivate ?? "");
  }, [detail?.id, detail?.notesPrivate]);

  function handleStatus(value: string) {
    if (!detail) return;
    update.mutate(
      {
        applicationId: detail.id,
        patch: {
          status: value as NonNullable<UpdateApplicationInput["status"]>,
          notifyApplicant: notifyPipeline,
        },
      },
      {
        onSuccess: () => toast.success("Status updated"),
        onError: (err) => toast.error(err.message || "Could not update status"),
      }
    );
  }

  function handleSaveNotes() {
    if (!detail) return;
    update.mutate(
      {
        applicationId: detail.id,
        patch: { notesPrivate: notes },
      },
      {
        onSuccess: () => toast.success("Notes saved"),
        onError: (err) => toast.error(err.message || "Could not save notes"),
      }
    );
  }

  async function handleResendTracker() {
    if (!detail) return;
    resend.mutate(
      { applicationId: detail.id },
      {
        onSuccess: (resp) =>
          toast.success(`Tracker link sent to ${resp.data.sentTo}`),
        onError: (err) =>
          toast.error(err.message || "Could not resend tracker link"),
      }
    );
  }

  async function handleWithdraw() {
    if (!detail) return;
    const result = await confirm({
      title: "Withdraw this application",
      description:
        "The application will be marked as withdrawn and removed from the active pipeline. This action is recorded in the timeline.",
      confirmLabel: "Withdraw",
      intent: "destructive",
    });
    if (result !== "confirm") return;
    withdraw.mutate(
      { applicationId: detail.id, reason: null },
      {
        onSuccess: () => toast.success("Application withdrawn"),
        onError: (err) => toast.error(err.message || "Could not withdraw"),
      }
    );
  }

  return (
    <>
      <Sheet
        open={Boolean(applicationId)}
        onOpenChange={(open) => !open && onClose()}
      >
        <SheetContent
          side="right"
          className="w-full overflow-y-auto border-l border-white/10 bg-[#080b12] px-0 py-0 text-white shadow-2xl sm:max-w-2xl"
        >
          <SheetHeader className="border-b border-white/10 bg-[#0b101a] px-5 py-5">
            <div className="rounded-2xl border border-white/10 bg-linear-to-br from-[#182033] via-[#111827] to-[#090d15] p-5 text-left shadow-xl">
              <SheetTitle className="text-lg font-semibold text-white">
                Application detail
              </SheetTitle>
              <SheetDescription className="mt-1 max-w-lg text-sm text-white/60">
                Review submitted information, documents, and decide on this
                applicant.
              </SheetDescription>
            </div>
          </SheetHeader>

          {isLoading ? (
            <div className="flex min-h-[320px] items-center justify-center text-sm text-white/60">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading…
            </div>
          ) : isError ? (
            <div className="m-5 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-100">
              {error instanceof Error ? error.message : "Failed to load"}
            </div>
          ) : detail ? (
            <DetailContent
              detail={detail}
              notes={notes}
              setNotes={setNotes}
              onSaveNotes={handleSaveNotes}
              onStatus={handleStatus}
              saving={update.isPending}
              update={update}
              notifyPipeline={notifyPipeline}
              onNotifyPipelineChange={setNotifyPipeline}
              onResendTracker={handleResendTracker}
              onWithdraw={handleWithdraw}
              resending={resend.isPending}
              withdrawing={withdraw.isPending}
            />
          ) : null}
        </SheetContent>
      </Sheet>
      {confirmationDialog}
    </>
  );
}

function DetailContent({
  detail,
  notes,
  setNotes,
  onSaveNotes,
  onStatus,
  saving,
  update,
  notifyPipeline,
  onNotifyPipelineChange,
  onResendTracker,
  onWithdraw,
  resending,
  withdrawing,
}: {
  detail: AdmissionApplicationDetail;
  notes: string;
  setNotes: (s: string) => void;
  onSaveNotes: () => void;
  onStatus: (value: string) => void;
  saving: boolean;
  update: ReturnType<typeof useUpdateAdmissionApplication>;
  notifyPipeline: boolean;
  onNotifyPipelineChange: (v: boolean) => void;
  onResendTracker: () => void;
  onWithdraw: () => void;
  resending: boolean;
  withdrawing: boolean;
}) {
  const resendReceived = useResendAdmissionReceivedEmail();
  const resendReminder = useResendAdmissionPipelineReminder();
  const sendFeeLink = useSendAdmissionFeeLinkEmail();
  const resendInterview = useResendAdmissionInterviewEmail();
  const requestSupplemental = useRequestSupplementalAdmissionDocument();

  const [interviewDate, setInterviewDate] = React.useState<Date | null>(null);
  const [interviewStartTime, setInterviewStartTime] = React.useState("");
  const [interviewEndTime, setInterviewEndTime] = React.useState("");
  const [requestDocOpen, setRequestDocOpen] = React.useState(false);
  const [docRequestLabel, setDocRequestLabel] = React.useState("");
  const [docRequestMessage, setDocRequestMessage] = React.useState("");

  React.useEffect(() => {
    if (!detail.interviewAt) {
      setInterviewDate(null);
      setInterviewStartTime("");
      setInterviewEndTime("");
      return;
    }
    const start = new Date(detail.interviewAt);
    setInterviewDate(
      new Date(start.getFullYear(), start.getMonth(), start.getDate())
    );
    setInterviewStartTime(format(start, "HH:mm"));
    const endRaw = detail.interviewEndsAt ?? null;
    if (endRaw) {
      setInterviewEndTime(format(new Date(endRaw), "HH:mm"));
    } else {
      setInterviewEndTime("");
    }
  }, [detail.id, detail.interviewAt, detail.interviewEndsAt]);

  const additionalEntries = Object.entries(detail.additional ?? {}).filter(
    ([, v]) => v != null && v !== ""
  );

  // The status dropdown is only meaningful for in-progress applications. Once a
  // decision has been recorded, the status is derived from `decision.outcome`.
  const statusDropdownDisabled =
    Boolean(detail.decision) ||
    detail.provisioned ||
    detail.status === "withdrawn";

  return (
    <div className="space-y-5 px-5 py-5">
      <div className="rounded-3xl border border-white/10 bg-[#0e1420] p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/40">
              Reference
            </p>
            <p className="font-mono text-base font-semibold text-white">
              {detail.referenceCode}
            </p>
          </div>
          <Badge
            variant="outline"
            className={cn(
              "shrink-0 border text-xs uppercase tracking-wide",
              STATUS_BADGES[detail.status]
            )}
          >
            {detail.status.replace("_", " ")}
          </Badge>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <PremiumSelect
            value={
              statusDropdownDisabled
                ? detail.status
                : (STATUS_OPTIONS.find((o) => o.value === detail.status)?.value ??
                  "submitted")
            }
            onValueChange={onStatus}
            disabled={statusDropdownDisabled}
          >
            <PremiumSelectTrigger className={admissionsAdminFieldClass}>
              <PremiumSelectValue />
            </PremiumSelectTrigger>
            <PremiumSelectContent>
              {STATUS_OPTIONS.map((s) => (
                <PremiumSelectItem key={s.value} value={s.value}>
                  {s.label}
                </PremiumSelectItem>
              ))}
            </PremiumSelectContent>
          </PremiumSelect>
          <Button
            variant="outline"
            asChild
            className="border-white/15 bg-[#141b2a] text-white hover:bg-[#1a2436] hover:text-white"
          >
            <a
              href={`/apply/track/${detail.trackerToken}`}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Open applicant tracker
            </a>
          </Button>
        </div>
        <div className="mt-3 flex flex-col gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-xs text-white/60">
            <Checkbox
              checked={notifyPipeline}
              onCheckedChange={(v) => onNotifyPipelineChange(v === true)}
              className="border-white/25 data-[state=checked]:bg-emerald-600"
            />
            Email guardian when status or interview schedule changes (this update)
          </label>
          <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onResendTracker}
            disabled={resending}
            className="border-white/15 bg-[#141b2a] text-white hover:bg-[#1a2436] hover:text-white"
          >
            {resending ? (
              <Loader2 className="mr-2 h-3 w-3 animate-spin" />
            ) : (
              <MailCheck className="mr-2 h-3 w-3" />
            )}
            Resend tracker link
          </Button>
          {detail.status !== "withdrawn" && !detail.provisioned ? (
            <Button
              variant="outline"
              size="sm"
              onClick={onWithdraw}
              disabled={withdrawing}
              className="border-rose-500/35 bg-rose-500/10 text-rose-100 hover:bg-rose-500/20 hover:text-rose-50"
            >
              {withdrawing ? (
                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
              ) : (
                <XCircle className="mr-2 h-3 w-3" />
              )}
              Withdraw
            </Button>
          ) : null}
          </div>
        </div>
      </div>

      {detail.status === "interview_scheduled" ? (
      <section className="rounded-3xl border border-white/10 bg-[#0e1420] p-5 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-white/40" />
          <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-white/55">
            Interview / assessment
          </h3>
        </div>
        {detail.interviewAt ? (
          <div className="mb-4 rounded-2xl border border-violet-500/25 bg-violet-500/10 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-200/90">
              Scheduled slot
            </p>
            <p className="mt-1.5 text-sm font-medium text-white">
              {formatAdmissionInterviewRange(
                new Date(detail.interviewAt),
                detail.interviewEndsAt ? new Date(detail.interviewEndsAt) : null
              )}
            </p>
            <p className="mt-2 text-xs text-white/50">
              Edit the fields below and save. Check &quot;Email guardian when status or
              interview schedule changes&quot; above to send the family the updated
              times, or use &quot;Email schedule to guardian&quot; after saving.
            </p>
          </div>
        ) : (
          <p className="mb-4 text-sm text-white/55">
            Set the interview date and times. Check &quot;Email guardian when status or
            interview schedule changes&quot; above if the family should be notified when
            you save.
          </p>
        )}
        <div className="space-y-3 sm:col-span-2">
          <CustomDatePicker
            value={interviewDate}
            onChange={setInterviewDate}
            placeholder="Pick date"
            label="Interview date"
            className="w-full max-w-sm"
            triggerAriaLabel="Interview date"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="text-xs text-white/55">Start time</Label>
              <input
                type="time"
                value={interviewStartTime}
                onChange={(e) => setInterviewStartTime(e.target.value)}
                disabled={!interviewDate}
                className={cn(
                  "mt-1 flex h-10 w-full rounded-xl border px-3 text-sm text-white",
                  admissionsAdminFieldClass
                )}
              />
            </div>
            <div>
              <Label className="text-xs text-white/55">End time (optional)</Label>
              <input
                type="time"
                value={interviewEndTime}
                onChange={(e) => setInterviewEndTime(e.target.value)}
                disabled={!interviewDate}
                className={cn(
                  "mt-1 flex h-10 w-full rounded-xl border px-3 text-sm text-white",
                  admissionsAdminFieldClass
                )}
              />
            </div>
          </div>
          <p className="text-[11px] text-white/40">
            Times use your computer&apos;s local timezone. Default start is 9:00
            if you leave it blank.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={saving}
              onClick={() => {
                if (!interviewDate) {
                  update.mutate(
                    {
                      applicationId: detail.id,
                      patch: {
                        interviewAt: null,
                        interviewEndsAt: null,
                        notifyApplicant: notifyPipeline,
                      },
                    },
                    {
                      onSuccess: () =>
                        toast.success("Interview schedule cleared"),
                      onError: (err) =>
                        toast.error(err.message || "Could not save"),
                    }
                  );
                  return;
                }
                const startT = interviewStartTime.trim() || "09:00";
                const start = combineLocalDateAndTime(interviewDate, startT);
                if (!start) {
                  toast.error("Enter a valid start time");
                  return;
                }
                let endIso: string | null = null;
                if (interviewEndTime.trim()) {
                  const end = combineLocalDateAndTime(
                    interviewDate,
                    interviewEndTime.trim()
                  );
                  if (!end) {
                    toast.error("Enter a valid end time");
                    return;
                  }
                  if (end.getTime() <= start.getTime()) {
                    toast.error("End time must be after start time");
                    return;
                  }
                  endIso = end.toISOString();
                }
                update.mutate(
                  {
                    applicationId: detail.id,
                    patch: {
                      interviewAt: start.toISOString(),
                      interviewEndsAt: endIso,
                      notifyApplicant: notifyPipeline,
                    },
                  },
                  {
                    onSuccess: () => toast.success("Interview schedule saved"),
                    onError: (err) =>
                      toast.error(err.message || "Could not save"),
                  }
                );
              }}
            >
              {saving ? (
                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
              ) : null}
              {detail.interviewAt ? "Save changes" : "Save interview schedule"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-white/15 bg-[#141b2a] text-white hover:bg-[#1a2436]"
              disabled={!detail.interviewAt || resendInterview.isPending}
              onClick={() => {
                resendInterview.mutate(
                  { applicationId: detail.id },
                  {
                    onSuccess: (r) =>
                      toast.success(`Schedule email sent to ${r.data.sentTo}`),
                    onError: (err) =>
                      toast.error(err.message || "Could not send"),
                  }
                );
              }}
            >
              {resendInterview.isPending ? (
                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
              ) : (
                <Send className="mr-2 h-3 w-3" />
              )}
              Email schedule to guardian
            </Button>
          </div>
        </div>
      </section>
      ) : null}

      <section className="rounded-3xl border border-white/10 bg-[#0e1420] p-5 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <Mail className="h-4 w-4 text-white/40" />
          <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-white/55">
            Emails to guardian
          </h3>
        </div>
        <p className="mb-3 text-xs text-white/45 sm:col-span-2">
          Manual messages use the same secure tracker and upload links as
          automated notifications.
        </p>
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <Button
            size="sm"
            variant="outline"
            className="border-white/15 bg-[#141b2a] text-white hover:bg-[#1a2436]"
            disabled={resendReceived.isPending}
            onClick={() =>
              resendReceived.mutate(
                { applicationId: detail.id },
                {
                  onSuccess: (r) =>
                    toast.success(`Confirmation sent to ${r.data.sentTo}`),
                  onError: (err) =>
                    toast.error(err.message || "Could not send"),
                }
              )
            }
          >
            {resendReceived.isPending ? (
              <Loader2 className="mr-2 h-3 w-3 animate-spin" />
            ) : (
              <Mail className="mr-2 h-3 w-3" />
            )}
            Resend application received
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="border-white/15 bg-[#141b2a] text-white hover:bg-[#1a2436]"
            disabled={resendReminder.isPending}
            onClick={() =>
              resendReminder.mutate(
                { applicationId: detail.id },
                {
                  onSuccess: (r) =>
                    toast.success(`Reminder sent to ${r.data.sentTo}`),
                  onError: (err) =>
                    toast.error(err.message || "Could not send"),
                }
              )
            }
          >
            {resendReminder.isPending ? (
              <Loader2 className="mr-2 h-3 w-3 animate-spin" />
            ) : (
              <MailCheck className="mr-2 h-3 w-3" />
            )}
            Send status reminder
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="border-white/15 bg-[#141b2a] text-white hover:bg-[#1a2436]"
            disabled={
              detail.feeStatus !== "pending" || sendFeeLink.isPending
            }
            onClick={() =>
              sendFeeLink.mutate(
                { applicationId: detail.id },
                {
                  onSuccess: (r) =>
                    toast.success(`Fee instructions sent to ${r.data.sentTo}`),
                  onError: (err) =>
                    toast.error(err.message || "Could not send"),
                }
              )
            }
          >
            {sendFeeLink.isPending ? (
              <Loader2 className="mr-2 h-3 w-3 animate-spin" />
            ) : (
              <Mail className="mr-2 h-3 w-3" />
            )}
            Send fee payment link
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="border-white/15 bg-[#141b2a] text-white hover:bg-[#1a2436]"
            disabled={requestSupplemental.isPending}
            onClick={() => setRequestDocOpen(true)}
          >
            <Paperclip className="mr-2 h-3 w-3" />
            Request document…
          </Button>
        </div>
      </section>

      <Dialog open={requestDocOpen} onOpenChange={setRequestDocOpen}>
        <DialogContent className="border-white/10 bg-[#0e1420] text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Request an extra document</DialogTitle>
            <DialogDescription className="text-white/55">
              Sends the guardian a secure upload link and attaches the file to
              this application when submitted.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-white/70">Document name</Label>
              <Input
                value={docRequestLabel}
                onChange={(e) => setDocRequestLabel(e.target.value)}
                placeholder="e.g. Most recent report card"
                className="mt-1 border-white/10 bg-black/20 text-white"
              />
            </div>
            <div>
              <Label className="text-white/70">Message (optional)</Label>
              <Textarea
                value={docRequestMessage}
                onChange={(e) => setDocRequestMessage(e.target.value)}
                rows={3}
                placeholder="Instructions for the family"
                className="mt-1 border-white/10 bg-black/20 text-white"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              className="border-white/15 bg-transparent"
              onClick={() => setRequestDocOpen(false)}
            >
              Cancel
            </Button>
            <Button
              disabled={
                !docRequestLabel.trim() || requestSupplemental.isPending
              }
              onClick={() => {
                requestSupplemental.mutate(
                  {
                    applicationId: detail.id,
                    label: docRequestLabel.trim(),
                    message: docRequestMessage.trim() || null,
                    sendEmail: true,
                  },
                  {
                    onSuccess: (resp) => {
                      toast.success(
                        resp.data.emailSent
                          ? `Request emailed. Link: ${resp.data.uploadUrl}`
                          : `Upload link created: ${resp.data.uploadUrl}`
                      );
                      setRequestDocOpen(false);
                      setDocRequestLabel("");
                      setDocRequestMessage("");
                    },
                    onError: (err) =>
                      toast.error(err.message || "Could not create request"),
                  }
                );
              }}
            >
              {requestSupplemental.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Send request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DecisionPanel detail={detail} />

      <LeoAdmissionsGuide surface="drawer" detail={detail} />

      <Section title="Applicant" icon={<User className="h-4 w-4 text-white/40" />}>
        <Field
          label="Name"
          value={`${detail.applicant.firstName} ${detail.applicant.lastName}`}
        />
        <Field label="Sex" value={detail.applicant.sex ?? "—"} />
        <Field
          label="Date of birth"
          value={
            detail.applicant.dateOfBirth
              ? format(new Date(detail.applicant.dateOfBirth), "MMM d, yyyy")
              : "—"
          }
        />
        <Field
          label="Intended grade"
          value={detail.applicant.intendedGradeName ?? "—"}
        />
        {detail.applicantAddress ? (
          <Field label="Address" value={detail.applicantAddress} wide />
        ) : null}
      </Section>

      <Section title="Guardian" icon={<User className="h-4 w-4 text-white/40" />}>
        <Field
          label="Name"
          value={`${detail.guardian.firstName} ${detail.guardian.lastName}`}
        />
        <Field
          label="Relationship"
          value={detail.guardian.relationship ?? "—"}
        />
        <Field
          label="Email"
          value={detail.guardian.email}
          icon={<Mail className="h-3 w-3" />}
        />
        <Field
          label="Phone"
          value={detail.guardian.phone ?? "—"}
          icon={<Phone className="h-3 w-3" />}
        />
        {detail.guardianAddress ? (
          <Field label="Address" value={detail.guardianAddress} wide />
        ) : null}
        {detail.guardianOccupation ? (
          <Field label="Occupation" value={detail.guardianOccupation} />
        ) : null}
      </Section>

      <Section
        title="Documents"
        icon={<FileText className="h-4 w-4 text-white/40" />}
      >
        {(detail.supplementalDocumentRequests ?? []).length > 0 ? (
          <div className="mb-4 space-y-2 sm:col-span-2">
            <p className="text-[11px] uppercase tracking-wide text-white/40">
              Supplemental requests
            </p>
            <ul className="space-y-1.5">
              {(detail.supplementalDocumentRequests ?? []).map((req) => (
                <li
                  key={req.id}
                  className="rounded-xl border border-violet-500/20 bg-violet-500/10 px-3 py-2 text-xs text-white/80"
                >
                  <span className="font-medium text-white">{req.label}</span>
                  {req.fulfilledAt ? (
                    <span className="ml-2 text-emerald-300">· Received</span>
                  ) : (
                    <span className="ml-2 text-amber-200">· Awaiting upload</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {detail.documents.length === 0 ? (
          <p className="text-xs text-white/40">No documents uploaded.</p>
        ) : (
          <div className="space-y-1.5 sm:col-span-2">
            {detail.documents.map((doc) => (
              <a
                key={`${doc.requirementId}-${doc.uploadedAt}`}
                href={doc.fileUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between rounded-xl border border-white/10 bg-[#111827] px-3 py-2 text-sm text-white transition hover:border-white/20 hover:bg-[#172033]"
              >
                <span className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-white/40" />
                  <span>
                    <span className="block font-medium">{doc.label}</span>
                    <span className="block text-[11px] text-white/40">
                      {doc.fileName ?? "Uploaded file"}
                    </span>
                  </span>
                </span>
                <ExternalLink className="h-3 w-3 text-white/40" />
              </a>
            ))}
          </div>
        )}
      </Section>

      {additionalEntries.length > 0 ? (
        <Section
          title="Additional answers"
          icon={<CheckCircle2 className="h-4 w-4 text-white/40" />}
        >
          <div className="grid gap-2 text-xs">
            {additionalEntries.map(([key, value]) => (
              <div
                key={key}
                className="rounded-xl border border-white/10 bg-[#111827] px-3 py-2"
              >
                <p className="text-[11px] uppercase tracking-wide text-white/40">
                  {key}
                </p>
                <p className="mt-0.5 text-white/85">
                  {Array.isArray(value)
                    ? (value as string[]).join(", ")
                    : String(value)}
                </p>
              </div>
            ))}
          </div>
        </Section>
      ) : null}

      <Section
        title="Internal notes"
        icon={<MessageCircle className="h-4 w-4 text-white/40" />}
      >
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          placeholder="Notes are visible to admissions reviewers only."
          className={admissionsAdminFieldClass}
        />
        <div className="mt-2 flex justify-end">
          <Button
            size="sm"
            onClick={onSaveNotes}
            disabled={saving || notes === (detail.notesPrivate ?? "")}
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                Saving…
              </>
            ) : (
              "Save notes"
            )}
          </Button>
        </div>
      </Section>

      <div className="rounded-2xl border border-white/10 bg-[#0e1420] p-3 text-[11px] text-white/45">
        <CalendarDays className="mr-1 inline h-3 w-3" />
        Submitted{" "}
        {detail.submittedAt
          ? format(new Date(detail.submittedAt), "MMM d, yyyy 'at' p")
          : "—"}{" "}
        · channel: {detail.channel}
      </div>
    </div>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-white/10 bg-[#0e1420] p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        {icon}
        <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-white/55">
          {title}
        </h3>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function Field({
  label,
  value,
  icon,
  wide = false,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <p className="text-[11px] uppercase tracking-wide text-white/40">{label}</p>
      <p className="mt-0.5 inline-flex items-center gap-1.5 text-sm text-white/90">
        {icon}
        {value}
      </p>
    </div>
  );
}
