import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { User } from "@/models/User";
import { getOnboardingTargetSchoolAdmin } from "@/lib/onboarding/target-school-admin";

const Body = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().optional(),
  avatarUrl: z.string().url().optional(),
  avatarPublicId: z.string().optional(),
  address: z.string().optional(),
  dateOfBirth: z.string().optional(),
});

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const gate = await requirePlatformAdmin();
  if (!gate.ok) return gate.res;

  const { id } = await context.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid school id" }, { status: 400 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  await connectToDatabase();

  const schoolId = new mongoose.Types.ObjectId(id);
  const target = await getOnboardingTargetSchoolAdmin(schoolId);
  if (!target?._id) {
    return NextResponse.json(
      { error: "No school admin found for this school." },
      { status: 409 }
    );
  }

  const res = await User.updateOne(
    {
      _id: target._id,
      schoolId,
    },
    {
      $set: {
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        phone: parsed.data.phone ?? null,
        avatarUrl: parsed.data.avatarUrl ?? null,
        avatarPublicId: parsed.data.avatarPublicId ?? null,
        address: parsed.data.address ?? null,
        dateOfBirth: parsed.data.dateOfBirth ?? null,
      },
    }
  );

  if (res.matchedCount === 0) {
    return NextResponse.json({ error: "Target user not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
