import { NextRequest } from "next/server";
import { z } from "zod";
import { requireSchoolAdminOrDelegatedAnyPermission, requireSchoolAdminOrDelegatedModuleView } from "@/lib/delegations/requireDelegatedModulePermission";
import { connectToDatabase } from "@/db/connectToDatabase";
import { CommunicationTemplate } from "@/models/CommunicationTemplate";
import { DEFAULT_COMMUNICATION_TEMPLATES } from "@/lib/communications/templates/defaultTemplates";

const UpsertTemplateSchema = z.object({
  key: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(500).optional().nullable(),
  type: z.enum(["notice", "announcement", "direct_message", "fee_reminder", "attendance_alert", "academic_update", "lesson_update", "exam_notice", "event_notice", "emergency_alert", "video_meeting_invite", "newsletter", "system_alert"]),
  defaultChannels: z.array(z.enum(["in_app", "email", "whatsapp", "sms"])).min(1),
  subject: z.string().trim().min(1).max(220),
  bodyHtml: z.string().min(1),
  bodyText: z.string().trim().min(1),
  variables: z.array(z.string().trim().min(1).max(80)).optional(),
});

function serializeTemplate(doc: any) {
  return {
    id: String(doc._id),
    key: doc.key,
    name: doc.name,
    description: doc.description ?? null,
    type: doc.type,
    defaultChannels: doc.defaultChannels,
    subject: doc.subject,
    bodyHtml: doc.bodyHtml,
    bodyText: doc.bodyText,
    variables: doc.variables ?? [],
    isSystem: Boolean(doc.isSystem),
    isActive: Boolean(doc.isActive),
  };
}

async function seedSystemTemplates() {
  for (const template of DEFAULT_COMMUNICATION_TEMPLATES) {
    await CommunicationTemplate.updateOne(
      { schoolId: null, key: template.key },
      { $setOnInsert: { ...template, schoolId: null, isSystem: true, isActive: true } },
      { upsert: true },
    );
  }
}

export async function GET() {
  try {
    const { schoolId } = await requireSchoolAdminOrDelegatedModuleView("communications");
    await connectToDatabase();
    await seedSystemTemplates();
    const templates = await CommunicationTemplate.find({
      isActive: true,
      $or: [{ schoolId: null }, { schoolId }],
    }).sort({ isSystem: -1, name: 1 }).lean();
    return Response.json({ success: true, data: { items: templates.map(serializeTemplate) } });
  } catch (error) {
    if (error instanceof Response) return error;
    return Response.json({ success: false, error: error instanceof Error ? error.message : "Failed to load templates" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { schoolId, userId } = await requireSchoolAdminOrDelegatedAnyPermission([
      "communications.templates.manage",
    ]);
    await connectToDatabase();
    const parsed = UpsertTemplateSchema.safeParse(await req.json());
    if (!parsed.success) {
      return Response.json({ success: false, error: parsed.error.issues[0]?.message || "Invalid payload" }, { status: 400 });
    }
    const template = await CommunicationTemplate.findOneAndUpdate(
      { schoolId, key: parsed.data.key },
      {
        $set: {
          ...parsed.data,
          schoolId,
          isSystem: false,
          isActive: true,
          createdByUserId: userId,
        },
      },
      { new: true, upsert: true },
    );
    return Response.json({ success: true, data: serializeTemplate(template) }, { status: 201 });
  } catch (error) {
    if (error instanceof Response) return error;
    return Response.json({ success: false, error: error instanceof Error ? error.message : "Failed to save template" }, { status: 500 });
  }
}
