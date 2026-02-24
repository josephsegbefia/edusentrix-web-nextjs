/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireFinanceStaff } from "@/lib/auth/requireFinanceStaff";
import { Payment } from "@/models/Payment";
import { CashClosure } from "@/models/CashClosure";

const closureSchema = z.object({
  closureDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  recordedCashMinor: z.number().int().min(0),
  varianceResolutionNote: z.string().optional(),
});

function todayDateKey() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDayRangeUtc(dateKey: string) {
  const start = new Date(`${dateKey}T00:00:00.000Z`);
  const end = new Date(`${dateKey}T23:59:59.999Z`);
  return { start, end };
}

async function computeExpectedCashMinor(
  schoolId: mongoose.Types.ObjectId | string,
  dateKey: string
) {
  const { start, end } = getDayRangeUtc(dateKey);
  const rows = await Payment.aggregate([
    {
      $match: {
        schoolId:
          schoolId instanceof mongoose.Types.ObjectId
            ? schoolId
            : new mongoose.Types.ObjectId(String(schoolId)),
        status: "completed",
        paymentMethod: "cash",
        paymentDate: { $gte: start, $lte: end },
      },
    },
    { $group: { _id: null, total: { $sum: "$amountMinor" }, count: { $sum: 1 } } },
  ]);

  return {
    expectedCashMinor: Number(rows[0]?.total || 0),
    paymentCount: Number(rows[0]?.count || 0),
  };
}

export async function GET(req: NextRequest) {
  const { schoolId } = await requireFinanceStaff();
  await connectToDatabase();

  const schoolIdObj =
    schoolId instanceof mongoose.Types.ObjectId
      ? schoolId
      : new mongoose.Types.ObjectId(String(schoolId));
  const requestedDate = new URL(req.url).searchParams.get("date");
  const closureDate = requestedDate || todayDateKey();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(closureDate)) {
    return NextResponse.json({ error: "Invalid closure date" }, { status: 400 });
  }

  const [{ expectedCashMinor, paymentCount }, currentClosure, recentClosures] =
    await Promise.all([
      computeExpectedCashMinor(schoolIdObj, closureDate),
      CashClosure.findOne({ schoolId: schoolIdObj, closureDate }).lean(),
      CashClosure.find({ schoolId: schoolIdObj })
        .sort({ closureDate: -1 })
        .limit(7)
        .lean(),
    ]);
  const currentClosureDoc = Array.isArray(currentClosure)
    ? currentClosure[0]
    : currentClosure;

  return NextResponse.json({
    closureDate,
    expectedCashMinor,
    paymentCount,
    closure: currentClosureDoc
      ? {
          ...currentClosureDoc,
          _id: String(currentClosureDoc._id),
          schoolId: String(currentClosureDoc.schoolId),
          closedBy: currentClosureDoc.closedBy
            ? String(currentClosureDoc.closedBy)
            : null,
        }
      : null,
    recentClosures: recentClosures.map((entry: any) => ({
      ...entry,
      _id: String(entry._id),
      schoolId: String(entry.schoolId),
      closedBy: entry.closedBy ? String(entry.closedBy) : null,
    })),
  });
}

export async function POST(req: NextRequest) {
  const { schoolId, userId } = await requireFinanceStaff();
  await connectToDatabase();

  const schoolIdObj =
    schoolId instanceof mongoose.Types.ObjectId
      ? schoolId
      : new mongoose.Types.ObjectId(String(schoolId));
  const payload = closureSchema.parse(await req.json());
  const closureDate = payload.closureDate || todayDateKey();
  const { expectedCashMinor, paymentCount } = await computeExpectedCashMinor(
    schoolIdObj,
    closureDate
  );

  const varianceMinor = payload.recordedCashMinor - expectedCashMinor;
  const varianceResolutionNote = payload.varianceResolutionNote?.trim() || null;

  if (varianceMinor !== 0 && !varianceResolutionNote) {
    return NextResponse.json(
      {
        error:
          "Variance must be resolved with a note before cash closure can be completed.",
        expectedCashMinor,
        recordedCashMinor: payload.recordedCashMinor,
        varianceMinor,
      },
      { status: 400 }
    );
  }

  const closure = await CashClosure.findOneAndUpdate(
    { schoolId: schoolIdObj, closureDate },
    {
      $set: {
        expectedCashMinor,
        recordedCashMinor: payload.recordedCashMinor,
        varianceMinor,
        varianceResolved: varianceMinor === 0 || Boolean(varianceResolutionNote),
        varianceResolutionNote,
        closedBy: userId ? new mongoose.Types.ObjectId(userId) : null,
        status: "closed",
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();
  const closureDoc = Array.isArray(closure) ? closure[0] : closure;

  return NextResponse.json({
    ok: true,
    closureDate,
    expectedCashMinor,
    recordedCashMinor: payload.recordedCashMinor,
    varianceMinor,
    paymentCount,
    closure: closureDoc
      ? {
          ...closureDoc,
          _id: String(closureDoc._id),
          schoolId: String(closureDoc.schoolId),
          closedBy: closureDoc.closedBy ? String(closureDoc.closedBy) : null,
        }
      : null,
  });
}
