/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { sendTrackedBrevoEmail } from "@/lib/email";

const ComposeSchema = z.object({
  to: z.string().email(),
  toName: z.string().trim().max(120).optional(),
  subject: z.string().trim().min(1).max(500),
  htmlContent: z.string().min(1),
  textContent: z.string().optional(),
  mailbox: z.enum(["support", "billing"]).optional().default("support"),
  relatedEntityType: z.string().trim().max(80).optional(),
  relatedEntityId: z.string().trim().max(80).optional(),
});

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

    const result = await sendTrackedBrevoEmail({
      to: parsed.data.to,
      toName: parsed.data.toName,
      subject: parsed.data.subject,
      htmlContent: parsed.data.htmlContent,
      textContent: parsed.data.textContent,
      templateKey: "PLATFORM_MANUAL_EMAIL",
      actorId: String((guard.me as any)._id),
      actorRole: "platform_admin",
      threadType: parsed.data.mailbox === "billing" ? "billing" : "support",
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
