import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { User } from "@/models/User";

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

  await User.updateOne(
    { clerkUserId: userId },
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
    { upsert: false }
  );

  return NextResponse.json({ ok: true });
}
