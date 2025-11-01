/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { supabaseServer } from "@/lib/supabase/server";
import { User } from "@/models/User";
import { School } from "@/models/School";
import mongoose from "mongoose";
import { ProvisioningJob } from "@/models/ProvisioningJob";
import { createSubaccount } from "@/lib/paystack";

const BodySchema = z.object({
  schoolId: z.string().min(1),
  name: z.string().min(2),
  type: z.enum(["Basic", "Secondary"]),
  address: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  region: z.string().nullable().optional(),
  bank: z
    .object({
      bankName: z.string().nullable().optional(),
      branchName: z.string().nullable().optional(),
      // UI may call this 'sortCode'; we store the Paystack bank "code" here
      sortCode: z
        .string()
        .regex(/^\d{3,6}$/)
        .nullable()
        .optional(),
      accountName: z.string().nullable().optional(),
      accountNumber: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
});

export async function POST(req: NextRequest) {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { schoolId, name, type, address, city, region, bank } = parsed.data;

  await connectToDatabase();

  const me = await User.findOne({ supabaseUserId: data.user.id });
  if (!me?.schoolId) {
    return NextResponse.json({ error: "No school bound" }, { status: 409 });
  }
  if (String(me.schoolId) !== schoolId) {
    return NextResponse.json(
      { error: "Forbidden for this school" },
      { status: 403 }
    );
  }

  // Transaction: update School document safely
  const session = await mongoose.startSession();
  session.startTransaction();
  let needSubaccount = false;
  let updatedSchool: any;

  try {
    const school = await School.findById(me.schoolId).session(session);
    if (!school) {
      await session.abortTransaction();
      session.endSession();
      return NextResponse.json({ error: "School not found" }, { status: 404 });
    }

    const bankBefore = school.bank ? { ...school.bank } : null;

    school.name = name;
    school.type = type;
    school.address = address ?? undefined;
    school.city = city ?? undefined;
    school.region = region ?? undefined;
    if (bank) {
      school.bank = {
        bankName: bank.bankName ?? undefined,
        branchName: bank.branchName ?? undefined,
        sortCode: bank.sortCode ?? undefined, // Paystack bank code
        accountName: bank.accountName ?? undefined,
        accountNumber: bank.accountNumber ?? undefined,
      };
    }

    // Determine if subaccount provisioning is needed
    const bankChanged =
      JSON.stringify(bankBefore) !== JSON.stringify(school.bank || null);
    const noSubaccount = !school.billing?.paystack?.subaccountCode;

    if (bankChanged || noSubaccount) {
      school.billing = {
        ...(school.billing || {}),
        status: "provisioning",
        paystack: {
          ...(school.billing?.paystack || {}),
          lastError: null,
        },
      };
      needSubaccount = true;
    }

    updatedSchool = await school.save({ session });
    await session.commitTransaction();
    session.endSession();
  } catch (e) {
    await session.abortTransaction();
    session.endSession();
    console.error("[onboarding/school] txn failed:", e);
    return NextResponse.json(
      { error: "Save failed. Please try again later." },
      { status: 500 }
    );
  }

  // Outside the DB transaction: call Paystack (don’t block the transaction)
  if (needSubaccount) {
    try {
      const businessName = updatedSchool.name;
      const bankCode = updatedSchool.bank?.sortCode; // bank "code" from /bank
      const accountNumber = updatedSchool.bank?.accountNumber;

      if (!bankCode || !accountNumber) {
        throw new Error("Missing bank code or account number for subaccount");
      }

      const created = await createSubaccount({
        businessName,
        bankCode,
        accountNumber,
        percentageCharge: 0,
        contactEmail: undefined, // optional
      });

      await School.findByIdAndUpdate(updatedSchool._id, {
        $set: {
          "billing.status": "provisioned",
          "billing.paystack.subaccountCode": created.subaccount_code,
          "billing.paystack.subaccountId": created.id,
          "billing.paystack.lastError": null,
        },
      });
    } catch (err: any) {
      console.error("[Paystack subaccount] error:", err?.message || err);

      await School.findByIdAndUpdate(updatedSchool._id, {
        $set: {
          "billing.status": "failed",
          "billing.paystack.lastError": err?.message || String(err),
        },
      });

      // Queue a provisioning job to retry silently later
      await ProvisioningJob.create({
        kind: "paystack_subaccount",
        schoolId: updatedSchool._id,
        payload: {
          businessName: updatedSchool.name,
          bankCode: updatedSchool.bank?.sortCode,
          accountNumber: updatedSchool.bank?.accountNumber,
        },
        status: "pending",
        attempts: 0,
      });

      // Don’t fail the request — the user already saved the data.
      return NextResponse.json({
        success: true,
        message:
          "School profile saved. We couldn't complete bank provisioning; we'll retry automatically.",
      });
    }
  }

  return NextResponse.json({ success: true });
}
