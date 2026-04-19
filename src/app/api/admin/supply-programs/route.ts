import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireFinanceStaff } from "@/lib/auth/requireFinanceStaff";
import { normalizeAudienceIds } from "@/lib/supply-programs/validateAudience";
import { SupplyProgram } from "@/models/SupplyProgram";

const CreateBody = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(5000).optional().nullable(),
  periodLabel: z.string().max(200).optional().nullable(),
  validFrom: z.string().datetime().optional().nullable(),
  validTo: z.string().datetime().optional().nullable(),
  purchaseByDate: z.string().datetime().optional().nullable(),
  audienceMode: z.enum(["whole_school", "grades", "class_groups", "students"]),
  audienceIds: z.array(z.string()).optional().default([]),
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

export async function GET() {
  try {
    const { schoolId, userId } = await requireFinanceStaff();
    await connectToDatabase();

    const programs = await SupplyProgram.find({ schoolId })
      .sort({ updatedAt: -1 })
      .lean();

    return NextResponse.json({
      success: true,
      data: programs.map((p) => serializeProgram(p)),
    });
  } catch (e) {
    if (e instanceof Response) return e;
    const msg = e instanceof Error ? e.message : "Failed to load programs";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { schoolId, userId } = await requireFinanceStaff();
    await connectToDatabase();

    const body = CreateBody.parse(await req.json());
    const oid = new mongoose.Types.ObjectId(String(schoolId));

    const audienceIds = await normalizeAudienceIds(
      oid,
      body.audienceMode,
      body.audienceIds || []
    );

    const status = body.status ?? "draft";
    const publishedAt =
      status === "published" ? new Date() : null;

    const doc = await SupplyProgram.create({
      schoolId: oid,
      name: body.name.trim(),
      description: body.description?.trim() || null,
      periodLabel: body.periodLabel?.trim() || null,
      validFrom: body.validFrom ? new Date(body.validFrom) : null,
      validTo: body.validTo ? new Date(body.validTo) : null,
      purchaseByDate: body.purchaseByDate ? new Date(body.purchaseByDate) : null,
      status,
      audienceMode: body.audienceMode,
      audienceIds,
      publishedAt,
      createdBy: userId,
      updatedBy: userId,
    });

    return NextResponse.json({
      success: true,
      data: { id: String(doc._id) },
    });
  } catch (e) {
    if (e instanceof Response) return e;
    const msg = e instanceof Error ? e.message : "Failed to create program";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}
