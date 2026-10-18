import { Types } from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import {
  AssessmentDefinitionError,
  getAssessmentDefinition,
  listAssessmentDefinitionVersions,
} from "@/lib/assess/assessment-definition-service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ definitionId: string }> }
) {
  try {
    const actor = await requireSchoolAdmin();
    await connectToDatabase();
    const { definitionId } = await params;
    if (!Types.ObjectId.isValid(definitionId)) {
      return Response.json({ success: false, error: "Invalid assessment definition id" }, { status: 400 });
    }
    const definition = await getAssessmentDefinition({
      schoolId: actor.schoolId,
      definitionId: new Types.ObjectId(definitionId),
    });
    if (!definition) {
      return Response.json({ success: false, error: "Assessment definition not found" }, { status: 404 });
    }
    const versions = await listAssessmentDefinitionVersions({
      schoolId: actor.schoolId,
      sourceExamPaperId: definition.sourceExamPaperId,
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
        supersedesVersionId: version.supersedesVersionId ? String(version.supersedesVersionId) : null,
        publishedAt: version.publishedAt?.toISOString?.() ?? null,
        supersededAt: version.supersededAt?.toISOString?.() ?? null,
      })),
    });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    if (error instanceof AssessmentDefinitionError) {
      return Response.json({ success: false, error: error.message }, { status: error.status });
    }
    return Response.json({ success: false, error: "Failed to retrieve assessment definition history" }, { status: 500 });
  }
}
