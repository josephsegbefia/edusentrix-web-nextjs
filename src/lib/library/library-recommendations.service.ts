import mongoose from "mongoose";
import { LibraryBook, type ILibraryBook } from "@/models/LibraryBook";
import { LibraryLoan } from "@/models/LibraryLoan";
import type { LibraryBorrowerType } from "@/models/LibraryLoan";

/** Shared engine: recent **book** ids from loan history (any borrower) drive tag overlap and fallbacks. */
export async function recommendLibraryBooksFromRecentLoanBooks(
  schoolId: mongoose.Types.ObjectId,
  recentLoanBookIds: mongoose.Types.ObjectId[],
  limit: number
): Promise<ILibraryBook[]> {
  const capped = Math.min(Math.max(limit, 1), 24);
  const recentIds = [...new Set(recentLoanBookIds.map((id) => String(id)))];
  const excludeOids = recentIds
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));

  async function popularFallback(extraExclude: mongoose.Types.ObjectId[]) {
    return LibraryBook.find({
      schoolId,
      status: "active",
      availableCopies: { $gt: 0 },
      _id: { $nin: extraExclude },
    })
      .sort({ borrowedCopies: -1, updatedAt: -1 })
      .limit(capped)
      .lean<ILibraryBook[]>();
  }

  if (recentIds.length === 0) {
    return popularFallback([]);
  }

  const borrowedBooks = await LibraryBook.find({
    _id: { $in: excludeOids },
    schoolId,
  })
    .select("tags category subject")
    .lean();

  const tagSet = new Set<string>();
  for (const b of borrowedBooks) {
    for (const t of b.tags ?? []) {
      if (t?.trim()) tagSet.add(t.trim());
    }
    if (b.category?.trim()) tagSet.add(b.category.trim());
    if (b.subject?.trim()) tagSet.add(b.subject.trim());
  }
  const tagVals = [...tagSet];

  if (tagVals.length === 0) {
    return popularFallback(excludeOids);
  }

  let recs = await LibraryBook.find({
    schoolId,
    status: "active",
    availableCopies: { $gt: 0 },
    _id: { $nin: excludeOids },
    $or: [
      { tags: { $in: tagVals } },
      { category: { $in: tagVals } },
      { subject: { $in: tagVals } },
    ],
  })
    .sort({ availableCopies: -1 })
    .limit(capped)
    .lean<ILibraryBook[]>();

  if (recs.length < capped) {
    const already = [...excludeOids, ...recs.map((b) => b._id as mongoose.Types.ObjectId)];
    const more = await LibraryBook.find({
      schoolId,
      status: "active",
      availableCopies: { $gt: 0 },
      _id: { $nin: already },
    })
      .sort({ borrowedCopies: -1, updatedAt: -1 })
      .limit(capped - recs.length)
      .lean<ILibraryBook[]>();
    recs = [...recs, ...more];
  }

  return recs;
}

export async function recommendLibraryBooksForBorrower(
  schoolId: mongoose.Types.ObjectId,
  borrowerType: LibraryBorrowerType,
  borrowerId: mongoose.Types.ObjectId,
  limit: number
): Promise<ILibraryBook[]> {
  const recent = await LibraryLoan.find({
    schoolId,
    borrowerType,
    borrowerId,
  })
    .sort({ issuedAt: -1 })
    .limit(30)
    .select("bookId")
    .lean();

  const bookIds = recent.map((l) => l.bookId as mongoose.Types.ObjectId);
  return recommendLibraryBooksFromRecentLoanBooks(schoolId, bookIds, limit);
}

/** Recommendations from all linked students’ borrowing history (parents). */
export async function recommendLibraryBooksForWardStudents(
  schoolId: mongoose.Types.ObjectId,
  wardStudentIds: mongoose.Types.ObjectId[],
  limit: number
): Promise<ILibraryBook[]> {
  if (wardStudentIds.length === 0) {
    return recommendLibraryBooksFromRecentLoanBooks(schoolId, [], limit);
  }
  const recent = await LibraryLoan.find({
    schoolId,
    borrowerType: "student",
    borrowerId: { $in: wardStudentIds },
  })
    .sort({ issuedAt: -1 })
    .limit(80)
    .select("bookId")
    .lean();
  const bookIds = recent.map((l) => l.bookId as mongoose.Types.ObjectId);
  return recommendLibraryBooksFromRecentLoanBooks(schoolId, bookIds, limit);
}

/** Active titles tagged for a grade with at least one available copy. */
export async function recommendLibraryBooksForGrade(
  schoolId: mongoose.Types.ObjectId,
  gradeId: mongoose.Types.ObjectId,
  limit: number
): Promise<ILibraryBook[]> {
  const capped = Math.min(Math.max(limit, 1), 24);
  return LibraryBook.find({
    schoolId,
    status: "active",
    availableCopies: { $gt: 0 },
    gradeLevelIds: gradeId,
  })
    .sort({ borrowedCopies: -1, updatedAt: -1 })
    .limit(capped)
    .lean<ILibraryBook[]>();
}
