import mongoose from "mongoose";
type LineItemLike = {
  _id: string | mongoose.Types.ObjectId;
  name: string;
  amountMinor: number;
  amountPaidMinor?: number;
  amountOutstandingMinor?: number;
  sortOrder?: number; // lower  = higher priority (Bursar controls)
  createdAt?: Date;
};

export type AllocationInput = {
  invoiceLineItemId: string;
  amountMinor: number;
};

export function getOutstandingMinor(li: LineItemLike) {
  if (typeof li.amountOutstandingMinor === "number")
    return Math.max(0, li.amountOutstandingMinor);
  const paid = li.amountPaidMinor ?? 0;
  return Math.max(0, (li.amountMinor ?? 0) - paid);
}

export function allocateToInvoiceLineItems(params: {
  lineItems: LineItemLike[];
  amountMinor: number;
  mode: "auto" | "manual";
  manualAllocations?: AllocationInput[];
}) {
  const { lineItems, amountMinor, mode, manualAllocations } = params;
  if (!Number.isFinite(amountMinor) || amountMinor <= 0) {
    return {
      allocations: [],
      allocatedMinor: 0,
      unallocatedMinor: Math.max(0, amountMinor),
    };
  }
  const items = [...lineItems];

  // priority: sortOrder asc, then createdAt asc

  items.sort((a, b) => {
    const ao = a.sortOrder ?? 9999;
    const bo = b.sortOrder ?? 9999;
    if (ao !== bo) return ao - bo;
    return (a.createdAt?.getTime?.() ?? 0) - (b.createdAt?.getTime?.() ?? 0);
  });

  const byId = new Map<string, LineItemLike>();

  // Normalize all IDs to ObjectId string representation for consistent comparison
  function normalizeId(id: string | mongoose.Types.ObjectId): string {
    if (mongoose.Types.ObjectId.isValid(id)) {
      try {
        const objId =
          id instanceof mongoose.Types.ObjectId
            ? id
            : new mongoose.Types.ObjectId(id);
        return objId.toString();
      } catch {
        return String(id);
      }
    }
    return String(id);
  }

  for (const li of items) {
    const normalizedId = normalizeId(li._id);
    byId.set(normalizedId, li);
  }
  const allocations: AllocationInput[] = [];

  if (mode === "manual") {
    const list = manualAllocations ?? [];
    let sum = 0;

    for (const a of list) {
      // Normalize the incoming ID
      const incomingId = normalizeId(a.invoiceLineItemId);
      const li = byId.get(incomingId);

      if (!li) {
        const availableIds = Array.from(byId.keys())
          .slice(0, 3)
          .map((id) => id.substring(0, 8) + "...")
          .join(", ");
        throw new Error(
          `Invalid invoice line item in allocations. Received: ${incomingId.substring(0, 8)}... Available: ${availableIds}`
        );
      }

      const outstanding = getOutstandingMinor(li);
      if (a.amountMinor <= 0) continue;
      if (a.amountMinor > outstanding)
        throw new Error("Allocation exceeds outstanding for: ${li.name");

      sum += a.amountMinor;
      if (sum > amountMinor)
        throw new Error("Allocation total exceeds payment/credit amount");

      allocations.push({
        invoiceLineItemId: String(a.invoiceLineItemId),
        amountMinor: a.amountMinor,
      });
    }

    return {
      allocations,
      allocatedMinor: sum,
      unallocatedMinor: Math.max(0, amountMinor - sum),
    };
  }

  // AUTO
  let remaining = amountMinor;
  for (const li of items) {
    if (remaining <= 0) break;
    const outstanding = getOutstandingMinor(li);
    if (outstanding <= 0) continue;

    const take = Math.min(remaining, outstanding);
    if (take > 0) {
      allocations.push({
        invoiceLineItemId: String(li._id),
        amountMinor: take,
      });
      remaining -= take;
    }
  }

  const allocatedMinor = amountMinor - remaining;
  return {
    allocations,
    allocatedMinor,
    unallocatedMinor: Math.max(0, remaining),
  };
}

export function ensureObjectId(id: string) {
  return new mongoose.Types.ObjectId(id);
}
