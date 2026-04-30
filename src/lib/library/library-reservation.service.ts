import mongoose from "mongoose";
import type { z } from "zod";
import { LibraryBook } from "@/models/LibraryBook";
import { LibraryBookCopy } from "@/models/LibraryBookCopy";
import type { ILibraryReservation } from "@/models/LibraryReservation";
import { LibraryReservation } from "@/models/LibraryReservation";
import type { LibraryBorrowerType } from "@/models/LibraryLoan";
import { assertBorrowerInSchool } from "@/lib/library/library-borrower.service";
import { syncBookCountersFromCopies } from "@/lib/library/library-book-counters";
import { getOrCreateLibrarySettings } from "@/lib/library/library-settings.service";
import {
  defaultLoanDueAtForBorrower,
  issueLibraryLoanFromReservedCopy,
} from "@/lib/library/library-loan.service";
import {
  enqueueLibraryLoanIssuedNotifications,
  notifyLibraryReservationsBecameReady,
} from "@/lib/library/library-notifications";
import { auditLibraryReservationExpired } from "@/lib/library/library-audit";
import {
  reservationExpiresAtForPending,
  reservationExpiresAtForReady,
  stalePendingReservedAtCutoff,
  staleReadyReadyAtCutoff,
} from "@/lib/library/library-reservation.constants";
import { promoteNextPendingReservationForBook } from "@/lib/library/library-reservation-promotion";
import type {
  createLibraryReservationBodySchema,
  listLibraryReservationsQuerySchema,
} from "@/lib/library/library.validators";
import { Student } from "@/models/Student";
import { Teacher } from "@/models/Teacher";
import { User } from "@/models/User";

type ListQuery = z.infer<typeof listLibraryReservationsQuerySchema>;
type CreateBody = z.infer<typeof createLibraryReservationBodySchema>;

export type LibraryReservationListDTO = {
  id: string;
  schoolId: string;
  bookId: string;
  bookTitle: string;
  bookCopyId?: string;
  copyCode?: string;
  borrowerType: LibraryBorrowerType;
  borrowerId: string;
  borrowerName: string;
  status: ILibraryReservation["status"];
  queuePosition: number;
  reservedAt: string;
  readyAt?: string;
  expiresAt?: string;
  fulfilledAt?: string;
  cancelledAt?: string;
  updatedAt: string;
};

function isDupKey(err: unknown): boolean {
  return Boolean(
    err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code?: number }).code === 11000
  );
}

async function nextPendingQueuePosition(
  session: mongoose.ClientSession | null,
  schoolId: mongoose.Types.ObjectId,
  bookId: mongoose.Types.ObjectId
): Promise<number> {
  const q = LibraryReservation.findOne({ schoolId, bookId, status: "pending" })
    .sort({ queuePosition: -1 })
    .select("queuePosition");
  const last = session
    ? await q.session(session).lean<{ queuePosition: number } | null>()
    : await q.lean();
  return (last?.queuePosition ?? 0) + 1;
}

async function renumberPendingQueue(
  session: mongoose.ClientSession,
  schoolId: mongoose.Types.ObjectId,
  bookId: mongoose.Types.ObjectId
): Promise<void> {
  const rows = await LibraryReservation.find({ schoolId, bookId, status: "pending" })
    .sort({ queuePosition: 1, reservedAt: 1 })
    .session(session)
    .select("_id")
    .lean();
  let pos = 1;
  for (const r of rows) {
    await LibraryReservation.updateOne({ _id: r._id }, { $set: { queuePosition: pos } }).session(
      session
    );
    pos += 1;
  }
}

/**
 * Mongo filter fragment: pending/ready holds that are past `expiresAt` or legacy age cutoffs.
 * Use as `{ ...staleLibraryReservationMatch(now) }` or `distinct("schoolId", match)` for cron.
 */
export function staleLibraryReservationMatch(now = new Date()): {
  $or: Record<string, unknown>[];
} {
  const pendingCutoff = stalePendingReservedAtCutoff(now);
  const readyCutoff = staleReadyReadyAtCutoff(now);
  return {
    $or: [
      { status: { $in: ["pending", "ready"] }, expiresAt: { $lte: now } },
      {
        status: "pending",
        $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }],
        reservedAt: { $lte: pendingCutoff },
      },
      {
        status: "ready",
        $and: [
          { $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }] },
          {
            $or: [
              { readyAt: { $lte: readyCutoff } },
              {
                $and: [
                  { $or: [{ readyAt: { $exists: false } }, { readyAt: null }] },
                  { reservedAt: { $lte: pendingCutoff } },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
}

/**
 * Marks holds past `expiresAt` (or legacy age cutoffs) as `expired`, releases copies, renumbers queue,
 * and may promote the next patron. Idempotent per reservation.
 */
export async function expireStaleLibraryReservationsForSchool(
  schoolId: mongoose.Types.ObjectId
): Promise<{ promotedReservationIds: mongoose.Types.ObjectId[] }> {
  const now = new Date();
  const pendingCutoff = stalePendingReservedAtCutoff(now);
  const readyCutoff = staleReadyReadyAtCutoff(now);

  const stale = await LibraryReservation.find({
    schoolId,
    ...staleLibraryReservationMatch(now),
  })
    .sort({ reservedAt: 1 })
    .lean<ILibraryReservation[]>();

  stale.sort((a, b) => {
    const ar = a.status === "ready" ? 0 : 1;
    const br = b.status === "ready" ? 0 : 1;
    if (ar !== br) return ar - br;
    return new Date(a.reservedAt).getTime() - new Date(b.reservedAt).getTime();
  });

  const promotedReservationIds: mongoose.Types.ObjectId[] = [];

  for (const row of stale) {
    const auditRef: {
      current: {
        reservationId: mongoose.Types.ObjectId;
        metadata: Record<string, unknown>;
      } | null;
    } = { current: null };
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const fresh = await LibraryReservation.findOne({
          _id: row._id,
          schoolId,
          status: { $in: ["pending", "ready"] },
        })
          .session(session)
          .lean<ILibraryReservation | null>();
        if (!fresh) return;

        const nowT = new Date();
        if (fresh.expiresAt && fresh.expiresAt.getTime() > nowT.getTime()) return;

        if (!fresh.expiresAt) {
          if (fresh.status === "pending") {
            if (fresh.reservedAt.getTime() > pendingCutoff.getTime()) return;
          } else {
            const readyStale =
              (Boolean(fresh.readyAt) &&
                fresh.readyAt!.getTime() <= readyCutoff.getTime()) ||
              (!fresh.readyAt && fresh.reservedAt.getTime() <= pendingCutoff.getTime());
            if (!readyStale) return;
          }
        }

        if (fresh.status === "ready" && fresh.bookCopyId) {
          await LibraryBookCopy.updateOne(
            { _id: fresh.bookCopyId, schoolId },
            { $set: { status: "available" } }
          ).session(session);
          await LibraryReservation.updateOne(
            { _id: fresh._id, schoolId },
            {
              $set: { status: "expired" },
              $unset: { bookCopyId: "" },
            }
          ).session(session);
          await syncBookCountersFromCopies(schoolId, fresh.bookId, session);
          await renumberPendingQueue(session, schoolId, fresh.bookId);
          const pid = await promoteNextPendingReservationForBook(
            session,
            schoolId,
            fresh.bookId
          );
          if (pid) promotedReservationIds.push(pid);
          auditRef.current = {
            reservationId: fresh._id as mongoose.Types.ObjectId,
            metadata: {
              bookId: String(fresh.bookId),
              borrowerType: fresh.borrowerType,
              borrowerId: String(fresh.borrowerId),
              priorStatus: "ready",
              reason: "stale_hold",
            },
          };
        } else if (fresh.status === "pending") {
          await LibraryReservation.updateOne(
            { _id: fresh._id, schoolId },
            { $set: { status: "expired" } }
          ).session(session);
          await renumberPendingQueue(session, schoolId, fresh.bookId);
          auditRef.current = {
            reservationId: fresh._id as mongoose.Types.ObjectId,
            metadata: {
              bookId: String(fresh.bookId),
              borrowerType: fresh.borrowerType,
              borrowerId: String(fresh.borrowerId),
              priorStatus: "pending",
              reason: "stale_hold",
            },
          };
        }
      });
    } finally {
      await session.endSession();
    }
    if (auditRef.current) {
      await auditLibraryReservationExpired(
        schoolId,
        auditRef.current.reservationId,
        auditRef.current.metadata
      );
    }
  }

  const uniq = [...new Set(promotedReservationIds.map(String))].map(
    (s) => new mongoose.Types.ObjectId(s)
  );
  if (uniq.length > 0) {
    await notifyLibraryReservationsBecameReady(schoolId, uniq);
  }
  return { promotedReservationIds: uniq };
}

export async function libraryReservationListFromDocs(
  schoolId: mongoose.Types.ObjectId,
  rows: ILibraryReservation[]
): Promise<LibraryReservationListDTO[]> {
  if (rows.length === 0) return [];

  const bookIds = [...new Set(rows.map((r) => String(r.bookId)))].map(
    (id) => new mongoose.Types.ObjectId(id)
  );
  const copyIds = rows
    .map((r) => r.bookCopyId)
    .filter(Boolean)
    .map((id) => new mongoose.Types.ObjectId(String(id)));
  const studentIds = rows
    .filter((r) => r.borrowerType === "student")
    .map((r) => r.borrowerId);
  const teacherIds = rows
    .filter((r) => r.borrowerType === "teacher")
    .map((r) => r.borrowerId);
  const staffIds = rows
    .filter((r) => r.borrowerType === "staff")
    .map((r) => r.borrowerId);

  const [books, copies, students, teachers, staffUsers] = await Promise.all([
    LibraryBook.find({ _id: { $in: bookIds }, schoolId }).select("title").lean(),
    copyIds.length
      ? LibraryBookCopy.find({ _id: { $in: copyIds }, schoolId }).select("copyCode").lean()
      : [],
    studentIds.length
      ? Student.find({ _id: { $in: studentIds }, schoolId })
          .select("firstName lastName")
          .lean()
      : [],
    teacherIds.length
      ? Teacher.find({ _id: { $in: teacherIds }, schoolId })
          .select("userId")
          .populate("userId", "firstName lastName")
          .lean()
      : [],
    staffIds.length
      ? User.find({ _id: { $in: staffIds } }).select("firstName lastName").lean()
      : [],
  ]);

  const bookMap = new Map(books.map((b) => [String(b._id), b]));
  const copyMap = new Map(copies.map((c) => [String(c._id), c]));
  const studentMap = new Map(students.map((s) => [String(s._id), s]));
  const teacherMap = new Map(teachers.map((t) => [String(t._id), t]));
  const staffMap = new Map(staffUsers.map((u) => [String(u._id), u]));

  return rows.map((r) => {
    const book = bookMap.get(String(r.bookId));
    const copy = r.bookCopyId ? copyMap.get(String(r.bookCopyId)) : undefined;

    let borrowerName = "Borrower";
    if (r.borrowerType === "student") {
      const s = studentMap.get(String(r.borrowerId)) as
        | { firstName?: string; lastName?: string }
        | undefined;
      if (s) borrowerName = `${s.firstName ?? ""} ${s.lastName ?? ""}`.trim() || borrowerName;
    } else if (r.borrowerType === "teacher") {
      const t = teacherMap.get(String(r.borrowerId)) as
        | { userId?: { firstName?: string; lastName?: string } }
        | undefined;
      const u = t?.userId;
      if (u) borrowerName = `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || borrowerName;
    } else {
      const u = staffMap.get(String(r.borrowerId)) as
        | { firstName?: string; lastName?: string }
        | undefined;
      if (u) borrowerName = `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || borrowerName;
    }

    return {
      id: String(r._id),
      schoolId: String(r.schoolId),
      bookId: String(r.bookId),
      bookTitle: (book as { title?: string } | undefined)?.title ?? "—",
      bookCopyId: r.bookCopyId ? String(r.bookCopyId) : undefined,
      copyCode: (copy as { copyCode?: string } | undefined)?.copyCode,
      borrowerType: r.borrowerType,
      borrowerId: String(r.borrowerId),
      borrowerName,
      status: r.status,
      queuePosition: r.queuePosition,
      reservedAt: r.reservedAt.toISOString(),
      readyAt: r.readyAt?.toISOString(),
      expiresAt: r.expiresAt?.toISOString(),
      fulfilledAt: r.fulfilledAt?.toISOString(),
      cancelledAt: r.cancelledAt?.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  });
}

function buildReservationFilter(
  schoolId: mongoose.Types.ObjectId,
  q: ListQuery
): Record<string, unknown> {
  const filter: Record<string, unknown> = { schoolId };
  if (q.bookId?.trim() && mongoose.Types.ObjectId.isValid(q.bookId.trim())) {
    filter.bookId = new mongoose.Types.ObjectId(q.bookId.trim());
  }
  if (q.borrowerType) filter.borrowerType = q.borrowerType;
  if (q.borrowerId?.trim() && mongoose.Types.ObjectId.isValid(q.borrowerId.trim())) {
    filter.borrowerId = new mongoose.Types.ObjectId(q.borrowerId.trim());
  }
  if (q.status) filter.status = q.status;
  return filter;
}

export async function listLibraryReservations(
  schoolId: mongoose.Types.ObjectId,
  q: ListQuery
): Promise<{ items: LibraryReservationListDTO[]; total: number }> {
  await expireStaleLibraryReservationsForSchool(schoolId);
  const filter = buildReservationFilter(schoolId, q);
  const skip = (q.page - 1) * q.limit;
  const [raw, total] = await Promise.all([
    LibraryReservation.find(filter)
      .sort({ reservedAt: -1 })
      .skip(skip)
      .limit(q.limit)
      .lean<ILibraryReservation[]>(),
    LibraryReservation.countDocuments(filter),
  ]);
  const items = await libraryReservationListFromDocs(schoolId, raw);
  return { items, total };
}

export async function listPatronLibraryReservations(
  schoolId: mongoose.Types.ObjectId,
  borrowerType: LibraryBorrowerType,
  borrowerId: mongoose.Types.ObjectId
): Promise<LibraryReservationListDTO[]> {
  await expireStaleLibraryReservationsForSchool(schoolId);
  const raw = await LibraryReservation.find({
    schoolId,
    borrowerType,
    borrowerId,
    status: { $in: ["pending", "ready"] },
  })
    .sort({ reservedAt: -1 })
    .lean<ILibraryReservation[]>();
  return libraryReservationListFromDocs(schoolId, raw);
}

export async function listParentWardLibraryReservations(
  schoolId: mongoose.Types.ObjectId,
  wardStudentIds: mongoose.Types.ObjectId[],
  opts?: { bookId?: mongoose.Types.ObjectId }
): Promise<LibraryReservationListDTO[]> {
  if (wardStudentIds.length === 0) return [];
  await expireStaleLibraryReservationsForSchool(schoolId);
  const filter: Record<string, unknown> = {
    schoolId,
    borrowerType: "student",
    borrowerId: { $in: wardStudentIds },
    status: { $in: ["pending", "ready"] },
  };
  if (opts?.bookId) filter.bookId = opts.bookId;
  const raw = await LibraryReservation.find(filter)
    .sort({ reservedAt: -1 })
    .lean<ILibraryReservation[]>();
  return libraryReservationListFromDocs(schoolId, raw);
}

export async function getLibraryReservationById(
  schoolId: mongoose.Types.ObjectId,
  reservationId: mongoose.Types.ObjectId
): Promise<ILibraryReservation | null> {
  return LibraryReservation.findOne({ _id: reservationId, schoolId }).lean<ILibraryReservation | null>();
}

export async function createLibraryReservation(
  schoolId: mongoose.Types.ObjectId,
  actorUserId: mongoose.Types.ObjectId,
  body: CreateBody
): Promise<ILibraryReservation> {
  if (!mongoose.Types.ObjectId.isValid(body.bookId)) throw new Error("Invalid book id");
  if (!mongoose.Types.ObjectId.isValid(body.borrowerId)) throw new Error("Invalid borrower id");

  const bookOid = new mongoose.Types.ObjectId(body.bookId);
  const borrowerOid = new mongoose.Types.ObjectId(body.borrowerId);

  const book = await LibraryBook.findOne({ _id: bookOid, schoolId, status: "active" })
    .select("_id")
    .lean();
  if (!book) throw new Error("Book not found or inactive");

  await assertBorrowerInSchool(schoolId, body.borrowerType, borrowerOid);

  const session = await mongoose.startSession();
  const out: { doc: ILibraryReservation | null } = { doc: null };

  try {
    await session.withTransaction(async () => {
      const pendingCount = await LibraryReservation.countDocuments({
        schoolId,
        bookId: bookOid,
        status: "pending",
      }).session(session);

      let avail: { _id: mongoose.Types.ObjectId } | null = null;
      if (pendingCount === 0) {
        avail = await LibraryBookCopy.findOne({ schoolId, bookId: bookOid, status: "available" })
          .sort({ createdAt: 1 })
          .session(session)
          .select("_id")
          .lean();
      }

      const queuePosition = await nextPendingQueuePosition(session, schoolId, bookOid);
      const now = new Date();
      const isReady = Boolean(avail);
      const expiresAt = isReady
        ? reservationExpiresAtForReady(now)
        : reservationExpiresAtForPending(now);

      const docs = await LibraryReservation.create(
        [
          {
            schoolId,
            bookId: bookOid,
            bookCopyId: isReady ? avail!._id : undefined,
            borrowerType: body.borrowerType,
            borrowerId: borrowerOid,
            status: isReady ? ("ready" as const) : ("pending" as const),
            queuePosition,
            reservedAt: now,
            readyAt: isReady ? now : undefined,
            expiresAt,
          },
        ],
        { session }
      );
      const row = docs[0];
      if (isReady && avail) {
        await LibraryBookCopy.updateOne(
          { _id: avail._id, schoolId },
          { $set: { status: "reserved", updatedBy: actorUserId } }
        ).session(session);
        await syncBookCountersFromCopies(schoolId, bookOid, session);
      }
      out.doc = await LibraryReservation.findById(row._id).session(session).lean<ILibraryReservation | null>();
    });
  } catch (e) {
    if (isDupKey(e)) {
      throw new Error("This patron already has an active reservation for this title");
    }
    throw e;
  } finally {
    await session.endSession();
  }

  if (!out.doc) throw new Error("Failed to create reservation");
  if (out.doc.status === "ready") {
    await notifyLibraryReservationsBecameReady(schoolId, [out.doc._id as mongoose.Types.ObjectId]);
  }
  return out.doc;
}

export async function cancelLibraryReservation(
  schoolId: mongoose.Types.ObjectId,
  actorUserId: mongoose.Types.ObjectId,
  reservationId: mongoose.Types.ObjectId
): Promise<ILibraryReservation | null> {
  const session = await mongoose.startSession();
  let result: ILibraryReservation | null = null;
  let promotedNext: mongoose.Types.ObjectId | null = null;

  try {
    await session.withTransaction(async () => {
      const res = await LibraryReservation.findOne({ _id: reservationId, schoolId }).session(session).lean<
        ILibraryReservation | null
      >();
      if (!res) return;
      if (res.status === "cancelled" || res.status === "fulfilled" || res.status === "expired") {
        throw new Error("Reservation is already closed");
      }

      const now = new Date();

      if (res.status === "ready" && res.bookCopyId) {
        await LibraryBookCopy.updateOne(
          { _id: res.bookCopyId, schoolId },
          { $set: { status: "available", updatedBy: actorUserId } }
        ).session(session);
        await LibraryReservation.updateOne(
          { _id: reservationId, schoolId },
          {
            $set: { status: "cancelled", cancelledAt: now },
            $unset: { bookCopyId: "" },
          }
        ).session(session);
        await syncBookCountersFromCopies(schoolId, res.bookId, session);
        await renumberPendingQueue(session, schoolId, res.bookId);
        promotedNext = await promoteNextPendingReservationForBook(
          session,
          schoolId,
          res.bookId,
          actorUserId
        );
      } else {
        await LibraryReservation.updateOne(
          { _id: reservationId, schoolId },
          { $set: { status: "cancelled", cancelledAt: now } }
        ).session(session);
        await renumberPendingQueue(session, schoolId, res.bookId);
      }

      result = await LibraryReservation.findById(reservationId).session(session).lean<
        ILibraryReservation | null
      >();
    });
  } finally {
    await session.endSession();
  }

  await notifyLibraryReservationsBecameReady(schoolId, [promotedNext]);

  return result;
}

export async function fulfillLibraryReservation(
  schoolId: mongoose.Types.ObjectId,
  staffUserId: mongoose.Types.ObjectId,
  reservationId: mongoose.Types.ObjectId
): Promise<{ reservation: ILibraryReservation; loanId: mongoose.Types.ObjectId } | null> {
  const session = await mongoose.startSession();
  let out: { reservation: ILibraryReservation; loanId: mongoose.Types.ObjectId } | null = null;
  let promotedNext: mongoose.Types.ObjectId | null = null;

  try {
    await session.withTransaction(async () => {
      const res = await LibraryReservation.findOne({ _id: reservationId, schoolId }).session(session).lean<
        ILibraryReservation | null
      >();
      if (!res || res.status !== "ready") return;
      if (!res.bookCopyId) throw new Error("Reservation has no copy assigned");

      const settings = await getOrCreateLibrarySettings(schoolId);
      const dueAt = defaultLoanDueAtForBorrower(settings, res.borrowerType, new Date());

      const loan = await issueLibraryLoanFromReservedCopy(session, schoolId, staffUserId, {
        bookId: res.bookId,
        bookCopyId: res.bookCopyId,
        borrowerType: res.borrowerType,
        borrowerId: res.borrowerId,
        dueAt,
      });

      const now = new Date();
      await LibraryReservation.updateOne(
        { _id: reservationId, schoolId },
        {
          $set: {
            status: "fulfilled",
            fulfilledAt: now,
          },
        }
      ).session(session);

      const updated = await LibraryReservation.findById(reservationId).session(session).lean<
        ILibraryReservation | null
      >();
      if (updated) {
        out = { reservation: updated, loanId: loan._id as mongoose.Types.ObjectId };

        promotedNext = await promoteNextPendingReservationForBook(
          session,
          schoolId,
          res.bookId,
          staffUserId
        );
      }
    });
  } finally {
    await session.endSession();
  }

  await notifyLibraryReservationsBecameReady(schoolId, [promotedNext]);

  if (out) {
    await enqueueLibraryLoanIssuedNotifications({
      schoolId,
      loanIds: [out.loanId],
    });
  }

  return out;
}

/** Patron cancels their own hold (pending or ready). */
export async function cancelPatronLibraryReservation(
  schoolId: mongoose.Types.ObjectId,
  patronUserId: mongoose.Types.ObjectId,
  reservationId: mongoose.Types.ObjectId,
  borrowerType: LibraryBorrowerType,
  borrowerId: mongoose.Types.ObjectId
): Promise<ILibraryReservation | null> {
  const res = await LibraryReservation.findOne({ _id: reservationId, schoolId }).lean<
    ILibraryReservation | null
  >();
  if (!res) return null;
  if (res.borrowerType !== borrowerType || String(res.borrowerId) !== String(borrowerId)) {
    throw new Error("Not allowed to cancel this reservation");
  }
  return cancelLibraryReservation(schoolId, patronUserId, reservationId);
}

export async function cancelParentLibraryReservation(
  schoolId: mongoose.Types.ObjectId,
  parentUserId: mongoose.Types.ObjectId,
  reservationId: mongoose.Types.ObjectId,
  wardStudentIds: mongoose.Types.ObjectId[]
): Promise<ILibraryReservation | null> {
  const res = await LibraryReservation.findOne({ _id: reservationId, schoolId }).lean<
    ILibraryReservation | null
  >();
  if (!res) return null;
  if (res.borrowerType !== "student") {
    throw new Error("Not allowed to cancel this reservation");
  }
  const allowed = wardStudentIds.some((id) => String(id) === String(res.borrowerId));
  if (!allowed) {
    throw new Error("Not allowed to cancel this reservation");
  }
  return cancelLibraryReservation(schoolId, parentUserId, reservationId);
}
