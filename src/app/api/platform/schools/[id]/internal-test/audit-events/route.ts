import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requirePlatformInternalTestAccess } from "@/lib/auth/requirePlatformInternalTest";
import { PlatformAuditLog } from "@/models/PlatformAuditLog";

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requirePlatformInternalTestAccess();
    if (!gate.ok) return gate.res;

    const { id: schoolIdParam } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(schoolIdParam)) {
      return NextResponse.json({ success: false, error: "Invalid school id" }, { status: 400 });
    }
    const schoolId = new mongoose.Types.ObjectId(schoolIdParam);

    const url = new URL(req.url);
    const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit")) || 25));
    const skip = (page - 1) * limit;

    await connectToDatabase();

    const filter = {
      schoolId,
      action: { $regex: /^internal_test\./ },
    };

    const [items, total] = await Promise.all([
      PlatformAuditLog.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("actorId", "email firstName lastName")
        .lean(),
      PlatformAuditLog.countDocuments(filter),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        items: items.map((row) => ({
          id: String(row._id),
          action: row.action,
          entityType: row.entityType,
          entityId: row.entityId ? String(row.entityId) : null,
          metadata: row.metadata,
          createdAt: row.createdAt.toISOString(),
          actor: row.actorId
            ? {
                id: String((row.actorId as { _id?: unknown })._id ?? row.actorId),
                email: (row.actorId as { email?: string }).email,
                name: [
                  (row.actorId as { firstName?: string }).firstName,
                  (row.actorId as { lastName?: string }).lastName,
                ]
                  .filter(Boolean)
                  .join(" ")
                  .trim(),
              }
            : null,
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (e) {
    console.error("internal-test audit-events GET", e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Failed to load audit events" },
      { status: 500 }
    );
  }
}
