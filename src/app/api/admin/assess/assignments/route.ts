import { Types } from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { buildSchoolUserAuditContext } from "@/lib/audit/fromApiRoute";
import { requireAssessPremiumPublication } from "@/lib/subscriptions/assess-premium";
import {
  AssessmentPaperAssignmentError,
  assignAssessmentPaperPacket,
  listAssessmentPacketAssignments,
  listEligibleAssessmentCandidates,
} from "@/lib/assess/assessment-paper-assignment-service";

const postSchema = z.object({ packetId: z.string().refine((value) => Types.ObjectId.isValid(value), "Invalid packet id"), studentId: z.string().refine((value) => Types.ObjectId.isValid(value), "Invalid student id") });
function actor(value: { userId: Types.ObjectId; schoolId: Types.ObjectId }) { return { userId: value.userId, schoolId: value.schoolId, isAdmin: true, premiumPublicationEntitled: true }; }
function errorResponse(error: unknown, fallback: string) {
  if (error instanceof Response) return error;
  if (error instanceof AssessmentPaperAssignmentError) return Response.json({ success: false, error: error.message }, { status: error.status });
  return Response.json({ success: false, error: fallback }, { status: 500 });
}
async function access() {
  const admin = await requireSchoolAdmin();
  const premium = await requireAssessPremiumPublication(admin.schoolId);
  if (!premium.allowed) return { admin: null, response: Response.json({ success: false, error: premium.reason }, { status: premium.statusCode }) };
  return { admin, response: null };
}

export async function GET(request: Request) {
  try {
    const permission = await access();
    if (permission.response) return permission.response;
    const admin = permission.admin!;
    const params = new URL(request.url).searchParams;
    const deliveryId = params.get("assessmentDeliveryVersionId");
    if (!deliveryId || !Types.ObjectId.isValid(deliveryId)) return Response.json({ success: false, error: "A valid assessment delivery id is required" }, { status: 400 });
    await connectToDatabase();
    const data = await listAssessmentPacketAssignments({ actor: actor(admin), assessmentDeliveryVersionId: new Types.ObjectId(deliveryId), packetId: params.get("packetId") && Types.ObjectId.isValid(params.get("packetId")!) ? new Types.ObjectId(params.get("packetId")!) : null, studentId: params.get("studentId") && Types.ObjectId.isValid(params.get("studentId")!) ? new Types.ObjectId(params.get("studentId")!) : null });
    const candidates = await listEligibleAssessmentCandidates({ actor: actor(admin), assessmentDeliveryVersionId: new Types.ObjectId(deliveryId), search: params.get("search") });
    return Response.json({ success: true, data: { ...data, candidates: candidates.candidates } });
  } catch (error) { return errorResponse(error, "Failed to load assessment packet assignments"); }
}

export async function POST(request: Request) {
  try {
    const permission = await access();
    if (permission.response) return permission.response;
    const admin = permission.admin!;
    const key = request.headers.get("x-idempotency-key")?.trim();
    if (!key) return Response.json({ success: false, error: "x-idempotency-key is required" }, { status: 400 });
    const parsed = postSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ success: false, error: "Invalid candidate assignment request" }, { status: 400 });
    await connectToDatabase();
    const result = await assignAssessmentPaperPacket({ actor: actor(admin), assessmentPaperPacketId: new Types.ObjectId(parsed.data.packetId), studentId: new Types.ObjectId(parsed.data.studentId), idempotencyKey: key, auditContext: buildSchoolUserAuditContext(request, { userId: admin.userId, schoolId: admin.schoolId, actorRole: "school_admin", idempotencyKey: key }) });
    return Response.json({ success: true, replayed: result.replayed, data: result.assignment }, { status: result.replayed ? 200 : 201 });
  } catch (error) { return errorResponse(error, "Failed to assign paper packet"); }
}

