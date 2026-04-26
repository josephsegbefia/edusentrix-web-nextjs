"use client";

import * as React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Lightbulb,
  ListChecks,
  Sparkles,
} from "lucide-react";
import { LeoIcon } from "@/components/icons/LeoIcon";
import type { AdmissionCycleDTO } from "@/hooks/admissions/useAdmissionCycles";
import type { AdmissionApplicationDetail } from "@/hooks/admissions/useAdmissionApplications";
import type { AdmissionFormSchema } from "@/lib/admissions/types";
import { validateAdmissionForm, summariseFormIssues } from "@/lib/admissions/form-validations";

type Tone = "info" | "warning" | "success";

type Guidance = {
  tone: Tone;
  title: string;
  body: string;
  actions: string[];
};

type LeoAdmissionsGuideProps =
  | {
      surface: "overview";
      cycle: AdmissionCycleDTO;
    }
  | {
      surface: "form";
      schema: AdmissionFormSchema | null;
      cycle?: AdmissionCycleDTO;
    }
  | {
      surface: "drawer";
      detail: AdmissionApplicationDetail;
      cycle?: AdmissionCycleDTO | null;
    };

function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const target = new Date(iso).getTime();
  if (Number.isNaN(target)) return null;
  const ms = target - Date.now();
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

function overviewGuidance(cycle: AdmissionCycleDTO): Guidance {
  if (cycle.status === "draft") {
    const actions = ["Customize the form in the Form builder tab.", "Set a clear application window."];
    if (!cycle.branding?.welcomeMessage) {
      actions.push("Add a short welcome message to humanize the public page.");
    }
    actions.push("Publish to make the link reachable.");
    return {
      tone: "info",
      title: "This cycle is still a draft",
      body:
        "Nobody can submit yet. Leo recommends polishing the form, branding, and capacity before publishing.",
      actions,
    };
  }
  if (cycle.status === "paused") {
    return {
      tone: "warning",
      title: "Cycle is paused",
      body:
        "The public link is hidden but data is preserved. Resume publishing when you're ready to receive new submissions again.",
      actions: [
        "Notify staff who share the link that it's currently inactive.",
        "Use the time to review existing applications.",
      ],
    };
  }
  if (cycle.status === "closed" || cycle.status === "archived") {
    return {
      tone: "info",
      title: "Cycle is closed",
      body:
        "No new applications can come in. You can still review and act on existing ones.",
      actions: [
        "Make any final decisions on remaining applications.",
        "Provision accepted applicants into student records.",
        "Open a new cycle when you're ready for the next intake.",
      ],
    };
  }
  // published
  const days = daysUntil(cycle.acceptsApplicationsUntil);
  const decisionDays = daysUntil(cycle.decisionDueBy);
  const actions: string[] = [];
  if (days !== null && days <= 7 && days >= 0) {
    actions.push(`The application window closes in ${days} day${days === 1 ? "" : "s"} — push out the link.`);
  }
  if (decisionDays !== null && decisionDays <= 14 && decisionDays >= 0) {
    actions.push(`Decision deadline is ${decisionDays} day${decisionDays === 1 ? "" : "s"} away — clear the inbox.`);
  }
  if (cycle.analytics.totalSubmissions === 0) {
    actions.push("No submissions yet — the QR code and direct invite tools live in the Distribution tab.");
  } else {
    const accepted = cycle.analytics.byStatus["accepted"] ?? 0;
    const pending =
      (cycle.analytics.byStatus["submitted"] ?? 0) +
      (cycle.analytics.byStatus["under_review"] ?? 0);
    if (pending > 0) {
      actions.push(`${pending} application${pending === 1 ? " needs" : "s need"} a review.`);
    }
    if (accepted > 0) {
      actions.push(`${accepted} accepted — provision them so families get welcomed automatically.`);
    }
  }
  if (actions.length === 0) {
    actions.push("Watch the inbox and respond to applicants within 24 hours when possible.");
  }
  return {
    tone: "info",
    title: "Cycle is live",
    body:
      "Applications can flow in. Leo will keep an eye on capacity, decision deadlines, and provisioning gaps.",
    actions,
  };
}

function formGuidance(schema: AdmissionFormSchema | null): Guidance {
  if (!schema) {
    return {
      tone: "info",
      title: "Loading form…",
      body: "Leo will analyse the form once it's loaded.",
      actions: [],
    };
  }
  const issues = validateAdmissionForm(schema);
  const summary = summariseFormIssues(issues);
  const totalFields = schema.sections.reduce((sum, s) => sum + s.fields.length, 0);
  const customFields = schema.sections.reduce(
    (sum, s) => sum + s.fields.filter((f) => !f.systemFieldKey).length,
    0
  );
  const customDocs = schema.documentRequirements.filter(
    (d) => !d.isPlatformRequired
  ).length;

  if (summary.errorCount > 0) {
    return {
      tone: "warning",
      title: "Resolve form errors first",
      body:
        "Some platform-required questions are missing or hidden. Applications would fail to provision.",
      actions: [
        "Make every locked question visible and required.",
        "Reset to defaults if you accidentally removed a required field.",
        "Re-run validation after each fix.",
      ],
    };
  }

  if (totalFields < 8) {
    return {
      tone: "info",
      title: "Form is intentionally minimal",
      body:
        "Short forms convert better. If you need more data, capture it in the interview rather than at the gate.",
      actions: [
        "Ask only for information you'll act on.",
        `${customFields} custom question${customFields === 1 ? "" : "s"} added so far.`,
        `${customDocs} custom document${customDocs === 1 ? "" : "s"} requested.`,
      ],
    };
  }

  if (summary.warningCount > 0) {
    return {
      tone: "warning",
      title: "Polish the form",
      body:
        "There are no blockers, but a few things would confuse applicants. Address the warnings below.",
      actions: [
        "Remove duplicate labels per section.",
        "Add file-type restrictions to document uploads.",
        "Set a sensible max size on each upload (5–10 MB).",
      ],
    };
  }

  return {
    tone: "success",
    title: "Form is in great shape",
    body:
      "Required platform fields are present, options are unique, and uploads are constrained. Save and publish.",
    actions: [
      "Run a test submission via the public link.",
      "Ask one staff member to fill it on a phone before launch.",
    ],
  };
}

function drawerGuidance(detail: AdmissionApplicationDetail): Guidance {
  if (detail.provisioned) {
    return {
      tone: "success",
      title: "Already provisioned",
      body:
        "The student and guardian were created. The parent invite goes out automatically.",
      actions: [
        "Check the parent received the invite email.",
        "Move the family to the school's onboarding workflow.",
      ],
    };
  }
  if (detail.decision?.outcome === "accepted") {
    return {
      tone: "success",
      title: "Provision this acceptance",
      body:
        "An offer was made but the student record hasn't been created yet. Provisioning links the family to the school.",
      actions: [
        "Confirm the intended grade and class group.",
        "Send the parent invite email.",
        "Use \"Provision now\" once placement is correct.",
      ],
    };
  }
  if (detail.decision?.outcome === "rejected") {
    return {
      tone: "info",
      title: "Decision recorded",
      body:
        "A rejection was sent. Keep the application as a record — no further action is required.",
      actions: ["You can withdraw the application to remove it from active filters."],
    };
  }
  if (detail.decision?.outcome === "waitlisted") {
    return {
      tone: "info",
      title: "On the waitlist",
      body:
        "If a seat opens, you can come back here and switch the decision to Accept.",
      actions: [
        "Track waitlist positions internally.",
        "Communicate timelines so families don't churn.",
      ],
    };
  }
  if (detail.status === "withdrawn") {
    return {
      tone: "info",
      title: "Application withdrawn",
      body: "No further action is required.",
      actions: [],
    };
  }

  const actions: string[] = [];
  const requiredDocsMissing = detail.documents.length === 0;
  if (requiredDocsMissing) {
    actions.push("No documents uploaded — resend the tracker link to nudge the family.");
  }
  if (!detail.notesPrivate) {
    actions.push("Add a short internal note so other reviewers see your context.");
  }
  if (detail.status === "submitted") {
    actions.push("Move to \"Under review\" once you've eyeballed it.");
  }
  if (detail.status === "under_review" || detail.status === "interview_scheduled") {
    actions.push("Make a decision (Accept / Waitlist / Reject) when ready.");
  }

  return {
    tone: "info",
    title: "Reviewing this applicant",
    body:
      "Leo highlights what's missing so you can move this application along confidently.",
    actions: actions.length > 0 ? actions : ["Looks complete — proceed to a decision when you're ready."],
  };
}

function pickGuidance(props: LeoAdmissionsGuideProps): Guidance {
  if (props.surface === "overview") return overviewGuidance(props.cycle);
  if (props.surface === "form") return formGuidance(props.schema);
  return drawerGuidance(props.detail);
}

export function LeoAdmissionsGuide(props: LeoAdmissionsGuideProps) {
  const guidance = pickGuidance(props);
  const toneClass =
    guidance.tone === "success"
      ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-100"
      : guidance.tone === "warning"
        ? "border-amber-500/25 bg-amber-500/10 text-amber-100"
        : "border-cyan-500/25 bg-cyan-500/10 text-cyan-100";
  const Icon =
    guidance.tone === "success"
      ? CheckCircle2
      : guidance.tone === "warning"
        ? AlertTriangle
        : Lightbulb;

  return (
    <aside className={`rounded-2xl border p-5 ${toneClass}`}>
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/10">
          <LeoIcon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4" />
            <p className="text-xs font-semibold uppercase tracking-wider">
              Leo guidance
            </p>
          </div>
          <h3 className="mt-1.5 text-base font-semibold text-white">
            {guidance.title}
          </h3>
          <p className="mt-1 text-sm text-white/70">{guidance.body}</p>
        </div>
      </div>

      {guidance.actions.length > 0 ? (
        <div className="mt-4 rounded-xl border border-white/10 bg-black/15 p-3">
          <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-white/60">
            <ListChecks className="h-3 w-3" />
            Suggested next steps
          </div>
          <ul className="space-y-1.5 text-xs text-white/75">
            {guidance.actions.map((action) => (
              <li key={action} className="flex items-start gap-2">
                <Sparkles className="mt-0.5 h-3 w-3 shrink-0 opacity-60" />
                <span>{action}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </aside>
  );
}
