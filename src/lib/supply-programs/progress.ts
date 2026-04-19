import type { Types } from "mongoose";

import { StoreOrder } from "@/models/StoreOrder";

/**
 * Sum paid order line quantities per supply program line for a student.
 */
export async function getPaidQtyBySupplyLine(
  schoolId: Types.ObjectId,
  studentId: Types.ObjectId,
  lineIds: Types.ObjectId[]
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (lineIds.length === 0) return out;

  const idSet = new Set(lineIds.map((x) => String(x)));

  const orders = await StoreOrder.find({
    schoolId,
    studentId,
    status: "paid",
  })
    .select("lines")
    .lean();

  for (const o of orders) {
    for (const ln of o.lines || []) {
      const lid = ln.supplyProgramLineId;
      if (!lid) continue;
      const key = String(lid);
      if (!idSet.has(key)) continue;
      out.set(key, (out.get(key) ?? 0) + (ln.quantity || 0));
    }
  }

  return out;
}
