import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { LibraryBook } from "../src/models/LibraryBook";
import { LibraryBookCopy } from "../src/models/LibraryBookCopy";
import { LibraryLoan } from "../src/models/LibraryLoan";
import { LibrarySettings } from "../src/models/LibrarySettings";
import { LibraryImportJob } from "../src/models/LibraryImportJob";
import { LibraryNotice } from "../src/models/LibraryNotice";
import { AcademicPeriod } from "../src/models/AcademicPeriod";
import { Invoice } from "../src/models/Invoice";
import { InvoiceLineItem } from "../src/models/InvoiceLineItem";
import { Student } from "../src/models/Student";
import { Grade } from "../src/models/Grade";
import { ClassGroup } from "../src/models/ClassGroup";
import { Teacher } from "../src/models/Teacher";
import { User } from "../src/models/User";
import {
  createLibraryBook,
  listLibraryBooks,
  updateLibraryBook,
} from "../src/lib/library/library-book.service";
import {
  createLibraryCopy,
  ensureLibraryCopyScannableCodes,
  listCopiesForBook,
  lookupLibraryCopyByCode,
  updateLibraryCopy,
} from "../src/lib/library/library-copy.service";
import {
  recommendLibraryBooksForBorrower,
  recommendLibraryBooksForGrade,
  recommendLibraryBooksForWardStudents,
} from "../src/lib/library/library-recommendations.service";
import {
  getOrCreateLibrarySettings,
  patchLibrarySettingsDb,
} from "../src/lib/library/library-settings.service";
import {
  issueLibraryLoan,
  listBorrowerLoanHistory,
  listLibraryLoans,
  renewLibraryLoan,
  returnLibraryLoan,
  waiveLibraryLoanFine,
} from "../src/lib/library/library-loan.service";
import { markOpenLoansOverdueForSchool } from "../src/lib/library/library-jobs";
import { syncBookCountersFromCopies } from "../src/lib/library/library-book-counters";
import { createAndRunLibraryImport } from "../src/lib/library/library-import.service";
import { runLibraryReport } from "../src/lib/library/library-report.service";

let replSet: MongoMemoryReplSet;

before(
  async () => {
    replSet = await MongoMemoryReplSet.create({
      replSet: { count: 1, name: "rs0" },
    });
    await mongoose.connect(replSet.getUri());
  },
  { timeout: 180_000 }
);

after(async () => {
  await mongoose.disconnect();
  await replSet.stop();
});

beforeEach(async () => {
  await mongoose.connection.db?.dropDatabase();
  await LibraryBook.syncIndexes();
  await LibraryBookCopy.syncIndexes();
  await LibraryLoan.syncIndexes();
  await LibrarySettings.syncIndexes();
  await LibraryImportJob.syncIndexes();
  await LibraryNotice.syncIndexes();
});

test("createLibraryBook seeds initial copies and counters", async () => {
  const schoolId = new mongoose.Types.ObjectId();
  const userId = new mongoose.Types.ObjectId();
  const book = await createLibraryBook(schoolId, userId, {
    title: "Formulas",
    initialCopies: 2,
    tags: [],
    gradeLevelIds: [],
    language: "English",
  });
  assert.equal(book.totalCopies, 2);
  assert.equal(book.availableCopies, 2);
  const copies = await listCopiesForBook(schoolId, book._id);
  assert.equal(copies.length, 2);
});

test("listLibraryBooks uses text index search on category", async () => {
  const schoolId = new mongoose.Types.ObjectId();
  const userId = new mongoose.Types.ObjectId();
  await createLibraryBook(schoolId, userId, {
    title: "Hidden Title",
    category: "Biology",
    initialCopies: 0,
    tags: [],
    gradeLevelIds: [],
    language: "English",
  });
  await createLibraryBook(schoolId, userId, {
    title: "Other",
    category: "Physics",
    initialCopies: 0,
    tags: [],
    gradeLevelIds: [],
    language: "English",
  });

  const { items, total } = await listLibraryBooks(schoolId, {
    page: 1,
    limit: 20,
    search: "Biology",
    status: "active",
    sortBy: "updatedAt",
    sortOrder: "desc",
  });
  assert.equal(total, 1);
  assert.equal(items[0]?.title, "Hidden Title");
});

test("listLibraryBooks sorts by title ascending", async () => {
  const schoolId = new mongoose.Types.ObjectId();
  const userId = new mongoose.Types.ObjectId();
  await createLibraryBook(schoolId, userId, {
    title: "Zebra tales",
    initialCopies: 0,
    tags: [],
    gradeLevelIds: [],
    language: "English",
  });
  await createLibraryBook(schoolId, userId, {
    title: "Apple anthology",
    initialCopies: 0,
    tags: [],
    gradeLevelIds: [],
    language: "English",
  });

  const { items } = await listLibraryBooks(schoolId, {
    page: 1,
    limit: 20,
    status: "all",
    sortBy: "title",
    sortOrder: "asc",
  });
  assert.equal(items[0]?.title, "Apple anthology");
  assert.equal(items[1]?.title, "Zebra tales");
});

test("updateLibraryBook can archive a title", async () => {
  const schoolId = new mongoose.Types.ObjectId();
  const userId = new mongoose.Types.ObjectId();
  const created = await createLibraryBook(schoolId, userId, {
    title: "Temp",
    initialCopies: 0,
    tags: [],
    gradeLevelIds: [],
    language: "English",
  });
  const updated = await updateLibraryBook(schoolId, created._id, userId, {
    status: "archived",
  });
  assert.ok(updated);
  assert.equal(updated?.status, "archived");
  const listed = await listLibraryBooks(schoolId, {
    page: 1,
    limit: 10,
    status: "active",
    sortBy: "updatedAt",
    sortOrder: "desc",
  });
  assert.equal(listed.total, 0);
});

test("createLibraryCopy rejects duplicate copyCode", async () => {
  const schoolId = new mongoose.Types.ObjectId();
  const userId = new mongoose.Types.ObjectId();
  const book = await createLibraryBook(schoolId, userId, {
    title: "One book",
    initialCopies: 0,
    tags: [],
    gradeLevelIds: [],
    language: "English",
  });
  await createLibraryCopy(schoolId, book._id, userId, {
    copyCode: "X-1",
    condition: "good",
    status: "available",
    source: "purchase",
  });
  await assert.rejects(
    async () =>
      createLibraryCopy(schoolId, book._id, userId, {
        copyCode: "X-1",
        condition: "good",
        status: "available",
        source: "purchase",
      }),
    (e: unknown) => e instanceof Error && e.message.includes("already exists")
  );
});

test("updateLibraryCopy blocks illicit edits on borrowed copy", async () => {
  const schoolId = new mongoose.Types.ObjectId();
  const userId = new mongoose.Types.ObjectId();
  const book = await createLibraryBook(schoolId, userId, {
    title: "Loaned",
    initialCopies: 0,
    tags: [],
    gradeLevelIds: [],
    language: "English",
  });
  const copy = await createLibraryCopy(schoolId, book._id, userId, {
    copyCode: "L-1",
    condition: "good",
    status: "available",
    source: "purchase",
  });
  await LibraryBookCopy.updateOne(
    { _id: copy._id },
    { $set: { status: "borrowed" } }
  );
  await syncBookCountersFromCopies(schoolId, book._id);

  await assert.rejects(
    async () =>
      updateLibraryCopy(schoolId, copy._id, userId, { condition: "fair" }),
    (e: unknown) => e instanceof Error && e.message.includes("borrowed")
  );
});

test("library settings getOrCreate and patch", async () => {
  const schoolId = new mongoose.Types.ObjectId();
  const first = await getOrCreateLibrarySettings(schoolId);
  assert.ok(first._id);
  const updated = await patchLibrarySettingsDb(schoolId, { maxRenewals: 5 });
  assert.equal(updated.maxRenewals, 5);
});

test("issue and return library loan updates copy status", async () => {
  const schoolId = new mongoose.Types.ObjectId();
  const staffUserId = new mongoose.Types.ObjectId();
  const borrowerUserId = new mongoose.Types.ObjectId();
  await User.create([
    {
      _id: staffUserId,
      email: `lib-staff-${staffUserId}@test.local`,
      schoolId,
    },
    {
      _id: borrowerUserId,
      email: `lib-borrower-${borrowerUserId}@test.local`,
      schoolId,
      firstName: "Ann",
      lastName: "Lee",
    },
  ]);
  const teacher = await Teacher.create({
    schoolId,
    userId: borrowerUserId,
    status: "active",
  });

  const book = await createLibraryBook(schoolId, staffUserId, {
    title: "Loan flow",
    initialCopies: 1,
    tags: [],
    gradeLevelIds: [],
    language: "English",
  });
  const copies = await listCopiesForBook(schoolId, book._id);
  const copyId = copies[0]!._id;

  const dueAt = new Date();
  dueAt.setDate(dueAt.getDate() + 7);

  const loan = await issueLibraryLoan(schoolId, staffUserId, {
    bookId: String(book._id),
    bookCopyId: String(copyId),
    borrowerType: "teacher",
    borrowerId: String(teacher._id),
    dueAt,
  });
  assert.equal(loan.isOpen, true);

  const copyAfter = await LibraryBookCopy.findById(copyId).lean();
  assert.equal(copyAfter?.status, "borrowed");

  const loanOid = loan._id as mongoose.Types.ObjectId;
  const returned = await returnLibraryLoan(schoolId, staffUserId, loanOid, {
    returnCondition: "good",
    createFeeCharge: false,
  });
  assert.ok(returned);
  assert.equal(returned?.isOpen, false);

  const copyEnd = await LibraryBookCopy.findById(copyId).lean();
  assert.equal(copyEnd?.status, "available");
});

test("renewLibraryLoan extends due date when allowed", async () => {
  const schoolId = new mongoose.Types.ObjectId();
  const staffUserId = new mongoose.Types.ObjectId();
  const borrowerUserId = new mongoose.Types.ObjectId();
  await User.create([
    { _id: staffUserId, email: `lib-r1-${staffUserId}@test.local`, schoolId },
    { _id: borrowerUserId, email: `lib-r2-${borrowerUserId}@test.local`, schoolId },
  ]);
  const teacher = await Teacher.create({
    schoolId,
    userId: borrowerUserId,
    status: "active",
  });
  const book = await createLibraryBook(schoolId, staffUserId, {
    title: "Renew me",
    initialCopies: 1,
    tags: [],
    gradeLevelIds: [],
    language: "English",
  });
  const copies = await listCopiesForBook(schoolId, book._id);
  const copyId = copies[0]!._id;
  const dueAt = new Date();
  dueAt.setDate(dueAt.getDate() + 3);
  const loan = await issueLibraryLoan(schoolId, staffUserId, {
    bookId: String(book._id),
    bookCopyId: String(copyId),
    borrowerType: "teacher",
    borrowerId: String(teacher._id),
    dueAt,
  });
  const newDue = new Date(dueAt);
  newDue.setDate(newDue.getDate() + 10);
  const updated = await renewLibraryLoan(
    schoolId,
    staffUserId,
    loan._id as mongoose.Types.ObjectId,
    { newDueAt: newDue }
  );
  assert.ok(updated);
  assert.equal(updated?.renewalCount, 1);
  assert.equal(updated?.dueAt.getTime(), newDue.getTime());
});

test("markOpenLoansOverdueForSchool sets active loans past due to overdue status", async () => {
  const schoolId = new mongoose.Types.ObjectId();
  const staffUserId = new mongoose.Types.ObjectId();
  const borrowerUserId = new mongoose.Types.ObjectId();
  await User.create([
    { _id: staffUserId, email: `lib-o1-${staffUserId}@test.local`, schoolId },
    { _id: borrowerUserId, email: `lib-o2-${borrowerUserId}@test.local`, schoolId },
  ]);
  const teacher = await Teacher.create({
    schoolId,
    userId: borrowerUserId,
    status: "active",
  });
  const book = await createLibraryBook(schoolId, staffUserId, {
    title: "Overdue job",
    initialCopies: 1,
    tags: [],
    gradeLevelIds: [],
    language: "English",
  });
  const copies = await listCopiesForBook(schoolId, book._id);
  const copyId = copies[0]!._id;
  const dueAt = new Date();
  dueAt.setDate(dueAt.getDate() + 7);
  const loan = await issueLibraryLoan(schoolId, staffUserId, {
    bookId: String(book._id),
    bookCopyId: String(copyId),
    borrowerType: "teacher",
    borrowerId: String(teacher._id),
    dueAt,
  });
  const past = new Date();
  past.setDate(past.getDate() - 3);
  await LibraryLoan.updateOne({ _id: loan._id }, { $set: { dueAt: past } });
  const n = await markOpenLoansOverdueForSchool(schoolId);
  assert.ok(n >= 1);
  const doc = await LibraryLoan.findById(loan._id).lean();
  assert.equal(doc?.status, "overdue");
});

test("returnLibraryLoan applies automatic fine after grace when settings enabled", async () => {
  const schoolId = new mongoose.Types.ObjectId();
  const staffUserId = new mongoose.Types.ObjectId();
  const borrowerUserId = new mongoose.Types.ObjectId();
  await User.create([
    { _id: staffUserId, email: `lib-f1-${staffUserId}@test.local`, schoolId },
    { _id: borrowerUserId, email: `lib-f2-${borrowerUserId}@test.local`, schoolId },
  ]);
  const teacher = await Teacher.create({
    schoolId,
    userId: borrowerUserId,
    status: "active",
  });
  await patchLibrarySettingsDb(schoolId, {
    enableFines: true,
    finePerDay: 2,
    graceDaysAfterDueDate: 0,
  });
  const book = await createLibraryBook(schoolId, staffUserId, {
    title: "Fines",
    initialCopies: 1,
    tags: [],
    gradeLevelIds: [],
    language: "English",
  });
  const copies = await listCopiesForBook(schoolId, book._id);
  const copyId = copies[0]!._id;
  const dueAt = new Date();
  dueAt.setDate(dueAt.getDate() + 7);
  const loan = await issueLibraryLoan(schoolId, staffUserId, {
    bookId: String(book._id),
    bookCopyId: String(copyId),
    borrowerType: "teacher",
    borrowerId: String(teacher._id),
    dueAt,
  });
  const past = new Date();
  past.setDate(past.getDate() - 2);
  await LibraryLoan.updateOne({ _id: loan._id }, { $set: { dueAt: past } });

  const returned = await returnLibraryLoan(schoolId, staffUserId, loan._id as mongoose.Types.ObjectId, {
    returnCondition: "good",
    createFeeCharge: false,
  });
  assert.ok(returned);
  assert.equal(returned?.fineStatus, "pending");
  assert.ok((returned?.fineAmount ?? 0) >= 4);
});

test("waiveLibraryLoanFine clears pending fine on closed loan", async () => {
  const schoolId = new mongoose.Types.ObjectId();
  const staffUserId = new mongoose.Types.ObjectId();
  const waivingUserId = new mongoose.Types.ObjectId();
  const borrowerUserId = new mongoose.Types.ObjectId();
  await User.create([
    { _id: staffUserId, email: `lib-w1-${staffUserId}@test.local`, schoolId },
    { _id: waivingUserId, email: `lib-wa-${waivingUserId}@test.local`, schoolId },
    { _id: borrowerUserId, email: `lib-w2-${borrowerUserId}@test.local`, schoolId },
  ]);
  const teacher = await Teacher.create({
    schoolId,
    userId: borrowerUserId,
    status: "active",
  });
  await patchLibrarySettingsDb(schoolId, {
    enableFines: true,
    finePerDay: 1,
    graceDaysAfterDueDate: 0,
  });
  const book = await createLibraryBook(schoolId, staffUserId, {
    title: "Waive",
    initialCopies: 1,
    tags: [],
    gradeLevelIds: [],
    language: "English",
  });
  const copies = await listCopiesForBook(schoolId, book._id);
  const copyId = copies[0]!._id;
  const dueAt = new Date();
  dueAt.setDate(dueAt.getDate() + 1);
  const loan = await issueLibraryLoan(schoolId, staffUserId, {
    bookId: String(book._id),
    bookCopyId: String(copyId),
    borrowerType: "teacher",
    borrowerId: String(teacher._id),
    dueAt,
  });
  const past = new Date();
  past.setDate(past.getDate() - 1);
  await LibraryLoan.updateOne({ _id: loan._id }, { $set: { dueAt: past } });
  await returnLibraryLoan(schoolId, staffUserId, loan._id as mongoose.Types.ObjectId, {
    returnCondition: "good",
    createFeeCharge: false,
  });

  const waived = await waiveLibraryLoanFine(
    schoolId,
    waivingUserId,
    loan._id as mongoose.Types.ObjectId,
    "Parent conference"
  );
  assert.ok(waived);
  assert.equal(waived?.fineStatus, "waived");
});

test("listLibraryLoans fines_pending bucket lists closed loans with pending fine", async () => {
  const schoolId = new mongoose.Types.ObjectId();
  const staffUserId = new mongoose.Types.ObjectId();
  const borrowerUserId = new mongoose.Types.ObjectId();
  await User.create([
    { _id: staffUserId, email: `lib-p1-${staffUserId}@test.local`, schoolId },
    { _id: borrowerUserId, email: `lib-p2-${borrowerUserId}@test.local`, schoolId },
  ]);
  const teacher = await Teacher.create({
    schoolId,
    userId: borrowerUserId,
    status: "active",
  });
  await patchLibrarySettingsDb(schoolId, {
    enableFines: true,
    finePerDay: 1,
    graceDaysAfterDueDate: 0,
  });
  const book = await createLibraryBook(schoolId, staffUserId, {
    title: "Bucket",
    initialCopies: 1,
    tags: [],
    gradeLevelIds: [],
    language: "English",
  });
  const copies = await listCopiesForBook(schoolId, book._id);
  const copyId = copies[0]!._id;
  const dueAt = new Date();
  dueAt.setDate(dueAt.getDate() + 1);
  const loan = await issueLibraryLoan(schoolId, staffUserId, {
    bookId: String(book._id),
    bookCopyId: String(copyId),
    borrowerType: "teacher",
    borrowerId: String(teacher._id),
    dueAt,
  });
  const past = new Date();
  past.setDate(past.getDate() - 1);
  await LibraryLoan.updateOne({ _id: loan._id }, { $set: { dueAt: past } });
  await returnLibraryLoan(schoolId, staffUserId, loan._id as mongoose.Types.ObjectId, {
    returnCondition: "good",
    createFeeCharge: false,
  });

  const { items, total } = await listLibraryLoans(schoolId, {
    page: 1,
    limit: 20,
    bucket: "fines_pending",
    sortBy: "returnedAt",
    sortOrder: "desc",
  });
  assert.equal(total, 1);
  assert.equal(items[0]?.fineStatus, "pending");
});

test("renewLibraryLoan restores status to active when loan was overdue", async () => {
  const schoolId = new mongoose.Types.ObjectId();
  const staffUserId = new mongoose.Types.ObjectId();
  const borrowerUserId = new mongoose.Types.ObjectId();
  await User.create([
    { _id: staffUserId, email: `lib-a1-${staffUserId}@test.local`, schoolId },
    { _id: borrowerUserId, email: `lib-a2-${borrowerUserId}@test.local`, schoolId },
  ]);
  const teacher = await Teacher.create({
    schoolId,
    userId: borrowerUserId,
    status: "active",
  });
  const book = await createLibraryBook(schoolId, staffUserId, {
    title: "Renew overdue",
    initialCopies: 1,
    tags: [],
    gradeLevelIds: [],
    language: "English",
  });
  const copies = await listCopiesForBook(schoolId, book._id);
  const copyId = copies[0]!._id;
  const dueAt = new Date();
  dueAt.setDate(dueAt.getDate() + 1);
  const loan = await issueLibraryLoan(schoolId, staffUserId, {
    bookId: String(book._id),
    bookCopyId: String(copyId),
    borrowerType: "teacher",
    borrowerId: String(teacher._id),
    dueAt,
  });
  const past = new Date();
  past.setDate(past.getDate() - 1);
  await LibraryLoan.updateOne({ _id: loan._id }, { $set: { dueAt: past, status: "overdue" } });
  const newDue = new Date();
  newDue.setDate(newDue.getDate() + 14);
  const updated = await renewLibraryLoan(
    schoolId,
    staffUserId,
    loan._id as mongoose.Types.ObjectId,
    { newDueAt: newDue }
  );
  assert.ok(updated);
  assert.equal(updated?.status, "active");
});

test("library CSV import records row-level errors", async () => {
  const schoolId = new mongoose.Types.ObjectId();
  const userId = new mongoose.Types.ObjectId();
  await User.create([{ _id: userId, email: `csv-${userId}@test.local`, schoolId }]);
  const csv = "title,initialCopies\nGood Row,1\n,1\n";
  const job = await createAndRunLibraryImport(schoolId, userId, {
    type: "books",
    fileName: "books.csv",
    csvText: csv,
  });
  assert.ok(job.successfulRows >= 1);
  assert.ok(job.failedRows >= 1);
  assert.equal(job.status, "completed_with_errors");
});

test("runLibraryReport most_borrowed is school-scoped", async () => {
  const schoolA = new mongoose.Types.ObjectId();
  const schoolB = new mongoose.Types.ObjectId();
  const userA = new mongoose.Types.ObjectId();
  const userB = new mongoose.Types.ObjectId();
  await User.create([
    { _id: userA, email: `rp-a-${userA}@test.local`, schoolId: schoolA },
    { _id: userB, email: `rp-b-${userB}@test.local`, schoolId: schoolB },
  ]);
  const tA = await Teacher.create({ schoolId: schoolA, userId: userA, status: "active" });
  const tB = await Teacher.create({ schoolId: schoolB, userId: userB, status: "active" });
  const bookA = await createLibraryBook(schoolA, userA, {
    title: "School A",
    initialCopies: 1,
    tags: [],
    gradeLevelIds: [],
    language: "English",
  });
  const bookB = await createLibraryBook(schoolB, userB, {
    title: "School B",
    initialCopies: 1,
    tags: [],
    gradeLevelIds: [],
    language: "English",
  });
  const cA = (await listCopiesForBook(schoolA, bookA._id))[0]!;
  const cB = (await listCopiesForBook(schoolB, bookB._id))[0]!;
  const due = new Date();
  due.setDate(due.getDate() + 7);
  await issueLibraryLoan(schoolA, userA, {
    bookId: String(bookA._id),
    bookCopyId: String(cA._id),
    borrowerType: "teacher",
    borrowerId: String(tA._id),
    dueAt: due,
  });
  await issueLibraryLoan(schoolB, userB, {
    bookId: String(bookB._id),
    bookCopyId: String(cB._id),
    borrowerType: "teacher",
    borrowerId: String(tB._id),
    dueAt: due,
  });
  const loanA = await LibraryLoan.findOne({ schoolId: schoolA }).lean();
  assert.ok(loanA);
  await returnLibraryLoan(schoolA, userA, loanA!._id as mongoose.Types.ObjectId, {
    returnCondition: "good",
    createFeeCharge: false,
  });

  const rA = await runLibraryReport(schoolA, { type: "most_borrowed", limit: 10 });
  const rB = await runLibraryReport(schoolB, { type: "most_borrowed", limit: 10 });
  assert.equal(rA.type, "most_borrowed");
  assert.equal(rB.type, "most_borrowed");
  assert.equal(rA.rows.length, 1);
  assert.equal(rB.rows.length, 0);
});

test("listBorrowerLoanHistory returns loans for borrower", async () => {
  const schoolId = new mongoose.Types.ObjectId();
  const staffUserId = new mongoose.Types.ObjectId();
  const borrowerUserId = new mongoose.Types.ObjectId();
  await User.create([
    { _id: staffUserId, email: `bh1-${staffUserId}@test.local`, schoolId },
    { _id: borrowerUserId, email: `bh2-${borrowerUserId}@test.local`, schoolId },
  ]);
  const teacher = await Teacher.create({
    schoolId,
    userId: borrowerUserId,
    status: "active",
  });
  const book = await createLibraryBook(schoolId, staffUserId, {
    title: "Hist",
    initialCopies: 1,
    tags: [],
    gradeLevelIds: [],
    language: "English",
  });
  const copyId = (await listCopiesForBook(schoolId, book._id))[0]!._id;
  const dueAt = new Date();
  dueAt.setDate(dueAt.getDate() + 5);
  await issueLibraryLoan(schoolId, staffUserId, {
    bookId: String(book._id),
    bookCopyId: String(copyId),
    borrowerType: "teacher",
    borrowerId: String(teacher._id),
    dueAt,
  });
  const { items, total } = await listBorrowerLoanHistory(
    schoolId,
    "teacher",
    teacher._id as mongoose.Types.ObjectId,
    { page: 1, limit: 10 }
  );
  assert.equal(total, 1);
  assert.equal(items.length, 1);
});

test("lookupLibraryCopyByCode resolves copyCode, barcode, and generated QR", async () => {
  const schoolId = new mongoose.Types.ObjectId();
  const userId = new mongoose.Types.ObjectId();
  const book = await createLibraryBook(schoolId, userId, {
    title: "Lookup book",
    initialCopies: 1,
    tags: [],
    gradeLevelIds: [],
    language: "English",
  });
  const copy = (await listCopiesForBook(schoolId, book._id))[0]!;
  await updateLibraryCopy(schoolId, copy._id, userId, {
    copyCode: "LK-9",
    barcode: "WEDGE-42",
  });
  const byCopy = await lookupLibraryCopyByCode(schoolId, "LK-9");
  assert.equal(String(byCopy?._id), String(copy._id));
  const byBar = await lookupLibraryCopyByCode(schoolId, "WEDGE-42");
  assert.equal(String(byBar?._id), String(copy._id));
  await ensureLibraryCopyScannableCodes(schoolId, copy._id, userId);
  const refreshed = (await listCopiesForBook(schoolId, book._id))[0]!;
  assert.ok(refreshed.qrCode?.startsWith("EDU:"));
  const byQr = await lookupLibraryCopyByCode(schoolId, refreshed.qrCode!);
  assert.equal(String(byQr?._id), String(copy._id));
});

test("recommendLibraryBooksForBorrower ranks untagged catalogue when no history", async () => {
  const schoolId = new mongoose.Types.ObjectId();
  const userId = new mongoose.Types.ObjectId();
  await User.create([{ _id: userId, email: `pop-${userId}@test.local`, schoolId }]);
  const teacher = await Teacher.create({
    schoolId,
    userId,
    status: "active",
  });
  await createLibraryBook(schoolId, userId, {
    title: "Only Popular",
    initialCopies: 1,
    tags: [],
    gradeLevelIds: [],
    language: "English",
  });
  const recs = await recommendLibraryBooksForBorrower(
    schoolId,
    "teacher",
    teacher._id as mongoose.Types.ObjectId,
    5
  );
  assert.equal(recs.length, 1);
  assert.equal(recs[0]?.title, "Only Popular");
});

test("recommendLibraryBooksForBorrower suggests by overlapping tags", async () => {
  const schoolId = new mongoose.Types.ObjectId();
  const userId = new mongoose.Types.ObjectId();
  await User.create([{ _id: userId, email: `tag-${userId}@test.local`, schoolId }]);
  const teacher = await Teacher.create({
    schoolId,
    userId,
    status: "active",
  });
  const b1 = await createLibraryBook(schoolId, userId, {
    title: "First adventure",
    initialCopies: 1,
    tags: ["adventure"],
    gradeLevelIds: [],
    language: "English",
  });
  const b2 = await createLibraryBook(schoolId, userId, {
    title: "Second adventure",
    initialCopies: 1,
    tags: ["adventure"],
    gradeLevelIds: [],
    language: "English",
  });
  const c1 = (await listCopiesForBook(schoolId, b1._id))[0]!;
  const dueAt = new Date();
  dueAt.setDate(dueAt.getDate() + 7);
  await issueLibraryLoan(schoolId, userId, {
    bookId: String(b1._id),
    bookCopyId: String(c1._id),
    borrowerType: "teacher",
    borrowerId: String(teacher._id),
    dueAt,
  });
  const recs = await recommendLibraryBooksForBorrower(
    schoolId,
    "teacher",
    teacher._id as mongoose.Types.ObjectId,
    10
  );
  const titles = recs.map((r) => r.title);
  assert.ok(titles.includes("Second adventure"));
  assert.ok(!titles.includes("First adventure"));
});

test("recommendLibraryBooksForWardStudents with no wards yields school popular titles", async () => {
  const schoolId = new mongoose.Types.ObjectId();
  const userId = new mongoose.Types.ObjectId();
  await createLibraryBook(schoolId, userId, {
    title: "Ward fallback popular",
    initialCopies: 1,
    tags: [],
    gradeLevelIds: [],
    language: "English",
  });
  const recs = await recommendLibraryBooksForWardStudents(schoolId, [], 5);
  assert.equal(recs.length, 1);
  assert.equal(recs[0]?.title, "Ward fallback popular");
});

test("recommendLibraryBooksForGrade lists titles tagged for grade", async () => {
  const schoolId = new mongoose.Types.ObjectId();
  const userId = new mongoose.Types.ObjectId();
  const gradeId = new mongoose.Types.ObjectId();
  await createLibraryBook(schoolId, userId, {
    title: "Grade match",
    initialCopies: 1,
    tags: [],
    gradeLevelIds: [gradeId],
    language: "English",
  });
  await createLibraryBook(schoolId, userId, {
    title: "Other grade",
    initialCopies: 1,
    tags: [],
    gradeLevelIds: [new mongoose.Types.ObjectId()],
    language: "English",
  });
  const recs = await recommendLibraryBooksForGrade(schoolId, gradeId, 10);
  assert.equal(recs.length, 1);
  assert.equal(recs[0]?.title, "Grade match");
});

test("returnLibraryLoan links student fine to invoice line item for current period", async () => {
  await AcademicPeriod.syncIndexes();
  await Invoice.syncIndexes();
  await InvoiceLineItem.syncIndexes();
  await Student.syncIndexes();

  const schoolId = new mongoose.Types.ObjectId();
  const staffUserId = new mongoose.Types.ObjectId();
  const studentUserId = new mongoose.Types.ObjectId();
  await User.create([
    { _id: staffUserId, email: `lib-fee-adm-${staffUserId}@test.local`, schoolId },
    {
      _id: studentUserId,
      email: `lib-fee-stu-${studentUserId}@test.local`,
      schoolId,
      firstName: "Pat",
      lastName: "Lee",
    },
  ]);
  await AcademicPeriod.create({
    schoolId,
    yearLabel: "2026/2027",
    term: "T1",
    startDate: new Date("2026-01-01"),
    endDate: new Date("2026-12-31"),
    isCurrent: true,
  });
  const gradeId = new mongoose.Types.ObjectId();
  await Grade.create({
    _id: gradeId,
    schoolId,
    name: "Lib fee grade",
    isActive: true,
  });
  const classGroupId = new mongoose.Types.ObjectId();
  await ClassGroup.create({
    _id: classGroupId,
    schoolId,
    gradeId,
    name: "A",
    isActive: true,
  });
  const student = await Student.create({
    schoolId,
    userId: studentUserId,
    gradeId,
    classGroupId,
    firstName: "Pat",
    lastName: "Lee",
    status: "active",
  });

  await patchLibrarySettingsDb(schoolId, {
    enableFines: true,
    finePerDay: 2,
    graceDaysAfterDueDate: 0,
    enableReplacementFees: true,
  });

  const book = await createLibraryBook(schoolId, staffUserId, {
    title: "Fee invoice",
    initialCopies: 1,
    tags: [],
    gradeLevelIds: [],
    language: "English",
  });
  const copies = await listCopiesForBook(schoolId, book._id);
  const dueAt = new Date();
  dueAt.setDate(dueAt.getDate() + 7);
  const loan = await issueLibraryLoan(schoolId, staffUserId, {
    bookId: String(book._id),
    bookCopyId: String(copies[0]!._id),
    borrowerType: "student",
    borrowerId: String(student._id),
    dueAt,
  });
  const pastDue = new Date();
  pastDue.setDate(pastDue.getDate() - 2);
  await LibraryLoan.updateOne({ _id: loan._id }, { $set: { dueAt: pastDue } });

  const returned = await returnLibraryLoan(
    schoolId,
    staffUserId,
    loan._id as mongoose.Types.ObjectId,
    {
      returnCondition: "good",
      createFeeCharge: true,
    }
  );
  assert.ok(returned?.linkedFeeId);
  const line = await InvoiceLineItem.findById(returned!.linkedFeeId).lean();
  assert.ok(line);
  assert.equal(line?.name, "Library charge");
  assert.ok(line && line.amountMinor >= 100);
  const inv = await Invoice.findOne({ schoolId, studentId: student._id }).lean();
  assert.ok(inv);
  assert.equal(inv?.status, "draft");
});
