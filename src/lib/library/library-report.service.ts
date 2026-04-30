import mongoose, { type PipelineStage } from "mongoose";
import { LibraryBook } from "@/models/LibraryBook";
import { LibraryBookCopy } from "@/models/LibraryBookCopy";
import { LibraryLoan } from "@/models/LibraryLoan";
import { ClassGroup } from "@/models/ClassGroup";
import { Student } from "@/models/Student";
import { libraryLoanListFromDocs } from "@/lib/library/library-loan.service";
import type { LibraryLoanListDTO } from "@/lib/library/library.serialize";

export const LIBRARY_REPORT_TYPES = [
  "overdue",
  "most_borrowed",
  "inventory_value",
  "active_readers",
  "lost_damaged",
  "category_usage",
  "class_activity",
] as const;

export type LibraryReportType = (typeof LIBRARY_REPORT_TYPES)[number];

export type LibraryReportQuery = {
  type: LibraryReportType;
  from?: Date;
  to?: Date;
  classGroupId?: mongoose.Types.ObjectId;
  gradeLevelId?: mongoose.Types.ObjectId;
  limit?: number;
};

function loanDateRange(q: LibraryReportQuery): Record<string, unknown> | undefined {
  if (!q.from && !q.to) return undefined;
  const issuedAt: Record<string, Date> = {};
  if (q.from) issuedAt.$gte = q.from;
  if (q.to) issuedAt.$lte = q.to;
  return { issuedAt };
}

export type LibraryReportResult =
  | {
      type: "overdue";
      generatedAt: string;
      items: LibraryLoanListDTO[];
      total: number;
    }
  | {
      type: "most_borrowed";
      generatedAt: string;
      rows: Array<{
        bookId: string;
        title: string;
        author?: string;
        borrowCount: number;
      }>;
    }
  | {
      type: "inventory_value";
      generatedAt: string;
      totalCopiesValued: number;
      estimatedValue: number;
    }
  | {
      type: "active_readers";
      generatedAt: string;
      rows: Array<{
        borrowerType: string;
        borrowerId: string;
        nameHint: string;
        loanCount: number;
      }>;
    }
  | {
      type: "lost_damaged";
      generatedAt: string;
      lostCopies: number;
      damagedCopies: number;
      bookCounterLost: number;
      bookCounterDamaged: number;
    }
  | {
      type: "category_usage";
      generatedAt: string;
      rows: Array<{ category: string; loanCount: number }>;
    }
  | {
      type: "class_activity";
      generatedAt: string;
      rows: Array<{ classGroupId: string; className: string; loanCount: number }>;
    };

export async function runLibraryReport(
  schoolId: mongoose.Types.ObjectId,
  q: LibraryReportQuery
): Promise<LibraryReportResult> {
  const generatedAt = new Date().toISOString();
  const limit = Math.min(100, Math.max(5, q.limit ?? 25));
  const range = loanDateRange(q);

  if (q.type === "overdue") {
    const now = new Date();
    const filter: Record<string, unknown> = { schoolId, isOpen: true, dueAt: { $lt: now } };
    const [raw, total] = await Promise.all([
      LibraryLoan.find(filter).sort({ dueAt: 1 }).limit(limit).lean(),
      LibraryLoan.countDocuments(filter),
    ]);
    const items = await libraryLoanListFromDocs(schoolId, raw);
    return { type: "overdue", generatedAt, items, total };
  }

  if (q.type === "most_borrowed") {
    const match: Record<string, unknown> = { schoolId, isOpen: false };
    if (range) Object.assign(match, range);
    const agg = await LibraryLoan.aggregate<{
      _id: mongoose.Types.ObjectId;
      borrowCount: number;
    }>([
      { $match: match },
      { $group: { _id: "$bookId", borrowCount: { $sum: 1 } } },
      { $sort: { borrowCount: -1 } },
      { $limit: limit },
    ]);
    const bookIds = agg.map((a) => a._id);
    const books =
      bookIds.length > 0
        ? await LibraryBook.find({ _id: { $in: bookIds }, schoolId })
            .select("title author")
            .lean()
        : [];
    const bookMap = new Map(books.map((b) => [String(b._id), b]));
    return {
      type: "most_borrowed",
      generatedAt,
      rows: agg.map((a) => {
        const b = bookMap.get(String(a._id));
        return {
          bookId: String(a._id),
          title: b ? String((b as { title?: string }).title ?? "") : "Unknown",
          author: (b as { author?: string } | undefined)?.author,
          borrowCount: a.borrowCount,
        };
      }),
    };
  }

  if (q.type === "inventory_value") {
    const agg = await LibraryBookCopy.aggregate<{
      _id: null;
      n: number;
      v: number;
    }>([
      { $match: { schoolId, status: { $ne: "archived" } } },
      {
        $group: {
          _id: null,
          n: { $sum: 1 },
          v: { $sum: { $ifNull: ["$acquisitionCost", 0] } },
        },
      },
    ]);
    const row = agg[0];
    return {
      type: "inventory_value",
      generatedAt,
      totalCopiesValued: row?.n ?? 0,
      estimatedValue: Math.round((row?.v ?? 0) * 100) / 100,
    };
  }

  if (q.type === "active_readers") {
    const match: Record<string, unknown> = { schoolId };
    if (range) Object.assign(match, range);
    const agg = await LibraryLoan.aggregate<{
      _id: { t: string; id: mongoose.Types.ObjectId };
      loanCount: number;
    }>([
      { $match: match },
      {
        $group: {
          _id: { t: "$borrowerType", id: "$borrowerId" },
          loanCount: { $sum: 1 },
        },
      },
      { $sort: { loanCount: -1 } },
      { $limit: limit },
    ]);
    return {
      type: "active_readers",
      generatedAt,
      rows: agg.map((a) => ({
        borrowerType: a._id.t,
        borrowerId: String(a._id.id),
        nameHint: `${a._id.t}:${String(a._id.id).slice(-6)}`,
        loanCount: a.loanCount,
      })),
    };
  }

  if (q.type === "lost_damaged") {
    const [lostCopies, damagedCopies, bookAgg] = await Promise.all([
      LibraryBookCopy.countDocuments({ schoolId, status: "lost" }),
      LibraryBookCopy.countDocuments({ schoolId, status: "damaged" }),
      LibraryBook.aggregate<{ _id: null; l: number; d: number }>([
        { $match: { schoolId, status: "active" } },
      {
        $group: {
          _id: null,
          l: { $sum: "$lostCopies" },
          d: { $sum: "$damagedCopies" },
        },
      },
      ]),
    ]);
    const br = bookAgg[0];
    return {
      type: "lost_damaged",
      generatedAt,
      lostCopies,
      damagedCopies,
      bookCounterLost: br?.l ?? 0,
      bookCounterDamaged: br?.d ?? 0,
    };
  }

  if (q.type === "category_usage") {
    const match: Record<string, unknown> = { schoolId };
    if (range) Object.assign(match, range);
    const agg = await LibraryLoan.aggregate<{
      _id: string;
      loanCount: number;
    }>([
      { $match: match },
      {
        $lookup: {
          from: "librarybooks",
          localField: "bookId",
          foreignField: "_id",
          as: "book",
        },
      },
      { $unwind: "$book" },
      {
        $match: {
          "book.schoolId": schoolId,
          ...(q.gradeLevelId
            ? { "book.gradeLevelIds": q.gradeLevelId }
            : {}),
        },
      },
      {
        $group: {
          _id: { $ifNull: ["$book.category", "Uncategorized"] },
          loanCount: { $sum: 1 },
        },
      },
      { $sort: { loanCount: -1 } },
      { $limit: limit },
    ]);
    return {
      type: "category_usage",
      generatedAt,
      rows: agg.map((a) => ({
        category: String(a._id || "Uncategorized"),
        loanCount: a.loanCount,
      })),
    };
  }

  /* class_activity */
  const match: Record<string, unknown> = { schoolId, borrowerType: "student" };
  if (range) Object.assign(match, range);
  if (q.classGroupId && q.gradeLevelId) {
    const [a, b] = await Promise.all([
      Student.find({ schoolId, classGroupId: q.classGroupId }).select("_id").lean(),
      Student.find({ schoolId, gradeId: q.gradeLevelId }).select("_id").lean(),
    ]);
    const inClass = new Set(a.map((s) => String(s._id)));
    const ids = b.map((s) => s._id).filter((id) => inClass.has(String(id)));
    match.borrowerId = { $in: ids };
  } else if (q.classGroupId) {
    const studs = await Student.find({ schoolId, classGroupId: q.classGroupId })
      .select("_id")
      .lean();
    match.borrowerId = { $in: studs.map((s) => s._id) };
  } else if (q.gradeLevelId) {
    const studs = await Student.find({ schoolId, gradeId: q.gradeLevelId })
      .select("_id")
      .lean();
    match.borrowerId = { $in: studs.map((s) => s._id) };
  }
  const pipe: PipelineStage[] = [
    { $match: match },
    {
      $lookup: {
        from: "students",
        localField: "borrowerId",
        foreignField: "_id",
        as: "s",
      },
    },
    { $unwind: "$s" },
    { $match: { "s.schoolId": schoolId } },
  ];
  if (q.gradeLevelId) {
    pipe.push({ $match: { "s.gradeId": q.gradeLevelId } });
  }
  pipe.push(
    {
      $group: {
        _id: "$s.classGroupId",
        loanCount: { $sum: 1 },
      },
    },
    { $sort: { loanCount: -1 } },
    { $limit: limit }
  );
  const agg = await LibraryLoan.aggregate<{
    _id: mongoose.Types.ObjectId;
    loanCount: number;
  }>(pipe);
  const cgIds = agg.map((a) => a._id).filter(Boolean);
  const groups =
    cgIds.length > 0
      ? await ClassGroup.find({ _id: { $in: cgIds }, schoolId }).select("name").lean()
      : [];
  const gmap = new Map(groups.map((g) => [String(g._id), g]));
  return {
    type: "class_activity",
    generatedAt,
    rows: agg.map((a) => {
      const g = gmap.get(String(a._id));
      return {
        classGroupId: String(a._id),
        className: g ? String((g as { name?: string }).name ?? "") : "Class",
        loanCount: a.loanCount,
      };
    }),
  };
}
