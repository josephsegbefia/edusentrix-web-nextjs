import { Types } from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { buildSchoolUserAuditContext } from "@/lib/audit/fromApiRoute";
import { requireAssessPremiumPublication } from "@/lib/subscriptions/assess-premium";
import { AssessmentEvidenceError, reserveEvidencePage } from "@/lib/assess/assessment-evidence-service";

const schema = z.object({ packetId: z.string().trim().min(1).max(160), pageId: z.string().trim().min(1).max(160), fileName: z.string().trim().min(1).max(180), mimeType: z.string().trim().min(1), clientUploadId: z.string().trim().min(8).max(240), expectedDigest: z.string().trim().optional(), captureOrder: z.number().int().min(1).optional() });

export async function POST(request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  try {
    const admin = await requireSchoolAdmin();
    const premium = await requireAssessPremiumPublication(admin.schoolId);
    if (!premium.allowed) return Response.json({ success: false, error: premium.reason }, { status: premium.statusCode });
    const { sessionId } = await params;
    if (!Types.ObjectId.isValid(sessionId)) return Response.json({ success: false, error: "Invalid capture session id" }, { status: 400 });
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ success: false, error: "Invalid evidence page reservation request" }, { status: 400 });
    const key = parsed.data.clientUploadId;
    await connectToDatabase();
    const result = await reserveEvidencePage({ actor: { userId: admin.userId, schoolId: admin.schoolId, isAdmin: true, premiumPublicationEntitled: true }, sessionId: new Types.ObjectId(sessionId), ...parsed.data, auditContext: buildSchoolUserAuditContext(request, { userId: admin.userId, schoolId: admin.schoolId, actorRole: "school_admin", idempotencyKey: key }) });
    return Response.json({ success: true, replayed: result.replayed, data: result }, { status: result.replayed ? 200 : 201 });
  } catch (error) { return errorResponse(error, "Failed to reserve evidence page"); }
}
function errorResponse(error: unknown, fallback: string) { if (error instanceof Response) return error; if (error instanceof AssessmentEvidenceError) return Response.json({ success: false, error: error.message }, { status: error.status }); return Response.json({ success: false, error: fallback }, { status: 500 }); }
