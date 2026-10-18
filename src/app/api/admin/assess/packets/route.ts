import { Types } from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { buildSchoolUserAuditContext, resolveAuditIdempotencyKey } from "@/lib/audit/fromApiRoute";
import { requireAssessPremiumPublication } from "@/lib/subscriptions/assess-premium";
import {
  AssessmentPaperPacketError,
  generatePaperPacketBatch,
  listAssessmentPaperPackets,
  serializeAssessmentPaperPacket,
} from "@/lib/assess/assessment-paper-packet-service";

const postSchema = z.object({
  assessmentDeliveryVersionId: z.string().refine((value) => Types.ObjectId.isValid(value), "Invalid assessment delivery id"),
  quantity: z.number().int().min(1).max(100),
  batchLabel: z.string().trim().max(160).nullable().optional(),
});

async function requirePremiumAdmin() {
  const actor = await requireSchoolAdmin();
  const premium = await requireAssessPremiumPublication(actor.schoolId);
  if (!premium.allowed) {
    return { actor: null, response: Response.json({ success: false, error: premium.reason }, { status: premium.statusCode }) };
  }
  return { actor, response: null };
}

function errorResponse(error: unknown, fallback: string) {
  if (error instanceof Response) return error;
  if (error instanceof AssessmentPaperPacketError) return Response.json({ success: false, error: error.message }, { status: error.status });
  return Response.json({ success: false, error: error instanceof Error ? error.message : fallback }, { status: 500 });
}

export async function GET(request: Request) {
  try {
    const access = await requirePremiumAdmin();
    if (access.response) return access.response;
    const actor = access.actor!;
    const deliveryId = new URL(request.url).searchParams.get("assessmentDeliveryVersionId");
    if (deliveryId && !Types.ObjectId.isValid(deliveryId)) return Response.json({ success: false, error: "Invalid assessment delivery id" }, { status: 400 });
    await connectToDatabase();
    const data = await listAssessmentPaperPackets({
      actor: { userId: actor.userId, schoolId: actor.schoolId, isAdmin: true, premiumPublicationEntitled: true },
      assessmentDeliveryVersionId: deliveryId ? new Types.ObjectId(deliveryId) : null,
    });
    return Response.json({ success: true, data });
  } catch (error: unknown) {
    return errorResponse(error, "Failed to load paper packets");
  }
}

export async function POST(request: Request) {
  try {
    const access = await requirePremiumAdmin();
    if (access.response) return access.response;
    const actor = access.actor!;
    const idempotencyKey = request.headers.get("x-idempotency-key")?.trim();
    if (!idempotencyKey) return Response.json({ success: false, error: "x-idempotency-key is required" }, { status: 400 });
    const parsed = postSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ success: false, error: "Invalid paper packet generation request" }, { status: 400 });
    await connectToDatabase();
    const auditContext = buildSchoolUserAuditContext(request, {
      userId: actor.userId,
      schoolId: actor.schoolId,
      actorRole: "school_admin",
      idempotencyKey,
    });
    const result = await generatePaperPacketBatch({
      actor: { userId: actor.userId, schoolId: actor.schoolId, isAdmin: true, premiumPublicationEntitled: true },
      assessmentDeliveryVersionId: new Types.ObjectId(parsed.data.assessmentDeliveryVersionId),
      quantity: parsed.data.quantity,
      batchLabel: parsed.data.batchLabel,
      idempotencyKey,
      auditContext,
    });
    return Response.json({
      success: true,
      replayed: result.replayed,
      data: { batchId: result.batchId, packets: result.packets.map(serializeAssessmentPaperPacket) },
    }, { status: result.replayed ? 200 : 201 });
  } catch (error: unknown) {
    return errorResponse(error, "Failed to generate paper packets");
  }
}
