import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireFinanceStaff } from "@/lib/auth/requireFinanceStaff";
import { normalizeAudienceIds } from "@/lib/supply-programs/validateAudience";
import { SupplyProgram } from "@/models/SupplyProgram";
import { SupplyProgramLine } from "@/models/SupplyProgramLine";

const PatchBody = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional().nullable(),
  periodLabel: z.string().max(200).optional().nullable(),
  validFrom: z.string().datetime().optional().nullable(),
  validTo: z.string().datetime().optional().nullable(),
  purchaseByDate: z.string().datetime().optional().nullable(),
  audienceMode: z
    .enum(["whole_school", "grades", "class_groups", "students"])
    .optional(),
  audienceIds: z.array(z.string()).optional(),
  status: z.enum(["draft", "published", "archived"]).optional(),
});

function serializeProgram(p: {
  _id: mongoose.Types.ObjectId;
  name: string;
  description?: string | null;
  periodLabel?: string | null;
  validFrom?: Date | null;
  validTo?: Date | null;
  purchaseByDate?: Date | null;
  status: string;
  audienceMode: string;
  audienceIds?: mongoose.Types.ObjectId[];
  publishedAt?: Date | null;
  updatedAt?: Date;
}) {
  return {
    id: String(p._id),
    name: p.name,
    description: p.description || "",
    periodLabel: p.periodLabel || "",
    validFrom: p.validFrom?.toISOString() || null,
    validTo: p.validTo?.toISOString() || null,
    purchaseByDate: p.purchaseByDate?.toISOString() || null,
    status: p.status,
    audienceMode: p.audienceMode,
    audienceIds: (p.audienceIds || []).map((x) => String(x)),
    publishedAt: p.publishedAt?.toISOString() || null,
    updatedAt: p.updatedAt?.toISOString() || null,
  };
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { schoolId } = await requireFinanceStaff();
    const { id } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, error: "Invalid id" }, { status: 400 });
    }
    await connectToDatabase();

    const program = await SupplyProgram.findOne({
      _id: new mongoose.Types.ObjectId(id),
      schoolId,
    }).lean();

    if (!program) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: serializeProgram(program),
    });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json(
      { success: false, error: "Failed to load program" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { schoolId, userId } = await requireFinanceStaff();
    const { id } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, error: "Invalid id" }, { status: 400 });
    }
    await connectToDatabase();

    const programId = new mongoose.Types.ObjectId(id);
    const oid = new mongoose.Types.ObjectId(String(schoolId));

    const existing = await SupplyProgram.findOne({ _id: programId, schoolId });
    if (!existing) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }

    const body = PatchBody.parse(await req.json());
    const $set: Record<string, unknown> = { updatedBy: userId };

    if (body.name !== undefined) $set.name = body.name.trim();
    if (body.description !== undefined) $set.description = body.description?.trim() || null;
    if (body.periodLabel !== undefined) $set.periodLabel = body.periodLabel?.trim() || null;
    if (body.validFrom !== undefined) $set.validFrom = body.validFrom ? new Date(body.validFrom) : null;
    if (body.validTo !== undefined) $set.validTo = body.validTo ? new Date(body.validTo) : null;
    if (body.purchaseByDate !== undefined) {
      $set.purchaseByDate = body.purchaseByDate ? new Date(body.purchaseByDate) : null;
    }

    const nextMode = body.audienceMode ?? existing.audienceMode;
    if (body.audienceMode !== undefined || body.audienceIds !== undefined) {
      const rawIds =
        body.audienceIds !== undefined
          ? body.audienceIds
          : (existing.audienceIds || []).map((id) => String(id));
      $set.audienceIds = await normalizeAudienceIds(oid, nextMode, rawIds);
      if (body.audienceMode !== undefined) $set.audienceMode = body.audienceMode;
    }

    if (body.status !== undefined) {
      $set.status = body.status;
      if (body.status === "published" && existing.status !== "published") {
        $set.publishedAt = new Date();
      }
    }

    const updated = await SupplyProgram.findOneAndUpdate(
      { _id: programId, schoolId },
      { $set },
      { new: true }
    ).lean();

    return NextResponse.json({
      success: true,
      data: updated ? serializeProgram(updated) : null,
    });
  } catch (e) {
    if (e instanceof Response) return e;
    const msg = e instanceof Error ? e.message : "Failed to update program";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { schoolId } = await requireFinanceStaff();
    const { id } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, error: "Invalid id" }, { status: 400 });
    }
    await connectToDatabase();

    const programId = new mongoose.Types.ObjectId(id);
    const program = await SupplyProgram.findOneAndDelete({ _id: programId, schoolId });
    if (!program) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }

    await SupplyProgramLine.deleteMany({ programId });

    return NextResponse.json({ success: true });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json(
      { success: false, error: "Failed to delete program" },
      { status: 500 }
    );
  }
}
