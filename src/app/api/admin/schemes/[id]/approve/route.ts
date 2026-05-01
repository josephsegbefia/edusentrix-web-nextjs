import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { SchemeOfWork } from "@/models/SchemeOfWork";
import { SchemeReview } from "@/models/SchemeReview";

const ReviewNoteSchema = z.object({
  note: z.string().trim().max(5000).optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireSchoolAdmin();
    await connectToDatabase();
    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return Response.json({ success: false, error: "Invalid scheme id" }, { status: 400 });
    }
    const parsed = ReviewNoteSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return Response.json({ success: false, error: "Validation failed" }, { status: 400 });

    const scheme = await SchemeOfWork.findOne({ _id: id, schoolId: ctx.schoolId });
    if (!scheme) return Response.json({ success: false, error: "Scheme not found" }, { status: 404 });
    if (!["in_review", "approved"].includes(scheme.status)) {
      return Response.json(
        { success: false, error: "Scheme must be in review before approval" },
        { status: 409 }
      );
    }

    scheme.status = "approved";
    scheme.approvedAt = new Date();
    scheme.approvedByUserId = ctx.userId;
    scheme.updatedByUserId = ctx.userId;
    await scheme.save();

    await SchemeReview.create({
      schoolId: ctx.schoolId,
      schemeId: scheme._id,
      actorUserId: ctx.userId,
      decision: "approved",
      note: parsed.data.note || null,
    });

    return Response.json({ success: true });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to approve scheme" },
      { status: 500 }
    );
  }
}
