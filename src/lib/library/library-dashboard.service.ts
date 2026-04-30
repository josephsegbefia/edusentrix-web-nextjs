import mongoose from "mongoose";
import { LibraryBook } from "@/models/LibraryBook";
import { LibraryLoan, type ILibraryLoan } from "@/models/LibraryLoan";
import {
  libraryLoanListFromDocs,
  recentLoansForDashboard,
} from "@/lib/library/library-loan.service";
import { markOpenLoansOverdueForSchool } from "@/lib/library/library-jobs";
import type { LibraryLoanListDTO } from "@/lib/library/library.serialize";

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export type LibraryDashboardDTO = {
  stats: {
    totalBooks: number;
    totalCopies: number;
    availableCopies: number;
    borrowedCopies: number;
    overdueLoans: number;
    lostCopies: number;
    damagedCopies: number;
    activeBorrowers: number;
    totalLoansAllTime: number;
    pendingFinesTotal: number;
  };
  recentLoans: LibraryLoanListDTO[];
  dueToday: LibraryLoanListDTO[];
  overdue: LibraryLoanListDTO[];
  popularBooks: Array<{
    bookId: string;
    title: string;
    author?: string;
    coverImageUrl?: string;
    borrowCount: number;
  }>;
  lowAvailabilityBooks: Array<{
    bookId: string;
    title: string;
    availableCopies: number;
    totalCopies: number;
  }>;
};

export async function getLibraryDashboardData(
  schoolId: mongoose.Types.ObjectId
): Promise<LibraryDashboardDTO> {
  await markOpenLoansOverdueForSchool(schoolId);
  const now = new Date();
  const sod = startOfDay(now);
  const eod = endOfDay(now);

  const [
    agg,
    overdueLoans,
    borrowerIds,
    dueTodayRaw,
    overdueRaw,
    popularAgg,
    recentLoans,
    totalLoansAllTime,
    finePendingAgg,
  ] = await Promise.all([
    LibraryBook.aggregate([
      { $match: { schoolId, status: "active" } },
      {
        $group: {
          _id: null,
          totalBooks: { $sum: 1 },
          totalCopies: { $sum: "$totalCopies" },
          availableCopies: { $sum: "$availableCopies" },
          borrowedCopies: { $sum: "$borrowedCopies" },
          lostCopies: { $sum: "$lostCopies" },
          damagedCopies: { $sum: "$damagedCopies" },
        },
      },
    ]),
    LibraryLoan.countDocuments({ schoolId, isOpen: true, dueAt: { $lt: now } }),
    LibraryLoan.distinct("borrowerId", { schoolId, isOpen: true }),
    LibraryLoan.find({ schoolId, isOpen: true, dueAt: { $gte: sod, $lte: eod } })
      .sort({ dueAt: 1 })
      .limit(12)
      .lean<ILibraryLoan[]>(),
    LibraryLoan.find({ schoolId, isOpen: true, dueAt: { $lt: now } })
      .sort({ dueAt: 1 })
      .limit(12)
      .lean<ILibraryLoan[]>(),
    LibraryLoan.aggregate<{ _id: mongoose.Types.ObjectId; borrowCount: number }>([
      { $match: { schoolId, isOpen: false } },
      { $group: { _id: "$bookId", borrowCount: { $sum: 1 } } },
      { $sort: { borrowCount: -1 } },
      { $limit: 6 },
    ]),
    recentLoansForDashboard(schoolId, 8),
    LibraryLoan.countDocuments({ schoolId }),
    LibraryLoan.aggregate<{ _id: null; t: number }>([
      { $match: { schoolId, fineStatus: "pending", fineAmount: { $gt: 0 } } },
      { $group: { _id: null, t: { $sum: "$fineAmount" } } },
    ]),
  ]);

  const row = agg[0] ?? {
    totalBooks: 0,
    totalCopies: 0,
    availableCopies: 0,
    borrowedCopies: 0,
    lostCopies: 0,
    damagedCopies: 0,
  };

  const popularBookIds = popularAgg.map((p) => p._id);
  const popularBooksDocs =
    popularBookIds.length > 0
      ? await LibraryBook.find({ _id: { $in: popularBookIds }, schoolId })
          .select("title author coverImageUrl")
          .lean()
      : [];
  const popularMap = new Map(popularBooksDocs.map((b) => [String(b._id), b]));

  const popularBooks = popularAgg.map((p) => {
    const b = popularMap.get(String(p._id));
    return {
      bookId: String(p._id),
      title: b ? String((b as { title?: string }).title ?? "") : "Unknown",
      author: (b as { author?: string } | undefined)?.author,
      coverImageUrl: (b as { coverImageUrl?: string } | undefined)?.coverImageUrl,
      borrowCount: p.borrowCount,
    };
  });

  const lowBooks = await LibraryBook.find({
    schoolId,
    status: "active",
    totalCopies: { $gt: 0 },
    $expr: { $lte: ["$availableCopies", 1] },
  })
    .select("title availableCopies totalCopies")
    .sort({ availableCopies: 1 })
    .limit(8)
    .lean();

  const [dueToday, overdue] = await Promise.all([
    libraryLoanListFromDocs(schoolId, dueTodayRaw),
    libraryLoanListFromDocs(schoolId, overdueRaw),
  ]);

  const pendingFines = finePendingAgg[0]?.t ?? 0;

  return {
    stats: {
      totalBooks: row.totalBooks ?? 0,
      totalCopies: row.totalCopies ?? 0,
      availableCopies: row.availableCopies ?? 0,
      borrowedCopies: row.borrowedCopies ?? 0,
      overdueLoans,
      lostCopies: row.lostCopies ?? 0,
      damagedCopies: row.damagedCopies ?? 0,
      activeBorrowers: borrowerIds.length,
      totalLoansAllTime,
      pendingFinesTotal: Math.round(pendingFines * 100) / 100,
    },
    recentLoans,
    dueToday,
    overdue,
    popularBooks,
    lowAvailabilityBooks: lowBooks.map((b) => ({
      bookId: String(b._id),
      title: String(b.title),
      availableCopies: b.availableCopies,
      totalCopies: b.totalCopies,
    })),
  };
}
