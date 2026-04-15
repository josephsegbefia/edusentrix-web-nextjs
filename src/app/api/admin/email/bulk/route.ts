import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { School } from "@/models/School";
import { EmailBatch } from "@/models/EmailBatch";
import { createEmailBatch, cancelBatch } from "@/lib/email";

const BulkSendSchema = z.object({
  subject: z.string().trim().min(1).max(500),
  htmlContent: z.string().min(1),
  textContent: z.string().optional(),
  recipients: z
    .array(
      z.object({
        email: z.string().email(),
        name: z.string().trim().max(120).optional(),
        userId: z.string().optional(),
        role: z.string().optional(),
      }),
    )
    .min(1)
    .max(1000),
  relatedEntityType: z.string().trim().max(80).optional(),
  relatedEntityId: z.string().trim().max(80).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const { schoolId } = await requireSchoolAdmin();
    await connectToDatabase();

    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit")) || 20));
    const skip = (page - 1) * limit;

    const [batches, total] = await Promise.all([
      EmailBatch.find({ schoolId: schoolIdObj })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      EmailBatch.countDocuments({ schoolId: schoolIdObj }),
    ]);

    return Response.json({
      success: true,
      data: batches.map((b) => ({
        _id: String(b._id),
        subject: b.subject,
        kind: b.kind,
        status: b.status,
        recipientCount: b.recipientCount,
        sentCount: b.sentCount,
        failedCount: b.failedCount,
        templateKey: b.templateKey,
        createdAt: b.createdAt.toISOString(),
        updatedAt: b.updatedAt.toISOString(),
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    const message = e instanceof Error ? e.message : "Failed to fetch batches";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { schoolId, userId } = await requireSchoolAdmin();
    await connectToDatabase();

    const parsed = BulkSendSchema.safeParse(await req.json());
    if (!parsed.success) {
      return Response.json(
        { success: false, error: parsed.error.issues[0]?.message || "Invalid payload" },
        { status: 400 },
      );
    }

    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));
    const school = await School.findById(schoolIdObj).select("name").lean();
    const schoolName = (school as Record<string, unknown>)?.name as string || "Your School";

    const result = await createEmailBatch({
      schoolId: String(schoolIdObj),
      schoolName,
      kind: "bulk",
      createdBy: String(userId),
      subject: parsed.data.subject,
      htmlContent: parsed.data.htmlContent,
      textContent: parsed.data.textContent,
      templateKey: "SCHOOL_BULK_EMAIL",
      recipients: parsed.data.recipients,
      relatedEntityType: parsed.data.relatedEntityType,
      relatedEntityId: parsed.data.relatedEntityId,
    });

    return Response.json({ success: true, data: result }, { status: 201 });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    const message = e instanceof Error ? e.message : "Failed to create bulk send";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { schoolId } = await requireSchoolAdmin();
    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const batchId = searchParams.get("batchId");
    if (!batchId || !mongoose.Types.ObjectId.isValid(batchId)) {
      return Response.json({ success: false, error: "Invalid batch ID" }, { status: 400 });
    }

    const batch = await EmailBatch.findOne({
      _id: new mongoose.Types.ObjectId(batchId),
      schoolId: new mongoose.Types.ObjectId(String(schoolId)),
    }).lean();

    if (!batch) {
      return Response.json({ success: false, error: "Batch not found" }, { status: 404 });
    }

    if (!["queued", "running", "draft"].includes(batch.status)) {
      return Response.json(
        { success: false, error: "Batch cannot be cancelled in its current state" },
        { status: 400 },
      );
    }

    await cancelBatch(batchId);

    return Response.json({ success: true, message: "Batch cancelled" });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    const message = e instanceof Error ? e.message : "Failed to cancel batch";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
