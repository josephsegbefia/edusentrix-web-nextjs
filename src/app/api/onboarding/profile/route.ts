import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { User } from "@/models/User";
import { ensureCanonicalUserForClerkSession } from "@/lib/auth/canonical-user";
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

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => ({})));

  if (!parsed.success)
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  await connectToDatabase();

  const clerk = await clerkClient();
  const clerkUser = await clerk.users.getUser(userId);
  const email =
    clerkUser.primaryEmailAddress?.emailAddress?.toLowerCase() ||
    clerkUser.emailAddresses[0]?.emailAddress?.toLowerCase() ||
    "";

  if (!email) {
    return NextResponse.json(
      { error: "No email associated with this account" },
      { status: 401 }
    );
  }

  let appUser;
  try {
    appUser = await ensureCanonicalUserForClerkSession({
      clerkUserId: userId,
      email,
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to resolve app user";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  try {
    await runMongoTransaction(async (session) => {
      const result = await User.updateOne(
        { _id: appUser._id },
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
        },
        { session }
      );

      if (result.matchedCount === 0) {
        throw new MongoTransactionError("User not found", 404);
      }
    });
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
