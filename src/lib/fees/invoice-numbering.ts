// src/lib/fees/invoice-numbering.ts
import { Types } from "mongoose";
import { Invoice } from "@/models/Invoice";
import {
  InvoiceNumberSequence,
  invoiceNumberSequenceKey,
} from "@/models/InvoiceNumberSequence";
import { generateInvoiceNumber, parseInvoiceNumber } from "@/lib/fees/invoice-utils";

export type InvoiceNumberAllocation = {
  year: number;
  firstSequence: number;
  lastSequence: number;
  numbers: string[];
};

function toSchoolObjectId(schoolId: Types.ObjectId | string): Types.ObjectId {
  if (schoolId instanceof Types.ObjectId) return schoolId;
  if (typeof schoolId === "string" && Types.ObjectId.isValid(schoolId)) {
    return new Types.ObjectId(schoolId);
  }
  throw new Error("Invalid schoolId for invoice number allocation");
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === 11000
  );
}

/**
 * Highest `INV-{year}-{n}` sequence already stored for this school, so a newly
 * created counter never hands out a number that existing invoices already use.
 */
export async function findHighestExistingInvoiceSequence(
  schoolId: Types.ObjectId,
  year: number
): Promise<number> {
  const prefix = `INV-${year}-`;
  const rows = await Invoice.find(
    { schoolId, invoiceNumber: { $regex: `^${prefix}\\d+$` } },
    { invoiceNumber: 1 }
  ).lean<Array<{ invoiceNumber?: string }>>();

  let highest = 0;
  for (const row of rows) {
    const parsed = parseInvoiceNumber(row.invoiceNumber);
    if (parsed && parsed.year === year && parsed.sequence > highest) {
      highest = parsed.sequence;
    }
  }
  return highest;
}

async function seedCounterIfMissing(
  key: string,
  schoolId: Types.ObjectId,
  year: number
): Promise<void> {
  const highest = await findHighestExistingInvoiceSequence(schoolId, year);
  const seed = () =>
    InvoiceNumberSequence.updateOne(
      { _id: key },
      { $max: { seq: highest }, $setOnInsert: { schoolId, year } },
      { upsert: true }
    );
  try {
    await seed();
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error;
    await seed();
  }
}

/**
 * Atomically reserves `count` consecutive invoice numbers for a school/year.
 *
 * Must NOT be called with a transaction session: the reservation commits
 * independently so concurrent creators never contend on the counter inside
 * their transactions, and an aborted transaction burns (never reuses) its
 * numbers. Callers that use `withTransaction` must allocate once outside the
 * callback and reuse the result on retries.
 */
export async function allocateInvoiceNumbers({
  schoolId,
  count = 1,
  year = new Date().getFullYear(),
}: {
  schoolId: Types.ObjectId | string;
  count?: number;
  year?: number;
}): Promise<InvoiceNumberAllocation> {
  if (!Number.isSafeInteger(count) || count < 1) {
    throw new Error("Invoice number allocation count must be a positive integer");
  }
  if (!Number.isSafeInteger(year) || year < 1000 || year > 9999) {
    throw new Error("Invoice number allocation year must be a 4-digit year");
  }

  const schoolObjectId = toSchoolObjectId(schoolId);
  const key = invoiceNumberSequenceKey(schoolObjectId, year);
  const increment = () =>
    InvoiceNumberSequence.findOneAndUpdate(
      { _id: key },
      { $inc: { seq: count } },
      { new: true, projection: { seq: 1 } }
    ).lean<{ seq: number } | null>();

  let counter = await increment();
  if (!counter) {
    await seedCounterIfMissing(key, schoolObjectId, year);
    counter = await increment();
  }
  if (!counter || !Number.isSafeInteger(counter.seq)) {
    throw new Error("Failed to allocate invoice number");
  }

  const lastSequence = counter.seq;
  const firstSequence = lastSequence - count + 1;
  const numbers = Array.from({ length: count }, (_, i) =>
    generateInvoiceNumber(year, firstSequence + i)
  );
  return { year, firstSequence, lastSequence, numbers };
}

export async function allocateInvoiceNumber(
  schoolId: Types.ObjectId | string,
  year?: number
): Promise<string> {
  const allocation = await allocateInvoiceNumbers({ schoolId, count: 1, year });
  return allocation.numbers[0]!;
}
