import { randomBytes } from "crypto";
import mongoose from "mongoose";
import { z } from "zod";
import { NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requirePlatformInternalTestAccess } from "@/lib/auth/requirePlatformInternalTest";
import { CORE_V1_STEP_DEFS } from "@/lib/internal-test/generation/core-v1-step-defs";
import { EXTENDED_V2_STEP_DEFS } from "@/lib/internal-test/generation/extended-v2-step-defs";
import { executeCoreV1Job } from "@/lib/internal-test/generation/run-core-v1-job";
import { validateAcademicPeriods } from "@/lib/internal-test/generation/validate-job-payload";
import { writePlatformAuditLog } from "@/lib/internal-test/write-audit";
import { InternalTestDataGenerationJob } from "@/models/InternalTestDataGenerationJob";
import { InternalTestSchoolConfig } from "@/models/InternalTestSchoolConfig";
import { School } from "@/models/School";

export const maxDuration = 300;

const PostBodySchema = z.object({
  scope: z.enum(["core_v1", "extended_v2"]),
  academicPeriods: z.array(
    z.object({
      name: z.string().min(1),
      termLabel: z.string().min(1),
      startDate: z.string().min(1),
      endDate: z.string().min(1),
      isCurrent: z.boolean(),
    })
  ),
  counts: z
    .object({
      studentsPerClassGroup: z.number().int().min(1).max(30).optional(),
      teachers: z.number().int().min(1).max(20).optional(),
      parentsPerStudentRatio: z.number().int().min(1).max(3).optional(),
    })
    .optional(),
});

function serializeJob(doc: {
  _id: mongoose.Types.ObjectId;
  testDataBatchId: string;
  scope: string;
  status: string;
  schoolId: mongoose.Types.ObjectId;
  requestedBy: mongoose.Types.ObjectId;
  academicPeriods: unknown[];
  counts: { studentsPerClassGroup: number; teachers: number; parentsPerStudentRatio: number };
  steps: unknown[];
  createdCounts: Record<string, number>;
  errors: unknown[];
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: String(doc._id),
    testDataBatchId: doc.testDataBatchId,
    scope: doc.scope,
    status: doc.status,
    schoolId: String(doc.schoolId),
    requestedBy: String(doc.requestedBy),
    academicPeriods: doc.academicPeriods,
    counts: doc.counts,
    steps: doc.steps,
    createdCounts: doc.createdCounts,
    errors: doc.errors,
    startedAt: doc.startedAt?.toISOString() ?? null,
    completedAt: doc.completedAt?.toISOString() ?? null,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requirePlatformInternalTestAccess();
    if (!gate.ok) return gate.res;

    const { id: schoolIdParam } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(schoolIdParam)) {
      return NextResponse.json({ success: false, error: "Invalid school id" }, { status: 400 });
    }
    const schoolId = new mongoose.Types.ObjectId(schoolIdParam);

    await connectToDatabase();

    const school = await School.findById(schoolId)
      .select("isInternalTestSchool internalTest")
      .lean();
    if (!school?.isInternalTestSchool || !school.internalTest?.enabled) {
      return NextResponse.json(
        { success: false, error: "Internal test mode is not enabled for this school." },
        { status: 409 }
      );
    }

    const items = await InternalTestDataGenerationJob.find({ schoolId })
      .sort({ createdAt: -1 })
      .limit(40)
      .lean();

    return NextResponse.json({
      success: true,
      data: { items: items.map(serializeJob) },
    });
  } catch (e) {
    console.error("internal-test generation-jobs GET", e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Failed to list jobs" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requirePlatformInternalTestAccess();
    if (!gate.ok) return gate.res;

    const { id: schoolIdParam } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(schoolIdParam)) {
      return NextResponse.json({ success: false, error: "Invalid school id" }, { status: 400 });
    }
    const schoolId = new mongoose.Types.ObjectId(schoolIdParam);

    const json = await req.json().catch(() => null);
    const parsed = PostBodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Invalid payload", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const periods = validateAcademicPeriods(parsed.data.academicPeriods);
    if (!periods.ok) {
      return NextResponse.json({ success: false, error: periods.error }, { status: 400 });
    }

    await connectToDatabase();

    const [school, config] = await Promise.all([
      School.findById(schoolId).select("isInternalTestSchool internalTest name").lean(),
      InternalTestSchoolConfig.findOne({ schoolId }).lean(),
    ]);

    if (!school) {
      return NextResponse.json({ success: false, error: "School not found." }, { status: 404 });
    }
    if (!school.isInternalTestSchool || !school.internalTest?.enabled) {
      return NextResponse.json(
        { success: false, error: "Internal test mode is not enabled for this school." },
        { status: 409 }
      );
    }
    if (!config?.allowSeedGeneration) {
      return NextResponse.json(
        {
          success: false,
          error: "Seed generation is disabled in this school's internal test configuration.",
          code: "SEED_GENERATION_DISABLED",
        },
        { status: 403 }
      );
    }

    const studentsPerClassGroup = parsed.data.counts?.studentsPerClassGroup ?? 2;
    const teachers = parsed.data.counts?.teachers ?? 4;
    const parentsPerStudentRatio = parsed.data.counts?.parentsPerStudentRatio ?? 1;

    const testDataBatchId = `bth_${randomBytes(12).toString("hex")}`;
    const scope = parsed.data.scope;
    const stepDefs =
      scope === "extended_v2"
        ? [...CORE_V1_STEP_DEFS, ...EXTENDED_V2_STEP_DEFS]
        : [...CORE_V1_STEP_DEFS];

    const job = await InternalTestDataGenerationJob.create({
      schoolId,
      requestedBy: gate.me._id,
      testDataBatchId,
      scope,
      status: "queued",
      academicPeriods: periods.normalized,
      counts: {
        studentsPerClassGroup,
        teachers,
        parentsPerStudentRatio,
      },
      steps: stepDefs.map((s) => ({
        key: s.key,
        label: s.label,
        status: "pending" as const,
      })),
      createdCounts: {},
      errors: [],
    });

    await writePlatformAuditLog({
      actorId: gate.me._id,
      schoolId,
      action: "internal_test.generation_started",
      entityType: "InternalTestDataGenerationJob",
      entityId: job._id as mongoose.Types.ObjectId,
      metadata: {
        testDataBatchId,
        scope,
      },
    });

    try {
      await executeCoreV1Job(job._id as mongoose.Types.ObjectId);
    } catch (runErr) {
      console.error("executeCoreV1Job:", runErr);
      await InternalTestDataGenerationJob.updateOne(
        { _id: job._id },
        {
          $set: { status: "failed", completedAt: new Date() },
          $push: {
            errors: {
              step: "runner",
              message: runErr instanceof Error ? runErr.message : String(runErr),
            },
          },
        }
      );
      await writePlatformAuditLog({
        actorId: gate.me._id,
        schoolId,
        action: "internal_test.generation_failed",
        entityType: "InternalTestDataGenerationJob",
        entityId: job._id as mongoose.Types.ObjectId,
        metadata: { testDataBatchId },
      });
      const updated = await InternalTestDataGenerationJob.findById(job._id).lean();
      return NextResponse.json(
        {
          success: false,
          error: runErr instanceof Error ? runErr.message : "Generation failed",
          data: updated ? serializeJob(updated as Parameters<typeof serializeJob>[0]) : null,
        },
        { status: 500 }
      );
    }

    const finished = await InternalTestDataGenerationJob.findById(job._id).lean();
    const failed = finished?.status === "failed";

    await writePlatformAuditLog({
      actorId: gate.me._id,
      schoolId,
      action: failed ? "internal_test.generation_failed" : "internal_test.generation_completed",
      entityType: "InternalTestDataGenerationJob",
      entityId: job._id as mongoose.Types.ObjectId,
      metadata: {
        testDataBatchId,
        status: finished?.status,
      },
    });

    return NextResponse.json({
      success: !failed,
      data: finished ? serializeJob(finished as Parameters<typeof serializeJob>[0]) : null,
    });
  } catch (e) {
    console.error("internal-test generation-jobs POST", e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Failed to start generation" },
      { status: 500 }
    );
  }
}
