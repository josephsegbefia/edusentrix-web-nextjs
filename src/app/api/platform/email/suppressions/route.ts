import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { EmailSuppression } from "@/models/EmailSuppression";
import { applySuppression, liftSuppression } from "@/lib/email";

export async function GET(req: NextRequest) {
  try {
    const guard = await requirePlatformAdmin();
    if (!guard.ok) return guard.res;

    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const email = searchParams.get("email")?.trim().toLowerCase();
    const reason = searchParams.get("reason");
    const active = searchParams.get("active");
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 30));
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {};

    if (email) {
      filter.email = { $regex: email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
    }

    if (reason) {
      filter.reason = reason;
    }

    if (active === "true") {
      filter.active = true;
    } else if (active === "false") {
      filter.active = false;
    }

    const [suppressions, total] = await Promise.all([
      EmailSuppression.find(filter)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      EmailSuppression.countDocuments(filter),
    ]);

    return NextResponse.json({
      success: true,
      data: suppressions.map((s) => ({
        _id: String(s._id),
        email: s.email,
        reason: s.reason,
        scope: s.scope,
        schoolId: s.schoolId ? String(s.schoolId) : null,
        active: s.active,
        sourceProvider: s.sourceProvider || null,
        categories: s.categories || [],
        createdAt: s.createdAt.toISOString(),
        updatedAt: s.updatedAt.toISOString(),
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    const message = e instanceof Error ? e.message : "Failed to fetch suppressions";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

const AddSuppressionSchema = z.object({
  email: z.string().email(),
  reason: z.enum(["bounce", "complaint", "manual_block"]),
  scope: z.enum(["global", "school"]).optional().default("global"),
  schoolId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const guard = await requirePlatformAdmin();
    if (!guard.ok) return guard.res;

    await connectToDatabase();

    const parsed = AddSuppressionSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message || "Invalid payload" },
        { status: 400 },
      );
    }

    await applySuppression({
      email: parsed.data.email,
      reason: parsed.data.reason,
      scope: parsed.data.scope,
      schoolId: parsed.data.schoolId,
      sourceProvider: "manual",
    });

    return NextResponse.json({ success: true, message: "Suppression applied" }, { status: 201 });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    const message = e instanceof Error ? e.message : "Failed to apply suppression";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

const LiftSuppressionSchema = z.object({
  email: z.string().email(),
  reason: z.string(),
  scope: z.enum(["global", "school"]).optional().default("global"),
  schoolId: z.string().optional(),
});

export async function DELETE(req: NextRequest) {
  try {
    const guard = await requirePlatformAdmin();
    if (!guard.ok) return guard.res;

    await connectToDatabase();

    const parsed = LiftSuppressionSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message || "Invalid payload" },
        { status: 400 },
      );
    }

    await liftSuppression(
      parsed.data.email,
      parsed.data.reason,
      parsed.data.scope,
      parsed.data.schoolId,
    );

    return NextResponse.json({ success: true, message: "Suppression lifted" });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    const message = e instanceof Error ? e.message : "Failed to lift suppression";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
