import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { requireAssessPremiumPublication } from "@/lib/subscriptions/assess-premium";
import { connectToDatabase } from "@/db/connectToDatabase";
import {
  AssessmentPaperPacketError,
  getAssessmentPaperPacket,
  serializeAssessmentPaperPacket,
} from "@/lib/assess/assessment-paper-packet-service";

export async function GET(_request: Request, { params }: { params: Promise<{ packetId: string }> }) {
  try {
    const actor = await requireSchoolAdmin();
    const premium = await requireAssessPremiumPublication(actor.schoolId);
    if (!premium.allowed) return Response.json({ success: false, error: premium.reason }, { status: premium.statusCode });
    await connectToDatabase();
    const { packetId } = await params;
    const packet = await getAssessmentPaperPacket({
      actor: { userId: actor.userId, schoolId: actor.schoolId, isAdmin: true, premiumPublicationEntitled: true },
      packetId,
    });
    if (!packet) return Response.json({ success: false, error: "Paper packet not found" }, { status: 404 });
    return Response.json({ success: true, data: serializeAssessmentPaperPacket(packet) });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    if (error instanceof AssessmentPaperPacketError) return Response.json({ success: false, error: error.message }, { status: error.status });
    return Response.json({ success: false, error: "Failed to load paper packet" }, { status: 500 });
  }
}
