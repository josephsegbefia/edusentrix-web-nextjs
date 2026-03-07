import { NextRequest, NextResponse } from "next/server";
import { requireFinanceStaff } from "@/lib/auth/requireFinanceStaff";
import { connectToDatabase } from "@/db/connectToDatabase";
import { buildTransferReconciliationUpdate } from "@/lib/finance/disbursements";
import { verifyTransfer } from "@/lib/paystack";
import { SchoolDisbursement } from "@/models/SchoolDisbursement";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(_req: NextRequest, { params }: RouteParams) {
  try {
    const { schoolId } = await requireFinanceStaff();
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
        { error: "Only Paystack disbursements can be reconciled" },
        { status: 400 }
      );
    }

    if (!disbursement.reference) {
      return NextResponse.json(
        { error: "Disbursement has no gateway reference" },
        { status: 400 }
      );
    }

    const transfer = await verifyTransfer(disbursement.reference);
    const update = buildTransferReconciliationUpdate({
      amountMinor: disbursement.amountMinor,
      platformFeeMinor: disbursement.platformFeeMinor,
      existingProcessorFeeMinor: disbursement.processorFeeMinor,
      transfer: {
        ...transfer,
        reference: disbursement.reference,
      },
    });

    disbursement.processorFeeMinor = update.processorFeeMinor;
    disbursement.totalDebitMinor = update.totalDebitMinor;
    disbursement.status = update.status;
    disbursement.processedAt = update.processedAt;
    disbursement.gateway = {
      ...(disbursement.gateway || {}),
      ...update.gateway,
    };

    await disbursement.save();

    return NextResponse.json({
      data: {
        id: String(disbursement._id),
        reference: disbursement.reference,
        status: disbursement.status,
        processorFeeMinor: disbursement.processorFeeMinor,
        totalDebitMinor: disbursement.totalDebitMinor,
        gateway: disbursement.gateway,
        processedAt: disbursement.processedAt?.toISOString?.() || null,
      },
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Error reconciling disbursement:", error);
    return NextResponse.json(
      { error: "Failed to reconcile disbursement" },
      { status: 500 }
    );
  }
}
