import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { requireAssessPremiumPublication } from "@/lib/subscriptions/assess-premium";
import { buildSchoolUserAuditContext, resolveAuditIdempotencyKey } from "@/lib/audit/fromApiRoute";
import { connectToDatabase } from "@/db/connectToDatabase";
import {
  AssessmentPaperPacketError,
  renderAssessmentPaperPacket,
} from "@/lib/assess/assessment-paper-packet-service";

export async function GET(request: Request, { params }: { params: Promise<{ packetId: string }> }) {
  try {
    const actor = await requireSchoolAdmin();
    const premium = await requireAssessPremiumPublication(actor.schoolId);
    if (!premium.allowed) return Response.json({ success: false, error: premium.reason }, { status: premium.statusCode });
    const { packetId } = await params;
    const mode = new URL(request.url).searchParams.get("mode") === "reprint" ? "reprint" : "download";
    const idempotencyKey = resolveAuditIdempotencyKey(request, `assessment.paper_packet.${mode}:${packetId}`);
    await connectToDatabase();
    const pdf = await renderAssessmentPaperPacket({
      actor: { userId: actor.userId, schoolId: actor.schoolId, isAdmin: true, premiumPublicationEntitled: true },
      packetId,
      mode,
      idempotencyKey,
      auditContext: buildSchoolUserAuditContext(request, {
        userId: actor.userId,
        schoolId: actor.schoolId,
        actorRole: "school_admin",
        idempotencyKey,
      }),
    });
    return new Response(Buffer.from(pdf.bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${pdf.fileName}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    if (error instanceof AssessmentPaperPacketError) return Response.json({ success: false, error: error.message }, { status: error.status });
    return Response.json({ success: false, error: "Failed to generate paper packet PDF" }, { status: 500 });
  }
}
