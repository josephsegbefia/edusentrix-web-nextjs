/**
 * Regression suite for the invoice-number collision fix.
 * See docs/FINANCIAL_BACKGROUND_FINDINGS_VERIFICATION.md (Claim 1) for the original defect.
 *
 * Exercises the real POST handlers of /api/admin/fees/invoices and
 * /api/admin/fees/invoices/bulk (auth and subscription gate stubbed) and the
 * real library-fee invoice path. In-memory MongoDB replica set only.
 */
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, mock, test } from "node:test";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { connectToDatabase } from "../../src/db/connectToDatabase";
import { Invoice } from "../../src/models/Invoice";
import { InvoiceLineItem } from "../../src/models/InvoiceLineItem";
import { InvoiceEvent } from "../../src/models/InvoiceEvent";
import { InstallmentSchedule } from "../../src/models/InstallmentSchedule";
import { InvoiceNumberSequence } from "../../src/models/InvoiceNumberSequence";
import { Student } from "../../src/models/Student";
import { AcademicPeriod } from "../../src/models/AcademicPeriod";
import { allocateInvoiceNumbers } from "../../src/lib/fees/invoice-numbering";
import { generateInvoiceNumber } from "../../src/lib/fees/invoice-utils";
import { disableAutoIndexing } from "./helpers/disable-auto-indexing";
import { setFinanceRouteContext, stubFinanceRouteDeps } from "./helpers/stub-finance-route-deps";

stubFinanceRouteDeps();

const DB_NAME = "invoice_numbering_regression";
const YEAR = new Date().getFullYear();
const inv = (sequence: number, year = YEAR) => generateInvoiceNumber(year, sequence);

type Handler = (req: unknown) => Promise<Response>;
let replSet: MongoMemoryReplSet;
let singlePOST: Handler;
let bulkPOST: Handler;
let persistStudentLibraryReturnFees: typeof import("../../src/lib/library/library-fee-persistence").persistStudentLibraryReturnFees;
let NextRequestCtor: new (url: string, init: Record<string, unknown>) => unknown;

const MODELS = [
  Invoice,
  InvoiceLineItem,
  InvoiceEvent,
  InstallmentSchedule,
  InvoiceNumberSequence,
  Student,
  AcademicPeriod,
] as mongoose.Model<any>[];

before(
  async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, name: "rs0" } });
    process.env.MONGODB_URI = replSet.getUri();
    process.env.MONGO_DB_NAME = DB_NAME;
    ({ NextRequest: NextRequestCtor } = (await import("next/server")) as never);
    ({ POST: singlePOST } = (await import("../../src/app/api/admin/fees/invoices/route")) as never);
    ({ POST: bulkPOST } = (await import("../../src/app/api/admin/fees/invoices/bulk/route")) as never);
    ({ persistStudentLibraryReturnFees } = await import("../../src/lib/library/library-fee-persistence"));
    disableAutoIndexing();
    await connectToDatabase();
    // Collections exist up front so concurrent transactions never race to create them.
    for (const model of MODELS) await model.createCollection();
    await Invoice.createIndexes();
  },
  { timeout: 180_000 }
);

after(async () => {
  mock.restoreAll();
  await mongoose.disconnect();
  await replSet.stop();
});

beforeEach(async () => {
  for (const model of MODELS) await model.deleteMany({});
});

const oid = () => new mongoose.Types.ObjectId();

async function seedSchool(studentCount: number) {
  const schoolId = oid();
  const userId = oid();
  const periodId = oid();
  await AcademicPeriod.collection.insertOne({
    _id: periodId,
    schoolId,
    isCurrent: true,
    startDate: new Date(Date.now() - 30 * 86_400_000),
    endDate: new Date(Date.now() + 60 * 86_400_000),
    yearLabel: `${YEAR}/${YEAR + 1}`,
    term: 1,
  });
  const studentIds = Array.from({ length: studentCount }, () => oid());
  if (studentIds.length > 0) {
    await Student.collection.insertMany(
      studentIds.map((_id, i) => ({ _id, schoolId, firstName: "Student", lastName: String(i + 1) }))
    );
  }
  return { schoolId, userId, periodId, studentIds };
}

type School = Awaited<ReturnType<typeof seedSchool>>;

function jsonRequest(url: string, body: unknown) {
  return new NextRequestCtor(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** Calls the real single-create handler. Context is captured synchronously by the auth stub. */
function createSingle(school: School, studentId: mongoose.Types.ObjectId) {
  setFinanceRouteContext({ schoolId: school.schoolId, userId: school.userId });
  return singlePOST(
    jsonRequest("http://localhost/api/admin/fees/invoices", {
      studentId: String(studentId),
      academicPeriodId: String(school.periodId),
      lineItems: [{ name: "Tuition", amount: 100 }],
    })
  );
}

function createBulk(
  school: School,
  studentIds: mongoose.Types.ObjectId[],
  lineItems: unknown[] = [{ name: "Tuition", amount: 100 }]
) {
  setFinanceRouteContext({ schoolId: school.schoolId, userId: school.userId });
  return bulkPOST(
    jsonRequest("http://localhost/api/admin/fees/invoices/bulk", {
      academicPeriodId: String(school.periodId),
      studentIds: studentIds.map(String),
      lineItems,
    })
  );
}

async function singleNumber(res: Response) {
  const body = (await res.json()) as { invoice?: { invoiceNumber: string }; error?: string };
  assert.equal(res.status, 201, `single create failed: ${body.error}`);
  return body.invoice!.invoiceNumber;
}

async function bulkNumbers(res: Response) {
  const body = (await res.json()) as {
    invoices?: Array<{ invoiceNumber: string }>;
    error?: string;
  };
  assert.equal(res.status, 201, `bulk create failed: ${body.error}`);
  return body.invoices!.map((i) => i.invoiceNumber);
}

async function persistedNumbers(schoolId: mongoose.Types.ObjectId) {
  const rows = await Invoice.find({ schoolId }).select("invoiceNumber").lean<Array<{ invoiceNumber: string }>>();
  return rows.map((r) => r.invoiceNumber).sort();
}

const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => inv(from + i));

async function counterSeq(schoolId: mongoose.Types.ObjectId, year = YEAR) {
  const doc = await InvoiceNumberSequence.findById(`invoice:${schoolId}:${year}`).lean();
  return doc?.seq ?? null;
}

describe("1. sequential creation", () => {
  test("single route numbers 0001, 0002, 0003 for one school", async () => {
    const school = await seedSchool(3);
    const numbers: string[] = [];
    for (const studentId of school.studentIds) {
      numbers.push(await singleNumber(await createSingle(school, studentId)));
    }
    assert.deepEqual(numbers, range(1, 3));
    assert.equal(await counterSeq(school.schoolId), 3);
  });

  test("numbers grow past 9999 without wrapping", async () => {
    const school = await seedSchool(1);
    await InvoiceNumberSequence.create({
      _id: `invoice:${school.schoolId}:${YEAR}`,
      schoolId: school.schoolId,
      year: YEAR,
      seq: 9999,
    });
    const number = await singleNumber(await createSingle(school, school.studentIds[0]!));
    assert.equal(number, `INV-${YEAR}-10000`);
  });
});

describe("2. different schools", () => {
  test("each school starts at 0001 and cross-school equal numbers are accepted", async () => {
    const a = await seedSchool(2);
    const b = await seedSchool(2);
    assert.equal(await singleNumber(await createSingle(a, a.studentIds[0]!)), inv(1));
    assert.equal(await singleNumber(await createSingle(b, b.studentIds[0]!)), inv(1));
    assert.equal(await singleNumber(await createSingle(b, b.studentIds[1]!)), inv(2));
    assert.equal(await singleNumber(await createSingle(a, a.studentIds[1]!)), inv(2));
    assert.deepEqual(await persistedNumbers(a.schoolId), range(1, 2));
    assert.deepEqual(await persistedNumbers(b.schoolId), range(1, 2));
  });
});

describe("3. deletion never causes reuse", () => {
  test("hard-deleting invoices does not lower the next number", async () => {
    const school = await seedSchool(5);
    for (const studentId of school.studentIds.slice(0, 3)) {
      await singleNumber(await createSingle(school, studentId));
    }
    // DELETE /invoices/[id] hard-deletes cancelled invoices.
    await Invoice.deleteOne({ schoolId: school.schoolId, invoiceNumber: inv(2) });
    assert.equal(await singleNumber(await createSingle(school, school.studentIds[3]!)), inv(4));

    await Invoice.deleteMany({ schoolId: school.schoolId });
    assert.equal(await singleNumber(await createSingle(school, school.studentIds[4]!)), inv(5));
  });

  test("a missing counter is seeded from the highest existing number, not a count", async () => {
    const school = await seedSchool(1);
    await Invoice.collection.insertMany([
      { schoolId: school.schoolId, studentId: oid(), academicPeriodId: oid(), invoiceNumber: inv(1) },
      { schoolId: school.schoolId, studentId: oid(), academicPeriodId: oid(), invoiceNumber: inv(7) },
      { schoolId: school.schoolId, studentId: oid(), academicPeriodId: oid(), invoiceNumber: "LEGACY-ABC" },
      { schoolId: school.schoolId, studentId: oid(), academicPeriodId: oid(), invoiceNumber: inv(50, YEAR - 1) },
    ]);
    assert.equal(await counterSeq(school.schoolId), null);
    assert.equal(await singleNumber(await createSingle(school, school.studentIds[0]!)), inv(8));
    assert.equal(await counterSeq(school.schoolId), 8);
  });
});

describe("4. concurrent single creates", () => {
  test("12 concurrent requests for one school get 12 distinct numbers 0001-0012", async () => {
    const school = await seedSchool(12);
    const responses = await Promise.all(school.studentIds.map((id) => createSingle(school, id)));
    const numbers = await Promise.all(responses.map(singleNumber));
    assert.equal(new Set(numbers).size, 12);
    assert.deepEqual([...numbers].sort(), range(1, 12));
    assert.deepEqual(await persistedNumbers(school.schoolId), range(1, 12));
    assert.equal(await counterSeq(school.schoolId), 12);
  });
});

describe("5. multi-school concurrent creates", () => {
  test("3 schools x 6 concurrent requests: every school gets 0001-0006, no failures", async () => {
    const schools = await Promise.all([seedSchool(6), seedSchool(6), seedSchool(6)]);
    const responses = await Promise.all(
      schools.flatMap((school) => school.studentIds.map((id) => createSingle(school, id)))
    );
    await Promise.all(responses.map(singleNumber));
    for (const school of schools) {
      assert.deepEqual(await persistedNumbers(school.schoolId), range(1, 6));
    }
  });
});

describe("6. bulk creation", () => {
  test("bulk reserves one contiguous range", async () => {
    const school = await seedSchool(5);
    const numbers = await bulkNumbers(await createBulk(school, school.studentIds));
    assert.deepEqual(numbers, range(1, 5));
    assert.equal(await counterSeq(school.schoolId), 5);
  });

  test("concurrent bulk + single creates never collide", async () => {
    const school = await seedSchool(14);
    const bulkStudents = school.studentIds.slice(0, 5);
    const bulkStudents2 = school.studentIds.slice(5, 10);
    const singles = school.studentIds.slice(10);
    const [bulkA, bulkB, ...singleResponses] = await Promise.all([
      createBulk(school, bulkStudents),
      createBulk(school, bulkStudents2),
      ...singles.map((id) => createSingle(school, id)),
    ]);
    const a = await bulkNumbers(bulkA);
    const b = await bulkNumbers(bulkB);
    const s = await Promise.all(singleResponses.map(singleNumber));

    const seq = (n: string) => Number(n.split("-")[2]);
    for (const batch of [a, b]) {
      assert.equal(seq(batch[batch.length - 1]!) - seq(batch[0]!), batch.length - 1, "bulk range contiguous");
    }
    const all = [...a, ...b, ...s];
    assert.equal(new Set(all).size, 14);
    assert.deepEqual(all.sort(), range(1, 14));
    assert.deepEqual(await persistedNumbers(school.schoolId), range(1, 14));
  });

  test("a failed bulk batch burns its range and never reuses it", async () => {
    const school = await seedSchool(4);
    // A nameless line item fails InvoiceLineItem validation after numbers are reserved.
    const errorLog = mock.method(console, "error", () => undefined);
    const failed = await createBulk(school, school.studentIds.slice(0, 3), [{ amount: 10 }]).finally(() =>
      errorLog.mock.restore()
    );
    assert.equal(failed.status, 500);
    assert.equal(await Invoice.countDocuments({ schoolId: school.schoolId }), 0, "batch rolled back");
    assert.equal(await counterSeq(school.schoolId), 3, "range stays reserved");

    assert.equal(await singleNumber(await createSingle(school, school.studentIds[3]!)), inv(4));
    const retried = await bulkNumbers(await createBulk(school, school.studentIds.slice(0, 3)));
    assert.deepEqual(retried, range(5, 7));
  });
});

describe("7. transaction retry", () => {
  test("a transient retry reuses the reserved number and allocates only once", async () => {
    const school = await seedSchool(2);
    const original = Invoice.create.bind(Invoice);
    let attempts = 0;
    const createMock = mock.method(Invoice, "create", (...args: unknown[]) => {
      attempts += 1;
      if (attempts === 1) {
        const err = new mongoose.mongo.MongoServerError({
          message: "WriteConflict (injected by regression test)",
          code: 112,
          codeName: "WriteConflict",
        });
        err.addErrorLabel("TransientTransactionError");
        return Promise.reject(err);
      }
      return (original as (...a: unknown[]) => unknown)(...args);
    });
    try {
      const number = await singleNumber(await createSingle(school, school.studentIds[0]!));
      assert.equal(attempts, 2, "withTransaction retried once");
      assert.equal(number, inv(1), "retry reused the reserved number");
      assert.equal(await counterSeq(school.schoolId), 1, "only one number allocated");
    } finally {
      createMock.mock.restore();
    }
    assert.equal(await singleNumber(await createSingle(school, school.studentIds[1]!)), inv(2));
  });

  test("library path inside a retried caller transaction leaves a gap, never a duplicate", async () => {
    const school = await seedSchool(2);
    await singleNumber(await createSingle(school, school.studentIds[1]!));
    const session = await mongoose.startSession();
    let calls = 0;
    try {
      await session.withTransaction(async () => {
        calls += 1;
        await persistStudentLibraryReturnFees({
          session,
          schoolId: school.schoolId,
          studentId: school.studentIds[0]!,
          performedBy: school.userId,
          loanId: oid(),
          fineAmountMajor: 5,
          replacementFeeAmountMajor: 0,
        });
        if (calls === 1) {
          const err = new mongoose.mongo.MongoServerError({ message: "injected", code: 112 });
          err.addErrorLabel("TransientTransactionError");
          throw err;
        }
      });
    } finally {
      await session.endSession();
    }
    const numbers = await persistedNumbers(school.schoolId);
    assert.equal(new Set(numbers).size, numbers.length, "no duplicates");
    assert.deepEqual(numbers, [inv(1), inv(3)], "aborted attempt burned 0002");
  });
});

describe("library path", () => {
  test("concurrent library charges and route creates share one sequence", async () => {
    const school = await seedSchool(6);
    const libraryStudents = school.studentIds.slice(0, 3);
    const routeStudents = school.studentIds.slice(3);
    const libraryRuns = libraryStudents.map(async (studentId) => {
      const session = await mongoose.startSession();
      try {
        await session.withTransaction(() =>
          persistStudentLibraryReturnFees({
            session,
            schoolId: school.schoolId,
            studentId,
            performedBy: school.userId,
            loanId: oid(),
            fineAmountMajor: 2,
            replacementFeeAmountMajor: 0,
          })
        );
      } finally {
        await session.endSession();
      }
    });
    const routeRuns = routeStudents.map((id) => createSingle(school, id).then(singleNumber));
    await Promise.all([...libraryRuns, ...routeRuns]);
    const numbers = await persistedNumbers(school.schoolId);
    assert.equal(numbers.length, 6);
    assert.equal(new Set(numbers).size, 6);
    assert.deepEqual(numbers, range(1, 6));
  });
});

describe("8. year boundary", () => {
  test("a new year starts its own sequence at 0001 and the old year continues", async () => {
    const school = await seedSchool(0);
    const y1 = await allocateInvoiceNumbers({ schoolId: school.schoolId, count: 2, year: 2026 });
    const y2 = await allocateInvoiceNumbers({ schoolId: school.schoolId, year: 2027 });
    const y1b = await allocateInvoiceNumbers({ schoolId: school.schoolId, year: 2026 });
    assert.deepEqual(y1.numbers, ["INV-2026-0001", "INV-2026-0002"]);
    assert.deepEqual(y2.numbers, ["INV-2027-0001"]);
    assert.deepEqual(y1b.numbers, ["INV-2026-0003"]);
  });

  test("the single route uses the current year's counter", async () => {
    const school = await seedSchool(2);
    assert.equal(await singleNumber(await createSingle(school, school.studentIds[0]!)), inv(1));
    const nextYear = YEAR + 1;
    const yearMock = mock.method(Date.prototype, "getFullYear", () => nextYear);
    try {
      assert.equal(
        await singleNumber(await createSingle(school, school.studentIds[1]!)),
        generateInvoiceNumber(nextYear, 1)
      );
    } finally {
      yearMock.mock.restore();
    }
    assert.equal(await counterSeq(school.schoolId), 1);
    assert.equal(await counterSeq(school.schoolId, nextYear), 1);
  });
});

describe("9. indexes", () => {
  test("schema declares unique {schoolId, invoiceNumber} and no global invoiceNumber unique", () => {
    const declared = Invoice.schema.indexes();
    const compound = declared.filter(([key]) => Object.keys(key).join(",") === "schoolId,invoiceNumber");
    assert.equal(compound.length, 1);
    assert.equal(compound[0]![1].unique, true);
    assert.equal(compound[0]![1].name, "unique_school_invoice_number");
    assert.equal(
      declared.filter(([key]) => Object.keys(key).join(",") === "invoiceNumber").length,
      0,
      "no single-field invoiceNumber index"
    );
    assert.equal(Invoice.schema.path("invoiceNumber").options.unique, undefined);
  });

  test("database enforces per-school uniqueness and allows cross-school equal numbers", async () => {
    const indexes = await Invoice.collection.indexes();
    assert.equal(indexes.filter((i) => Object.keys(i.key).join(",") === "invoiceNumber").length, 0);
    const schoolA = oid();
    const schoolB = oid();
    const doc = (schoolId: mongoose.Types.ObjectId) => ({
      schoolId,
      studentId: oid(),
      academicPeriodId: oid(),
      invoiceNumber: inv(1),
    });
    await Invoice.collection.insertOne(doc(schoolA));
    await assert.rejects(Invoice.collection.insertOne(doc(schoolA)), /E11000/);
    await Invoice.collection.insertOne(doc(schoolB));
    assert.equal(await Invoice.countDocuments({ invoiceNumber: inv(1) }), 2);
  });
});

describe("allocator input validation", () => {
  test("rejects invalid school ids and counts", async () => {
    await assert.rejects(allocateInvoiceNumbers({ schoolId: "not-an-id" }), /Invalid schoolId/);
    await assert.rejects(allocateInvoiceNumbers({ schoolId: oid(), count: 0 }), /positive integer/);
    await assert.rejects(allocateInvoiceNumbers({ schoolId: oid(), count: 1.5 }), /positive integer/);
  });
});
