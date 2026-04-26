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
  Phone,
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
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import {
  useAdmissionApplication,
  useResendTrackerLink,
  useUpdateAdmissionApplication,
  useWithdrawAdmissionApplication,
  type AdmissionApplicationDetail,
} from "@/hooks/admissions/useAdmissionApplications";
import { useConfirmationDialog } from "@/hooks/useConfirmationDialog";
import { toast } from "sonner";
import { DecisionPanel } from "./DecisionPanel";
import { LeoAdmissionsGuide } from "@/components/admissions/leo/LeoAdmissionsGuide";

const STATUS_OPTIONS: Array<{
  value: "submitted" | "under_review" | "interview_scheduled";
  label: string;
}> = [
  { value: "submitted", label: "Submitted" },
  { value: "under_review", label: "Under review" },
  { value: "interview_scheduled", label: "Interview scheduled" },
];

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
        patch: { status: value as "under_review" },
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
          className="w-full overflow-y-auto sm:max-w-2xl"
        >
          <SheetHeader>
            <SheetTitle>Application detail</SheetTitle>
            <SheetDescription>
              Review submitted information, documents, and decide on this
              applicant.
            </SheetDescription>
          </SheetHeader>

          {isLoading ? (
            <div className="mt-8 flex items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading…
            </div>
          ) : isError ? (
            <div className="mt-8 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-100">
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
  onResendTracker: () => void;
  onWithdraw: () => void;
  resending: boolean;
  withdrawing: boolean;
}) {
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
    <div className="mt-4 space-y-5">
      <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
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
            className={`border-white/10 ${
              detail.status === "accepted"
                ? "bg-emerald-500/15 text-emerald-100"
                : detail.status === "rejected"
                  ? "bg-rose-500/15 text-rose-100"
                  : detail.status === "waitlisted"
                    ? "bg-amber-500/15 text-amber-100"
                    : detail.status === "withdrawn"
                      ? "bg-white/5 text-white/60"
                      : "bg-white/5 text-white/80"
            }`}
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
            <PremiumSelectTrigger>
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
            className="border-white/10 bg-white/5 text-white"
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
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onResendTracker}
            disabled={resending}
            className="border-white/10 bg-white/5 text-white"
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
              className="border-rose-500/30 bg-rose-500/10 text-rose-100 hover:bg-rose-500/20"
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
        {detail.documents.length === 0 ? (
          <p className="text-xs text-white/40">No documents uploaded.</p>
        ) : (
          <div className="space-y-1.5">
            {detail.documents.map((doc) => (
              <a
                key={doc.requirementId}
                href={doc.fileUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white hover:bg-white/10"
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
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2"
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

      <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-3 text-[11px] text-white/40">
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
    <section className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
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
