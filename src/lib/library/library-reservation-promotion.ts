import type { ClientSession } from "mongoose";
import mongoose from "mongoose";
import { LibraryBookCopy } from "@/models/LibraryBookCopy";
import { LibraryReservation } from "@/models/LibraryReservation";
import { syncBookCountersFromCopies } from "@/lib/library/library-book-counters";
import { reservationExpiresAtForReady } from "@/lib/library/library-reservation.constants";

/**
 * When a copy becomes `available`, assign the next pending reservation (FIFO) a copy and mark it `ready`.
 * Must run inside an existing transaction session.
 * @returns reservation id that became ready, or null
 */
export async function promoteNextPendingReservationForBook(
  session: ClientSession,
  schoolId: mongoose.Types.ObjectId,
  bookId: mongoose.Types.ObjectId,
  updatedByUserId?: mongoose.Types.ObjectId | null
): Promise<mongoose.Types.ObjectId | null> {
  const avail = await LibraryBookCopy.findOne({ schoolId, bookId, status: "available" })
    .sort({ createdAt: 1 })
    .session(session)
    .lean();
  if (!avail) return null;

  const next = await LibraryReservation.findOne({
    schoolId,
    bookId,
    status: "pending",
  })
    .sort({ queuePosition: 1, reservedAt: 1 })
    .session(session)
    .lean();

  if (!next) return null;

  const now = new Date();
  const expiresAt = reservationExpiresAtForReady(now);
  await LibraryReservation.updateOne(
    { _id: next._id, schoolId },
    {
      $set: {
        status: "ready",
        bookCopyId: avail._id,
        readyAt: now,
        expiresAt,
      },
    }
  ).session(session);

  await LibraryBookCopy.updateOne(
    { _id: avail._id, schoolId },
    {
      $set: {
        status: "reserved",
        ...(updatedByUserId ? { updatedBy: updatedByUserId } : {}),
      },
    }
  ).session(session);

  await syncBookCountersFromCopies(schoolId, bookId, session);
  return next._id as mongoose.Types.ObjectId;
}
