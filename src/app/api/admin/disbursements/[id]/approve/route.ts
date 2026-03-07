import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireFinanceStaff } from "@/lib/auth/requireFinanceStaff";
import { connectToDatabase } from "@/db/connectToDatabase";
import { dispatchApprovedPaystackDisbursement } from "@/lib/finance/disbursements";
import { SchoolDisbursement } from "@/models/SchoolDisbursement";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const ApproveDisbursementSchema = z.object({
  note: z.string().trim().max(500).optional().nullable().default(null),
});

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { userId, schoolId } = await requireFinanceStaff();
    const { id } = await params;
    await connectToDatabase();

    const disbursement = await SchoolDisbursement.findOne({
      _id: id,
      schoolId,
    });

    if (!disbursement) {
      return NextResponse.json(
        { error: "Disbursement not found" },
        { status: 404 }
      );
    }

    if (disbursement.paymentRail !== "paystack") {
      return NextResponse.json(
        { error: "Only Paystack disbursements require approval" },
        { status: 400 }
      );
    }

    if (disbursement.approval?.status !== "pending") {
      return NextResponse.json(
        { error: "Only pending Paystack disbursements can be approved" },
        { status: 400 }
      );
    }

    const makerId =
      disbursement.approval?.requestedBy || disbursement.createdBy || null;

    if (makerId && String(makerId) === String(userId)) {
      return NextResponse.json(
        {
          error:
            "Maker-checker control requires a different finance user to approve this payout.",
        },
        { status: 400 }
      );
    }

    const body = ApproveDisbursementSchema.parse(await req.json().catch(() => ({})));

    disbursement.approval = {
      ...(disbursement.approval || {
        required: true,
        status: "pending",
      }),
      required: true,
      status: "approved",
      approvedAt: new Date(),
      approvedBy: userId,
      rejectedAt: null,
      rejectedBy: null,
      note: body.note || disbursement.approval?.note || null,
    };

    await disbursement.save();

    let warning: string | null = null;

    try {
      await dispatchApprovedPaystackDisbursement(disbursement);
    } catch (error) {
      warning =
        error instanceof Error ? error.message : "Failed to initiate payout";

      await SchoolDisbursement.findByIdAndUpdate(disbursement._id, {
        $set: {
          status: "failed",
          "gateway.lastError": warning,
        },
      });
    }

    const saved = await SchoolDisbursement.findById(disbursement._id).lean();

    return NextResponse.json({
      data: {
        id: String(saved?._id || disbursement._id),
        status: saved?.status || disbursement.status,
        reference: saved?.reference || disbursement.reference,
        approval: saved?.approval || disbursement.approval,
        gateway: saved?.gateway || null,
        processedAt: saved?.processedAt?.toISOString?.() || null,
      },
      warning,
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid approval payload" },
        { status: 400 }
      );
    }
    console.error("Error approving disbursement:", error);
    return NextResponse.json(
      { error: "Failed to approve disbursement" },
      { status: 500 }
    );
  }
}
