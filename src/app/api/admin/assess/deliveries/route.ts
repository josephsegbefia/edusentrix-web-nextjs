import { Types } from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { requireAssessPremiumPublication } from "@/lib/subscriptions/assess-premium";
import {
  AssessmentDeliveryError,
  createAssessmentDeliveryDraft,
  listAssessmentDeliveryVersions,
  listPublishedAssessmentDefinitions,
  serializeAssessmentDefinitionSummary,
  serializeAssessmentDelivery,
} from "@/lib/assess/assessment-delivery-service";

const objectId = (label: string) => z.string().refine((value) => Types.ObjectId.isValid(value), label);
const createSchema = z.object({
  assessmentDefinitionVersionId: objectId("Invalid assessment definition id"),
  title: z.string().trim().min(1).max(220),
  durationMinutes: z.number().int().min(1).max(720).nullable().optional(),
  lateEntryMinutes: z.number().int().min(0).max(720).optional(),
  resultBinding: z.enum(["none", "score_bearing"]),
  assessmentPlanId: objectId("Invalid assessment plan id").nullable().optional(),
  assessmentItemId: objectId("Invalid assessment item id").nullable().optional(),
  schedule: z.object({
    examSessionId: objectId("Invalid exam session id").nullable().optional(),
    examTimetableEntryId: objectId("Invalid timetable entry id").nullable().optional(),
    scheduledDate: z.string().nullable().optional(),
    startTime: z.string().nullable().optional(),
    endTime: z.string().nullable().optional(),
    venueId: objectId("Invalid venue id").nullable().optional(),
    roomLabel: z.string().trim().max(200).nullable().optional(),
  }).optional(),
  accessibilityPolicy: z.object({
    extraTimeMinutes: z.number().int().min(0).max(720).optional(),
    largePrint: z.boolean().optional(),
    readerOrScribe: z.boolean().optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
  }).optional(),
});

function errorResponse(error: unknown, fallback: string) {
  if (error instanceof Response) return error;
  if (error instanceof AssessmentDeliveryError) {
    return Response.json({ success: false, error: error.message }, { status: error.status });
  }
  return Response.json({ success: false, error: error instanceof Error ? error.message : fallback }, { status: 500 });
}

async function requirePremiumAdmin() {
  const actor = await requireSchoolAdmin();
  const premium = await requireAssessPremiumPublication(actor.schoolId);
  if (!premium.allowed) {
    return { actor: null, response: Response.json({ success: false, error: premium.reason }, { status: premium.statusCode }) };
  }
  return { actor, response: null };
}

export async function GET(request: Request) {
  try {
    const access = await requirePremiumAdmin();
    if (access.response) return access.response;
    const actor = access.actor!;
    await connectToDatabase();
    const definitionId = new URL(request.url).searchParams.get("assessmentDefinitionVersionId");
    if (definitionId && !Types.ObjectId.isValid(definitionId)) {
      return Response.json({ success: false, error: "Invalid assessment definition id" }, { status: 400 });
    }
    const [definitions, deliveries] = await Promise.all([
      listPublishedAssessmentDefinitions(actor.schoolId),
      listAssessmentDeliveryVersions({
        schoolId: actor.schoolId,
        assessmentDefinitionVersionId: definitionId ? new Types.ObjectId(definitionId) : undefined,
      }),
    ]);
    return Response.json({
      success: true,
      data: {
        definitions: definitions.map((definition) => serializeAssessmentDefinitionSummary(definition)),
        deliveries: deliveries.map(serializeAssessmentDelivery),
      },
    });
  } catch (error: unknown) {
    return errorResponse(error, "Failed to load assessment deliveries");
  }
}

export async function POST(request: Request) {
  try {
    const access = await requirePremiumAdmin();
    if (access.response) return access.response;
    const actor = access.actor!;
    const parsed = createSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ success: false, error: "Invalid delivery draft request" }, { status: 400 });
    await connectToDatabase();
    const body = parsed.data;
    const result = await createAssessmentDeliveryDraft({
      assessmentDefinitionVersionId: new Types.ObjectId(body.assessmentDefinitionVersionId),
      actor: { userId: actor.userId, schoolId: actor.schoolId, isAdmin: true, premiumPublicationEntitled: true },
      title: body.title,
      durationMinutes: body.durationMinutes,
      lateEntryMinutes: body.lateEntryMinutes,
      schedule: body.schedule ? {
        examSessionId: body.schedule.examSessionId ? new Types.ObjectId(body.schedule.examSessionId) : null,
        examTimetableEntryId: body.schedule.examTimetableEntryId ? new Types.ObjectId(body.schedule.examTimetableEntryId) : null,
        scheduledDate: body.schedule.scheduledDate,
        startTime: body.schedule.startTime,
        endTime: body.schedule.endTime,
        venueId: body.schedule.venueId ? new Types.ObjectId(body.schedule.venueId) : null,
        roomLabel: body.schedule.roomLabel,
      } : undefined,
      resultBinding: body.resultBinding,
      assessmentPlanId: body.assessmentPlanId ? new Types.ObjectId(body.assessmentPlanId) : null,
      assessmentItemId: body.assessmentItemId ? new Types.ObjectId(body.assessmentItemId) : null,
      accessibilityPolicy: body.accessibilityPolicy,
    });
    return Response.json({ success: true, replayed: result.replayed, data: serializeAssessmentDelivery(result.delivery) }, { status: result.replayed ? 200 : 201 });
  } catch (error: unknown) {
    return errorResponse(error, "Failed to create assessment delivery draft");
  }
}
