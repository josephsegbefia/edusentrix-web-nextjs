/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
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
  mailbox: z.enum(["hello", "support", "billing"]).optional().default("hello"),
  senderFamily: z.enum(["hello", "support", "billing"]).optional(),
  relatedEntityType: z.string().trim().max(80).optional(),
  relatedEntityId: z.string().trim().max(80).optional(),
});

function estimateBase64Bytes(value: string) {
  const clean = value.replace(/\s/g, "");
  const padding = clean.endsWith("==") ? 2 : clean.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((clean.length * 3) / 4) - padding);
}

function templateKeyForSender(senderFamily: "hello" | "support" | "billing") {
  if (senderFamily === "billing") return "PLATFORM_BILLING_MANUAL_EMAIL";
  if (senderFamily === "hello") return "PLATFORM_HELLO_MANUAL_EMAIL";
  return "PLATFORM_MANUAL_EMAIL";
}

export async function POST(req: NextRequest) {
  try {
    const guard = await requirePlatformAdmin();
    if (!guard.ok) return guard.res;

    await connectToDatabase();

    const parsed = ComposeSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message || "Invalid payload" },
        { status: 400 },
      );
    }

    const mailbox = parsed.data.senderFamily || parsed.data.mailbox;
    const result = await sendTrackedBrevoEmail({
      to: parsed.data.to,
      toName: parsed.data.toName,
      subject: parsed.data.subject,
      htmlContent: parsed.data.htmlContent,
      textContent: parsed.data.textContent,
      attachments: parsed.data.attachments,
      templateKey: templateKeyForSender(mailbox),
      actorId: String((guard.me as any)._id),
      actorRole: "platform_admin",
      threadType: mailbox === "billing" ? "billing" : "support",
      relatedEntityType: parsed.data.relatedEntityType,
      relatedEntityId: parsed.data.relatedEntityId,
    });

    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    const message = e instanceof Error ? e.message : "Failed to send email";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
