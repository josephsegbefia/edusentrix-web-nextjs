import { Types } from "mongoose";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { requireAssessPremiumPublication } from "@/lib/subscriptions/assess-premium";
import { connectToDatabase } from "@/db/connectToDatabase";
import { AssessmentPaperPacketError, renderAssessmentDeliveryPreview } from "@/lib/assess/assessment-paper-packet-service";

export async function GET(_request: Request, { params }: { params: Promise<{ deliveryId: string }> }) {
  try {
    const actor = await requireSchoolAdmin();
    const premium = await requireAssessPremiumPublication(actor.schoolId);
    if (!premium.allowed) return Response.json({ success: false, error: premium.reason }, { status: premium.statusCode });
    const { deliveryId } = await params;
    if (!Types.ObjectId.isValid(deliveryId)) return Response.json({ success: false, error: "Invalid assessment delivery id" }, { status: 400 });
    await connectToDatabase();
    const pdf = await renderAssessmentDeliveryPreview({
      actor: { userId: actor.userId, schoolId: actor.schoolId, isAdmin: true, premiumPublicationEntitled: true },
      assessmentDeliveryVersionId: new Types.ObjectId(deliveryId),
    });
    return new Response(Buffer.from(pdf.bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="assessment-delivery-preview.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    if (error instanceof AssessmentPaperPacketError) return Response.json({ success: false, error: error.message }, { status: error.status });
    return Response.json({ success: false, error: "Failed to generate assessment delivery preview" }, { status: 500 });
  }
}
