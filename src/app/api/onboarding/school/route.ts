import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { supabaseServer } from "@/lib/supabase/server";
import { User } from "@/models/User";
import { School } from "@/models/School";

const BodySchema = z.object({
  schoolId: z.string().min(1),
  name: z.string().min(2),
  type: z.enum(["Basic", "Secondary"]),
  address: z.string(),
  city: z.string(),
  region: z.string(),
  bank: z.object({
    bankName: z.string(),
    branchName: z.string(),
    sortCode: z.string().regex(/^\d{6}$/),
    accountName: z.string(),
    accountNumber: z.string(),
  }),
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

  const user = await User.findOne({ supabaseUserId: data.user.id });
  if (!user?.schoolId)
    return NextResponse.json({ error: "No school bound" }, { status: 409 });

  if (String(user.schoolId) !== parsed.data.schoolId) {
    return NextResponse.json(
      { error: "Forbidden for this school" },
      { status: 403 }
    );
  }

  const school = await School.findById(user.schoolId);
  if (!school)
    return NextResponse.json({ error: "School not found" }, { status: 404 });

  school.name = parsed.data.name;
  school.type = parsed.data.type;
  school.address = parsed.data.address ?? undefined;
  school.city = parsed.data.city ?? undefined;
  school.region = parsed.data.region ?? undefined;
  school.bank = parsed.data.bank ?? undefined;

  await school.save();
  return NextResponse.json({ success: true });
}
