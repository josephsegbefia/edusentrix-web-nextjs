import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import {
  AssessmentDefinitionError,
  listAssessmentDefinitionVersions,
  publishAssessmentDefinition,
  serializeAssessmentDefinition,
} from "@/lib/assess/assessment-definition-service";
import { requireAssessPremiumPublication } from "@/lib/subscriptions/assess-premium";
import { Types } from "mongoose";

const publicationSchema = z.object({
  examPaperId: z.string().refine((value) => Types.ObjectId.isValid(value), "Invalid exam paper id"),
  resultBinding: z.enum(["none", "score_bearing"]),
  assessmentPlanId: z.string().refine((value) => Types.ObjectId.isValid(value), "Invalid assessment plan id").nullable().optional(),
  assessmentItemId: z.string().refine((value) => Types.ObjectId.isValid(value), "Invalid assessment item id").nullable().optional(),
});

function handleError(error: unknown, fallback: string) {
  if (error instanceof Response) return error;
  if (error instanceof AssessmentDefinitionError) {
    return Response.json({ success: false, error: error.message }, { status: error.status });
  }
  return Response.json(
    { success: false, error: error instanceof Error ? error.message : fallback },
    { status: 500 }
  );
}

export async function POST(request: Request) {
  try {
    const actor = await requireSchoolAdmin();
    const premium = await requireAssessPremiumPublication(actor.schoolId);
    if (!premium.allowed) {
      return Response.json({ success: false, error: premium.reason }, { status: premium.statusCode });
    }
    const parsed = publicationSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return Response.json({ success: false, error: "Invalid publication request" }, { status: 400 });
    }
    await connectToDatabase();
    const result = await publishAssessmentDefinition({
      examPaperId: new Types.ObjectId(parsed.data.examPaperId),
      actor: {
        userId: actor.userId,
        schoolId: actor.schoolId,
        isAdmin: true,
        premiumPublicationEntitled: true,
      },
      resultBinding: parsed.data.resultBinding,
      assessmentPlanId: parsed.data.assessmentPlanId ? new Types.ObjectId(parsed.data.assessmentPlanId) : null,
      assessmentItemId: parsed.data.assessmentItemId ? new Types.ObjectId(parsed.data.assessmentItemId) : null,
    });
    return Response.json(
      { success: true, replayed: result.replayed, data: serializeAssessmentDefinition(result.definition, { includePrivateContent: true }) },
      { status: result.replayed ? 200 : 201 }
    );
  } catch (error: unknown) {
    return handleError(error, "Failed to publish assessment definition");
  }
}

export async function GET(request: Request) {
  try {
    const actor = await requireSchoolAdmin();
    await connectToDatabase();
    const sourceExamPaperId = new URL(request.url).searchParams.get("sourceExamPaperId");
    if (!sourceExamPaperId || !Types.ObjectId.isValid(sourceExamPaperId)) {
      return Response.json({ success: false, error: "A valid sourceExamPaperId is required" }, { status: 400 });
    }
    const versions = await listAssessmentDefinitionVersions({
      schoolId: actor.schoolId,
      sourceExamPaperId: new Types.ObjectId(sourceExamPaperId),
    });
    return Response.json({
      success: true,
      data: versions.map((version) => ({
        id: String(version._id),
        sourceExamPaperId: String(version.sourceExamPaperId),
        version: version.version,
        status: version.status,
        contentHash: version.contentHash,
        resultBinding: version.resultBinding,
        publishedAt: version.publishedAt?.toISOString?.() ?? null,
        supersededAt: version.supersededAt?.toISOString?.() ?? null,
      })),
    });
  } catch (error: unknown) {
    return handleError(error, "Failed to list assessment definition versions");
  }
}
