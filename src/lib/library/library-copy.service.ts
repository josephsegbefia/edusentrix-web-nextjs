import mongoose from "mongoose";
import { LibraryBook } from "@/models/LibraryBook";
import { LibraryBookCopy, type ILibraryBookCopy } from "@/models/LibraryBookCopy";
import { syncBookCountersFromCopies } from "@/lib/library/library-book-counters";
import type { z } from "zod";
import type {
  createLibraryBookCopyBodySchema,
  updateLibraryBookCopySchema,
} from "@/lib/library/library.validators";

type CreateCopy = z.infer<typeof createLibraryBookCopyBodySchema>;
type UpdateCopy = z.infer<typeof updateLibraryBookCopySchema>;

export async function listCopiesForBook(
  schoolId: mongoose.Types.ObjectId,
  bookId: mongoose.Types.ObjectId,
  opts?: { includeArchived?: boolean }
): Promise<ILibraryBookCopy[]> {
  const filter: Record<string, unknown> = { schoolId, bookId };
  if (!opts?.includeArchived) {
    filter.status = { $ne: "archived" };
  }
  return LibraryBookCopy.find(filter).sort({ copyCode: 1 }).lean<ILibraryBookCopy[]>();
}

export async function getCopyById(
  schoolId: mongoose.Types.ObjectId,
  copyId: mongoose.Types.ObjectId
): Promise<ILibraryBookCopy | null> {
  return LibraryBookCopy.findOne({ _id: copyId, schoolId }).lean<ILibraryBookCopy | null>();
}

export async function createLibraryCopy(
  schoolId: mongoose.Types.ObjectId,
  bookId: mongoose.Types.ObjectId,
  userId: mongoose.Types.ObjectId,
  input: CreateCopy
): Promise<ILibraryBookCopy> {
  const book = await LibraryBook.findOne({ _id: bookId, schoolId }).select("_id").lean();
  if (!book) {
    throw new Error("Book not found");
  }

  try {
    const doc = await LibraryBookCopy.create({
      schoolId,
      bookId,
      createdBy: userId,
      copyCode: input.copyCode,
      barcode: input.barcode || undefined,
      qrCode: input.qrCode || undefined,
      condition: input.condition,
      status: input.status,
      shelfLocation: input.shelfLocation || undefined,
      acquisitionDate: input.acquisitionDate,
      acquisitionCost: input.acquisitionCost,
      source: input.source,
      notes: input.notes || undefined,
    });
    await syncBookCountersFromCopies(schoolId, bookId);
    return doc.toObject() as ILibraryBookCopy;
  } catch (e: unknown) {
    const err = e as { code?: number };
    if (err?.code === 11000) {
      throw new Error("A copy with this code already exists in your school");
    }
    throw e;
  }
}

export async function updateLibraryCopy(
  schoolId: mongoose.Types.ObjectId,
  copyId: mongoose.Types.ObjectId,
  userId: mongoose.Types.ObjectId,
  patch: UpdateCopy
): Promise<ILibraryBookCopy | null> {
  const existing = await LibraryBookCopy.findOne({ _id: copyId, schoolId });
  if (!existing) return null;

  if (patch.status === "archived" && existing.status === "borrowed") {
    throw new Error("Cannot archive a copy that is currently borrowed");
  }

  if (patch.status && patch.status !== "archived" && existing.status === "borrowed") {
    throw new Error("Cannot change status of a borrowed copy except through return workflow (V1.1)");
  }

  if (existing.status === "borrowed") {
    const entries = Object.entries(patch).filter(([, v]) => v !== undefined);
    if (entries.length > 0 && !entries.every(([k]) => k === "notes")) {
      throw new Error("Cannot edit a borrowed copy except notes until return workflow (V1.1)");
    }
  }

  const next: Record<string, unknown> = { updatedBy: userId };
  if (patch.copyCode !== undefined) next.copyCode = patch.copyCode;
  if (patch.barcode !== undefined) next.barcode = patch.barcode || undefined;
  if (patch.qrCode !== undefined) next.qrCode = patch.qrCode || undefined;
  if (patch.condition !== undefined) next.condition = patch.condition;
  if (patch.status !== undefined) next.status = patch.status;
  if (patch.shelfLocation !== undefined) next.shelfLocation = patch.shelfLocation || undefined;
  if (patch.acquisitionDate !== undefined) next.acquisitionDate = patch.acquisitionDate;
  if (patch.acquisitionCost !== undefined) next.acquisitionCost = patch.acquisitionCost;
  if (patch.source !== undefined) next.source = patch.source;
  if (patch.notes !== undefined) next.notes = patch.notes || undefined;

  Object.assign(existing, next);
  await existing.save();
  await syncBookCountersFromCopies(schoolId, existing.bookId);

  return LibraryBookCopy.findById(copyId).lean<ILibraryBookCopy | null>();
}

export async function lookupLibraryCopyByCode(
  schoolId: mongoose.Types.ObjectId,
  raw: string
): Promise<ILibraryBookCopy | null> {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const or: Record<string, unknown>[] = [
    { copyCode: trimmed },
    { barcode: trimmed },
    { qrCode: trimmed },
  ];
  if (/^[a-f0-9]{24}$/i.test(trimmed)) {
    const lc = trimmed.toLowerCase();
    or.push({ barcode: lc }, { qrCode: `EDU:${lc}` });
  }
  return LibraryBookCopy.findOne({ schoolId, $or: or }).lean<ILibraryBookCopy | null>();
}

export async function ensureLibraryCopyScannableCodes(
  schoolId: mongoose.Types.ObjectId,
  copyId: mongoose.Types.ObjectId,
  userId: mongoose.Types.ObjectId
): Promise<ILibraryBookCopy | null> {
  const existing = await LibraryBookCopy.findOne({ _id: copyId, schoolId });
  if (!existing) return null;

  const idHex = copyId.toString().toLowerCase();
  let barcode = existing.barcode?.trim() ?? "";
  let qrCode = existing.qrCode?.trim() ?? "";

  if (!barcode && !qrCode) {
    barcode = idHex;
    qrCode = `EDU:${idHex}`;
  } else if (barcode && !qrCode) {
    qrCode = `EDU:${barcode}`;
  } else if (!barcode && qrCode) {
    barcode = qrCode.startsWith("EDU:") ? qrCode.slice(4) : qrCode;
    if (!barcode) barcode = idHex;
  }

  if (existing.barcode === barcode && existing.qrCode === qrCode) {
    return LibraryBookCopy.findById(copyId).lean<ILibraryBookCopy | null>();
  }

  existing.barcode = barcode || undefined;
  existing.qrCode = qrCode || undefined;
  existing.updatedBy = userId;
  try {
    await existing.save();
  } catch (e: unknown) {
    const err = e as { code?: number };
    if (err?.code === 11000) {
      throw new Error("Codes conflict with another copy (duplicate barcode or QR value)");
    }
    throw e;
  }
  return LibraryBookCopy.findById(copyId).lean<ILibraryBookCopy | null>();
}
