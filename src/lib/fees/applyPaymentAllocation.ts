/* eslint-disable @typescript-eslint/no-explicit-any */
// src/lib/fees/applyPaymentAllocations.ts
import mongoose from "mongoose";
import { InvoiceLineItem } from "@/models/InvoiceLineItem";
import { InstallmentSchedule } from "@/models/InstallmentSchedule";
import { PaymentAllocation } from "@/models/PaymentAllocation";

type AllocationInputMinor = {
  invoiceLineItemId: string;
  amountMinor: number;
  installmentScheduleId?: string | null;
  installmentNumber?: number | null;
  notes?: string | null;
};

function keyFor(lineItemId: string, scheduleId?: string | null) {
  return `${lineItemId}:${scheduleId || "direct"}`;
}

export async function applyPaymentAllocations(args: {
  session: mongoose.ClientSession;
  paymentId: mongoose.Types.ObjectId;
  invoiceId: mongoose.Types.ObjectId;
  allocations: AllocationInputMinor[];
}): Promise<{
  createdAllocations: any[];
  overpaymentMinor: number;
}> {
  const { session, paymentId, invoiceId, allocations } = args;

  // basic “no dupes in request”
  {
    const seen = new Set<string>();
    for (const a of allocations) {
      const k = `${a.invoiceLineItemId}:${a.installmentScheduleId || ""}:${
        a.installmentNumber || ""
      }`;
      if (seen.has(k)) {
        throw new Error("Duplicate allocation target in request");
      }
      seen.add(k);
    }
  }

  const lineItemIds = allocations.map(
    (a) => new mongoose.Types.ObjectId(a.invoiceLineItemId)
  );
  const lineItems = await InvoiceLineItem.find({
    _id: { $in: lineItemIds },
    invoiceId,
  }).session(session);

  if (lineItems.length !== new Set(lineItemIds.map(String)).size) {
    throw new Error("One or more allocations reference invalid line items");
  }

  const lineItemById = new Map<string, any>();
  for (const li of lineItems) lineItemById.set(String(li._id), li);

  // Fetch all schedules for these line items once
  const schedules = await InstallmentSchedule.find({
    invoiceLineItemId: { $in: lineItemIds },
  })
    .sort({ installmentNumber: 1 })
    .session(session);

  const schedulesByLineItem = new Map<string, any[]>();
  const scheduleById = new Map<string, any>();
  for (const s of schedules) {
    scheduleById.set(String(s._id), s);
    const lid = String(s.invoiceLineItemId);
    const arr = schedulesByLineItem.get(lid) || [];
    arr.push(s);
    schedulesByLineItem.set(lid, arr);
  }

  // We’ll merge chunks per (lineItem + schedule) to avoid duplicates
  const mergedChunks = new Map<
    string,
    {
      invoiceLineItemId: mongoose.Types.ObjectId;
      installmentScheduleId: mongoose.Types.ObjectId | null;
      installmentNumber: number | null;
      amountMinor: number;
      notes?: string | null;
    }
  >();

  let overpaymentMinor = 0;

  for (const req of allocations) {
    const li = lineItemById.get(String(req.invoiceLineItemId));
    if (!li) throw new Error("Invalid line item");

    const requestMinor = Math.max(0, Math.floor(req.amountMinor));
    if (requestMinor <= 0) continue;

    // Cap at line-item outstanding; remainder becomes credit
    const payableMinor = Math.min(
      requestMinor,
      Math.max(0, li.amountOutstandingMinor)
    );
    const leftoverMinor = requestMinor - payableMinor;
    if (leftoverMinor > 0) overpaymentMinor += leftoverMinor;

    if (payableMinor <= 0) continue;

    const liSchedules = schedulesByLineItem.get(String(li._id)) || [];
    const hasInstallments = liSchedules.length > 0;

    // Helper: add merged chunk
    const addChunk = (schedule: any | null, amt: number) => {
      if (amt <= 0) return;
      const scheduleId = schedule ? String(schedule._id) : null;
      const k = keyFor(String(li._id), scheduleId);
      const existing = mergedChunks.get(k);
      if (existing) {
        existing.amountMinor += amt;
        mergedChunks.set(k, existing);
      } else {
        mergedChunks.set(k, {
          invoiceLineItemId: li._id,
          installmentScheduleId: schedule ? schedule._id : null,
          installmentNumber: schedule ? schedule.installmentNumber : null,
          amountMinor: amt,
          notes: req.notes || null,
        });
      }
    };

    // Helper: pay schedules sequentially
    const paySchedulesFromIndex = (startIndex: number, total: number) => {
      let remaining = total;
      for (let i = startIndex; i < liSchedules.length && remaining > 0; i++) {
        const sch = liSchedules[i];
        const outstanding = Math.max(0, sch.amountOutstandingMinor);
        if (outstanding <= 0) continue;

        const applied = Math.min(remaining, outstanding);

        sch.amountPaidMinor += applied;
        sch.amountOutstandingMinor = sch.amountMinor - sch.amountPaidMinor;
        sch.status =
          sch.amountPaidMinor >= sch.amountMinor
            ? "paid"
            : sch.amountPaidMinor > 0
            ? "partially_paid"
            : "pending";

        addChunk(sch, applied);
        remaining -= applied;
      }
      return remaining;
    };

    // If user specified an installment (by scheduleId or installmentNumber), start from there
    if (
      hasInstallments &&
      (req.installmentScheduleId || req.installmentNumber)
    ) {
      let startIndex = 0;

      if (req.installmentScheduleId) {
        const sch = scheduleById.get(String(req.installmentScheduleId));
        if (!sch || String(sch.invoiceLineItemId) !== String(li._id)) {
          throw new Error("Invalid installmentScheduleId for this line item");
        }
        startIndex = liSchedules.findIndex(
          (x) => String(x._id) === String(sch._id)
        );
        if (startIndex < 0) startIndex = 0;
      } else if (req.installmentNumber) {
        const idx = liSchedules.findIndex(
          (x) => x.installmentNumber === req.installmentNumber
        );
        if (idx < 0)
          throw new Error("Invalid installmentNumber for this line item");
        startIndex = idx;
      }

      const remainingAfter = paySchedulesFromIndex(startIndex, payableMinor);
      // Anything that couldn’t fit into remaining schedules becomes overpayment credit
      if (remainingAfter > 0) overpaymentMinor += remainingAfter;

      // Update line item totals by how much actually applied to schedules
      const appliedToLineItem = payableMinor - remainingAfter;
      li.amountPaidMinor += appliedToLineItem;
      li.amountOutstandingMinor = li.amountMinor - li.amountPaidMinor;
      li.isFullyPaid = li.amountOutstandingMinor <= 0;
      li.status = li.isFullyPaid
        ? "paid"
        : li.amountPaidMinor > 0
        ? "partially_paid"
        : "pending";

      continue;
    }

    // Auto-fill earliest unpaid installments
    if (hasInstallments) {
      const remainingAfter = paySchedulesFromIndex(0, payableMinor);
      if (remainingAfter > 0) overpaymentMinor += remainingAfter;

      const appliedToLineItem = payableMinor - remainingAfter;
      li.amountPaidMinor += appliedToLineItem;
      li.amountOutstandingMinor = li.amountMinor - li.amountPaidMinor;
      li.isFullyPaid = li.amountOutstandingMinor <= 0;
      li.status = li.isFullyPaid
        ? "paid"
        : li.amountPaidMinor > 0
        ? "partially_paid"
        : "pending";
      continue;
    }

    // Non-installment line item: direct apply
    li.amountPaidMinor += payableMinor;
    li.amountOutstandingMinor = li.amountMinor - li.amountPaidMinor;
    li.isFullyPaid = li.amountOutstandingMinor <= 0;
    li.status = li.isFullyPaid
      ? "paid"
      : li.amountPaidMinor > 0
      ? "partially_paid"
      : "pending";
    addChunk(null, payableMinor);
  }

  // Save schedules + line items
  for (const s of schedules) await s.save({ session });
  for (const li of lineItems) await li.save({ session });

  // Create allocations
  const createdAllocations: any[] = [];
  for (const chunk of mergedChunks.values()) {
    const [alloc] = await PaymentAllocation.create(
      [
        {
          paymentId,
          invoiceLineItemId: chunk.invoiceLineItemId,
          amountMinor: chunk.amountMinor,
          installmentScheduleId: chunk.installmentScheduleId,
          installmentNumber: chunk.installmentNumber,
          notes: chunk.notes || null,
        },
      ],
      { session }
    );
    createdAllocations.push(alloc);
  }

  return { createdAllocations, overpaymentMinor };
}
