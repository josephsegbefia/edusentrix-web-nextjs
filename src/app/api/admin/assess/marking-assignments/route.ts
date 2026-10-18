import { Types } from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { buildSchoolUserAuditContext } from "@/lib/audit/fromApiRoute";
import { requireAssessPremiumPublication } from "@/lib/subscriptions/assess-premium";
import { AssessmentMarkingError, assignMarkingScript, listMarkingAdminQueue } from "@/lib/assess/assessment-marking-service";

const postSchema = z.object({
  packetAssignmentId: z.string().refine((value) => Types.ObjectId.isValid(value), "Invalid packet assignment id"),
  markerUserId: z.string().refine((value) => Types.ObjectId.isValid(value), "Invalid marker user id"),
  blindMarking: z.boolean().optional(),
});

function errorResponse(error: unknown, fallback: string) {
  if (error instanceof Response) return error;
  if (error instanceof AssessmentMarkingError) return Response.json({ success: false, error: error.message }, { status: error.status });
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
    const deliveryId = new URL(request.url).searchParams.get("assessmentDeliveryVersionId");
    if (!deliveryId || !Types.ObjectId.isValid(deliveryId)) return Response.json({ success: false, error: "A valid assessment delivery id is required" }, { status: 400 });
    await connectToDatabase();
    const data = await listMarkingAdminQueue({ actor: { userId: admin.userId, schoolId: admin.schoolId, isAdmin: true, premiumPublicationEntitled: true }, assessmentDeliveryVersionId: new Types.ObjectId(deliveryId) });
    return Response.json({ success: true, data });
  } catch (error) { return errorResponse(error, "Failed to load marking assignments"); }
}

export async function POST(request: Request) {
  try {
    const permission = await access();
    if (permission.response) return permission.response;
    const admin = permission.admin!;
    const idempotencyKey = request.headers.get("x-idempotency-key")?.trim();
    if (!idempotencyKey) return Response.json({ success: false, error: "x-idempotency-key is required" }, { status: 400 });
    const parsed = postSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ success: false, error: "Invalid marking assignment request" }, { status: 400 });
    await connectToDatabase();
    const result = await assignMarkingScript({ actor: { userId: admin.userId, schoolId: admin.schoolId, isAdmin: true, premiumPublicationEntitled: true }, packetAssignmentId: new Types.ObjectId(parsed.data.packetAssignmentId), markerUserId: new Types.ObjectId(parsed.data.markerUserId), blindMarking: parsed.data.blindMarking, idempotencyKey, auditContext: buildSchoolUserAuditContext(request, { userId: admin.userId, schoolId: admin.schoolId, actorRole: "school_admin", idempotencyKey }) });
    return Response.json({ success: true, replayed: result.replayed, data: result.assignment }, { status: result.replayed ? 200 : 201 });
  } catch (error) { return errorResponse(error, "Failed to assign examination script"); }
}
