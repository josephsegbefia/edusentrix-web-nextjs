import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { can } from "@/lib/auth/can";
import { PERMISSIONS } from "@/lib/rbac";
import { SchemeOfWork } from "@/models/SchemeOfWork";
import { SchemeReview } from "@/models/SchemeReview";
import { SchemeItem } from "@/models/SchemeItem";

const SubmitSchema = z.object({
  note: z.string().trim().max(5000).optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireTeacher();
    if (!can(ctx.permissions, PERMISSIONS.schemeOfWorkSubmit)) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }
    await connectToDatabase();
    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return Response.json({ success: false, error: "Invalid scheme id" }, { status: 400 });
    }
    const schemeId = new mongoose.Types.ObjectId(id);
    const parsed = SubmitSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return Response.json({ success: false, error: "Validation failed" }, { status: 400 });
    }

    const scheme = await SchemeOfWork.findOne({ _id: schemeId, schoolId: ctx.schoolId });
    if (!scheme) return Response.json({ success: false, error: "Scheme not found" }, { status: 404 });
    if (String(scheme.ownerTeacherId) !== String(ctx.teacherId)) {
      return Response.json({ success: false, error: "Only owner can submit this scheme" }, { status: 403 });
    }
    if (scheme.status !== "draft") {
      return Response.json(
        { success: false, error: "Only draft schemes can be submitted" },
        { status: 409 }
      );
    }

    const itemCount = await SchemeItem.countDocuments({ schemeId, schoolId: ctx.schoolId });
    if (itemCount < 1) {
      return Response.json(
        { success: false, error: "Add at least one scheme item before submitting" },
        { status: 409 }
      );
    }

    scheme.status = "in_review";
    scheme.submittedAt = new Date();
    scheme.updatedByUserId = ctx.userId;
    await scheme.save();

    await SchemeReview.create({
      schoolId: ctx.schoolId,
      schemeId,
      actorUserId: ctx.userId,
      actorTeacherId: ctx.teacherId,
      decision: "submitted",
      note: parsed.data.note || null,
    });

    return Response.json({ success: true });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to submit scheme" },
      { status: 500 }
    );
  }
}
