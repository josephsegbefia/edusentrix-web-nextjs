import { NextRequest } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Activity } from "@/models/Activity";
import mongoose from "mongoose";

export async function GET(req: NextRequest) {
  try {
    const { schoolId } = await requireSchoolAdmin();
    if (!schoolId) {
      return new Response(
        JSON.stringify({ success: false, error: "School ID not found" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");
    const entityType = searchParams.get("entityType");
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 50));
    const page = Math.max(1, Number(searchParams.get("page")) || 1);

    // Ensure schoolId is properly converted to ObjectId
    const schoolIdObj =
      schoolId instanceof mongoose.Types.ObjectId
        ? schoolId
        : new mongoose.Types.ObjectId(String(schoolId));

    const filter: Record<string, unknown> = {
      schoolId: schoolIdObj,
    };

    if (action) {
      filter.action = action;
    }

    if (entityType) {
      filter.entityType = entityType;
    }

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      Activity.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("userId", "firstName lastName email")
        .lean(),
      Activity.countDocuments(filter),
    ]);

    return Response.json({
      success: true,
      data: items.map((item) => ({
        _id: String(item._id),
        type: item.type,
        entityType: item.entityType,
        entityId: item.entityId ? String(item.entityId) : null,
        description: item.description,
        metadata: item.metadata || {},
        performedBy: item.userId
          ? {
              _id: String((item.userId as any)._id),
              firstName: (item.userId as any).firstName,
              lastName: (item.userId as any).lastName,
              email: (item.userId as any).email,
            }
          : null,
        createdAt: item.createdAt.toISOString(),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (e: unknown) {
    console.error("Failed to fetch activity log:", e);
    const message =
      e instanceof Error ? e.message : "Failed to fetch activity log";
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
