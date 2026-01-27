/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { Application } from "@/models/Application";
import { recordApplicationAudit } from "@/lib/audit/recordApplicationAudit";

const BodySchema = z.object({
  reason: z.string().min(3),
});

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const guard = await requirePlatformAdmin();
  if (!guard.ok) return guard.res;

  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  await connectToDatabase();
  const session = await mongoose.startSession();

  const { id } = await ctx.params;

  try {
    await session.withTransaction(async () => {
      const app = await Application.findById(id).session(session);
      if (!app) throw new Error("Not found");

      // Only allow reject from 'submitted' or 'reviewed'
      if (!["submitted", "reviewed"].includes(app.status)) {
        // If already rejected, make this idempotent
        if (app.status === "rejected") return;
        throw new Error(
          `Invalid state transition from '${app.status}' to 'rejected'`
        );
      }

      const adminIdObj = guard.me?._id
        ? new mongoose.Types.ObjectId(String(guard.me._id))
        : null;

      app.status = "rejected";
      app.processedBy = adminIdObj as any;
      await app.save({ session });

      await recordApplicationAudit(
        {
          applicationId: app._id,
          action: "rejected",
          by: adminIdObj,
          note: parsed.data.reason,
        },
        { session }
      );
    });

    // (Optional) send rejection email here — non-fatal if it fails

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: "Reject failed", details: e?.message || String(e) },
      { status: 500 }
    );
  } finally {
    session.endSession();
  }
}
