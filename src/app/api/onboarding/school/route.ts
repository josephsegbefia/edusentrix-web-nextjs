/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { supabaseServer } from "@/lib/supabase/server";
import { User, type IUser } from "@/models/User";
import { School } from "@/models/School";
import { resolveBankCode } from "@/lib/banks/banks";

const BodySchema = z.object({
  schoolId: z.string().min(1),
  name: z.string().min(2),
  type: z.enum(["Basic", "Secondary"]),
  address: z.string().nullable().optional(),
  email: z.email().optional(),
  city: z.string().nullable().optional(),
  region: z.string().nullable().optional(),
  bank: z
    .object({
      bankName: z.string().nullable().optional(),
      branchName: z.string().nullable().optional(),
      accountName: z.string().nullable().optional(),
      accountNumber: z.string().nullable().optional(),
      // sortCode is IGNORED (derived on server)
      sortCode: z.string().optional().nullable(),
    })
    .nullable()
    .optional(),
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

  const meResult = await User.findOne({ clerkUserId: data.user.id }).lean();
  const me: IUser | null = meResult as IUser | null;
  if (!me?.schoolId)
    return NextResponse.json({ error: "No school bound" }, { status: 409 });
  if (String(me.schoolId) !== parsed.data.schoolId) {
    return NextResponse.json(
      { error: "Forbidden for this school" },
      { status: 403 }
    );
  }

  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const school = await School.findById(me.schoolId).session(session);
    if (!school) {
      await session.abortTransaction();
      return NextResponse.json({ error: "School not found" }, { status: 404 });
    }

    // Resolve bank code from DB; ignore client sortCode
    let derivedSortCode: string | null = null;
    const bankReq = parsed.data.bank || undefined;
    if (bankReq?.bankName && bankReq?.branchName) {
      derivedSortCode = await resolveBankCode(
        bankReq.bankName,
        bankReq.branchName
      );
    }

    school.name = parsed.data.name;
    school.type = parsed.data.type;
    school.address = parsed.data.address ?? undefined;
    school.email = parsed.data.email ?? undefined;
    school.city = parsed.data.city ?? undefined;
    school.region = parsed.data.region ?? undefined;

    school.bank = {
      bankName: bankReq?.bankName || undefined,
      branchName: bankReq?.branchName || undefined,
      sortCode: derivedSortCode || undefined,
      accountName: bankReq?.accountName || undefined,
      accountNumber: bankReq?.accountNumber || undefined,
    };

    // Do NOT call Paystack here; just persist. Provisioning will be enqueued on /finish
    await school.save({ session });

    await session.commitTransaction();
    return NextResponse.json({ success: true });
  } catch (e: any) {
    await session.abortTransaction();
    return NextResponse.json(
      { error: "Failed to save school profile", details: e?.message },
      { status: 500 }
    );
  } finally {
    session.endSession();
  }
}
