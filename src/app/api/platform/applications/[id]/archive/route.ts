import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { recordApplicationAudit } from "@/lib/audit/recordApplicationAudit";
import { Application } from "@/models/Application";

const BodySchema = z.object({ archived: z.boolean() });

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const guard = await requirePlatformAdmin();
  if (!guard.ok) return guard.res;

  const { id } = await ctx.params;
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ success: false, error: "Invalid application id" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Invalid archive request" }, { status: 400 });
  }

  await connectToDatabase();
  const application = await Application.findById(id);
  if (!application) {
    return NextResponse.json({ success: false, error: "Application not found" }, { status: 404 });
  }

  if (parsed.data.archived && !["approved", "rejected"].includes(application.status)) {
    return NextResponse.json(
      { success: false, error: "Only accepted or rejected applications can be archived." },
      { status: 400 }
    );
  }

  const actorId = guard.me?._id
    ? new mongoose.Types.ObjectId(String(guard.me._id))
    : null;
  const wasArchived = Boolean(application.archivedAt);

  if (parsed.data.archived !== wasArchived) {
    application.archivedAt = parsed.data.archived ? new Date() : null;
    application.archivedBy = parsed.data.archived ? actorId : null;
    await application.save();
    await recordApplicationAudit({
      applicationId: application._id,
      action: parsed.data.archived ? "archived" : "restored",
      by: actorId,
    });
  }

  return NextResponse.json({
    success: true,
    data: {
      archived: Boolean(application.archivedAt),
      archivedAt: application.archivedAt?.toISOString() ?? null,
    },
  });
}
