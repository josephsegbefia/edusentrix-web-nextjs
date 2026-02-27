// src/app/api/admin/promotions/cycles/preview/route.ts
// PROMO-BE-003: Preview run - read-only, creates cycle and decisions
import { NextRequest, NextResponse } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { PromotionPolicy } from "@/models/PromotionPolicy";
import { PromotionCycle } from "@/models/PromotionCycle";
import { PromotionDecision } from "@/models/PromotionDecision";
import { PromotionExecutionLog } from "@/models/PromotionExecutionLog";
import { Student } from "@/models/Student";
import { Grade } from "@/models/Grade";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { SchoolSettings } from "@/models/SchoolSettings";
import { GradingScale } from "@/models/GradingScale";
import {
  computeAttendancePercent,
  computeAcademicEvidence,
  computeFeeOutstanding,
  computeDisciplineFlags,
} from "@/lib/promotions/evidence";
import { evaluatePolicy } from "@/lib/promotions/engine";
import { selectClassForPromotion } from "@/lib/promotions/placement";
import { recordPromotionActivity } from "@/lib/promotions/recordPromotionActivity";
import { logPromotionEvent } from "@/lib/promotions/logging";
import type { IPromotionPolicy } from "@/models/PromotionPolicy";
import type { EvidenceResult } from "@/lib/promotions/evidence";
import mongoose from "mongoose";
import { z } from "zod";

const PreviewRequestSchema = z.object({
  sourceAcademicPeriodId: z.string().length(24),
  targetAcademicPeriodId: z.string().length(24).optional(),
  policyId: z.string().length(24).optional(),
  scope: z
    .object({
      gradeIds: z.array(z.string().length(24)).optional(),
      classGroupIds: z.array(z.string().length(24)).optional(),
    })
    .optional()
    .default({}),
});

type PreviewInput = z.infer<typeof PreviewRequestSchema>;

function policyToSnapshot(policy: IPromotionPolicy): Record<string, unknown> {
  const p = policy as unknown as Record<string, unknown>;
  return {
    _id: p._id,
    schoolId: p.schoolId,
    name: p.name,
    version: p.version,
    isActive: p.isActive,
    appliesTo: p.appliesTo,
    criteria: p.criteria,
    logic: p.logic,
    thresholds: p.thresholds,
    tieBreaker: p.tieBreaker,
    attendanceComputation: p.attendanceComputation,
    financeHold: p.financeHold,
    manualOverrideRules: p.manualOverrideRules,
    createdBy: p.createdBy,
    updatedBy: p.updatedBy,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

export async function POST(req: NextRequest) {
  try {
    const { userId, schoolId } = await requireSchoolAdmin();
    await connectToDatabase();

    const idempotencyKey = req.headers.get("Idempotency-Key")?.trim();
    if (!idempotencyKey) {
      return NextResponse.json(
        { success: false, error: "Idempotency-Key header is required" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const parsed = PreviewRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const input: PreviewInput = parsed.data;
    const schoolIdObj =
      schoolId instanceof mongoose.Types.ObjectId
        ? schoolId
        : new mongoose.Types.ObjectId(String(schoolId));
    const userIdObj =
      userId instanceof mongoose.Types.ObjectId
        ? userId
        : new mongoose.Types.ObjectId(String(userId));

    const sourcePeriod = await AcademicPeriod.findOne({
      _id: input.sourceAcademicPeriodId,
      schoolId: schoolIdObj,
    }).lean();

    if (!sourcePeriod) {
      return NextResponse.json(
        { success: false, error: "Source academic period not found" },
        { status: 404 }
      );
    }

    let policy: IPromotionPolicy | null = null;
    if (input.policyId) {
      policy = await PromotionPolicy.findOne({
        _id: input.policyId,
        schoolId: schoolIdObj,
      }).lean() as IPromotionPolicy | null;
      if (!policy) {
        return NextResponse.json(
          { success: false, error: "Policy not found" },
          { status: 404 }
        );
      }
    } else {
      policy = await PromotionPolicy.findOne({
        schoolId: schoolIdObj,
        isActive: true,
      }).lean() as IPromotionPolicy | null;
    }

    const settings = await SchoolSettings.findOne({ schoolId: schoolIdObj }).lean();
    const gradingScale = await GradingScale.findOne({
      schoolId: schoolIdObj,
      isDefault: true,
    }).lean();

    if (
      !policy &&
      (settings?.minimumAttendancePercent == null || gradingScale?.passThreshold == null)
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No active policy and fallback settings unavailable. Create or activate a policy, or ensure SchoolSettings.minimumAttendancePercent and GradingScale.passThreshold exist.",
        },
        { status: 400 }
      );
    }

    const fallbackPolicy: IPromotionPolicy = policy ?? {
      _id: new mongoose.Types.ObjectId(),
      schoolId: schoolIdObj,
      name: "Fallback",
      version: 0,
      isActive: false,
      appliesTo: {},
      criteria: [
        {
          key: "attendance_percent",
          operator: ">=",
          value: settings?.minimumAttendancePercent ?? 75,
          required: true,
        },
        {
          key: "overall_average",
          operator: ">=",
          value: gradingScale?.passThreshold ?? 50,
          required: true,
        },
      ],
      logic: "all_required_pass",
      thresholds: { promote: 100 },
      tieBreaker: "overall_average",
      attendanceComputation: { treatExcusedAsPresent: true },
      financeHold: { enabled: false, maxOutstandingMinor: 0 },
      manualOverrideRules: { requireReason: true, requireApprover: false },
      createdBy: userIdObj,
      updatedBy: userIdObj,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as IPromotionPolicy;

    const effectivePolicy = policy ?? fallbackPolicy;
    const treatExcused = effectivePolicy.attendanceComputation?.treatExcusedAsPresent ?? true;

    const sourcePeriodId = new mongoose.Types.ObjectId(input.sourceAcademicPeriodId);

    let studentQuery: mongoose.FilterQuery<{ schoolId: mongoose.Types.ObjectId; gradeId: mongoose.Types.ObjectId; classGroupId: mongoose.Types.ObjectId }> = {
      schoolId: schoolIdObj,
      status: "active",
    };

    if (input.scope?.gradeIds?.length) {
      studentQuery.gradeId = { $in: input.scope.gradeIds.map((id) => new mongoose.Types.ObjectId(id)) };
    }
    if (input.scope?.classGroupIds?.length) {
      studentQuery.classGroupId = {
        $in: input.scope.classGroupIds.map((id) => new mongoose.Types.ObjectId(id)),
      };
    }

    const students = await Student.find(studentQuery)
      .select("_id gradeId classGroupId status")
      .populate("gradeId", "name stage order")
      .lean();

    const grades = await Grade.find({ schoolId: schoolIdObj, isActive: true })
      .select("_id name order stage")
      .sort({ order: 1 })
      .lean();

    const maxOrder = Math.max(...grades.map((g) => g.order ?? 0), 0);
    const gradeOrderMap = new Map(
      grades.map((g) => [String(g._id), g.order ?? 0])
    );

    const idempotency = `preview-${schoolIdObj}-${input.sourceAcademicPeriodId}-${idempotencyKey}`;

    const existingCycle = await PromotionCycle.findOne({
      idempotencyKey: idempotency,
    });
    if (existingCycle) {
      return NextResponse.json({
        success: true,
        data: {
          cycleId: String(existingCycle._id),
          status: existingCycle.status,
          totals: existingCycle.totals,
        },
      });
    }

    const cycle = await PromotionCycle.create({
      schoolId: schoolIdObj,
      sourceAcademicPeriodId: sourcePeriodId,
      targetAcademicPeriodId: input.targetAcademicPeriodId
        ? new mongoose.Types.ObjectId(input.targetAcademicPeriodId)
        : null,
      sourceYearLabel: (sourcePeriod as { yearLabel?: string }).yearLabel ?? "Unknown",
      policySnapshot: policyToSnapshot(effectivePolicy),
      status: "draft",
      totals: {
        studentsEvaluated: 0,
        promote: 0,
        repeat: 0,
        graduate: 0,
        hold: 0,
        overrides: 0,
        errors: 0,
      },
      idempotencyKey: idempotency,
      lockVersion: 0,
      createdBy: userIdObj,
    });

    const totals = { promote: 0, repeat: 0, graduate: 0, hold: 0 };
    const decisions: Array<{
      schoolId: mongoose.Types.ObjectId;
      cycleId: mongoose.Types.ObjectId;
      studentId: mongoose.Types.ObjectId;
      fromGradeId: mongoose.Types.ObjectId;
      fromClassGroupId: mongoose.Types.ObjectId;
      targetGradeId?: mongoose.Types.ObjectId | null;
      targetClassGroupId?: mongoose.Types.ObjectId | null;
      recommendedOutcome: string;
      finalOutcome: string;
      source: string;
      reasonCodes: string[];
      evidence: EvidenceResult;
      conflicts: string[];
      isApplied: boolean;
      version: number;
      createdBy: mongoose.Types.ObjectId;
      updatedBy: mongoose.Types.ObjectId;
    }> = [];

    for (const student of students) {
      const gradeId = student.gradeId as { _id: mongoose.Types.ObjectId; order?: number } | null;
      const gradeOrder = gradeOrderMap.get(String(gradeId?._id)) ?? 0;
      const isTerminalGrade = gradeOrder >= maxOrder;

      const [attendancePercent, academic, feeOutstanding, disciplineFlags] =
        await Promise.all([
          computeAttendancePercent(
            student._id,
            sourcePeriodId,
            treatExcused
          ),
          computeAcademicEvidence(
            student._id,
            sourcePeriodId,
            student.classGroupId
          ),
          computeFeeOutstanding(student._id, sourcePeriodId),
          computeDisciplineFlags(student._id, sourcePeriodId),
        ]);

      const evidence: EvidenceResult = {
        attendancePercent,
        overallAverage: academic.overallAverage,
        subjectsPassedPercent: academic.subjectsPassedPercent,
        feeOutstandingMinor: feeOutstanding,
        disciplineFlags,
      };

      const result = evaluatePolicy(effectivePolicy, evidence, {
        studentStatus: student.status as "active" | "inactive" | "withdrawn",
        isTerminalGrade,
        gradeOrder,
        maxGradeOrderInScope: maxOrder,
      });

      totals[result.outcome as keyof typeof totals]++;

      let targetGradeId: mongoose.Types.ObjectId | null = null;
      let targetClassGroupId: mongoose.Types.ObjectId | null = null;
      const conflicts = [...result.reasonCodes];

      if (result.outcome === "promote") {
        const placement = await selectClassForPromotion(
          student.gradeId as mongoose.Types.ObjectId,
          student.classGroupId as mongoose.Types.ObjectId,
          schoolIdObj
        );
        if (placement) {
          targetGradeId = placement.targetGradeId;
          targetClassGroupId = placement.targetClassGroupId;
          if (placement.conflict) conflicts.push(placement.conflict);
        }
      }

      decisions.push({
        schoolId: schoolIdObj,
        cycleId: cycle._id,
        studentId: student._id,
        fromGradeId: student.gradeId as mongoose.Types.ObjectId,
        fromClassGroupId: student.classGroupId as mongoose.Types.ObjectId,
        targetGradeId: targetGradeId ?? undefined,
        targetClassGroupId: targetClassGroupId ?? undefined,
        recommendedOutcome: result.outcome,
        finalOutcome: result.outcome,
        source: "engine",
        reasonCodes: result.reasonCodes,
        evidence,
        conflicts,
        isApplied: false,
        version: 1,
        createdBy: userIdObj,
        updatedBy: userIdObj,
      });
    }

    await PromotionExecutionLog.create({
      schoolId: schoolIdObj,
      cycleId: cycle._id,
      action: "preview_started",
      actorId: userIdObj,
      details: {
        sourceAcademicPeriodId: input.sourceAcademicPeriodId,
        studentsCount: students.length,
      },
      createdAt: new Date(),
    });

    if (decisions.length > 0) {
      await PromotionDecision.insertMany(decisions);
    }

    await PromotionCycle.updateOne(
      { _id: cycle._id },
      {
        $set: {
          status: "preview_ready",
          totals: {
            studentsEvaluated: students.length,
            promote: totals.promote,
            repeat: totals.repeat,
            graduate: totals.graduate,
            hold: totals.hold,
            overrides: 0,
            errors: 0,
          },
          updatedAt: new Date(),
        },
      }
    );

    await PromotionExecutionLog.create({
      schoolId: schoolIdObj,
      cycleId: cycle._id,
      action: "preview_completed",
      actorId: userIdObj,
      details: {
        studentsEvaluated: students.length,
        totals,
      },
      createdAt: new Date(),
    });
    await recordPromotionActivity({
      schoolId: schoolIdObj,
      userId: userIdObj,
      type: "promotion.cycle.preview_ready",
      entityType: "PromotionCycle",
      entityId: cycle._id,
      description: `Promotion preview ready for ${cycle.sourceYearLabel}`,
      metadata: {
        cycleId: String(cycle._id),
        sourceYearLabel: cycle.sourceYearLabel,
        studentsEvaluated: students.length,
        totals,
      },
    });
    logPromotionEvent({
      schoolId: schoolIdObj,
      cycleId: cycle._id,
      action: "preview_ready",
      actorId: String(userIdObj),
      studentsEvaluated: students.length,
    });

    const updatedCycle = await PromotionCycle.findById(cycle._id).lean();

    return NextResponse.json({
      success: true,
      data: {
        cycleId: String(cycle._id),
        status: updatedCycle?.status ?? "preview_ready",
        totals: updatedCycle?.totals ?? {
          studentsEvaluated: students.length,
          promote: totals.promote,
          repeat: totals.repeat,
          graduate: totals.graduate,
          hold: totals.hold,
          overrides: 0,
          errors: 0,
        },
      },
    });
  } catch (error) {
    console.error("Promotion preview error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to run preview" },
      { status: 500 }
    );
  }
}
