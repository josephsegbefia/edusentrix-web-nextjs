import connectToDatabase from "@/db/connectToDatabase";
import { supabaseServer } from "@/lib/supabase/server";
import { User } from "@/models/User";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const BodySchema = z.object({
  name: z.string().min(2),
  phone: z.string().min(6).optional().nullable(),
  dateOfBirth: z.iso.datetime().optional().nullable(),
  address: z.string().optional().nullable(),
  avatarUrl: z.url().optional().nullable(),
});

export async function POST(req: NextRequest) {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  if (!data.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = BodySchema.safeParse(await req.json());
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  await connectToDatabase();

  const user = await User.findOne({ clerkUserId: data.user.id });
  if (!user)
    return NextResponse.json({ error: "User not found" }, { status: 404 });

  const b = parsed.data;
  // Parse name into firstName and lastName
  const nameParts = b.name.trim().split(/\s+/);
  user.firstName = nameParts[0] || "";
  user.lastName = nameParts.slice(1).join(" ") || "";
  user.phone = b.phone ?? undefined;
  user.address = b.address ?? undefined;
  user.avatarUrl = b.avatarUrl ?? undefined;
  user.dateOfBirth = b.dateOfBirth ? new Date(b.dateOfBirth) : undefined;

  await user.save();
  return NextResponse.json({ success: true });
}
