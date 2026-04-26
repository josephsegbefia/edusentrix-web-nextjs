"use client";

import * as React from "react";
import {
  CheckCircle2,
  GraduationCap,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UserCheck,
  UserPlus,
  XCircle,
} from "lucide-react";
import { format } from "date-fns/format";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import { useConfirmationDialog } from "@/hooks/useConfirmationDialog";
import {
  useAdmissionsLookup,
  useDecideAdmissionApplication,
  useProvisionAdmissionApplication,
  type AdmissionApplicationDetail,
} from "@/hooks/admissions/useAdmissionApplications";
import { toast } from "sonner";

type DecisionPanelProps = {
  detail: AdmissionApplicationDetail;
};

type Mode = "idle" | "accept" | "reject" | "waitlist";

export function DecisionPanel({ detail }: DecisionPanelProps) {
  const { confirm, confirmationDialog } = useConfirmationDialog();
  const decide = useDecideAdmissionApplication();
  const provision = useProvisionAdmissionApplication();

  const [mode, setMode] = React.useState<Mode>("idle");
  const [notes, setNotes] = React.useState("");
  const [sendEmail, setSendEmail] = React.useState(true);
  const [gradeId, setGradeId] = React.useState<string>(
    detail.decision?.targetGradeId ?? detail.applicant.intendedGradeId ?? ""
  );
  const [classGroupId, setClassGroupId] = React.useState<string>(
    detail.decision?.targetClassGroupId ?? ""
  );

  React.useEffect(() => {
    setMode("idle");
    setNotes("");
    setSendEmail(true);
    setGradeId(
      detail.decision?.targetGradeId ?? detail.applicant.intendedGradeId ?? ""
    );
    setClassGroupId(detail.decision?.targetClassGroupId ?? "");
  }, [
    detail.id,
    detail.decision?.targetGradeId,
    detail.decision?.targetClassGroupId,
    detail.applicant.intendedGradeId,
  ]);

  const lookup = useAdmissionsLookup(gradeId || null);
  const grades = lookup.data?.data.grades ?? [];
  const classGroups =
    lookup.data?.data.classGroups.filter((c) => c.gradeId === gradeId) ?? [];

  const isWithdrawn = detail.status === "withdrawn";
  const decisionRecorded = Boolean(detail.decision);
  const provisioned = detail.provisioned;

  async function submitDecision(
    outcome: "accepted" | "rejected" | "waitlisted"
  ) {
    if (outcome === "accepted" && !gradeId) {
      toast.error("Pick a target grade before accepting.");
      return;
    }

    const labelMap = {
      accepted: "Accept this application",
      rejected: "Reject this application",
      waitlisted: "Waitlist this application",
    };
    const intentMap = {
      accepted: "default" as const,
      rejected: "destructive" as const,
      waitlisted: "warning" as const,
    };
    const result = await confirm({
      title: labelMap[outcome],
      description: sendEmail
        ? `An email will be sent to ${detail.guardian.email}. This action is recorded in the application timeline.`
        : "No email will be sent. The decision is recorded in the application timeline.",
      confirmLabel: labelMap[outcome],
      intent: intentMap[outcome],
    });
    if (result !== "confirm") return;

    decide.mutate(
      {
        applicationId: detail.id,
        input: {
          outcome,
          notes: notes.trim() || null,
          targetGradeId: outcome === "accepted" ? gradeId || null : null,
          targetClassGroupId:
            outcome === "accepted" ? classGroupId || null : null,
          sendEmail,
        },
      },
      {
        onSuccess: (resp) => {
          toast.success(
            resp.data.emailSent
              ? "Decision recorded and email sent."
              : "Decision recorded."
          );
          setMode("idle");
        },
        onError: (err) => toast.error(err.message || "Could not record decision"),
      }
    );
  }

  async function provisionNow() {
    const result = await confirm({
      title: "Provision student record",
      description:
        "This will create the student, the parent account, and (optionally) send the parent a Clerk invite. You can do this later if you'd like to wait.",
      confirmLabel: "Provision now",
      intent: "default",
    });
    if (result !== "confirm") return;

    provision.mutate(
      {
        applicationId: detail.id,
        input: {
          targetClassGroupId: classGroupId || null,
          targetGradeId: gradeId || null,
          sendParentInvite: true,
        },
      },
      {
        onSuccess: (resp) => {
          toast.success(
            resp.data.alreadyProvisioned
              ? "Already provisioned."
              : resp.data.invitedParent
                ? "Student created and parent invited."
                : "Student created."
          );
        },
        onError: (err) =>
          toast.error(err.message || "Could not provision student"),
      }
    );
  }

  if (isWithdrawn) {
    return (
      <Wrapper>
        <div className="flex items-start gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4 text-sm text-amber-100">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">Application withdrawn</p>
            <p className="mt-0.5 text-amber-100/80">
              This application has been withdrawn and cannot receive a decision.
            </p>
          </div>
        </div>
        {confirmationDialog}
      </Wrapper>
    );
  }

  if (provisioned) {
    return (
      <Wrapper>
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-100">
          <div className="flex items-center gap-2 font-semibold">
            <ShieldCheck className="h-4 w-4" /> Provisioned
          </div>
          <p className="mt-1 text-emerald-100/80">
            Student record and guardian account have been created from this
            application.
          </p>
          <div className="mt-3 grid gap-2 text-[12px] text-emerald-50/85 sm:grid-cols-2">
            <DecisionLine label="Outcome" value="Accepted" />
            <DecisionLine
              label="Decided"
              value={
                detail.decision?.decidedAt
                  ? format(new Date(detail.decision.decidedAt), "MMM d, yyyy")
                  : "—"
              }
            />
            {detail.decision?.notes ? (
              <DecisionLine
                label="Decision notes"
                value={detail.decision.notes}
                wide
              />
            ) : null}
          </div>
        </div>
        {confirmationDialog}
      </Wrapper>
    );
  }

  if (decisionRecorded && detail.decision) {
    const outcome = detail.decision.outcome;
    return (
      <Wrapper>
        <div
          className={`rounded-2xl border p-4 text-sm ${
            outcome === "accepted"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
              : outcome === "waitlisted"
                ? "border-amber-500/30 bg-amber-500/10 text-amber-100"
                : "border-rose-500/30 bg-rose-500/10 text-rose-100"
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 font-semibold">
              {outcome === "accepted" ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : outcome === "waitlisted" ? (
                <Sparkles className="h-4 w-4" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              <span className="capitalize">Decision: {outcome}</span>
            </div>
            <Badge
              variant="outline"
              className="border-white/15 bg-white/10 text-[11px] text-white/85"
            >
              {format(new Date(detail.decision.decidedAt), "MMM d, yyyy")}
            </Badge>
          </div>
          {detail.decision.notes ? (
            <p className="mt-2 text-[12px] text-white/70">
              {detail.decision.notes}
            </p>
          ) : null}
        </div>

        {outcome === "accepted" ? (
          <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <UserPlus className="h-4 w-4 text-white/70" />
              Provision student now
            </div>
            <p className="mt-1 text-xs text-white/60">
              Confirm the placement and we&apos;ll create the Student, link the
              Guardian, and (optionally) invite the parent to set up their
              account.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <GradeSelect
                value={gradeId}
                onChange={(v) => {
                  setGradeId(v);
                  setClassGroupId("");
                }}
                grades={grades}
                loading={lookup.isLoading}
              />
              <ClassGroupSelect
                value={classGroupId}
                onChange={setClassGroupId}
                classGroups={classGroups}
                loading={lookup.isLoading}
                disabled={!gradeId}
              />
            </div>
            <div className="mt-3 flex items-center justify-end">
              <Button
                onClick={provisionNow}
                disabled={provision.isPending}
                className="bg-emerald-500/90 text-white hover:bg-emerald-500"
              >
                {provision.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                    Provisioning…
                  </>
                ) : (
                  <>
                    <UserCheck className="mr-2 h-3 w-3" />
                    Provision now
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : null}

        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMode("accept")}
            className="border-white/10 bg-white/5 text-white"
          >
            Change decision
          </Button>
        </div>

        {mode !== "idle" ? (
          <DecisionForm
            mode={mode}
            notes={notes}
            setNotes={setNotes}
            sendEmail={sendEmail}
            setSendEmail={setSendEmail}
            gradeId={gradeId}
            setGradeId={(v) => {
              setGradeId(v);
              setClassGroupId("");
            }}
            classGroupId={classGroupId}
            setClassGroupId={setClassGroupId}
            grades={grades}
            classGroups={classGroups}
            lookupLoading={lookup.isLoading}
            isPending={decide.isPending}
            onSubmit={submitDecision}
            onCancel={() => setMode("idle")}
          />
        ) : null}

        {confirmationDialog}
      </Wrapper>
    );
  }

  // No decision yet → show the three primary actions (or the inline form if a
  // mode is active).
  return (
    <Wrapper>
      {mode === "idle" ? (
        <div className="grid gap-2 sm:grid-cols-3">
          <ActionCard
            tone="emerald"
            icon={<CheckCircle2 className="h-4 w-4" />}
            label="Accept"
            onClick={() => setMode("accept")}
          />
          <ActionCard
            tone="amber"
            icon={<Sparkles className="h-4 w-4" />}
            label="Waitlist"
            onClick={() => setMode("waitlist")}
          />
          <ActionCard
            tone="rose"
            icon={<XCircle className="h-4 w-4" />}
            label="Reject"
            onClick={() => setMode("reject")}
          />
        </div>
      ) : (
        <DecisionForm
          mode={mode}
          notes={notes}
          setNotes={setNotes}
          sendEmail={sendEmail}
          setSendEmail={setSendEmail}
          gradeId={gradeId}
          setGradeId={(v) => {
            setGradeId(v);
            setClassGroupId("");
          }}
          classGroupId={classGroupId}
          setClassGroupId={setClassGroupId}
          grades={grades}
          classGroups={classGroups}
          lookupLoading={lookup.isLoading}
          isPending={decide.isPending}
          onSubmit={submitDecision}
          onCancel={() => setMode("idle")}
        />
      )}
      {confirmationDialog}
    </Wrapper>
  );
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
      <div className="mb-3 flex items-center gap-2">
        <GraduationCap className="h-4 w-4 text-white/40" />
        <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-white/55">
          Decision
        </h3>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function ActionCard({
  tone,
  icon,
  label,
  onClick,
}: {
  tone: "emerald" | "amber" | "rose";
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  const toneClass =
    tone === "emerald"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/20"
      : tone === "amber"
        ? "border-amber-500/30 bg-amber-500/10 text-amber-100 hover:bg-amber-500/20"
        : "border-rose-500/30 bg-rose-500/10 text-rose-100 hover:bg-rose-500/20";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition ${toneClass}`}
    >
      {icon}
      {label}
    </button>
  );
}

function DecisionForm(props: {
  mode: "accept" | "reject" | "waitlist";
  notes: string;
  setNotes: (v: string) => void;
  sendEmail: boolean;
  setSendEmail: (v: boolean) => void;
  gradeId: string;
  setGradeId: (v: string) => void;
  classGroupId: string;
  setClassGroupId: (v: string) => void;
  grades: Array<{ id: string; name: string; level: number | null }>;
  classGroups: Array<{
    id: string;
    name: string;
    gradeId: string;
    capacity: number | null;
    enrolled: number;
    isFull: boolean;
  }>;
  lookupLoading: boolean;
  isPending: boolean;
  onSubmit: (outcome: "accepted" | "rejected" | "waitlisted") => void;
  onCancel: () => void;
}) {
  const {
    mode,
    notes,
    setNotes,
    sendEmail,
    setSendEmail,
    gradeId,
    setGradeId,
    classGroupId,
    setClassGroupId,
    grades,
    classGroups,
    lookupLoading,
    isPending,
    onSubmit,
    onCancel,
  } = props;

  const outcome =
    mode === "accept"
      ? "accepted"
      : mode === "reject"
        ? "rejected"
        : "waitlisted";

  const accent =
    outcome === "accepted"
      ? "border-emerald-500/25"
      : outcome === "waitlisted"
        ? "border-amber-500/25"
        : "border-rose-500/25";

  return (
    <div className={`space-y-3 rounded-2xl border bg-white/3 p-4 ${accent}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold capitalize text-white">
          {mode === "accept"
            ? "Accept application"
            : mode === "waitlist"
              ? "Waitlist application"
              : "Reject application"}
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          className="text-white/60 hover:text-white"
        >
          Cancel
        </Button>
      </div>

      {outcome === "accepted" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <GradeSelect
            value={gradeId}
            onChange={setGradeId}
            grades={grades}
            loading={lookupLoading}
          />
          <ClassGroupSelect
            value={classGroupId}
            onChange={setClassGroupId}
            classGroups={classGroups}
            loading={lookupLoading}
            disabled={!gradeId}
          />
        </div>
      ) : null}

      <div className="space-y-1.5">
        <Label className="text-[11px] uppercase tracking-wide text-white/50">
          {outcome === "accepted"
            ? "Personal note (optional)"
            : outcome === "waitlisted"
              ? "Message to the family (optional)"
              : "Reason or message (optional)"}
        </Label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          placeholder={
            outcome === "accepted"
              ? "Welcome them, mention orientation date, etc."
              : outcome === "waitlisted"
                ? "Let them know what to expect from the waitlist."
                : "A short, kind explanation that will appear in the email."
          }
        />
      </div>

      <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/3 px-3 py-2">
        <div>
          <p className="text-sm font-medium text-white">
            Send email to {`${"guardian"}`} now
          </p>
          <p className="text-[11px] text-white/55">
            Uses the cycle&apos;s {outcome === "accepted" ? "acceptance" : "rejection"}
            {" "}template; falls back to a default if not customised.
          </p>
        </div>
        <Switch checked={sendEmail} onCheckedChange={setSendEmail} />
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button
          onClick={() => onSubmit(outcome)}
          disabled={isPending || (outcome === "accepted" && !gradeId)}
          className={
            outcome === "accepted"
              ? "bg-emerald-500/90 text-white hover:bg-emerald-500"
              : outcome === "waitlisted"
                ? "bg-amber-500/90 text-white hover:bg-amber-500"
                : "bg-rose-500/90 text-white hover:bg-rose-500"
          }
        >
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-3 w-3 animate-spin" />
              Recording…
            </>
          ) : outcome === "accepted" ? (
            "Accept"
          ) : outcome === "waitlisted" ? (
            "Waitlist"
          ) : (
            "Reject"
          )}
        </Button>
      </div>
    </div>
  );
}

function GradeSelect(props: {
  value: string;
  onChange: (v: string) => void;
  grades: Array<{ id: string; name: string }>;
  loading: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] uppercase tracking-wide text-white/50">
        Target grade
      </Label>
      <PremiumSelect value={props.value} onValueChange={props.onChange}>
        <PremiumSelectTrigger>
          <PremiumSelectValue
            placeholder={props.loading ? "Loading…" : "Select grade"}
          />
        </PremiumSelectTrigger>
        <PremiumSelectContent>
          {props.grades.map((g) => (
            <PremiumSelectItem key={g.id} value={g.id}>
              {g.name}
            </PremiumSelectItem>
          ))}
        </PremiumSelectContent>
      </PremiumSelect>
    </div>
  );
}

function ClassGroupSelect(props: {
  value: string;
  onChange: (v: string) => void;
  classGroups: Array<{
    id: string;
    name: string;
    capacity: number | null;
    enrolled: number;
    isFull: boolean;
  }>;
  loading: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] uppercase tracking-wide text-white/50">
        Class group{" "}
        <span className="text-white/40 normal-case">
          (optional — auto-picks least-loaded if blank)
        </span>
      </Label>
      <PremiumSelect
        value={props.value}
        onValueChange={props.onChange}
        disabled={props.disabled}
      >
        <PremiumSelectTrigger>
          <PremiumSelectValue
            placeholder={
              props.disabled
                ? "Pick a grade first"
                : props.loading
                  ? "Loading…"
                  : "Auto-select least-loaded"
            }
          />
        </PremiumSelectTrigger>
        <PremiumSelectContent>
          {props.classGroups.map((c) => (
            <PremiumSelectItem
              key={c.id}
              value={c.id}
              disabled={c.isFull}
            >
              {c.name}
              {c.capacity != null
                ? ` · ${c.enrolled}/${c.capacity}${c.isFull ? " · full" : ""}`
                : ` · ${c.enrolled} enrolled`}
            </PremiumSelectItem>
          ))}
        </PremiumSelectContent>
      </PremiumSelect>
    </div>
  );
}

function DecisionLine({
  label,
  value,
  wide = false,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <p className="text-[10px] uppercase tracking-wide opacity-60">{label}</p>
      <p className="text-sm">{value}</p>
    </div>
  );
}
