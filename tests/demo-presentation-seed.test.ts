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
      const paymentsAfterFirst = await Payment.countDocuments({
        schoolId: school._id,
        idempotencyKey: { $regex: `^${PRESENTATION_SEED_MARKER}` },
      });
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
        1
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
    },
    { timeout: 180_000 }
  );
});
