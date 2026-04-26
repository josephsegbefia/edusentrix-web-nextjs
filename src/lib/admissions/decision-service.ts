// src/lib/admissions/decision-service.ts
// Server-side service: record an admin's decision (accept / reject / waitlist),
// keep cycle analytics in sync, optionally email the applicant, and append an
// AdmissionEvent. This service is the single source of truth for setting
// `application.decision` and the corresponding `application.status`.

import "server-only";
import mongoose, { Types } from "mongoose";

import { connectToDatabase } from "@/db/connectToDatabase";
import { AdmissionApplication } from "@/models/AdmissionApplication";
import { AdmissionCycle } from "@/models/AdmissionCycle";
import { AdmissionEvent } from "@/models/AdmissionEvent";
import { Grade } from "@/models/Grade";
import { ClassGroup } from "@/models/ClassGroup";
import { School } from "@/models/School";
import { sendTrackedBrevoEmail } from "@/lib/email";
import { getAppUrl } from "@/lib/utils/getAppUrl";
import {
  buildVariables,
  defaultBody,
  interpolate,
} from "./decision-emails";

export type AdmissionDecisionOutcome = "accepted" | "rejected" | "waitlisted";

export type RecordDecisionInput = {
  applicationId: Types.ObjectId | string;
  schoolId: Types.ObjectId;
  decidedBy: Types.ObjectId;
  decidedByLabel: string;
  decidedByRole: "school_admin" | "admissions_officer";
  outcome: AdmissionDecisionOutcome;
  notes?: string | null;
  /** Required when outcome === "accepted". Must belong to the same school. */
  targetGradeId?: string | null;
  /** Optional at decision time; can be set later during provisioning. */
  targetClassGroupId?: string | null;
  /** When true, send the applicant the email immediately. */
  sendEmail?: boolean;
};

export type RecordDecisionResult = {
  applicationId: string;
  status: "accepted" | "rejected" | "waitlisted";
  decision: {
    outcome: AdmissionDecisionOutcome;
    decidedAt: string;
    targetGradeId: string | null;
    targetClassGroupId: string | null;
    notes: string | null;
  };
  emailSent: boolean;
};

export class DecisionServiceError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "DecisionServiceError";
    this.status = status;
  }
}

const ALLOWED_OUTCOMES: AdmissionDecisionOutcome[] = [
  "accepted",
  "rejected",
  "waitlisted",
];

const STATUS_BY_OUTCOME: Record<
  AdmissionDecisionOutcome,
  "accepted" | "rejected" | "waitlisted"
> = {
  accepted: "accepted",
  rejected: "rejected",
  waitlisted: "waitlisted",
};

const TEMPLATE_KEY_BY_OUTCOME: Record<AdmissionDecisionOutcome, string> = {
  accepted: "ADMISSIONS_DECISION_ACCEPTED",
  rejected: "ADMISSIONS_DECISION_REJECTED",
  waitlisted: "ADMISSIONS_DECISION_WAITLISTED",
};

export async function recordDecision(
  input: RecordDecisionInput
): Promise<RecordDecisionResult> {
  if (!ALLOWED_OUTCOMES.includes(input.outcome)) {
    throw new DecisionServiceError(`Invalid outcome: ${input.outcome}`);
  }

  await connectToDatabase();

  const application = await AdmissionApplication.findOne({
    _id: input.applicationId,
    schoolId: input.schoolId,
  });
  if (!application) {
    throw new DecisionServiceError("Application not found", 404);
  }
  if (application.status === "withdrawn") {
    throw new DecisionServiceError(
      "Withdrawn applications cannot be decided.",
      409
    );
  }
  if (application.provisioned) {
    throw new DecisionServiceError(
      "This application is already provisioned and cannot be re-decided.",
      409
    );
  }

  // Resolve target grade for "accepted" outcome.
  let targetGradeId: Types.ObjectId | null = null;
  let targetClassGroupId: Types.ObjectId | null = null;

  if (input.outcome === "accepted") {
    const candidateGradeId =
      input.targetGradeId ??
      (application.applicant.intendedGradeId
        ? String(application.applicant.intendedGradeId)
        : null);
    if (!candidateGradeId || !mongoose.Types.ObjectId.isValid(candidateGradeId)) {
      throw new DecisionServiceError(
        "A target grade is required to accept this application."
      );
    }
    const grade = await Grade.findOne({
      _id: candidateGradeId,
      schoolId: input.schoolId,
    })
      .select({ _id: 1 })
      .lean();
    if (!grade) {
      throw new DecisionServiceError("Target grade not found in this school.");
    }
    targetGradeId = new Types.ObjectId(candidateGradeId);

    if (input.targetClassGroupId) {
      if (!mongoose.Types.ObjectId.isValid(input.targetClassGroupId)) {
        throw new DecisionServiceError("Invalid target class group id.");
      }
      const classGroup = await ClassGroup.findOne({
        _id: input.targetClassGroupId,
        schoolId: input.schoolId,
        gradeId: targetGradeId,
      })
        .select({ _id: 1 })
        .lean();
      if (!classGroup) {
        throw new DecisionServiceError(
          "Target class group does not belong to the chosen grade."
        );
      }
      targetClassGroupId = new Types.ObjectId(input.targetClassGroupId);
    }
  }

  const previousStatus = application.status;
  const newStatus = STATUS_BY_OUTCOME[input.outcome];
  const decidedAt = new Date();

  application.decision = {
    outcome: input.outcome,
    decidedBy: input.decidedBy,
    decidedAt,
    targetGradeId,
    targetClassGroupId,
    notes: (input.notes ?? "").trim() || null,
  };
  application.status = newStatus;
  await application.save();

  // Keep cycle analytics in sync with status changes.
  void (async () => {
    const cycle = await AdmissionCycle.findById(application.cycleId);
    if (!cycle) return;
    const byStatus = (cycle.analytics?.byStatus ?? {}) as Record<string, number>;
    if (previousStatus !== newStatus) {
      byStatus[previousStatus] = Math.max(0, (byStatus[previousStatus] ?? 1) - 1);
      byStatus[newStatus] = (byStatus[newStatus] ?? 0) + 1;
      cycle.analytics.byStatus = byStatus;
      cycle.markModified("analytics");
      await cycle.save();
    }
  })();

  await AdmissionEvent.create({
    schoolId: input.schoolId,
    cycleId: application.cycleId,
    applicationId: application._id,
    actor: {
      userId: input.decidedBy,
      role: input.decidedByRole,
      label: input.decidedByLabel,
    },
    kind: "application.decision_recorded",
    metadata: {
      outcome: input.outcome,
      previousStatus,
      newStatus,
      targetGradeId: targetGradeId ? String(targetGradeId) : null,
      targetClassGroupId: targetClassGroupId
        ? String(targetClassGroupId)
        : null,
    },
    at: decidedAt,
  });

  let emailSent = false;
  if (input.sendEmail) {
    try {
      await sendDecisionEmail({
        application,
        outcome: input.outcome,
        decidedBy: input.decidedBy,
        decidedByRole: input.decidedByRole,
        decidedByLabel: input.decidedByLabel,
        notes: application.decision?.notes ?? null,
      });
      emailSent = true;
    } catch (err) {
      // We do not fail the decision if the email fails; it can be re-sent.
      console.error("Failed to send admissions decision email:", err);
    }
  }

  return {
    applicationId: String(application._id),
    status: newStatus,
    decision: {
      outcome: input.outcome,
      decidedAt: decidedAt.toISOString(),
      targetGradeId: targetGradeId ? String(targetGradeId) : null,
      targetClassGroupId: targetClassGroupId
        ? String(targetClassGroupId)
        : null,
      notes: application.decision?.notes ?? null,
    },
    emailSent,
  };
}

export async function sendDecisionEmail(args: {
  application: InstanceType<typeof AdmissionApplication>;
  outcome: AdmissionDecisionOutcome;
  decidedBy: Types.ObjectId;
  decidedByRole: "school_admin" | "admissions_officer";
  decidedByLabel: string;
  notes?: string | null;
}): Promise<void> {
  const { application, outcome } = args;

  const [cycle, school, grade] = await Promise.all([
    AdmissionCycle.findById(application.cycleId).lean(),
    School.findById(application.schoolId).select("name").lean(),
    application.decision?.targetGradeId
      ? Grade.findById(application.decision.targetGradeId).select("name").lean()
      : application.applicant.intendedGradeId
        ? Grade.findById(application.applicant.intendedGradeId)
            .select("name")
            .lean()
        : null,
  ]);

  if (!cycle) {
    throw new DecisionServiceError("Cycle not found for application.", 404);
  }

  const schoolName =
    (school as { name?: string } | null)?.name ?? "your school";
  const intendedGradeName =
    (grade as { name?: string } | null)?.name ?? null;

  const trackerUrl = `${getAppUrl()}/apply/track/${application.tracker.token}`;

  const variables = buildVariables({
    application,
    cycle,
    schoolName,
    trackerUrl,
    intendedGradeName,
    decisionNotes: args.notes ?? null,
  });

  const template =
    outcome === "accepted"
      ? cycle.acceptanceTemplate
      : outcome === "rejected"
        ? cycle.rejectionTemplate
        : cycle.acceptanceTemplate; // waitlist falls back to acceptance template subject for tone

  const subject =
    interpolate(template?.subject ?? "", variables) ||
    (outcome === "accepted"
      ? `Offer of admission to ${schoolName}`
      : outcome === "waitlisted"
        ? `${schoolName} admissions update`
        : `${schoolName} admissions update`);

  const body =
    interpolate(template?.htmlBody ?? "", variables) ||
    defaultBody(outcome, variables);

  await sendTrackedBrevoEmail({
    to: application.guardian.email,
    toName:
      `${application.guardian.firstName ?? ""} ${application.guardian.lastName ?? ""}`.trim() ||
      undefined,
    subject,
    htmlContent: body,
    templateKey: TEMPLATE_KEY_BY_OUTCOME[outcome],
    schoolId: String(application.schoolId),
    schoolName,
    actorId: String(args.decidedBy),
    actorRole: args.decidedByRole,
    relatedEntityType: "admission_application",
    relatedEntityId: String(application._id),
  });

  await AdmissionEvent.create({
    schoolId: application.schoolId,
    cycleId: application.cycleId,
    applicationId: application._id,
    actor: {
      userId: args.decidedBy,
      role: args.decidedByRole,
      label: args.decidedByLabel,
    },
    kind: "application.email_sent",
    metadata: {
      outcome,
      to: application.guardian.email,
    },
    at: new Date(),
  });
}
