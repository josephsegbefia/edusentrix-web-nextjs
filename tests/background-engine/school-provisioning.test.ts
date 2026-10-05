import assert from "node:assert/strict";
import { after, before, beforeEach, describe, test } from "node:test";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { stubServerOnly } from "../regression/helpers/stub-server-only";

stubServerOnly();

const DB_NAME = "background_school_provisioning";
let mongod: MongoMemoryServer;
let sendCalls: Array<{ id?: string; name: string; data: Record<string, unknown> }>;
before(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();
  process.env.MONGO_DB_NAME = DB_NAME;
  const { connectToDatabase } = await import("../../src/db/connectToDatabase");
  await connectToDatabase();
  const { BackgroundJob } = await import("../../src/models/BackgroundJob");
  await BackgroundJob.syncIndexes();
}, { timeout: 180_000 });

after(async () => {
  await mongoose.disconnect().catch(() => undefined);
  await mongod?.stop();
});

beforeEach(async () => {
  sendCalls = [];
  const { inngestEventPort } = await import("../../src/lib/background/inngest-port");
  inngestEventPort.send = async (event) => {
    sendCalls.push(event);
    return { ids: ["evt_ok"] };
  };
  const db = mongoose.connection.db;
  if (!db) return;
  for (const collection of await db.collections()) {
    await collection.deleteMany({});
  }
});

describe("SCHOOL_PROVISIONING", () => {
  test("enqueue creates a BackgroundJob after persisting the domain row", async () => {
    const schoolId = new mongoose.Types.ObjectId();
    const userId = new mongoose.Types.ObjectId();
    const { School } = await import("../../src/models/School");
    await School.create({ _id: schoolId, name: "Pay School", type: "Basic", status: "active" });
    const { enqueueSchoolPaymentProvisioning } = await import(
      "../../src/lib/jobs/payment-provisioning"
    );
    await enqueueSchoolPaymentProvisioning({ schoolId, requestedBy: userId });
    assert.equal(sendCalls.length, 1);
    assert.equal(sendCalls[0]?.data.kind, "SCHOOL_PROVISIONING");
    const { ProvisioningJob } = await import("../../src/models/ProvisioningJob");
    const domain = await ProvisioningJob.findOne({ schoolId });
    assert.equal(domain?.status, "pending");
    assert.ok(domain?.backgroundJobId);
  });

  test("skips Paystack when a valid subaccount already exists", async () => {
    const schoolId = new mongoose.Types.ObjectId();
    const { School } = await import("../../src/models/School");
    await School.create({
      _id: schoolId,
      name: "Pay School",
      type: "Basic",
      status: "active",
      billing: { paystack: { subaccountCode: "ACCT_already1" } },
    });
    const { ProvisioningJob } = await import("../../src/models/ProvisioningJob");
    const domain = await ProvisioningJob.create({
      kind: "paystack_subaccount",
      schoolId,
      status: "pending",
    });
    const { BackgroundJob } = await import("../../src/models/BackgroundJob");
    const bg = await BackgroundJob.create({
      kind: "SCHOOL_PROVISIONING",
      schoolId,
      tenantKey: `school:${String(schoolId)}`,
      status: "running",
      queuedAt: new Date(),
      input: { provisioningJobId: String(domain._id) },
    });
    const { executeSchoolProvisioning } = await import(
      "../../src/lib/jobs/execute-school-provisioning"
    );
    const result = await executeSchoolProvisioning({
      job: bg,
      updateProgress: async () => undefined,
      isCancellationRequested: async () => false,
      throwIfCancellationRequested: async () => undefined,
    });
    assert.equal(result.alreadyProvisioned, true);
    const fresh = await ProvisioningJob.findById(domain._id);
    assert.equal(fresh?.status, "done");
  });
});
