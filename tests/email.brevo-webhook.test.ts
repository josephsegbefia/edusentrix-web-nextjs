/**
 * Brevo delivery-event webhook: EmailEvent rows must always link to an
 * existing EmailMessage. Events for messages EduSentrix did not record are
 * stored as unlinked CommunicationProviderEvent rows instead of failing
 * EmailEvent validation (which returned 500 and made Brevo retry forever).
 *
 * In-memory MongoDB only. Every outbound fetch is blocked.
 */
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, mock, test } from "node:test";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { stubServerOnly } from "./regression/helpers/stub-server-only";

stubServerOnly();

const DB_NAME = "brevo_webhook_events";
const WEBHOOK_TOKEN = "brevo_test_token_not_a_real_secret";

let mongod: MongoMemoryServer;
let POST: (req: unknown) => Promise<Response>;
let NextRequestCtor: new (url: string, init: Record<string, unknown>) => unknown;
let models: {
  EmailEvent: typeof import("../src/models/EmailEvent").EmailEvent;
  EmailMessage: typeof import("../src/models/EmailMessage").EmailMessage;
  EmailSuppression: typeof import("../src/models/EmailSuppression").EmailSuppression;
  CommunicationProviderEvent: typeof import("../src/models/CommunicationProviderEvent").CommunicationProviderEvent;
};
const externalCalls: string[] = [];

before(
  async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri();
    process.env.MONGO_DB_NAME = DB_NAME;
    process.env.BREVO_WEBHOOK_SECRET = WEBHOOK_TOKEN;
    mock.method(globalThis, "fetch", async (input: unknown) => {
      externalCalls.push(String((input as { url?: string })?.url ?? input));
      throw new Error("brevo webhook test: outbound fetch blocked");
    });
    const { connectToDatabase } = await import("../src/db/connectToDatabase");
    await connectToDatabase();
    ({ NextRequest: NextRequestCtor } = (await import("next/server")) as never);
    ({ POST } = (await import("../src/app/api/webhooks/brevo/route")) as never);
    models = {
      EmailEvent: (await import("../src/models/EmailEvent")).EmailEvent,
      EmailMessage: (await import("../src/models/EmailMessage")).EmailMessage,
      EmailSuppression: (await import("../src/models/EmailSuppression")).EmailSuppression,
      CommunicationProviderEvent: (await import("../src/models/CommunicationProviderEvent"))
        .CommunicationProviderEvent,
    };
  },
  { timeout: 180_000 }
);

after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  await mongoose.connection.db!.dropDatabase();
});

function deliver(body: Record<string, unknown>, token: string | null = WEBHOOK_TOKEN) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;
  return POST(
    new NextRequestCtor("http://localhost:3999/api/webhooks/brevo", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    })
  );
}

async function seedMessage(providerMessageId: string) {
  return models.EmailMessage.create({
    provider: "brevo",
    direction: "outbound",
    mailboxScope: "school",
    mailboxKey: "school_support",
    schoolId: new mongoose.Types.ObjectId(),
    from: "hello@example.test",
    to: "parent@example.test",
    subject: "Fee reminder",
    status: "sent",
    messageClass: "system",
    trafficClass: "transactional",
    providerMessageId,
  });
}

describe("EmailEvent schema stays strict", () => {
  test("an EmailEvent without emailMessageId is still rejected (the original production error)", async () => {
    await assert.rejects(
      models.EmailEvent.create({
        emailMessageId: null,
        provider: "brevo",
        eventType: "delivered",
        providerMessageId: "<unmatched@smtp-relay.test>",
        payload: {},
        occurredAt: new Date(),
      }),
      /emailMessageId: Path `emailMessageId` is required/
    );
  });
});

describe("matched provider message", () => {
  test("records an EmailEvent linked to the internal EmailMessage._id and updates its status", async () => {
    const message = await seedMessage("<matched@smtp-relay.test>");
    const res = await deliver({ event: "delivered", "message-id": "<matched@smtp-relay.test>", email: "parent@example.test", ts_event: 1_700_000_000 });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, "ok");

    const events = await models.EmailEvent.find({}).lean();
    assert.equal(events.length, 1);
    assert.equal(String(events[0].emailMessageId), String(message._id));
    assert.equal(String(events[0].schoolId), String(message.schoolId));
    assert.equal(events[0].providerMessageId, "<matched@smtp-relay.test>");
    assert.equal(String(events[0]._id), body.eventId);
    assert.equal(await models.CommunicationProviderEvent.countDocuments(), 0);

    const updated = await models.EmailMessage.findById(message._id).lean();
    assert.equal(updated?.status, "delivered");
  });
});

describe("unmatched provider message", () => {
  test("returns 200, writes no EmailEvent, and stores one unlinked provider event", async () => {
    const res = await deliver({ event: "delivered", "message-id": "<unknown@smtp-relay.test>", email: "someone@example.test" });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, "unmatched");

    assert.equal(await models.EmailEvent.countDocuments(), 0);
    const stored = await models.CommunicationProviderEvent.find({}).lean();
    assert.equal(stored.length, 1);
    assert.equal(String(stored[0]._id), body.providerEventId);
    assert.equal(stored[0].channel, "email");
    assert.equal(stored[0].provider, "brevo");
    assert.equal(stored[0].eventType, "delivered");
    assert.equal(stored[0].providerMessageId, "<unknown@smtp-relay.test>");
    assert.equal(stored[0].communicationId ?? null, null);
  });

  test("a hard bounce is still suppressed even though no EmailMessage matches", async () => {
    const res = await deliver({ event: "hard_bounce", "message-id": "<bounced@smtp-relay.test>", email: "Bounced@Example.test" });
    assert.equal(res.status, 200);
    assert.equal(await models.EmailEvent.countDocuments(), 0);
    const suppression = await models.EmailSuppression.findOne({ email: "bounced@example.test" }).lean();
    assert.ok(suppression, "suppression recorded");
    assert.equal(suppression.reason, "bounce");
    assert.equal(suppression.active, true);
  });
});

describe("request handling is unchanged", () => {
  test("events without an event name or message-id are ignored", async () => {
    for (const body of [{ "message-id": "<x@smtp-relay.test>" }, { event: "delivered" }]) {
      const res = await deliver(body);
      assert.equal(res.status, 200);
      assert.equal((await res.json()).status, "ignored");
    }
    assert.equal(await models.EmailEvent.countDocuments(), 0);
    assert.equal(await models.CommunicationProviderEvent.countDocuments(), 0);
  });

  test("a wrong or missing bearer token is rejected with 401", async () => {
    for (const token of ["wrong-token", null]) {
      const res = await deliver({ event: "delivered", "message-id": "<x@smtp-relay.test>" }, token);
      assert.equal(res.status, 401);
    }
    assert.equal(await models.CommunicationProviderEvent.countDocuments(), 0);
  });

  test("no external HTTP call was attempted", () => {
    assert.deepEqual(externalCalls, []);
  });
});
