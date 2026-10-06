import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { PRESENTATION_OUTSTANDING_CEDIS, PRESENTATION_SEED_MARKER } from "../src/lib/demo/presentation-cast";
import { runPresentationSeed, seedPresentationForSchool } from "../scripts/demo/seed-demo-presentation";

const DB_NAME = "presentation_seed_idempotency";
let mongod: MongoMemoryServer;

describe("presentation seed CLI guard", () => {
  test("runPresentationSeed refuses a non edusentrix-demo database before connecting", async () => {
    const previous = {
      MONGO_DB_NAME: process.env.MONGO_DB_NAME,
      MONGODB_URI: process.env.MONGODB_URI,
    };
    process.env.MONGO_DB_NAME = "edusentrix";
    process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/edusentrix";
    await assert.rejects(
      () => runPresentationSeed({ reset: false }),
      /REFUSED: Presentation demo seeding can only run against edusentrix-demo\.\nCurrent database: edusentrix/
    );
    process.env.MONGO_DB_NAME = previous.MONGO_DB_NAME;
    process.env.MONGODB_URI = previous.MONGODB_URI;
  });
});

describe("presentation seed idempotency", () => {
  before(
    async () => {
      mongod = await MongoMemoryServer.create();
      process.env.MONGODB_URI = mongod.getUri();
      process.env.MONGO_DB_NAME = DB_NAME;
      await mongoose.connect(process.env.MONGODB_URI, { dbName: DB_NAME });
    },
    { timeout: 180_000 }
  );

  after(async () => {
    await mongoose.disconnect().catch(() => undefined);
    await mongod?.stop();
  });

  test(
    "seeding twice does not duplicate presentation records",
    async () => {
      const { School } = await import("../src/models/School");
      const school = await School.create({
        name: "Lighthouse Preparatory School",
        type: "Basic",
        curriculumCode: "ghana_nacca",
        status: "active",
        city: "Accra",
        region: "Greater Accra",
      });

      const first = await seedPresentationForSchool(school._id);
      const Payment = mongoose.model("Payment");
      const AssessmentItem = mongoose.model("AssessmentItem");
      const StudentReportCard = mongoose.model("StudentReportCard");
      const paymentsAfterFirst = await Payment.countDocuments({
        schoolId: school._id,
        idempotencyKey: { $regex: `^${PRESENTATION_SEED_MARKER}` },
      });
      const itemsAfterFirst = await AssessmentItem.countDocuments({
        schoolId: school._id,
        sourceRefType: PRESENTATION_SEED_MARKER,
      });
      const cardAfterFirst = await StudentReportCard.findOne({
        schoolId: school._id,
        studentId: first.studentId,
        status: "released",
      }).lean();
      const second = await seedPresentationForSchool(school._id);
      assert.equal(second.studentId, first.studentId);
      assert.equal(second.outstandingMinor, PRESENTATION_OUTSTANDING_CEDIS * 100);

      const Student = mongoose.model("Student");
      const Invoice = mongoose.model("Invoice");
      const Notice = mongoose.model("Notice");
      const Teacher = mongoose.model("Teacher");
      const Guardian = mongoose.model("Guardian");

      assert.equal(
        await Student.countDocuments({
          schoolId: school._id,
          admissionNo: { $regex: /^PRES-S/ },
        }),
        18
      );
      assert.equal(
        await Invoice.countDocuments({
          schoolId: school._id,
          notes: PRESENTATION_SEED_MARKER,
        }),
        18
      );
      assert.equal(
        await Notice.countDocuments({
          schoolId: school._id,
          message: { $regex: PRESENTATION_SEED_MARKER },
        }),
        4
      );
      assert.equal(
        await Teacher.countDocuments({
          schoolId: school._id,
          tags: PRESENTATION_SEED_MARKER,
        }),
        6
      );
      assert.equal(
        await Guardian.countDocuments({ studentId: first.studentId }),
        1
      );
      const paymentCount = await Payment.countDocuments({
        schoolId: school._id,
        idempotencyKey: { $regex: `^${PRESENTATION_SEED_MARKER}` },
      });
      assert.equal(paymentCount, paymentsAfterFirst);
      assert.ok(paymentCount > 0);
      assert.equal(
        await AssessmentItem.countDocuments({
          schoolId: school._id,
          sourceRefType: PRESENTATION_SEED_MARKER,
        }),
        itemsAfterFirst
      );
      assert.equal(itemsAfterFirst, 30);

      const cards = await StudentReportCard.find({
        schoolId: school._id,
        studentId: first.studentId,
        status: "released",
      }).lean();
      assert.equal(cards.length, 1);
      const card = cards[0]!;
      const rows = card.subjectResultsSnapshot as Array<{
        subjectId?: string;
        subjectName?: string;
        teacherId?: string;
        roundedFinalScore?: number;
        gradeLabel?: string;
        components?: Array<{ componentKey?: string }>;
      }>;
      assert.equal(rows.length, 6);
      const expectedScores: Record<string, number> = {
        Computing: 88,
        Mathematics: 84,
        "Integrated Science": 81,
        "Religious and Moral Education": 79,
        "English Language": 76,
        "Social Studies": 72,
      };
      for (const row of rows) {
        assert.ok(row.subjectId);
        assert.ok(row.subjectName);
        assert.notEqual(row.subjectName, "Subject");
        assert.ok((row.roundedFinalScore ?? 0) > 0);
        assert.ok(row.gradeLabel);
        assert.equal(row.roundedFinalScore, expectedScores[row.subjectName!]);
        const keys = (row.components ?? []).map((component) => component.componentKey).sort();
        assert.deepEqual(keys, ["classwork", "exam"]);
      }
      const firstRows = (cardAfterFirst?.subjectResultsSnapshot ?? []) as Array<{
        subjectName?: string;
        roundedFinalScore?: number;
      }>;
      assert.deepEqual(
        rows.map((row) => [row.subjectName, row.roundedFinalScore]),
        firstRows.map((row) => [row.subjectName, row.roundedFinalScore])
      );

      const policy = card.gradingPolicySnapshot as { scoreComponents?: Array<{ key?: string }> };
      assert.deepEqual(
        (policy.scoreComponents ?? []).map((component) => component.key),
        ["classwork", "exam"]
      );

      const { buildStudentReportCardViewData } = await import(
        "../src/lib/academics/reporting/build-student-report-card-view"
      );
      const view = buildStudentReportCardViewData(card as never, {
        subjectNamesById: new Map(),
        period: { yearLabel: "2026/2027", term: "Term 1" },
        gradeName: "JHS 2",
        classGroupName: "A",
        classGroupLabel: "JHS 2A",
        verificationId: null,
      });
      assert.equal(view.subjects.length, 6);
      assert.ok(view.subjects.every((row) => row.subjectName !== "Subject" && row.roundedFinalScore > 0));
      assert.equal(view.scoreComponents.length, 2);
      const maths = rows.find((row) => row.subjectName === "Mathematics");
      assert.equal(String(maths?.teacherId), String(second.teacherId));
    },
    { timeout: 180_000 }
  );

  test(
    "reuses existing Lighthouse subjects including missing normalizedKey and casing variants",
    async () => {
      const { School } = await import("../src/models/School");
      const { Subject } = await import("../src/models/Subject");
      await Subject.createIndexes();

      const school = await School.create({
        name: "Lighthouse Preparatory School",
        type: "Basic",
        curriculumCode: "ghana_nacca",
        status: "active",
        city: "Accra",
        region: "Greater Accra",
      });

      const mathsId = new mongoose.Types.ObjectId();
      await mongoose.connection.collection("subjects").insertOne({
        _id: mathsId,
        schoolId: school._id,
        name: "Mathematics",
        code: "MAT",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const english = await Subject.create({
        schoolId: school._id,
        name: "english language",
        normalizedKey: "english_language",
        code: "ENG",
        category: "core",
        isActive: true,
      });

      const first = await seedPresentationForSchool(school._id);
      const subjectsAfterFirst = await Subject.find({ schoolId: school._id })
        .collation({ locale: "en", strength: 2 })
        .lean();
      const mathsAfterFirst = subjectsAfterFirst.find(
        (row) => row.name.toLowerCase() === "mathematics"
      );
      const englishAfterFirst = subjectsAfterFirst.find(
        (row) => String(row.normalizedKey) === "english_language"
      );

      assert.equal(String(mathsAfterFirst?._id), String(mathsId));
      assert.equal(mathsAfterFirst?.normalizedKey, "mathematics");
      assert.equal(String(englishAfterFirst?._id), String(english._id));
      assert.equal(
        subjectsAfterFirst.filter((row) =>
          ["mathematics", "english language"].includes(row.name.trim().toLowerCase())
        ).length,
        2
      );

      const second = await seedPresentationForSchool(school._id);
      assert.equal(second.studentId, first.studentId);

      const mathsCount = await Subject.countDocuments({
        schoolId: school._id,
        name: "Mathematics",
      }).collation({ locale: "en", strength: 2 });
      const englishCount = await Subject.countDocuments({
        schoolId: school._id,
        name: "English Language",
      }).collation({ locale: "en", strength: 2 });
      assert.equal(mathsCount, 1);
      assert.equal(englishCount, 1);
      assert.equal(
        await mongoose.model("Student").countDocuments({
          schoolId: school._id,
          admissionNo: { $regex: /^PRES-S/ },
        }),
        18
      );
    },
    { timeout: 180_000 }
  );
});
