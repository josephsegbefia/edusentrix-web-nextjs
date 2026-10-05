/**
 * Proves async:true only queues EmailDispatchJob and never calls Resend
 * unless runEmailDispatchJob is invoked.
 */
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, mock, test } from "node:test";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { readFileSync } from "node:fs";
import { stubServerOnly } from "./regression/helpers/stub-server-only";

stubServerOnly();

const DB_NAME = "email_dispatch_async";
let mongod: MongoMemoryServer;
let resendCalls = 0;

before(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();
  process.env.MONGO_DB_NAME = DB_NAME;
  process.env.RESEND_API_KEY = "re_test_not_real";
  mock.method(globalThis, "fetch", async (input: unknown) => {
    const url = String((input as { url?: string })?.url ?? input);
    if (url.includes("api.resend.com")) {
      resendCalls += 1;
      return new Response(JSON.stringify({ id: "re_mocked" }), { status: 200 });
    }
    throw new Error(`unexpected fetch: ${url}`);
  });
  await mongoose.connect(mongod.getUri(), { dbName: DB_NAME });
});

beforeEach(async () => {
  resendCalls = 0;
  const collections = await mongoose.connection.db?.collections();
  for (const collection of collections || []) {
    await collection.deleteMany({});
  }
});

after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

describe("sendTrackedBrevoEmail async mode", () => {
  test("async:true does not call Resend and creates one pending dispatch job", async () => {
    const { sendTrackedBrevoEmail } = await import("../src/lib/email/services/send-brevo-email");
    const { EmailDispatchJob } = await import("../src/models/EmailDispatchJob");
    const { EmailMessage } = await import("../src/models/EmailMessage");

    const result = await sendTrackedBrevoEmail({
      to: "admin@example.com",
      subject: "Queued invite",
      htmlContent: "<p>Hello</p>",
      templateKey: "SCHOOL_INVITE",
      async: true,
    });

    assert.equal(result.status, "queued");
    assert.equal(resendCalls, 0);
    const messages = await EmailMessage.find({}).lean();
    const jobs = await EmailDispatchJob.find({}).lean();
    assert.equal(messages.length, 1);
    assert.equal(messages[0]?.status, "queued");
    assert.equal(jobs.length, 1);
    assert.equal(jobs[0]?.status, "pending");
    assert.equal(String(jobs[0]?.emailMessageId), String(messages[0]?._id));
  });

  test("platform school creation source no longer uses async:true", () => {
    const source = readFileSync(
      "src/lib/platform/schools/create-school-from-platform.ts",
      "utf8"
    );
    assert.doesNotMatch(source, /async:\s*true/);
    assert.match(source, /issueInvitation/);
  });
});
