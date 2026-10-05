import assert from "node:assert/strict";
import { after, before, beforeEach, describe, mock, test } from "node:test";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { stubServerOnly } from "../regression/helpers/stub-server-only";

stubServerOnly();

const DB_NAME = "invitation_issue_school_create";
let mongod: MongoMemoryServer;
let resendCalls = 0;
let resendShouldFail = false;
let clerkUrl: string | null = "https://accounts.example.com/invite?__clerk_ticket=ticket1";
const clerkCalls: Array<Record<string, unknown>> = [];

before(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();
  process.env.MONGO_DB_NAME = DB_NAME;
  process.env.RESEND_API_KEY = "re_test_not_real";
  process.env.APP_URL = "https://app.example.test";

  mock.method(globalThis, "fetch", async (input: unknown) => {
    const url = String((input as { url?: string })?.url ?? input);
    if (url.includes("api.resend.com")) {
      resendCalls += 1;
      if (resendShouldFail) {
        return new Response(JSON.stringify({ message: "provider down" }), {
          status: 500,
        });
      }
      return new Response(JSON.stringify({ id: `re_${resendCalls}` }), {
        status: 200,
      });
    }
    throw new Error(`unexpected fetch: ${url}`);
  });

  const clerkInvitation = await import("../../src/lib/invitations/clerk-invitation");
  mock.method(clerkInvitation.clerkInvitationPort, "create", async (input) => {
    clerkCalls.push(input as Record<string, unknown>);
    if (!clerkUrl) {
      return { id: `inv_${clerkCalls.length}`, url: null, emailAddress: input.email };
    }
    return {
      id: `inv_${clerkCalls.length}`,
      url: clerkUrl,
      emailAddress: input.email,
    };
  });

  await mongoose.connect(mongod.getUri(), { dbName: DB_NAME });
});

beforeEach(async () => {
  resendCalls = 0;
  resendShouldFail = false;
  clerkUrl = "https://accounts.example.com/invite?__clerk_ticket=ticket1";
  clerkCalls.length = 0;
  const { inngestEventPort } = await import("../../src/lib/background/inngest-port");
  inngestEventPort.send = async () => ({ ids: ["evt_ok"] });
  const collections = await mongoose.connection.db?.collections();
  for (const collection of collections || []) {
    await collection.deleteMany({});
  }
});

after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

async function createActor() {
  const { User } = await import("../../src/models/User");
  return User.create({
    email: "platform@example.com",
    firstName: "Plat",
    lastName: "Form",
    role: "platform_admin",
  });
}

describe("issueInvitation", () => {
  test("creates Clerk metadata, canonical Invitation, and immediate Resend send", async () => {
    const { issueInvitation } = await import("../../src/lib/invitations/issue-invitation");
    const { Invitation } = await import("../../src/models/Invitation");
    const { BackgroundJob } = await import("../../src/models/BackgroundJob");
    const actor = await createActor();
    const schoolId = new mongoose.Types.ObjectId();

    const result = await issueInvitation({
      email: "Admin@School.com",
      role: "school_admin",
      schoolId,
      invitedBy: actor._id,
      recipientName: "Ada Admin",
      schoolName: "Ridge School",
    });

    assert.equal(result.emailStatus, "sent");
    assert.equal(result.invitationStatus, "pending");
    assert.equal(result.deliveryCode, "INVITATION_CREATED_EMAIL_SENT");
    assert.equal(resendCalls, 1);
    assert.equal(clerkCalls.length, 1);
    assert.deepEqual(clerkCalls[0]?.publicMetadata, {
      role: "school_admin",
      schoolId: String(schoolId),
    });
    assert.equal((clerkCalls[0]?.email as string).toLowerCase(), "admin@school.com");

    const invites = await Invitation.find({ schoolId }).lean();
    assert.equal(invites.length, 1);
    assert.equal(invites[0]?.email, "admin@school.com");
    assert.equal(invites[0]?.role, "school_admin");
    assert.equal(await BackgroundJob.countDocuments({ kind: "EMAIL_DISPATCH" }), 0);
  });

  test("missing Clerk URL fails closed and never emails a ticketless fallback", async () => {
    clerkUrl = null;
    const { issueInvitation } = await import("../../src/lib/invitations/issue-invitation");
    const { EmailMessage } = await import("../../src/models/EmailMessage");
    const actor = await createActor();

    const result = await issueInvitation({
      email: "admin@school.com",
      role: "teacher",
      schoolId: new mongoose.Types.ObjectId(),
      invitedBy: actor._id,
      recipientName: "Tia Teacher",
      schoolName: "Ridge School",
    });

    assert.equal(result.emailStatus, "failed");
    assert.equal(result.invitationStatus, "failed");
    assert.equal(resendCalls, 0);
    assert.equal(await EmailMessage.countDocuments({}), 0);
  });

  test("provider failure keeps invitation recoverable and enqueues one retry job", async () => {
    resendShouldFail = true;
    const { issueInvitation } = await import("../../src/lib/invitations/issue-invitation");
    const { Invitation } = await import("../../src/models/Invitation");
    const { BackgroundJob } = await import("../../src/models/BackgroundJob");
    const { EmailMessage } = await import("../../src/models/EmailMessage");
    const actor = await createActor();
    const schoolId = new mongoose.Types.ObjectId();

    const result = await issueInvitation({
      email: "admin@school.com",
      role: "school_admin",
      schoolId,
      invitedBy: actor._id,
      schoolName: "Ridge School",
    });

    assert.equal(result.emailStatus, "queued");
    assert.equal(result.invitationStatus, "pending");
    assert.equal(result.deliveryCode, "INVITATION_CREATED_EMAIL_QUEUED");
    assert.equal(resendCalls, 1);
    assert.equal(await Invitation.countDocuments({ schoolId, status: "pending" }), 1);
    const jobs = await BackgroundJob.find({ kind: "EMAIL_DISPATCH" }).lean();
    assert.equal(jobs.length, 1);
    const messages = await EmailMessage.find({}).lean();
    assert.equal(messages.length, 1);
    assert.equal(jobs[0]?.input?.emailMessageId, String(messages[0]?._id));
  });

  test("retry helper is idempotent for the same EmailMessage", async () => {
    resendShouldFail = true;
    const { issueInvitation } = await import("../../src/lib/invitations/issue-invitation");
    const { enqueueEmailMessageForRetry } = await import(
      "../../src/lib/email/enqueue-dispatch-job"
    );
    const { BackgroundJob } = await import("../../src/models/BackgroundJob");
    const actor = await createActor();

    const result = await issueInvitation({
      email: "retry@school.com",
      role: "school_admin",
      schoolId: new mongoose.Types.ObjectId(),
      invitedBy: actor._id,
      schoolName: "Ridge School",
    });
    assert.equal(result.emailStatus, "queued");
    assert.ok(result.emailMessageId);
    await enqueueEmailMessageForRetry(result.emailMessageId!);
    await enqueueEmailMessageForRetry(result.emailMessageId!);
    assert.equal(await BackgroundJob.countDocuments({ kind: "EMAIL_DISPATCH" }), 1);
  });

  test("reuse of a pending invitation does not create a second row", async () => {
    const { issueInvitation } = await import("../../src/lib/invitations/issue-invitation");
    const { Invitation } = await import("../../src/models/Invitation");
    const actor = await createActor();
    const schoolId = new mongoose.Types.ObjectId();

    const first = await issueInvitation({
      email: "teacher@school.com",
      role: "teacher",
      schoolId,
      invitedBy: actor._id,
      schoolName: "Ridge School",
    });
    const second = await issueInvitation({
      email: "teacher@school.com",
      role: "teacher",
      schoolId,
      invitedBy: actor._id,
      schoolName: "Ridge School",
    });

    assert.equal(first.invitationId, second.invitationId);
    assert.equal(second.reusedExisting, true);
    assert.ok(second.resendCount >= 1);
    assert.equal(await Invitation.countDocuments({ schoolId, role: "teacher" }), 1);
  });
});

describe("createSchoolFromPlatform invitation delivery", () => {
  test("creates school, admin invitation, Clerk metadata, and immediate send", async () => {
    const { createSchoolFromPlatform } = await import(
      "../../src/lib/platform/schools/create-school-from-platform"
    );
    const { Invitation } = await import("../../src/models/Invitation");
    const { School } = await import("../../src/models/School");
    const actor = await createActor();

    const result = await createSchoolFromPlatform({
      actorUserId: actor._id,
      school: {
        name: "Ridge School",
        type: "Basic",
        curriculumCode: "ghana_nacca",
        email: "office@ridge.edu",
      },
      admin: {
        fullName: "Ada Admin",
        email: "ada@ridge.edu",
      },
    });

    assert.ok(result.school._id);
    assert.equal(result.adminInvitation.emailStatus, "sent");
    assert.ok(result.adminInvitation.invitationId);
    assert.equal(result.schoolContactEmail.status, "sent");
    assert.equal(resendCalls, 2);
    const school = await School.findById(result.school._id);
    assert.ok(school);
    const invite = await Invitation.findById(result.adminInvitation.invitationId);
    assert.equal(invite?.role, "school_admin");
    assert.equal(invite?.email, "ada@ridge.edu");
    assert.equal((clerkCalls[0]?.publicMetadata as { role?: string })?.role, "school_admin");
    assert.equal(
      (clerkCalls[0]?.publicMetadata as { schoolId?: string })?.schoolId,
      String(result.school._id)
    );
  });

  test("provider failure does not remove the school and reports queued truth", async () => {
    resendShouldFail = true;
    const { createSchoolFromPlatform } = await import(
      "../../src/lib/platform/schools/create-school-from-platform"
    );
    const { School } = await import("../../src/models/School");
    const { BackgroundJob } = await import("../../src/models/BackgroundJob");
    const actor = await createActor();

    const result = await createSchoolFromPlatform({
      actorUserId: actor._id,
      school: {
        name: "Queued School",
        type: "Basic",
        curriculumCode: "ghana_nacca",
        email: "office@queued.edu",
      },
      admin: {
        fullName: "Ada Admin",
        email: "ada@queued.edu",
      },
    });

    assert.equal(await School.countDocuments({ _id: result.school._id }), 1);
    assert.equal(result.adminInvitation.status, "pending");
    assert.equal(result.adminInvitation.emailStatus, "queued");
    assert.ok(result.adminInvitation.invitationId);
    assert.ok((await BackgroundJob.countDocuments({ kind: "EMAIL_DISPATCH" })) >= 1);
  });

  test("same school/admin email is deduplicated and missing school email is safe", async () => {
    const { createSchoolFromPlatform } = await import(
      "../../src/lib/platform/schools/create-school-from-platform"
    );
    const actor = await createActor();

    const same = await createSchoolFromPlatform({
      actorUserId: actor._id,
      school: {
        name: "Same Email School",
        type: "Basic",
        curriculumCode: "ghana_nacca",
        email: "Ada@Same.edu",
      },
      admin: {
        fullName: "Ada Admin",
        email: "ada@same.edu",
      },
    });
    assert.equal(same.schoolContactEmail.status, "same_as_admin");
    assert.equal(resendCalls, 1);

    resendCalls = 0;
    const missing = await createSchoolFromPlatform({
      actorUserId: actor._id,
      school: {
        name: "No Contact School",
        type: "Basic",
        curriculumCode: "ghana_nacca",
      },
      admin: {
        fullName: "Ada Admin",
        email: "ada@nocontact.edu",
      },
    });
    assert.equal(missing.schoolContactEmail.status, "not_provided");
    assert.equal(resendCalls, 1);
  });

  test("school contact email never includes the Clerk ticket", async () => {
    const { createSchoolFromPlatform } = await import(
      "../../src/lib/platform/schools/create-school-from-platform"
    );
    const { EmailMessage } = await import("../../src/models/EmailMessage");
    const actor = await createActor();

    await createSchoolFromPlatform({
      actorUserId: actor._id,
      school: {
        name: "Contact School",
        type: "Basic",
        curriculumCode: "ghana_nacca",
        email: "office@contact.edu",
      },
      admin: {
        fullName: "Ada Admin",
        email: "ada@contact.edu",
      },
    });

    const contact = await EmailMessage.findOne({
      templateKey: "SCHOOL_CREATED_CONTACT",
    }).lean();
    assert.ok(contact);
    assert.doesNotMatch(String(contact.htmlBody), /__clerk_ticket/);
    assert.doesNotMatch(String(contact.htmlBody), /accounts\.example\.com\/invite/);
  });
});
