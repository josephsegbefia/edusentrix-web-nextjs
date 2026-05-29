import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { requireSchoolAdminOrDelegatedAnyPermission } from "@/lib/delegations/requireDelegatedModulePermission";
import { connectToDatabase } from "@/db/connectToDatabase";
import { School } from "@/models/School";
import { EmailThread } from "@/models/EmailThread";
import { sendTrackedBrevoEmail } from "@/lib/email";

const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;
const MAX_TOTAL_ATTACHMENT_BYTES = 12 * 1024 * 1024;

const AttachmentSchema = z
  .object({
    name: z.string().trim().min(1).max(180),
    mimeType: z.string().trim().max(120).optional(),
    sizeBytes: z.number().int().nonnegative().max(MAX_ATTACHMENT_BYTES).optional(),
    contentBase64: z.string().min(1).optional(),
    url: z.string().url().optional(),
  })
  .refine((attachment) => attachment.contentBase64 || attachment.url, {
    message: "Attachment requires file content or a URL.",
  })
  .refine(
    (attachment) =>
      !attachment.contentBase64 ||
      estimateBase64Bytes(attachment.contentBase64) <= MAX_ATTACHMENT_BYTES,
    { message: "Attachment is larger than 8 MB." },
  );

const ComposeSchema = z.object({
  to: z.string().email(),
  toName: z.string().trim().max(120).optional(),
  subject: z.string().trim().min(1).max(500),
  htmlContent: z.string().min(1),
  textContent: z.string().optional(),
  attachments: z
    .array(AttachmentSchema)
    .max(5)
    .optional()
    .refine(
      (attachments) =>
        !attachments ||
        attachments.reduce(
          (sum, attachment) =>
            sum +
            (attachment.contentBase64
              ? estimateBase64Bytes(attachment.contentBase64)
              : Number(attachment.sizeBytes || 0)),
          0,
        ) <= MAX_TOTAL_ATTACHMENT_BYTES,
      { message: "Attachments can be up to 12 MB total." },
    ),
  threadType: z
    .enum(["support", "billing", "school_ops", "manual"])
    .optional()
    .default("manual"),
  threadId: z.string().refine((value) => mongoose.Types.ObjectId.isValid(value), {
    message: "Invalid thread ID",
  }).optional(),
  relatedEntityType: z.string().trim().max(80).optional(),
  relatedEntityId: z.string().trim().max(80).optional(),
});

function estimateBase64Bytes(value: string) {
  const clean = value.replace(/\s/g, "");
  const padding = clean.endsWith("==") ? 2 : clean.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((clean.length * 3) / 4) - padding);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderSchoolManualEmailBody(args: {
  htmlContent: string;
  schoolName: string;
}) {
  if (args.htmlContent.includes('data-school-email-context="true"')) {
    return args.htmlContent;
  }

  const safeSchoolName = escapeHtml(args.schoolName);
  return `
    <div data-school-email-context="true" style="margin:0 0 18px; padding:14px 16px; border-radius:14px; background:#ecfeff; border:1px solid #bae6fd; color:#155e75; font-size:14px; line-height:1.6;">
      <strong style="color:#0f172a;">${safeSchoolName}</strong> sent this message through EduSentrix.
    </div>
    ${args.htmlContent}
  `;
}

function renderSchoolManualTextBody(args: {
  textContent?: string;
  schoolName: string;
}) {
  const text = args.textContent?.trim() || "";
  const prefix = `${args.schoolName} sent this message through EduSentrix.`;
  if (text.startsWith(prefix)) return text;
  return `${prefix}\n\n${text}`.trim();
}

export async function POST(req: NextRequest) {
  try {
    const { schoolId, userId } = await requireSchoolAdminOrDelegatedAnyPermission([
      "email.send",
    ]);
    await connectToDatabase();

    const parsed = ComposeSchema.safeParse(await req.json());
    if (!parsed.success) {
      return Response.json(
        { success: false, error: parsed.error.issues[0]?.message || "Invalid payload" },
        { status: 400 },
      );
    }

    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));
    const school = await School.findById(schoolIdObj).select("name logo").lean();
    const schoolName = (school as Record<string, unknown>)?.name as string || "Your School";
    const schoolLogo = (school as Record<string, unknown>)?.logo as string | undefined;

    if (parsed.data.threadId) {
      const thread = await EmailThread.findOne({
        _id: new mongoose.Types.ObjectId(parsed.data.threadId),
        mailboxScope: "school",
        schoolId: schoolIdObj,
      })
        .select("_id")
        .lean();
      if (!thread) {
        return Response.json({ success: false, error: "Thread not found" }, { status: 404 });
      }
    }

    const result = await sendTrackedBrevoEmail({
      to: parsed.data.to,
      toName: parsed.data.toName,
      subject: parsed.data.subject,
      htmlContent: renderSchoolManualEmailBody({
        htmlContent: parsed.data.htmlContent,
        schoolName,
      }),
      textContent: renderSchoolManualTextBody({
        textContent: parsed.data.textContent,
        schoolName,
      }),
      attachments: parsed.data.attachments,
      templateKey: "SCHOOL_MANUAL_EMAIL",
      schoolId: String(schoolIdObj),
      schoolName,
      schoolLogo,
      actorId: String(userId),
      actorRole: "school_admin",
      threadId: parsed.data.threadId,
      threadType: parsed.data.threadType,
      relatedEntityType: parsed.data.relatedEntityType,
      relatedEntityId: parsed.data.relatedEntityId,
    });

    return Response.json({ success: true, data: result }, { status: 201 });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    const message = e instanceof Error ? e.message : "Failed to send email";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
