/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { Application } from "@/models/Application";

// Optional: ensure useful indexes in your model file (shown below).
// applicationSchema.index({ status: 1, createdAt: -1 });
// applicationSchema.index({ schoolType: 1 });
// applicationSchema.index({ adminEmail: 1 });
// applicationSchema.index({ schoolName: 1 });

export async function GET(req: NextRequest) {
  const guard = await requirePlatformAdmin();
  if (!guard.ok) return guard.res;

  await connectToDatabase();
  const { searchParams } = new URL(req.url);

  const status = searchParams.get("status") ?? "pending"; // pending|approved|rejected|all
  const type = searchParams.get("type"); // Basic|Secondary|undefined
  const q = (searchParams.get("q") ?? "").trim();
  const from = searchParams.get("from"); // ISO yyyy-mm-dd
  const to = searchParams.get("to"); // ISO yyyy-mm-dd
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const limit = Math.min(
    100,
    Math.max(1, Number(searchParams.get("limit") ?? "20"))
  );

  const where: Record<string, any> = {};
  if (status && status !== "all") where.status = status;
  if (type) where.schoolType = type;

  // Date range on createdAt
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.$gte = new Date(from);
    if (to) {
      // include end-of-day
      const d = new Date(to);
      d.setHours(23, 59, 59, 999);
      where.createdAt.$lte = d;
    }
  }

  // Simple “contains” search across useful fields
  if (q) {
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    where.$or = [
      { schoolName: rx },
      { adminEmail: rx },
      { adminFirstName: rx },
      { adminLastName: rx },
      { city: rx },
      { region: rx },
    ];
  }

  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    Application.find(where)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Application.countDocuments(where),
  ]);

  return NextResponse.json({
    items,
    page,
    limit,
    total,
    hasMore: skip + items.length < total,
  });
}
