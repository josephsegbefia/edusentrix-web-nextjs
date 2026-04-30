import type { ILibraryBook } from "@/models/LibraryBook";
import type { ILibraryBookCopy } from "@/models/LibraryBookCopy";
import type { ILibrarySettings } from "@/models/LibrarySettings";
import type {
  ILibraryLoan,
  LibraryBorrowerType,
  LibraryFineStatus,
  LibraryLoanStatus,
} from "@/models/LibraryLoan";

export function serializeLibraryBook(doc: ILibraryBook) {
  return {
    id: String(doc._id),
    schoolId: String(doc.schoolId),
    title: doc.title,
    subtitle: doc.subtitle ?? undefined,
    author: doc.author ?? undefined,
    publisher: doc.publisher ?? undefined,
    isbn: doc.isbn ?? undefined,
    edition: doc.edition ?? undefined,
    publicationYear: doc.publicationYear ?? undefined,
    category: doc.category ?? undefined,
    subject: doc.subject ?? undefined,
    gradeLevelIds: (doc.gradeLevelIds ?? []).map((g) => String(g)),
    language: doc.language,
    description: doc.description ?? undefined,
    coverImageUrl: doc.coverImageUrl ?? undefined,
    coverImageKey: doc.coverImageKey ?? undefined,
    shelfLocation: doc.shelfLocation ?? undefined,
    tags: doc.tags ?? [],
    totalCopies: doc.totalCopies,
    availableCopies: doc.availableCopies,
    borrowedCopies: doc.borrowedCopies,
    lostCopies: doc.lostCopies,
    damagedCopies: doc.damagedCopies,
    reservedCopies: doc.reservedCopies,
    status: doc.status,
    createdBy: String(doc.createdBy),
    updatedBy: doc.updatedBy ? String(doc.updatedBy) : undefined,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

/** Catalogue fields for student/teacher/parent browse (no staff ids or internal keys). */
export function serializeLibraryBookPatron(doc: ILibraryBook) {
  return {
    id: String(doc._id),
    title: doc.title,
    subtitle: doc.subtitle ?? undefined,
    author: doc.author ?? undefined,
    publisher: doc.publisher ?? undefined,
    isbn: doc.isbn ?? undefined,
    publicationYear: doc.publicationYear ?? undefined,
    category: doc.category ?? undefined,
    subject: doc.subject ?? undefined,
    gradeLevelIds: (doc.gradeLevelIds ?? []).map((g) => String(g)),
    language: doc.language,
    description: doc.description ?? undefined,
    coverImageUrl: doc.coverImageUrl ?? undefined,
    shelfLocation: doc.shelfLocation ?? undefined,
    tags: doc.tags ?? [],
    totalCopies: doc.totalCopies,
    availableCopies: doc.availableCopies,
    borrowedCopies: doc.borrowedCopies,
    status: doc.status,
  };
}

export function serializeLibraryCopy(doc: ILibraryBookCopy) {
  return {
    id: String(doc._id),
    schoolId: String(doc.schoolId),
    bookId: String(doc.bookId),
    copyCode: doc.copyCode,
    barcode: doc.barcode ?? undefined,
    qrCode: doc.qrCode ?? undefined,
    condition: doc.condition,
    status: doc.status,
    shelfLocation: doc.shelfLocation ?? undefined,
    acquisitionDate: doc.acquisitionDate?.toISOString(),
    acquisitionCost: doc.acquisitionCost ?? undefined,
    source: doc.source,
    notes: doc.notes ?? undefined,
    createdBy: String(doc.createdBy),
    updatedBy: doc.updatedBy ? String(doc.updatedBy) : undefined,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export type LibraryLoanListDTO = {
  _id: string;
  book: {
    _id: string;
    title: string;
    author?: string;
    coverImageUrl?: string;
  };
  copy: { _id: string; copyCode: string };
  borrower: {
    id: string;
    type: LibraryBorrowerType;
    name: string;
    avatarUrl?: string;
    classGroupName?: string;
  };
  issuedAt: string;
  dueAt: string;
  returnedAt?: string;
  status: LibraryLoanStatus;
  daysOverdue: number;
  fineAmount: number;
  fineStatus: LibraryFineStatus;
  renewalCount: number;
};

export function effectiveLibraryLoanStatus(
  loan: Pick<ILibraryLoan, "status" | "isOpen" | "dueAt">
): LibraryLoanStatus {
  if (!loan.isOpen) return loan.status;
  const dueMs = loan.dueAt.getTime();
  if (dueMs >= Date.now()) {
    return loan.status === "overdue" ? "active" : loan.status;
  }
  return "overdue";
}

export function libraryLoanDaysOverdue(
  loan: Pick<ILibraryLoan, "isOpen" | "dueAt" | "status">
): number {
  const eff = effectiveLibraryLoanStatus(loan);
  if (eff !== "overdue" && loan.status !== "overdue") return 0;
  return Math.max(0, Math.ceil((Date.now() - loan.dueAt.getTime()) / 86_400_000));
}

export function buildLibraryLoanListDTO(args: {
  loan: ILibraryLoan;
  book: LibraryLoanListDTO["book"];
  copy: LibraryLoanListDTO["copy"];
  borrower: LibraryLoanListDTO["borrower"];
}): LibraryLoanListDTO {
  const { loan, book, copy, borrower } = args;
  return {
    _id: String(loan._id),
    book,
    copy,
    borrower,
    issuedAt: loan.issuedAt.toISOString(),
    dueAt: loan.dueAt.toISOString(),
    returnedAt: loan.returnedAt?.toISOString(),
    status: effectiveLibraryLoanStatus(loan),
    daysOverdue: libraryLoanDaysOverdue(loan),
    fineAmount: loan.fineAmount ?? 0,
    fineStatus: loan.fineStatus,
    renewalCount: loan.renewalCount,
  };
}

export function serializeLibrarySettings(doc: ILibrarySettings) {
  return {
    id: String(doc._id),
    schoolId: String(doc.schoolId),
    defaultLoanDaysStudent: doc.defaultLoanDaysStudent,
    defaultLoanDaysTeacher: doc.defaultLoanDaysTeacher,
    defaultLoanDaysStaff: doc.defaultLoanDaysStaff,
    maxBooksPerStudent: doc.maxBooksPerStudent,
    maxBooksPerTeacher: doc.maxBooksPerTeacher,
    maxBooksPerStaff: doc.maxBooksPerStaff,
    allowRenewals: doc.allowRenewals,
    maxRenewals: doc.maxRenewals,
    renewalDays: doc.renewalDays,
    enableFines: doc.enableFines,
    finePerDay: doc.finePerDay,
    graceDaysAfterDueDate: doc.graceDaysAfterDueDate,
    enableReplacementFees: doc.enableReplacementFees,
    notifyBeforeDueDate: doc.notifyBeforeDueDate,
    dueReminderDaysBefore: doc.dueReminderDaysBefore,
    notifyOnDueDate: doc.notifyOnDueDate,
    notifyAfterOverdue: doc.notifyAfterOverdue,
    overdueReminderFrequencyDays: doc.overdueReminderFrequencyDays,
    notifyParentsForStudentOverdue: doc.notifyParentsForStudentOverdue,
    notifyTeachersForTeacherOverdue: doc.notifyTeachersForTeacherOverdue,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}
