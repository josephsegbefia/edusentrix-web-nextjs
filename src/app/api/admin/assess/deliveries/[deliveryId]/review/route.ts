import { Types } from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { requireAssessPremiumPublication } from "@/lib/subscriptions/assess-premium";
import { AssessmentDeliveryError, serializeAssessmentDelivery, submitAssessmentDeliveryForReview } from "@/lib/assess/assessment-delivery-service";

const bodySchema = z.object({ expectedUpdatedAt: z.string().datetime().nullable().optional() });

export async function POST(request: Request, { params }: { params: Promise<{ deliveryId: string }> }) {
  try {
    const actor = await requireSchoolAdmin();
    const premium = await requireAssessPremiumPublication(actor.schoolId);
    if (!premium.allowed) return Response.json({ success: false, error: premium.reason }, { status: premium.statusCode });
    const { deliveryId } = await params;
    if (!Types.ObjectId.isValid(deliveryId)) return Response.json({ success: false, error: "Invalid assessment delivery id" }, { status: 400 });
    const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return Response.json({ success: false, error: "Invalid review request" }, { status: 400 });
    await connectToDatabase();
    const delivery = await submitAssessmentDeliveryForReview({
      deliveryId: new Types.ObjectId(deliveryId),
      actor: { userId: actor.userId, schoolId: actor.schoolId, isAdmin: true, premiumPublicationEntitled: true },
      expectedUpdatedAt: parsed.data.expectedUpdatedAt,
    });
    return Response.json({ success: true, data: serializeAssessmentDelivery(delivery) });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    if (error instanceof AssessmentDeliveryError) return Response.json({ success: false, error: error.message }, { status: error.status });
    return Response.json({ success: false, error: "Failed to submit delivery for review" }, { status: 500 });
  }
}
