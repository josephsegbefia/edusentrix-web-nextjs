import type { ClientSession, Types } from "mongoose";
import { LibraryBook } from "@/models/LibraryBook";
import { LibraryBookCopy } from "@/models/LibraryBookCopy";

/**
 * Recomputes denormalized counters on `LibraryBook` from non-archived copies.
 * Call after any copy create/update/delete.
 */
export async function syncBookCountersFromCopies(
  schoolId: Types.ObjectId,
  bookId: Types.ObjectId,
  session?: ClientSession
): Promise<void> {
  const query = LibraryBookCopy.find({ schoolId, bookId });
  const copies = session ? await query.session(session).lean() : await query.lean();

  let totalCopies = 0;
  let availableCopies = 0;
  let borrowedCopies = 0;
  let lostCopies = 0;
  let damagedCopies = 0;
  let reservedCopies = 0;

  for (const c of copies) {
    if (c.status === "archived") continue;
    totalCopies += 1;
    switch (c.status) {
      case "available":
        availableCopies += 1;
        break;
      case "borrowed":
        borrowedCopies += 1;
        break;
      case "lost":
        lostCopies += 1;
        break;
      case "damaged":
        damagedCopies += 1;
        break;
      case "reserved":
        reservedCopies += 1;
        break;
      default:
        break;
    }
  }

  const op = LibraryBook.updateOne(
    { _id: bookId, schoolId },
    {
      $set: {
        totalCopies,
        availableCopies,
        borrowedCopies,
        lostCopies,
        damagedCopies,
        reservedCopies,
      },
    }
  );
  if (session) await op.session(session);
  else await op;
}

export function autoCopyCode(bookId: Types.ObjectId, indexZeroBased: number): string {
  const tail = bookIdToShortTail(bookId);
  return `AUTO-${tail}-${String(indexZeroBased + 1).padStart(3, "0")}`;
}

function bookIdToShortTail(bookId: Types.ObjectId): string {
  const hex = bookId.toHexString();
  return hex.slice(-6).toUpperCase();
}
