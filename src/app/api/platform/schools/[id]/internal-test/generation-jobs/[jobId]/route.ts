import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requirePlatformInternalTestAccess } from "@/lib/auth/requirePlatformInternalTest";
import { InternalTestDataGenerationJob } from "@/models/InternalTestDataGenerationJob";

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
  context: { params: Promise<{ id: string; jobId: string }> }
) {
  try {
    const gate = await requirePlatformInternalTestAccess();
    if (!gate.ok) return gate.res;

    const { id: schoolIdParam, jobId: jobIdParam } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(schoolIdParam) || !mongoose.Types.ObjectId.isValid(jobIdParam)) {
      return NextResponse.json({ success: false, error: "Invalid id" }, { status: 400 });
    }
    const schoolId = new mongoose.Types.ObjectId(schoolIdParam);
    const jobId = new mongoose.Types.ObjectId(jobIdParam);

    await connectToDatabase();

    const doc = await InternalTestDataGenerationJob.findOne({
      _id: jobId,
      schoolId,
    }).lean();

    if (!doc) {
      return NextResponse.json({ success: false, error: "Job not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: serializeJob(doc as Parameters<typeof serializeJob>[0]),
    });
  } catch (e) {
    console.error("internal-test generation job GET", e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Failed to load job" },
      { status: 500 }
    );
  }
}
