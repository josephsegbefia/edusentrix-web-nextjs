import mongoose from "mongoose";
import { LibraryBook, type ILibraryBook } from "@/models/LibraryBook";
import { LibraryBookCopy } from "@/models/LibraryBookCopy";
import { autoCopyCode, syncBookCountersFromCopies } from "@/lib/library/library-book-counters";
import type { z } from "zod";
import type {
  createLibraryBookSchema,
  listLibraryBooksQuerySchema,
  updateLibraryBookSchema,
} from "@/lib/library/library.validators";

type CreateBook = z.infer<typeof createLibraryBookSchema>;
type ListQuery = z.infer<typeof listLibraryBooksQuerySchema>;
type UpdateBook = z.infer<typeof updateLibraryBookSchema>;

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sanitizeCatalogTextSearch(raw: string): string {
  return raw.replace(/["\\]/g, " ").replace(/\s+/g, " ").trim();
}

function buildListSort(q: ListQuery): Record<string, 1 | -1> {
  const dir: 1 | -1 = q.sortOrder === "asc" ? 1 : -1;
  if (q.sortBy === "createdAt") return { createdAt: dir };
  if (q.sortBy === "title") return { title: dir };
  return { updatedAt: dir };
}

export async function listLibraryBooks(
  schoolId: mongoose.Types.ObjectId,
  q: ListQuery
): Promise<{ items: ILibraryBook[]; total: number }> {
  const filter: Record<string, unknown> = { schoolId };
  if (q.status !== "all") {
    filter.status = q.status;
  }
  const searchRaw = q.search?.trim() ?? "";
  if (searchRaw) {
    const safeText = sanitizeCatalogTextSearch(searchRaw);
    if (safeText.length > 0) {
      filter.$text = { $search: safeText };
    } else {
      const rx = new RegExp(escapeRegex(searchRaw), "i");
      filter.$or = [
        { title: rx },
        { author: rx },
        { isbn: rx },
        { tags: rx },
        { category: rx },
        { subject: rx },
        { publisher: rx },
      ];
    }
  }

  const skip = (q.page - 1) * q.limit;
  const sort = buildListSort(q);
  const [items, total] = await Promise.all([
    LibraryBook.find(filter).sort(sort).skip(skip).limit(q.limit).lean<ILibraryBook[]>(),
    LibraryBook.countDocuments(filter),
  ]);
  return { items, total };
}

export async function getLibraryBookById(
  schoolId: mongoose.Types.ObjectId,
  bookId: mongoose.Types.ObjectId
): Promise<ILibraryBook | null> {
  return LibraryBook.findOne({ _id: bookId, schoolId }).lean<ILibraryBook | null>();
}

export async function createLibraryBook(
  schoolId: mongoose.Types.ObjectId,
  userId: mongoose.Types.ObjectId,
  input: CreateBook
): Promise<ILibraryBook> {
  const gradeLevelIds = input.gradeLevelIds
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));

  const session = await mongoose.startSession();
  let book: ILibraryBook | null = null;
  try {
    await session.withTransaction(async () => {
      const docs = await LibraryBook.create(
        [
          {
            schoolId,
            createdBy: userId,
            title: input.title,
            subtitle: input.subtitle || undefined,
            author: input.author || undefined,
            publisher: input.publisher || undefined,
            isbn: input.isbn || undefined,
            edition: input.edition || undefined,
            publicationYear: input.publicationYear,
            category: input.category || undefined,
            subject: input.subject || undefined,
            gradeLevelIds,
            language: input.language || "English",
            description: input.description || undefined,
            coverImageUrl: input.coverImageUrl || undefined,
            coverImageKey: input.coverImageKey || undefined,
            shelfLocation: input.shelfLocation || undefined,
            tags: input.tags,
            totalCopies: 0,
            availableCopies: 0,
            borrowedCopies: 0,
            lostCopies: 0,
            damagedCopies: 0,
            reservedCopies: 0,
            status: "active",
          },
        ],
        { session }
      );
      const b = docs[0];
      const bookId = b._id as mongoose.Types.ObjectId;
      const n = input.initialCopies ?? 0;
      if (n > 0) {
        const rows = [];
        for (let i = 0; i < n; i += 1) {
          rows.push({
            schoolId,
            bookId,
            createdBy: userId,
            copyCode: autoCopyCode(bookId, i),
            condition: "good" as const,
            status: "available" as const,
            source: "purchase" as const,
            acquisitionCost: input.acquisitionCost,
          });
        }
        await LibraryBookCopy.insertMany(rows, { session });
      }
      await syncBookCountersFromCopies(schoolId, bookId, session);
      book = (await LibraryBook.findById(bookId).session(session).lean<ILibraryBook | null>()) ?? null;
    });
  } finally {
    await session.endSession();
  }

  if (!book) throw new Error("Failed to create book");
  return book;
}

export async function updateLibraryBook(
  schoolId: mongoose.Types.ObjectId,
  bookId: mongoose.Types.ObjectId,
  userId: mongoose.Types.ObjectId,
  patch: UpdateBook
): Promise<ILibraryBook | null> {
  const found = await LibraryBook.findOne({ _id: bookId, schoolId });
  if (!found) return null;

  const $set: Record<string, unknown> = { updatedBy: userId };
  const assign = (key: string, v: unknown) => {
    if (v !== undefined) $set[key] = v;
  };
  assign("title", patch.title);
  assign("subtitle", patch.subtitle || undefined);
  assign("author", patch.author || undefined);
  assign("publisher", patch.publisher || undefined);
  assign("isbn", patch.isbn || undefined);
  assign("edition", patch.edition || undefined);
  assign("publicationYear", patch.publicationYear);
  assign("category", patch.category || undefined);
  assign("subject", patch.subject || undefined);
  if (patch.gradeLevelIds) {
    $set.gradeLevelIds = patch.gradeLevelIds
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id));
  }
  assign("language", patch.language);
  assign("description", patch.description || undefined);
  assign("coverImageUrl", patch.coverImageUrl || undefined);
  assign("coverImageKey", patch.coverImageKey || undefined);
  assign("shelfLocation", patch.shelfLocation || undefined);
  if (patch.tags) $set.tags = patch.tags;
  if (patch.status) $set.status = patch.status;

  await LibraryBook.updateOne({ _id: bookId, schoolId }, { $set });
  return LibraryBook.findById(bookId).lean<ILibraryBook | null>();
}
