import { z } from "zod";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { requireAssessPremiumPublication } from "@/lib/subscriptions/assess-premium";
import { buildSchoolUserAuditContext } from "@/lib/audit/fromApiRoute";
import { connectToDatabase } from "@/db/connectToDatabase";
import {
  AssessmentPaperPacketError,
  serializeAssessmentPaperPacket,
  voidAssessmentPaperPacket,
} from "@/lib/assess/assessment-paper-packet-service";

const schema = z.object({ reason: z.string().trim().min(3).max(1000) });

export async function POST(request: Request, { params }: { params: Promise<{ packetId: string }> }) {
  try {
    const actor = await requireSchoolAdmin();
    const premium = await requireAssessPremiumPublication(actor.schoolId);
    if (!premium.allowed) return Response.json({ success: false, error: premium.reason }, { status: premium.statusCode });
    const idempotencyKey = request.headers.get("x-idempotency-key")?.trim();
    if (!idempotencyKey) return Response.json({ success: false, error: "x-idempotency-key is required" }, { status: 400 });
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ success: false, error: "A void reason is required" }, { status: 400 });
    await connectToDatabase();
    const { packetId } = await params;
    const result = await voidAssessmentPaperPacket({
      actor: { userId: actor.userId, schoolId: actor.schoolId, isAdmin: true, premiumPublicationEntitled: true },
      packetId,
      reason: parsed.data.reason,
      idempotencyKey,
      auditContext: buildSchoolUserAuditContext(request, {
        userId: actor.userId,
        schoolId: actor.schoolId,
        actorRole: "school_admin",
        idempotencyKey,
      }),
    });
    return Response.json({ success: true, replayed: result.replayed, data: serializeAssessmentPaperPacket(result.packet) });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    if (error instanceof AssessmentPaperPacketError) return Response.json({ success: false, error: error.message }, { status: error.status });
    return Response.json({ success: false, error: "Failed to void paper packet" }, { status: 500 });
  }
}
