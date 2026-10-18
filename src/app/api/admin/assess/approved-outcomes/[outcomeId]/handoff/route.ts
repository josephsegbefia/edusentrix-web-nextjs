import { Types } from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { buildSchoolUserAuditContext } from "@/lib/audit/fromApiRoute";
import { requireAssessPremiumPublication } from "@/lib/subscriptions/assess-premium";
import {
  AssessmentScoreHandoffError,
  getScoreHandoffStatus,
  handoffApprovedMarkingOutcome,
} from "@/lib/assess/assessment-score-handoff-service";

function errorResponse(error: unknown, fallback: string) {
  if (error instanceof Response) return error;
  if (error instanceof AssessmentScoreHandoffError) {
    return Response.json({ success: false, error: error.message }, { status: error.status });
  }
  return Response.json({ success: false, error: fallback }, { status: 500 });
}

async function access() {
  const admin = await requireSchoolAdmin();
  const premium = await requireAssessPremiumPublication(admin.schoolId);
  if (!premium.allowed) {
    return { admin: null, response: Response.json({ success: false, error: premium.reason }, { status: premium.statusCode }) };
  }
  return { admin, response: null };
}

export async function GET(_request: Request, { params }: { params: Promise<{ outcomeId: string }> }) {
  try {
    const permission = await access();
    if (permission.response) return permission.response;
    const admin = permission.admin!;
    const { outcomeId } = await params;
    if (!Types.ObjectId.isValid(outcomeId)) return Response.json({ success: false, error: "Invalid approved outcome id" }, { status: 400 });
    await connectToDatabase();
    const data = await getScoreHandoffStatus({ actor: { userId: admin.userId, schoolId: admin.schoolId, isAdmin: true, premiumPublicationEntitled: true }, approvedOutcomeId: new Types.ObjectId(outcomeId) });
    return Response.json({ success: true, data });
  } catch (error) {
    return errorResponse(error, "Failed to load score handoff status");
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ outcomeId: string }> }) {
  try {
    const permission = await access();
    if (permission.response) return permission.response;
    const admin = permission.admin!;
    const { outcomeId } = await params;
    const idempotencyKey = request.headers.get("x-idempotency-key")?.trim();
    if (!Types.ObjectId.isValid(outcomeId) || !idempotencyKey) {
      return Response.json({ success: false, error: "A valid approved outcome id and x-idempotency-key are required" }, { status: 400 });
    }
    await connectToDatabase();
    const result = await handoffApprovedMarkingOutcome({
      actor: { userId: admin.userId, schoolId: admin.schoolId, isAdmin: true, premiumPublicationEntitled: true },
      approvedOutcomeId: new Types.ObjectId(outcomeId),
      requestIdempotencyKey: idempotencyKey,
      auditContext: buildSchoolUserAuditContext(request, { userId: admin.userId, schoolId: admin.schoolId, actorRole: "school_admin", idempotencyKey }),
    });
    return Response.json({ success: true, replayed: result.replayed, data: result.receipt }, { status: result.replayed ? 200 : 201 });
  } catch (error) {
    return errorResponse(error, "Failed to hand off approved marks");
  }
}
