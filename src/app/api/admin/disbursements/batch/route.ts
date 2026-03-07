import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { requireFinanceStaff } from "@/lib/auth/requireFinanceStaff";
import { connectToDatabase } from "@/db/connectToDatabase";
import {
  buildTransferReconciliationUpdate,
  dispatchApprovedPaystackDisbursement,
} from "@/lib/finance/disbursements";
import { verifyTransfer } from "@/lib/paystack";
import { SchoolDisbursement } from "@/models/SchoolDisbursement";

const BatchDisbursementSchema = z.object({
  action: z.enum(["reconcile", "retry_send"]),
  ids: z.array(z.string().trim()).optional().nullable().default(null),
  limit: z.number().int().min(1).max(100).optional().default(25),
});

export async function POST(req: NextRequest) {
  try {
    const { schoolId } = await requireFinanceStaff();
    const body = BatchDisbursementSchema.parse(await req.json());
    await connectToDatabase();

    const validIds = (body.ids || [])
      .filter((value) => mongoose.Types.ObjectId.isValid(value))
      .map((value) => new mongoose.Types.ObjectId(value));

    const query: Record<string, unknown> = {
      schoolId,
      paymentRail: "paystack",
    };

    if (validIds.length > 0) {
      query._id = { $in: validIds };
    } else if (body.action === "reconcile") {
      query.status = { $in: ["processing", "failed"] };
    } else {
      query.$or = [
        {
          status: "queued",
          "approval.status": { $in: ["approved", "not_required", null] },
        },
        {
          status: "failed",
          $and: [
            {
              "approval.status": { $in: ["approved", "not_required", null] },
            },
            {
              $or: [
                { "gateway.transferCode": { $exists: false } },
                { "gateway.transferCode": null },
                { "gateway.transferCode": "" },
              ],
            },
          ],
        },
      ];
    }

    const rows = await SchoolDisbursement.find(query)
      .sort({ createdAt: -1 })
      .limit(body.limit)
      .lean();

    let updated = 0;
    let failed = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const row of rows) {
      try {
        if (body.action === "reconcile") {
          if (!row.reference) {
            skipped += 1;
            continue;
          }

          const transfer = await verifyTransfer(row.reference);
          const update = buildTransferReconciliationUpdate({
            amountMinor: row.amountMinor,
            platformFeeMinor: row.platformFeeMinor,
            existingProcessorFeeMinor: row.processorFeeMinor,
            transfer: {
              ...transfer,
              reference: row.reference,
            },
          });

          await SchoolDisbursement.findByIdAndUpdate(row._id, {
            $set: {
              status: update.status,
              processorFeeMinor: update.processorFeeMinor,
              totalDebitMinor: update.totalDebitMinor,
              processedAt: update.processedAt,
              "gateway.transferCode": update.gateway.transferCode,
              "gateway.transferId": update.gateway.transferId,
              "gateway.transferStatus": update.gateway.transferStatus,
              "gateway.response": update.gateway.response,
              "gateway.lastError": update.gateway.lastError,
            },
          });
          updated += 1;
          continue;
        }

        const needsRetry =
          row.status === "queued" ||
          (row.status === "failed" &&
            !row.gateway?.transferCode &&
            !row.gateway?.transferId);

        if (!needsRetry) {
          skipped += 1;
          continue;
        }

        const disbursement = await SchoolDisbursement.findById(row._id);
        if (!disbursement) {
          skipped += 1;
          continue;
        }

        await dispatchApprovedPaystackDisbursement(disbursement);
        updated += 1;
      } catch (error) {
        failed += 1;

        const message =
          error instanceof Error ? error.message : "Batch disbursement action failed";

        if (body.action === "retry_send") {
          await SchoolDisbursement.findByIdAndUpdate(row._id, {
            $set: {
              status: "failed",
              "gateway.lastError": message,
            },
          }).catch(() => undefined);
        }

        if (errors.length < 10) {
          errors.push(`${row.reference || String(row._id)}: ${message}`);
        }
      }
    }

    return NextResponse.json({
      data: {
        action: body.action,
        matched: rows.length,
        updated,
        failed,
        skipped,
        errors,
      },
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid batch payload" },
        { status: 400 }
      );
    }
    console.error("Error running disbursement batch action:", error);
    return NextResponse.json(
      { error: "Failed to run disbursement batch action" },
      { status: 500 }
    );
  }
}
