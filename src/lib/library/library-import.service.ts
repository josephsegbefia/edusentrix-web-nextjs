import { parse } from "csv-parse/sync";
import mongoose from "mongoose";
import { LibraryBook } from "@/models/LibraryBook";
import {
  LibraryImportJob,
  type ILibraryImportJob,
  type ILibraryImportJobError,
  type LibraryImportJobType,
} from "@/models/LibraryImportJob";
import { createLibraryBook } from "@/lib/library/library-book.service";
import { createLibraryCopy } from "@/lib/library/library-copy.service";
import type { ILibraryBookCopy } from "@/models/LibraryBookCopy";

const MAX_ROWS = 2_000;

type Row = Record<string, string>;

function normHeader(h: string): string {
  return h.trim().toLowerCase();
}

function parseRows(csvText: string): Row[] {
  const text = csvText.trim();
  if (!text) return [];
  const raw = parse(text, {
    columns: (header: string[]) => header.map((h) => normHeader(h)),
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  }) as Row[];
  return raw;
}

function num(row: Row, key: string, fallback: number): number {
  const v = row[key];
  if (v === undefined || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function opt(row: Row, key: string): string | undefined {
  const v = row[key]?.trim();
  return v || undefined;
}

function splitList(row: Row, key: string): string[] {
  const v = row[key]?.trim();
  if (!v) return [];
  return v
    .split(/[,;|]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

async function findBookByIsbnOrTitle(
  schoolId: mongoose.Types.ObjectId,
  isbn?: string,
  title?: string
): Promise<mongoose.Types.ObjectId | null> {
  const isbnT = isbn?.trim();
  if (isbnT) {
    const b = await LibraryBook.findOne({ schoolId, isbn: isbnT }).select("_id").lean();
    if (b) return b._id as mongoose.Types.ObjectId;
  }
  const titleT = title?.trim();
  if (titleT) {
    const b = await LibraryBook.findOne({ schoolId, title: titleT, status: "active" })
      .select("_id")
      .lean();
    if (b) return b._id as mongoose.Types.ObjectId;
  }
  return null;
}

function validateCopyCondition(v: string | undefined): ILibraryBookCopy["condition"] {
  const s = (v || "good").toLowerCase();
  if (s === "new" || s === "good" || s === "fair" || s === "damaged" || s === "lost") return s;
  return "good";
}

/** Status values allowed when creating a copy via API/import (no borrowed/reserved on create). */
function parseCopyStatusForImport(
  v: string | undefined
): "available" | "maintenance" | "lost" | "damaged" {
  const s = (v || "available").toLowerCase();
  if (s === "available" || s === "maintenance" || s === "lost" || s === "damaged") return s;
  return "available";
}

function validateSource(v: string | undefined): "purchase" | "donation" | "government" | "other" {
  const s = (v || "purchase").toLowerCase();
  if (s === "donation" || s === "government" || s === "other") return s;
  return "purchase";
}

async function processBooks(
  schoolId: mongoose.Types.ObjectId,
  userId: mongoose.Types.ObjectId,
  rows: Row[]
): Promise<{ ok: number; errors: ILibraryImportJobError[] }> {
  const errors: ILibraryImportJobError[] = [];
  let ok = 0;
  let rowNumber = 0;
  for (const row of rows) {
    rowNumber += 1;
    const title = row["title"]?.trim();
    if (!title) {
      errors.push({
        rowNumber,
        field: "title",
        message: "Title is required",
        raw: row as Record<string, unknown>,
      });
      continue;
    }
    try {
      const gradeLevelIds = splitList(row, "gradelevels").filter((id) =>
        mongoose.Types.ObjectId.isValid(id)
      );
      await createLibraryBook(schoolId, userId, {
        title,
        subtitle: opt(row, "subtitle") ?? "",
        author: opt(row, "author") ?? "",
        publisher: opt(row, "publisher") ?? "",
        isbn: opt(row, "isbn") ?? "",
        edition: opt(row, "edition") ?? "",
        publicationYear: row["publicationyear"] ? num(row, "publicationyear", 2000) : undefined,
        category: opt(row, "category") ?? "",
        subject: opt(row, "subject") ?? "",
        gradeLevelIds,
        language: opt(row, "language") || "English",
        description: opt(row, "description") ?? "",
        coverImageUrl: opt(row, "coverimageurl"),
        coverImageKey: undefined,
        shelfLocation: opt(row, "shelflocation") ?? "",
        tags: splitList(row, "tags"),
        initialCopies: Math.min(500, Math.max(0, Math.floor(num(row, "initialcopies", 0)))),
        acquisitionCost: row["acquisitioncost"] ? num(row, "acquisitioncost", 0) : undefined,
      });
      ok += 1;
    } catch (e) {
      errors.push({
        rowNumber,
        message: e instanceof Error ? e.message : "Row failed",
        raw: row as Record<string, unknown>,
      });
    }
  }
  return { ok, errors };
}

async function processCopies(
  schoolId: mongoose.Types.ObjectId,
  userId: mongoose.Types.ObjectId,
  rows: Row[]
): Promise<{ ok: number; errors: ILibraryImportJobError[] }> {
  const errors: ILibraryImportJobError[] = [];
  let ok = 0;
  let rowNumber = 0;
  for (const row of rows) {
    rowNumber += 1;
    const copyCode = row["copycode"]?.trim() || row["copy_code"]?.trim();
    if (!copyCode) {
      errors.push({
        rowNumber,
        field: "copyCode",
        message: "copyCode is required",
        raw: row as Record<string, unknown>,
      });
      continue;
    }
    const bookId = await findBookByIsbnOrTitle(
      schoolId,
      opt(row, "bookisbn") || opt(row, "isbn"),
      opt(row, "booktitle") || opt(row, "title")
    );
    if (!bookId) {
      errors.push({
        rowNumber,
        message: "Book not found for bookIsbn / bookTitle",
        raw: row as Record<string, unknown>,
      });
      continue;
    }
    try {
      let acquisitionDate: Date | undefined;
      if (row["acquisitiondate"]?.trim()) {
        const d = new Date(row["acquisitiondate"]);
        if (!Number.isNaN(d.getTime())) acquisitionDate = d;
      }
      await createLibraryCopy(schoolId, bookId, userId, {
        copyCode,
        barcode: opt(row, "barcode") ?? "",
        condition: validateCopyCondition(row["condition"]),
        status: parseCopyStatusForImport(row["status"]),
        shelfLocation: opt(row, "shelflocation") ?? "",
        acquisitionDate,
        acquisitionCost: row["acquisitioncost"] ? num(row, "acquisitioncost", 0) : undefined,
        source: validateSource(row["source"]),
        notes: opt(row, "notes") ?? "",
      });
      ok += 1;
    } catch (e) {
      errors.push({
        rowNumber,
        message: e instanceof Error ? e.message : "Row failed",
        raw: row as Record<string, unknown>,
      });
    }
  }
  return { ok, errors };
}

/** Combined rows: book columns + copy columns; creates book then one copy per row when copyCode set. */
async function processBooksAndCopies(
  schoolId: mongoose.Types.ObjectId,
  userId: mongoose.Types.ObjectId,
  rows: Row[]
): Promise<{ ok: number; errors: ILibraryImportJobError[] }> {
  const errors: ILibraryImportJobError[] = [];
  let ok = 0;
  let rowNumber = 0;
  for (const row of rows) {
    rowNumber += 1;
    const t = row["title"]?.trim();
    const copyCode = row["copycode"]?.trim();
    if (!t) {
      errors.push({
        rowNumber,
        field: "title",
        message: "title is required for books_and_copies",
        raw: row as Record<string, unknown>,
      });
      continue;
    }
    if (!copyCode) {
      errors.push({
        rowNumber,
        field: "copyCode",
        message: "copyCode is required for books_and_copies",
        raw: row as Record<string, unknown>,
      });
      continue;
    }
    try {
      const gradeLevelIds = splitList(row, "gradelevels").filter((id) =>
        mongoose.Types.ObjectId.isValid(id)
      );
      let bookId = await findBookByIsbnOrTitle(schoolId, opt(row, "isbn"), t);
      if (!bookId) {
        const book = await createLibraryBook(schoolId, userId, {
          title: t,
          subtitle: opt(row, "subtitle") ?? "",
          author: opt(row, "author") ?? "",
          publisher: opt(row, "publisher") ?? "",
          isbn: opt(row, "isbn") ?? "",
          edition: opt(row, "edition") ?? "",
          publicationYear: row["publicationyear"]
            ? num(row, "publicationyear", 2000)
            : undefined,
          category: opt(row, "category") ?? "",
          subject: opt(row, "subject") ?? "",
          gradeLevelIds,
          language: opt(row, "language") || "English",
          description: opt(row, "description") ?? "",
          shelfLocation: opt(row, "shelflocation") ?? "",
          tags: splitList(row, "tags"),
          initialCopies: 0,
          acquisitionCost: row["acquisitioncost"] ? num(row, "acquisitioncost", 0) : undefined,
        });
        bookId = book._id as mongoose.Types.ObjectId;
      }
      let acquisitionDate: Date | undefined;
      if (row["acquisitiondate"]?.trim()) {
        const d = new Date(row["acquisitiondate"]);
        if (!Number.isNaN(d.getTime())) acquisitionDate = d;
      }
      await createLibraryCopy(schoolId, bookId, userId, {
        copyCode,
        barcode: opt(row, "barcode") ?? "",
        condition: validateCopyCondition(row["condition"]),
        status: parseCopyStatusForImport(row["status"]),
        shelfLocation: opt(row, "shelflocation") ?? "",
        acquisitionDate,
        acquisitionCost: row["acquisitioncost"] ? num(row, "acquisitioncost", 0) : undefined,
        source: validateSource(row["source"]),
        notes: opt(row, "notes") ?? "",
      });
      ok += 1;
    } catch (e) {
      errors.push({
        rowNumber,
        message: e instanceof Error ? e.message : "Row failed",
        raw: row as Record<string, unknown>,
      });
    }
  }
  return { ok, errors };
}

export async function getLibraryImportJob(
  schoolId: mongoose.Types.ObjectId,
  jobId: mongoose.Types.ObjectId
): Promise<ILibraryImportJob | null> {
  return LibraryImportJob.findOne({ _id: jobId, schoolId }).lean<ILibraryImportJob | null>();
}

/** Validates row count, persists CSV payload, returns job in `pending` (worker not started). */
export async function enqueueLibraryImport(
  schoolId: mongoose.Types.ObjectId,
  userId: mongoose.Types.ObjectId,
  input: { type: LibraryImportJobType; fileName: string; csvText: string }
): Promise<ILibraryImportJob> {
  const rows = parseRows(input.csvText);
  if (rows.length > MAX_ROWS) {
    throw new Error(`Too many rows (max ${MAX_ROWS})`);
  }
  const created = await LibraryImportJob.create({
    schoolId,
    type: input.type,
    status: "pending",
    fileName: input.fileName,
    csvText: input.csvText,
    totalRows: rows.length,
    successfulRows: 0,
    failedRows: 0,
    errors: [],
    createdBy: userId,
  });
  return created.toObject() as ILibraryImportJob;
}

/**
 * Claim a `pending` job (`pending` → `processing`), run import, clear `csvText`.
 * No-op if the job is not pending (already running or finished).
 */
export async function executeLibraryImportJob(
  schoolId: mongoose.Types.ObjectId,
  jobId: mongoose.Types.ObjectId,
  userId: mongoose.Types.ObjectId
): Promise<ILibraryImportJob | null> {
  const claimed = await LibraryImportJob.findOneAndUpdate(
    { _id: jobId, schoolId, status: "pending" },
    { $set: { status: "processing" } },
    { new: true }
  ).lean<ILibraryImportJob | null>();

  if (!claimed) {
    return LibraryImportJob.findOne({ _id: jobId, schoolId }).lean<ILibraryImportJob | null>();
  }

  const csvText = claimed.csvText ?? "";
  const rows = parseRows(csvText);

  const finishUpdate = async (
    finalStatus: ILibraryImportJob["status"],
    successfulRows: number,
    failedRows: number,
    errors: ILibraryImportJobError[]
  ) => {
    await LibraryImportJob.updateOne(
      { _id: jobId },
      {
        $set: {
          status: finalStatus,
          successfulRows,
          failedRows,
          errors,
        },
        $unset: { csvText: 1 },
      }
    );
  };

  try {
    if (rows.length > MAX_ROWS) {
      await finishUpdate(
        "failed",
        0,
        0,
        [{ rowNumber: 0, message: `Too many rows (max ${MAX_ROWS})` }]
      );
      return LibraryImportJob.findById(jobId).lean<ILibraryImportJob | null>();
    }

    let result: { ok: number; errors: ILibraryImportJobError[] };
    if (claimed.type === "books") {
      result = await processBooks(schoolId, userId, rows);
    } else if (claimed.type === "copies") {
      result = await processCopies(schoolId, userId, rows);
    } else {
      result = await processBooksAndCopies(schoolId, userId, rows);
    }

    const failed = result.errors.length;
    const finalStatus: ILibraryImportJob["status"] =
      failed === 0 ? "completed" : result.ok === 0 ? "failed" : "completed_with_errors";

    await finishUpdate(finalStatus, result.ok, failed, result.errors.slice(0, 500));
  } catch (e) {
    await finishUpdate(
      "failed",
      0,
      0,
      [{ rowNumber: 0, message: e instanceof Error ? e.message : "Import crashed" }]
    );
  }

  return LibraryImportJob.findById(jobId).lean<ILibraryImportJob | null>();
}

/** Integration tests: enqueue + execute in-process (no background worker). */
export async function createAndRunLibraryImport(
  schoolId: mongoose.Types.ObjectId,
  userId: mongoose.Types.ObjectId,
  input: { type: LibraryImportJobType; fileName: string; csvText: string }
): Promise<ILibraryImportJob> {
  const job = await enqueueLibraryImport(schoolId, userId, input);
  const jobId = job._id as mongoose.Types.ObjectId;
  const done = await executeLibraryImportJob(schoolId, jobId, userId);
  if (!done) throw new Error("Import job not found after processing");
  return done;
}
