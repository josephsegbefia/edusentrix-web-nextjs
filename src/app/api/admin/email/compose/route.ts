import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { School } from "@/models/School";
import { sendTrackedBrevoEmail } from "@/lib/email";

const ComposeSchema = z.object({
  to: z.string().email(),
  toName: z.string().trim().max(120).optional(),
  subject: z.string().trim().min(1).max(500),
  htmlContent: z.string().min(1),
  textContent: z.string().optional(),
  threadType: z
    .enum(["support", "billing", "school_ops", "manual"])
    .optional()
    .default("manual"),
  relatedEntityType: z.string().trim().max(80).optional(),
  relatedEntityId: z.string().trim().max(80).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const { schoolId, userId } = await requireSchoolAdmin();
    await connectToDatabase();

    const parsed = ComposeSchema.safeParse(await req.json());
    if (!parsed.success) {
      return Response.json(
        { success: false, error: parsed.error.issues[0]?.message || "Invalid payload" },
        { status: 400 },
      );
    }

    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));
    const school = await School.findById(schoolIdObj).select("name").lean();
    const schoolName = (school as Record<string, unknown>)?.name as string || "Your School";

    const result = await sendTrackedBrevoEmail({
      to: parsed.data.to,
      toName: parsed.data.toName,
      subject: parsed.data.subject,
      htmlContent: parsed.data.htmlContent,
      textContent: parsed.data.textContent,
      templateKey: "SCHOOL_MANUAL_EMAIL",
      schoolId: String(schoolIdObj),
      schoolName,
      actorId: String(userId),
      actorRole: "school_admin",
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
