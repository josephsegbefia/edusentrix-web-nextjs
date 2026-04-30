import mongoose from "mongoose";
import type { ClientSession } from "mongoose";
import type { z } from "zod";
import { LibraryBook } from "@/models/LibraryBook";
import { LibraryBookCopy, type ILibraryBookCopy } from "@/models/LibraryBookCopy";
import {
  LibraryLoan,
  type ILibraryLoan,
  type LibraryBorrowerType,
  type LibraryLoanStatus,
} from "@/models/LibraryLoan";
import { promoteNextPendingReservationForBook } from "@/lib/library/library-reservation-promotion";
import { notifyLibraryReservationsBecameReady } from "@/lib/library/library-notifications";
import { getOrCreateLibrarySettings } from "@/lib/library/library-settings.service";
import type { ILibrarySettings } from "@/models/LibrarySettings";
import { assertBorrowerInSchool } from "@/lib/library/library-borrower.service";
import { syncBookCountersFromCopies } from "@/lib/library/library-book-counters";
import { computeAutoFineOnReturn } from "@/lib/library/library-fines";
import { stubLibraryFeeChargeIntent } from "@/lib/library/library-fee-hook";
import { persistStudentLibraryReturnFees } from "@/lib/library/library-fee-persistence";
import { enqueueLibraryLoanIssuedNotifications } from "@/lib/library/library-notifications";
import { markOpenLoansOverdueForSchool } from "@/lib/library/library-jobs";
import type {
  issueLibraryLoanSchema,
  listLibraryLoansQuerySchema,
  renewLibraryLoanSchema,
  returnLibraryLoanSchema,
} from "@/lib/library/library.validators";
import {
  buildLibraryLoanListDTO,
  type LibraryLoanListDTO,
} from "@/lib/library/library.serialize";
import { ClassGroup } from "@/models/ClassGroup";
import { Student } from "@/models/Student";
import { Teacher } from "@/models/Teacher";
import { User } from "@/models/User";

type IssueLoan = z.infer<typeof issueLibraryLoanSchema>;
type ReturnLoan = z.infer<typeof returnLibraryLoanSchema>;
type RenewLoan = z.infer<typeof renewLibraryLoanSchema>;
type ListLoans = z.infer<typeof listLibraryLoansQuerySchema>;

function maxBooksForBorrower(settings: ILibrarySettings, borrowerType: string): number {
  if (borrowerType === "student") return settings.maxBooksPerStudent;
  if (borrowerType === "teacher") return settings.maxBooksPerTeacher;
  return settings.maxBooksPerStaff;
}

export function defaultLoanDueAtForBorrower(
  settings: ILibrarySettings,
  borrowerType: LibraryBorrowerType,
  from: Date = new Date()
): Date {
  const days =
    borrowerType === "student"
      ? settings.defaultLoanDaysStudent
      : borrowerType === "teacher"
        ? settings.defaultLoanDaysTeacher
        : settings.defaultLoanDaysStaff;
  const d = new Date(from.getTime());
  d.setDate(d.getDate() + Math.max(1, days));
  return d;
}

function buildLoanFilter(
  schoolId: mongoose.Types.ObjectId,
  bucket: ListLoans["bucket"]
): Record<string, unknown> {
  const now = new Date();
  const base: Record<string, unknown> = { schoolId };
  if (bucket === "open") return { ...base, isOpen: true };
  if (bucket === "overdue") return { ...base, isOpen: true, dueAt: { $lt: now } };
  if (bucket === "returned") return { ...base, isOpen: false };
  if (bucket === "fines_pending") {
    return { ...base, isOpen: false, fineStatus: "pending" as const };
  }
  return base;
}

function listSort(q: ListLoans): Record<string, 1 | -1> {
  const dir: 1 | -1 = q.sortOrder === "asc" ? 1 : -1;
  if (q.bucket === "overdue" && q.sortBy === "dueAt") return { dueAt: 1 };
  if (q.sortBy === "dueAt") return { dueAt: dir };
  if (q.sortBy === "returnedAt") return { returnedAt: dir };
  return { issuedAt: dir };
}

export async function countOpenLoansForBorrower(
  schoolId: mongoose.Types.ObjectId,
  borrowerType: string,
  borrowerId: mongoose.Types.ObjectId
): Promise<number> {
  return LibraryLoan.countDocuments({
    schoolId,
    borrowerType,
    borrowerId,
    isOpen: true,
  });
}

export async function issueLibraryLoan(
  schoolId: mongoose.Types.ObjectId,
  userId: mongoose.Types.ObjectId,
  input: IssueLoan
): Promise<ILibraryLoan> {
  if (!mongoose.Types.ObjectId.isValid(input.bookId)) throw new Error("Invalid book id");
  if (!mongoose.Types.ObjectId.isValid(input.bookCopyId)) throw new Error("Invalid copy id");
  if (!mongoose.Types.ObjectId.isValid(input.borrowerId)) throw new Error("Invalid borrower id");

  const bookOid = new mongoose.Types.ObjectId(input.bookId);
  const copyOid = new mongoose.Types.ObjectId(input.bookCopyId);
  const borrowerOid = new mongoose.Types.ObjectId(input.borrowerId);

  const issuedAt = new Date();
  if (input.dueAt.getTime() < issuedAt.getTime() - 60_000) {
    throw new Error("Due date must be on or after issue time");
  }

  await assertBorrowerInSchool(schoolId, input.borrowerType, borrowerOid);

  const settings = await getOrCreateLibrarySettings(schoolId);
  const openCount = await countOpenLoansForBorrower(
    schoolId,
    input.borrowerType,
    borrowerOid
  );
  const cap = maxBooksForBorrower(settings, input.borrowerType);
  if (openCount >= cap) {
    throw new Error(`Borrower has reached the maximum of ${cap} open loans`);
  }

  const book = await LibraryBook.findOne({ _id: bookOid, schoolId }).select("_id").lean();
  if (!book) throw new Error("Book not found");

  const session = await mongoose.startSession();
  let created: ILibraryLoan | null = null;

  try {
    await session.withTransaction(async () => {
      const copy = await LibraryBookCopy.findOne({
        _id: copyOid,
        schoolId,
        bookId: bookOid,
      })
        .session(session)
        .lean<ILibraryBookCopy | null>();

      if (!copy) throw new Error("Copy not found for this book");
      if (copy.status !== "available") throw new Error("Copy is not available to borrow");

      const existingOpen = await LibraryLoan.findOne({
        schoolId,
        bookCopyId: copyOid,
        isOpen: true,
      })
        .session(session)
        .select("_id")
        .lean();
      if (existingOpen) throw new Error("This copy already has an open loan");

      const docs = await LibraryLoan.create(
        [
          {
            schoolId,
            bookId: bookOid,
            bookCopyId: copyOid,
            borrowerType: input.borrowerType,
            borrowerId: borrowerOid,
            issuedBy: userId,
            issuedAt,
            dueAt: input.dueAt,
            status: "active" as LibraryLoanStatus,
            isOpen: true,
            renewalCount: 0,
            fineAmount: 0,
            fineStatus: "none",
            notes: input.notes?.trim() || undefined,
          },
        ],
        { session }
      );
      const loan = docs[0];
      created = (await LibraryLoan.findById(loan._id).session(session).lean<ILibraryLoan | null>())!;

      await LibraryBookCopy.updateOne(
        { _id: copyOid, schoolId },
        { $set: { status: "borrowed", updatedBy: userId } }
      ).session(session);

      await syncBookCountersFromCopies(schoolId, bookOid, session);
    });
  } finally {
    await session.endSession();
  }

  if (!created) throw new Error("Failed to create loan");
  await enqueueLibraryLoanIssuedNotifications({
    schoolId,
    loanIds: [created._id as mongoose.Types.ObjectId],
  });
  return created;
}

/** Issue loan when copy is `reserved` (hold ready for pickup). Caller must run inside a transaction. */
export async function issueLibraryLoanFromReservedCopy(
  session: ClientSession,
  schoolId: mongoose.Types.ObjectId,
  staffUserId: mongoose.Types.ObjectId,
  input: {
    bookId: mongoose.Types.ObjectId;
    bookCopyId: mongoose.Types.ObjectId;
    borrowerType: LibraryBorrowerType;
    borrowerId: mongoose.Types.ObjectId;
    dueAt: Date;
    notes?: string;
  }
): Promise<ILibraryLoan> {
  await assertBorrowerInSchool(schoolId, input.borrowerType, input.borrowerId);
  const settings = await getOrCreateLibrarySettings(schoolId);
  const openCount = await LibraryLoan.countDocuments({
    schoolId,
    borrowerType: input.borrowerType,
    borrowerId: input.borrowerId,
    isOpen: true,
  }).session(session);
  const cap = maxBooksForBorrower(settings, input.borrowerType);
  if (openCount >= cap) {
    throw new Error(`Borrower has reached the maximum of ${cap} open loans`);
  }

  const book = await LibraryBook.findOne({ _id: input.bookId, schoolId })
    .select("_id")
    .session(session)
    .lean();
  if (!book) throw new Error("Book not found");

  const issuedAt = new Date();
  if (input.dueAt.getTime() < issuedAt.getTime() - 60_000) {
    throw new Error("Due date must be on or after issue time");
  }

  const copy = await LibraryBookCopy.findOne({
    _id: input.bookCopyId,
    schoolId,
    bookId: input.bookId,
  })
    .session(session)
    .lean<ILibraryBookCopy | null>();

  if (!copy) throw new Error("Copy not found for this book");
  if (copy.status !== "reserved") throw new Error("Copy is not reserved for pickup");

  const existingOpen = await LibraryLoan.findOne({
    schoolId,
    bookCopyId: input.bookCopyId,
    isOpen: true,
  })
    .session(session)
    .select("_id")
    .lean();
  if (existingOpen) throw new Error("This copy already has an open loan");

  const docs = await LibraryLoan.create(
    [
      {
        schoolId,
        bookId: input.bookId,
        bookCopyId: input.bookCopyId,
        borrowerType: input.borrowerType,
        borrowerId: input.borrowerId,
        issuedBy: staffUserId,
        issuedAt,
        dueAt: input.dueAt,
        status: "active" as LibraryLoanStatus,
        isOpen: true,
        renewalCount: 0,
        fineAmount: 0,
        fineStatus: "none",
        notes: input.notes?.trim() || undefined,
      },
    ],
    { session }
  );
  const loan = docs[0];
  const created = await LibraryLoan.findById(loan._id).session(session).lean<ILibraryLoan | null>();
  if (!created) throw new Error("Failed to create loan");

  await LibraryBookCopy.updateOne(
    { _id: input.bookCopyId, schoolId },
    { $set: { status: "borrowed", updatedBy: staffUserId } }
  ).session(session);

  await syncBookCountersFromCopies(schoolId, input.bookId, session);
  return created;
}

export async function returnLibraryLoan(
  schoolId: mongoose.Types.ObjectId,
  userId: mongoose.Types.ObjectId,
  loanId: mongoose.Types.ObjectId,
  input: ReturnLoan
): Promise<ILibraryLoan | null> {
  const returnedAt = input.returnedAt ?? new Date();

  const session = await mongoose.startSession();
  let result: ILibraryLoan | null = null;
  let promotedReservationId: mongoose.Types.ObjectId | null = null;

  try {
    await session.withTransaction(async () => {
      const loan = await LibraryLoan.findOne({ _id: loanId, schoolId })
        .session(session)
        .lean<ILibraryLoan | null>();
      if (!loan) return;
      if (!loan.isOpen) throw new Error("Loan is already closed");

      const settings = await getOrCreateLibrarySettings(schoolId);
      let fineAmount: number;
      if (input.fineAmount !== undefined && Number.isFinite(input.fineAmount)) {
        fineAmount = input.fineAmount;
      } else if (settings.enableFines) {
        fineAmount = computeAutoFineOnReturn(loan, settings, returnedAt);
      } else {
        fineAmount = 0;
      }
      if (!settings.enableFines) fineAmount = 0;
      const fineStatus: ILibraryLoan["fineStatus"] = fineAmount > 0 ? "pending" : "none";

      let replacementFeeAmount = input.replacementFeeAmount ?? 0;
      if (!settings.enableReplacementFees) replacementFeeAmount = 0;
      const replacementFeeStatus =
        replacementFeeAmount > 0 ? ("pending" as const) : ("none" as const);

      let linkedFeeId: mongoose.Types.ObjectId | undefined;
      if (input.createFeeCharge && (fineAmount > 0 || replacementFeeAmount > 0)) {
        if (loan.borrowerType === "student") {
          const id = await persistStudentLibraryReturnFees({
            session,
            schoolId,
            studentId: loan.borrowerId as mongoose.Types.ObjectId,
            performedBy: userId,
            loanId,
            fineAmountMajor: fineAmount,
            replacementFeeAmountMajor: replacementFeeAmount,
          });
          if (id) linkedFeeId = id;
        } else {
          if (fineAmount > 0) {
            stubLibraryFeeChargeIntent({
              schoolId: String(schoolId),
              loanId: String(loanId),
              kind: "overdue_fine",
              amount: fineAmount,
              borrowerType: loan.borrowerType,
              borrowerId: String(loan.borrowerId),
            });
          }
          if (replacementFeeAmount > 0) {
            stubLibraryFeeChargeIntent({
              schoolId: String(schoolId),
              loanId: String(loanId),
              kind: "replacement",
              amount: replacementFeeAmount,
              borrowerType: loan.borrowerType,
              borrowerId: String(loan.borrowerId),
            });
          }
        }
      }

      let finalStatus: LibraryLoanStatus = "returned";
      if (input.returnCondition === "lost") finalStatus = "lost";
      else if (input.returnCondition === "damaged") finalStatus = "damaged";

      let copyStatus: ILibraryBookCopy["status"] = "available";
      let copyCondition = input.returnCondition;
      if (input.returnCondition === "lost") {
        copyStatus = "lost";
        copyCondition = "lost";
      } else if (input.returnCondition === "damaged") {
        copyStatus = "damaged";
        copyCondition = "damaged";
      }

      await LibraryLoan.updateOne(
        { _id: loanId, schoolId },
        {
          $set: {
            returnedTo: userId,
            returnedAt,
            returnCondition: input.returnCondition,
            status: finalStatus,
            isOpen: false,
            fineAmount,
            fineStatus,
            replacementFeeAmount:
              replacementFeeAmount > 0 ? replacementFeeAmount : undefined,
            replacementFeeStatus:
              replacementFeeAmount > 0 ? replacementFeeStatus : "none",
            notes: input.notes?.trim() ? input.notes.trim() : loan.notes,
            ...(linkedFeeId ? { linkedFeeId } : {}),
          },
        }
      ).session(session);

      await LibraryBookCopy.updateOne(
        { _id: loan.bookCopyId, schoolId },
        {
          $set: {
            status: copyStatus,
            condition: copyCondition,
            updatedBy: userId,
          },
        }
      ).session(session);

      await syncBookCountersFromCopies(schoolId, loan.bookId, session);
      if (copyStatus === "available") {
        promotedReservationId = await promoteNextPendingReservationForBook(
          session,
          schoolId,
          loan.bookId,
          userId
        );
      }
      result = await LibraryLoan.findById(loanId).session(session).lean<ILibraryLoan | null>();
    });
  } finally {
    await session.endSession();
  }

  await notifyLibraryReservationsBecameReady(schoolId, [promotedReservationId]);

  return result;
}

export async function renewLibraryLoan(
  schoolId: mongoose.Types.ObjectId,
  userId: mongoose.Types.ObjectId,
  loanId: mongoose.Types.ObjectId,
  input: RenewLoan
): Promise<ILibraryLoan | null> {
  const settings = await getOrCreateLibrarySettings(schoolId);
  if (!settings.allowRenewals) throw new Error("Renewals are disabled for this library");

  const loan = await LibraryLoan.findOne({ _id: loanId, schoolId }).lean<ILibraryLoan | null>();
  if (!loan) return null;
  if (!loan.isOpen) throw new Error("Cannot renew a closed loan");
  if (loan.renewalCount >= settings.maxRenewals) {
    throw new Error("Maximum renewals reached for this loan");
  }
  if (input.newDueAt.getTime() <= loan.dueAt.getTime()) {
    throw new Error("New due date must be after the current due date");
  }

  const now = new Date();
  await LibraryLoan.updateOne(
    { _id: loanId, schoolId },
    {
      $set: {
        dueAt: input.newDueAt,
        renewalCount: loan.renewalCount + 1,
        lastRenewedAt: now,
        lastRenewedBy: userId,
        lastDueSoonReminderAt: null,
        notes: input.notes?.trim() ? input.notes.trim() : loan.notes,
        status: "active",
      },
    }
  );

  return LibraryLoan.findById(loanId).lean<ILibraryLoan | null>();
}

export async function getLibraryLoanById(
  schoolId: mongoose.Types.ObjectId,
  loanId: mongoose.Types.ObjectId
): Promise<ILibraryLoan | null> {
  return LibraryLoan.findOne({ _id: loanId, schoolId }).lean<ILibraryLoan | null>();
}

export async function listLibraryLoans(
  schoolId: mongoose.Types.ObjectId,
  q: ListLoans
): Promise<{ items: LibraryLoanListDTO[]; total: number }> {
  await markOpenLoansOverdueForSchool(schoolId);

  const filter = buildLoanFilter(schoolId, q.bucket);
  const sort = listSort(q);
  const skip = (q.page - 1) * q.limit;

  const [raw, total] = await Promise.all([
    LibraryLoan.find(filter).sort(sort).skip(skip).limit(q.limit).lean<ILibraryLoan[]>(),
    LibraryLoan.countDocuments(filter),
  ]);

  const items = await libraryLoanListFromDocs(schoolId, raw);
  return { items, total };
}

export async function listBorrowerLoanHistory(
  schoolId: mongoose.Types.ObjectId,
  borrowerType: "student" | "teacher" | "staff",
  borrowerId: mongoose.Types.ObjectId,
  opts: { page: number; limit: number }
): Promise<{ items: LibraryLoanListDTO[]; total: number }> {
  await markOpenLoansOverdueForSchool(schoolId);
  const filter = { schoolId, borrowerType, borrowerId };
  const skip = (opts.page - 1) * opts.limit;
  const [raw, total] = await Promise.all([
    LibraryLoan.find(filter)
      .sort({ issuedAt: -1 })
      .skip(skip)
      .limit(opts.limit)
      .lean<ILibraryLoan[]>(),
    LibraryLoan.countDocuments(filter),
  ]);
  const items = await libraryLoanListFromDocs(schoolId, raw);
  return { items, total };
}

export async function libraryLoanListFromDocs(
  schoolId: mongoose.Types.ObjectId,
  loans: ILibraryLoan[]
): Promise<LibraryLoanListDTO[]> {
  if (loans.length === 0) return [];

  const bookIds = [...new Set(loans.map((l) => String(l.bookId)))].map(
    (id) => new mongoose.Types.ObjectId(id)
  );
  const copyIds = [...new Set(loans.map((l) => String(l.bookCopyId)))].map(
    (id) => new mongoose.Types.ObjectId(id)
  );
  const studentIds = loans
    .filter((l) => l.borrowerType === "student")
    .map((l) => l.borrowerId);
  const teacherIds = loans
    .filter((l) => l.borrowerType === "teacher")
    .map((l) => l.borrowerId);
  const staffIds = loans
    .filter((l) => l.borrowerType === "staff")
    .map((l) => l.borrowerId);

  const [books, copies, students, teachers, staffUsers] = await Promise.all([
    LibraryBook.find({ _id: { $in: bookIds }, schoolId })
      .select("title author coverImageUrl")
      .lean(),
    LibraryBookCopy.find({ _id: { $in: copyIds }, schoolId }).select("copyCode").lean(),
    studentIds.length
      ? Student.find({ _id: { $in: studentIds }, schoolId })
          .select("firstName lastName classGroupId")
          .lean()
      : [],
    teacherIds.length
      ? Teacher.find({ _id: { $in: teacherIds }, schoolId })
          .select("userId")
          .populate("userId", "firstName lastName avatarUrl")
          .lean()
      : [],
    staffIds.length
      ? User.find({ _id: { $in: staffIds } })
          .select("firstName lastName avatarUrl")
          .lean()
      : [],
  ]);

  const bookMap = new Map(books.map((b) => [String(b._id), b]));
  const copyMap = new Map(copies.map((c) => [String(c._id), c]));
  const studentMap = new Map(students.map((s) => [String(s._id), s]));
  const teacherMap = new Map(teachers.map((t) => [String(t._id), t]));
  const staffMap = new Map(staffUsers.map((u) => [String(u._id), u]));

  const classIds = [
    ...new Set(
      students
        .map((s) => (s as { classGroupId?: mongoose.Types.ObjectId }).classGroupId)
        .filter(Boolean)
        .map(String)
    ),
  ].map((id) => new mongoose.Types.ObjectId(id));

  const classGroups =
    classIds.length > 0
      ? await ClassGroup.find({ _id: { $in: classIds }, schoolId }).select("name").lean()
      : [];
  const classMap = new Map(classGroups.map((g) => [String(g._id), g]));

  return loans.map((loan) => {
    const book = bookMap.get(String(loan.bookId));
    const copy = copyMap.get(String(loan.bookCopyId));

    let borrowerName = "Borrower";
    let avatarUrl: string | undefined;
    let classGroupName: string | undefined;

    if (loan.borrowerType === "student") {
      const s = studentMap.get(String(loan.borrowerId)) as
        | {
            firstName?: string;
            lastName?: string;
            classGroupId?: mongoose.Types.ObjectId;
          }
        | undefined;
      if (s) {
        borrowerName =
          `${s.firstName ?? ""} ${s.lastName ?? ""}`.trim() || borrowerName;
        const cgId = s.classGroupId ? String(s.classGroupId) : null;
        if (cgId) {
          const cg = classMap.get(cgId) as { name?: string } | undefined;
          classGroupName = cg?.name;
        }
      }
    } else if (loan.borrowerType === "teacher") {
      const t = teacherMap.get(String(loan.borrowerId)) as
        | {
            userId?: {
              firstName?: string;
              lastName?: string;
              avatarUrl?: string;
            } | null;
          }
        | undefined;
      const u = t?.userId;
      if (u) {
        borrowerName =
          `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || borrowerName;
        avatarUrl = u.avatarUrl ?? undefined;
      }
    } else {
      const u = staffMap.get(String(loan.borrowerId)) as
        | { firstName?: string; lastName?: string; avatarUrl?: string }
        | undefined;
      if (u) {
        borrowerName =
          `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || borrowerName;
        avatarUrl = u.avatarUrl ?? undefined;
      }
    }

    return buildLibraryLoanListDTO({
      loan,
      book:
        book && "title" in book
          ? {
              _id: String(book._id),
              title: String((book as { title?: string }).title ?? ""),
              author: (book as { author?: string }).author,
              coverImageUrl: (book as { coverImageUrl?: string }).coverImageUrl,
            }
          : {
              _id: String(loan.bookId),
              title: "Unknown",
            },
      copy: copy
        ? { _id: String((copy as { _id: mongoose.Types.ObjectId })._id), copyCode: (copy as { copyCode: string }).copyCode }
        : { _id: String(loan.bookCopyId), copyCode: "—" },
      borrower: {
        id: String(loan.borrowerId),
        type: loan.borrowerType,
        name: borrowerName,
        avatarUrl,
        classGroupName,
      },
    });
  });
}

export async function recentLoansForDashboard(
  schoolId: mongoose.Types.ObjectId,
  limit: number
): Promise<LibraryLoanListDTO[]> {
  const raw = await LibraryLoan.find({ schoolId })
    .sort({ issuedAt: -1 })
    .limit(limit)
    .lean<ILibraryLoan[]>();
  return libraryLoanListFromDocs(schoolId, raw);
}

export async function waiveLibraryLoanFine(
  schoolId: mongoose.Types.ObjectId,
  userId: mongoose.Types.ObjectId,
  loanId: mongoose.Types.ObjectId,
  reason?: string
): Promise<ILibraryLoan | null> {
  const loan = await LibraryLoan.findOne({ _id: loanId, schoolId }).lean<ILibraryLoan | null>();
  if (!loan) return null;
  if (loan.isOpen) throw new Error("Cannot waive fine on an open loan");
  if (loan.fineStatus !== "pending" || !loan.fineAmount || loan.fineAmount <= 0) {
    throw new Error("No pending fine to waive");
  }

  await LibraryLoan.updateOne(
    { _id: loanId, schoolId },
    {
      $set: {
        fineStatus: "waived",
        fineWaivedBy: userId,
        fineWaivedAt: new Date(),
        fineWaiverReason: reason?.trim() || undefined,
      },
    }
  );

  return LibraryLoan.findById(loanId).lean<ILibraryLoan | null>();
}
