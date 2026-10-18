import { Types } from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import {
  AssessmentDefinitionError,
  getAssessmentDefinition,
  serializeAssessmentDefinition,
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
    return Response.json({
      success: true,
      data: serializeAssessmentDefinition(definition, { includePrivateContent: true }),
    });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    if (error instanceof AssessmentDefinitionError) {
      return Response.json({ success: false, error: error.message }, { status: error.status });
    }
    return Response.json({ success: false, error: "Failed to retrieve assessment definition" }, { status: 500 });
  }
}
