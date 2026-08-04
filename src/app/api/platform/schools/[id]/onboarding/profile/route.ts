import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { clerkClient } from "@clerk/nextjs/server";
import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { User } from "@/models/User";
import { getOnboardingTargetSchoolAdmin } from "@/lib/onboarding/target-school-admin";
import {
  MongoTransactionError,
  runMongoTransaction,
} from "@/lib/mongoose/run-transaction";

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

  try {
    await runMongoTransaction(async (session) => {
      const result = await User.updateOne(
        {
          _id: target._id,
          schoolId,
        },
        {
          $set: {
            name: `${parsed.data.firstName} ${parsed.data.lastName}`.trim(),
            firstName: parsed.data.firstName,
            lastName: parsed.data.lastName,
            phone: parsed.data.phone ?? null,
            avatarUrl: parsed.data.avatarUrl ?? null,
            avatarPublicId: parsed.data.avatarPublicId ?? null,
            address: parsed.data.address ?? null,
            dateOfBirth: parsed.data.dateOfBirth ?? null,
          },
        },
        { session }
      );

      if (result.matchedCount === 0) {
        throw new MongoTransactionError("Target user not found", 404);
      }
    });

    if (target.clerkUserId) {
      const clerk = await clerkClient();
      await clerk.users.updateUser(target.clerkUserId, {
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
      });
    }
  } catch (error) {
    if (error instanceof MongoTransactionError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    const message =
      error instanceof Error ? error.message : "Failed to save profile";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
