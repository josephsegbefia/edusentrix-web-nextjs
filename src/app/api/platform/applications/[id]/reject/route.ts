/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { Application } from "@/models/Application";

const BodySchema = z.object({
  reason: z.string().min(3),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const guard = await requirePlatformAdmin();
  if (!guard.ok) return guard.res;

  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  await connectToDatabase();
  const app = await Application.findById(params.id);
  if (!app) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (app.status !== "pending")
    return NextResponse.json({ success: true, already: app.status });

  app.status = "rejected";
  (app as any).reviewedBy = guard.me!._id;
  (app as any).reviewNote = parsed.data.reason;
  (app as any).reviewedAt = new Date();
  await app.save();

  // (Optional) send rejection email with Brevo if you want.

  return NextResponse.json({ success: true });
}
