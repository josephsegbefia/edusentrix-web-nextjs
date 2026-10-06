import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import mongoose, { Types } from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { stubServerOnly } from "./regression/helpers/stub-server-only";
import {
  PRESENTATION_ADMIN,
  PRESENTATION_PARENT,
  PRESENTATION_TEACHER,
  presentationPersonaEmail,
} from "../src/lib/demo/presentation-cast";

stubServerOnly();

const DB_NAME = "demo_switch_persona";
const COOKIE_NAME = "edusentrix_demo_session";
let mongod: MongoMemoryServer;
let POST: (req: unknown) => Promise<Response>;
let NextRequestCtor: new (url: string, init: Record<string, unknown>) => unknown;
let hashSessionToken: (raw: string) => string;

async function switchRole(role: string, cookieValue?: string) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (cookieValue) headers.cookie = `${COOKIE_NAME}=${cookieValue}`;
  return POST(
    new NextRequestCtor("http://localhost:3999/api/demo/switch-persona", {
      method: "POST",
      headers,
      body: JSON.stringify({ role }),
    })
  );
}

describe("POST /api/demo/switch-persona", () => {
  before(
    async () => {
      mongod = await MongoMemoryServer.create();
      process.env.MONGODB_URI = mongod.getUri();
      process.env.MONGO_DB_NAME = DB_NAME;
      process.env.DEMO_SESSION_SECRET = "test-demo-session-secret";
      const { connectToDatabase } = await import("../src/db/connectToDatabase");
      await connectToDatabase();
      ({ NextRequest: NextRequestCtor } = (await import("next/server")) as never);
      ({ POST } = (await import("../src/app/api/demo/switch-persona/route")) as never);
      ({ hashSessionToken } = await import("../src/lib/demo/session"));
    },
    { timeout: 180_000 }
  );

  after(async () => {
    await mongoose.disconnect().catch(() => undefined);
    await mongod?.stop();
  });

  test("returns 404 when demo mode is off", async () => {
    const previous = process.env.APP_RUNTIME_MODE;
    delete process.env.APP_RUNTIME_MODE;
    const res = await switchRole("parent");
    const json = await res.json();
    process.env.APP_RUNTIME_MODE = previous;
    assert.equal(res.status, 404);
    assert.equal(json.success, false);
  });

  test(
    "switches Admin → Parent → Teacher → Admin to presentation personas",
    async () => {
      process.env.APP_RUNTIME_MODE = "demo";
      const { School } = await import("../src/models/School");
      const { User } = await import("../src/models/User");
      const { UserMembership } = await import("../src/models/UserMembership");
      const { Teacher } = await import("../src/models/Teacher");
      const { DemoLead } = await import("../src/models/DemoLead");
      const { DemoSession } = await import("../src/models/DemoSession");
      const { DemoSandbox } = await import("../src/models/DemoSandbox");

      const school = await School.create({
        name: "Lighthouse Preparatory School",
        type: "Basic",
        curriculumCode: "ghana_nacca",
        status: "active",
      });
      const schoolId = school._id as Types.ObjectId;

      const admin = await User.create({
        email: PRESENTATION_ADMIN.fallbackEmails![0],
        firstName: PRESENTATION_ADMIN.firstName,
        lastName: PRESENTATION_ADMIN.lastName,
        role: "school_admin",
        schoolId,
      });
      const parent = await User.create({
        email: presentationPersonaEmail(PRESENTATION_PARENT.emailLocal, String(schoolId)),
        firstName: PRESENTATION_PARENT.firstName,
        lastName: PRESENTATION_PARENT.lastName,
        role: "parent",
        schoolId,
      });
      const teacherUser = await User.create({
        email: presentationPersonaEmail(PRESENTATION_TEACHER.emailLocal, String(schoolId)),
        firstName: PRESENTATION_TEACHER.firstName,
        lastName: PRESENTATION_TEACHER.lastName,
        role: "teacher",
        schoolId,
      });
      await UserMembership.create({
        userId: admin._id,
        schoolId,
        roles: ["school_admin"],
        status: "active",
      });
      await UserMembership.create({
        userId: parent._id,
        schoolId,
        roles: ["parent"],
        status: "active",
      });
      await UserMembership.create({
        userId: teacherUser._id,
        schoolId,
        roles: ["teacher"],
        status: "active",
      });

      const lead = await DemoLead.create({
        fullName: "Demo Lead",
        email: "lead@example.com",
        phone: "0240000000",
        schoolName: "Lighthouse Preparatory School",
        status: "active_demo",
      });
      const sandbox = await DemoSandbox.create({
        templateKey: "flagship_basic_v1",
        templateVersion: 1,
        schoolId,
        state: "allocated",
      });
      const rawToken = "demo-switch-persona-token";
      const session = await DemoSession.create({
        leadId: lead._id,
        sandboxId: sandbox._id,
        sandboxSchoolId: schoolId,
        sessionTokenHash: hashSessionToken(rawToken),
        status: "active",
        activePersonaRole: "school_admin",
        activePersonaUserId: admin._id,
        startedAt: new Date(),
        expiresAt: new Date(Date.now() + 90 * 60_000),
        lastActiveAt: new Date(),
        lastInteractionAt: new Date(),
      });

      const parentRes = await switchRole("parent", rawToken);
      const parentJson = await parentRes.json();
      assert.equal(parentRes.status, 200);
      assert.equal(parentJson.success, true);
      assert.equal(parentJson.data.redirectTo, "/parent");
      let live = await DemoSession.findById(session._id).lean();
      assert.equal(live?.activePersonaRole, "parent");
      assert.equal(String(live?.activePersonaUserId), String(parent._id));

      const teacherRes = await switchRole("teacher", rawToken);
      const teacherJson = await teacherRes.json();
      assert.equal(teacherRes.status, 200);
      assert.equal(teacherJson.data.redirectTo, "/teacher");
      live = await DemoSession.findById(session._id).lean();
      assert.equal(live?.activePersonaRole, "teacher");
      assert.equal(String(live?.activePersonaUserId), String(teacherUser._id));
      const teacherRow = await Teacher.findOne({
        schoolId,
        userId: teacherUser._id,
      }).lean();
      assert.ok(teacherRow, "Teacher document must exist after teacher switch");

      const adminRes = await switchRole("school_admin", rawToken);
      const adminJson = await adminRes.json();
      assert.equal(adminRes.status, 200);
      assert.equal(adminJson.data.redirectTo, "/admin");
      live = await DemoSession.findById(session._id).lean();
      assert.equal(live?.activePersonaRole, "school_admin");
      assert.equal(String(live?.activePersonaUserId), String(admin._id));
    },
    { timeout: 180_000 }
  );
});
