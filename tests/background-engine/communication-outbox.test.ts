import assert from "node:assert/strict";
import { after, before, beforeEach, describe, test } from "node:test";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { stubServerOnly } from "../regression/helpers/stub-server-only";

stubServerOnly();

const DB_NAME = "background_communication_outbox";
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

describe("COMMUNICATION_OUTBOX", () => {
  test("enqueues one BackgroundJob per pending delivery", async () => {
    const schoolId = new mongoose.Types.ObjectId();
    const communicationId = new mongoose.Types.ObjectId();
    const deliveryId = new mongoose.Types.ObjectId();
    const { CommunicationOutboxJob } = await import("../../src/models/CommunicationOutboxJob");
    await CommunicationOutboxJob.create({
      schoolId,
      communicationId,
      deliveryId,
      channel: "email",
      status: "pending",
    });
    const { enqueueCommunicationOutboxJobs } = await import(
      "../../src/lib/communications/delivery/enqueue-communication-outbox"
    );
    const result = await enqueueCommunicationOutboxJobs({ schoolId, communicationId });
    assert.equal(result.enqueued, 1);
    assert.equal(sendCalls[0]?.data.kind, "COMMUNICATION_OUTBOX");
    const payload = JSON.stringify(sendCalls[0]?.data);
    assert.doesNotMatch(payload, /bodyHtml|htmlContent|csv/i);
  });

  test("already-delivered outbox jobs succeed without sending again", async () => {
    const schoolId = new mongoose.Types.ObjectId();
    const communicationId = new mongoose.Types.ObjectId();
    const outputEntityId = new mongoose.Types.ObjectId();
    const { Communication } = await import("../../src/models/Communication");
    const { CommunicationDelivery } = await import("../../src/models/CommunicationDelivery");
    const { CommunicationOutboxJob } = await import("../../src/models/CommunicationOutboxJob");
    await Communication.create({
      _id: communicationId,
      schoolId,
      title: "Hello",
      bodyText: "Body",
      bodyHtml: "<p>Body</p>",
      type: "announcement",
      channels: ["email"],
      status: "queued",
      audience: { mode: "all" },
      createdByUserId: new mongoose.Types.ObjectId(),
    });
    const delivery = await CommunicationDelivery.create({
      schoolId,
      communicationId,
      channel: "email",
      status: "delivered",
      recipientKey: "email:a@example.com",
      recipientRole: "parent",
      destination: "a@example.com",
      outputEntityId,
    });
    const outbox = await CommunicationOutboxJob.create({
      schoolId,
      communicationId,
      deliveryId: delivery._id,
      channel: "email",
      status: "completed",
    });
    const { BackgroundJob } = await import("../../src/models/BackgroundJob");
    const bg = await BackgroundJob.create({
      kind: "COMMUNICATION_OUTBOX",
      schoolId,
      tenantKey: `school:${String(schoolId)}`,
      status: "running",
      queuedAt: new Date(),
      input: {
        communicationOutboxJobId: String(outbox._id),
        deliveryId: String(delivery._id),
      },
    });
    const { executeCommunicationOutbox } = await import(
      "../../src/lib/communications/delivery/execute-communication-outbox"
    );
    const result = await executeCommunicationOutbox({
      job: bg,
      updateProgress: async () => undefined,
      isCancellationRequested: async () => false,
      throwIfCancellationRequested: async () => undefined,
    });
    assert.equal(result.skipped, true);
  });
});
