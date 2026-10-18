import { Types } from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { requireAssessPremiumPublication } from "@/lib/subscriptions/assess-premium";
import {
  AssessmentDeliveryError,
  getAssessmentDelivery,
  serializeAssessmentDelivery,
} from "@/lib/assess/assessment-delivery-service";

export async function GET(_request: Request, { params }: { params: Promise<{ deliveryId: string }> }) {
  try {
    const actor = await requireSchoolAdmin();
    const premium = await requireAssessPremiumPublication(actor.schoolId);
    if (!premium.allowed) return Response.json({ success: false, error: premium.reason }, { status: premium.statusCode });
    const { deliveryId } = await params;
    if (!Types.ObjectId.isValid(deliveryId)) return Response.json({ success: false, error: "Invalid assessment delivery id" }, { status: 400 });
    await connectToDatabase();
    const delivery = await getAssessmentDelivery({ schoolId: actor.schoolId, deliveryId: new Types.ObjectId(deliveryId) });
    if (!delivery) return Response.json({ success: false, error: "Assessment delivery not found" }, { status: 404 });
    return Response.json({ success: true, data: serializeAssessmentDelivery(delivery) });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    if (error instanceof AssessmentDeliveryError) return Response.json({ success: false, error: error.message }, { status: error.status });
    return Response.json({ success: false, error: "Failed to load assessment delivery" }, { status: 500 });
  }
}
