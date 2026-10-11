import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { after, before, beforeEach, describe, test } from "node:test";
import mongoose, { Types } from "mongoose";
import { NextRequest } from "next/server";
import { createMockR2Port } from "./helpers/mock-r2";
import {
  SCHOOL_A,
  SCHOOL_B,
  assetPath,
  resetStorageDb,
  seedApplicationWithTracker,
  seedAsset,
  seedParentDocumentRequest,
  seedStudent,
  setStudentPhoto,
  startStorageDb,
  stopStorageDb,
} from "./helpers/school-fixtures";
import { setActiveSchool, stubStorageRouteDeps } from "./helpers/stub-storage-route-deps";

stubStorageRouteDeps();

type RouteGet = (
  req: NextRequest,
  ctx: { params: Promise<{ assetId: string }> }
) => Promise<Response>;

let urlRoute: RouteGet;
let gatewayRoute: RouteGet;

before(
  async () => {
    await startStorageDb("signed_url_route");
    const { setR2PortForTests } = await import("@/lib/storage/r2");
    setR2PortForTests(createMockR2Port());
    urlRoute = (await import("@/app/api/storage/assets/[assetId]/url/route")).GET as RouteGet;
    gatewayRoute = (await import("@/app/api/storage/assets/[assetId]/route")).GET as unknown as RouteGet;
  },
  { timeout: 180_000 }
);

after(async () => {
  const { setR2PortForTests } = await import("@/lib/storage/r2");
  setR2PortForTests(null);
  await stopStorageDb();
});

beforeEach(async () => {
  setActiveSchool(undefined);
  await resetStorageDb();
});

function signedIn(roles: string[], schoolId = SCHOOL_A, source: "single_membership" | "assisted_access" = "single_membership") {
  setActiveSchool({
    ok: true,
    context: { userId: new Types.ObjectId(), schoolId, roles, source },
  });
}

function call(
  route: RouteGet,
  assetId: string,
  headers: Record<string, string> = {},
  query = ""
) {
  const req = new NextRequest(
    `http://localhost/api/storage/assets/${assetId}/url?disposition=inline${query}`,
    { headers }
  );
  return route(req, { params: Promise.resolve({ assetId }) });
}

function assertNoStore(res: Response) {
  assert.equal(res.headers.get("cache-control"), "private, no-store");
  assert.equal(res.headers.get("vary"), "Authorization, Cookie");
}

async function studentPhoto(visibility: "public" | "private" = "public") {
  const studentId = await seedStudent();
  const assetId = await seedAsset({ visibility, association: null });
  await setStudentPhoto(studentId, assetPath(assetId));
  return { studentId, assetId: String(assetId) };
}

async function learnSession(studentId: Types.ObjectId, expiresAt = new Date(Date.now() + 60_000)) {
  const token = randomBytes(32).toString("base64url");
  const accountId = new Types.ObjectId();
  await mongoose.model("LearnStudentAccount").collection.insertOne({
    _id: accountId,
    schoolId: SCHOOL_A,
    studentId,
    status: "active",
    mustChangePassword: false,
  });
  await mongoose.model("LearnStudentSession").collection.insertOne({
    _id: new Types.ObjectId(),
    schoolId: SCHOOL_A,
    studentId,
    accountId,
    tokenHash: createHash("sha256").update(token).digest("hex"),
    expiresAt,
    startedAt: new Date(),
    endedAt: null,
  });
  return token;
}

describe("GET /api/storage/assets/[assetId]/url", () => {
  test("401 with no session, before any asset lookup", async () => {
    const { assetId } = await studentPhoto();
    const missing = String(new Types.ObjectId());
    for (const id of [assetId, missing, "not-an-id"]) {
      const res = await call(urlRoute, id);
      assert.equal(res.status, 401);
      assertNoStore(res);
    }
  });

  test("401 for an invalid Bearer token and an expired Learn session", async () => {
    const { assetId, studentId } = await studentPhoto();
    const junk = await call(urlRoute, assetId, { authorization: "Bearer not-a-real-token" });
    assert.equal(junk.status, 401);
    assertNoStore(junk);

    const expired = await learnSession(studentId, new Date(Date.now() - 1_000));
    const res = await call(urlRoute, assetId, { authorization: `Bearer ${expired}` });
    assert.equal(res.status, 401);
  });

  test("403 for a suspended membership, a suspended school, and cross-school access", async () => {
    const { assetId } = await studentPhoto();

    setActiveSchool({ ok: false, reason: "membership_suspended" });
    const membership = await call(urlRoute, assetId);
    assert.equal(membership.status, 403);
    assertNoStore(membership);

    setActiveSchool({ throwStatus: 403 });
    const school = await call(urlRoute, assetId);
    assert.equal(school.status, 403);
    assertNoStore(school);

    signedIn(["school_admin"], SCHOOL_B);
    const crossSchool = await call(urlRoute, assetId);
    assert.equal(crossSchool.status, 403);
    assertNoStore(crossSchool);
  });

  test("403 for a signed-in member without a relationship to the student", async () => {
    const { assetId } = await studentPhoto();
    signedIn(["teacher"]);
    const res = await call(urlRoute, assetId);
    assert.equal(res.status, 403);
  });

  test("404 for a missing asset once signed in", async () => {
    signedIn(["school_admin"]);
    const res = await call(urlRoute, String(new Types.ObjectId()));
    assert.equal(res.status, 404);
    assertNoStore(res);
  });

  test("200 with the exact body shape for an authorized admin", async () => {
    const { assetId } = await studentPhoto();
    signedIn(["school_admin"]);
    const before = Date.now();
    const res = await call(urlRoute, assetId);
    assert.equal(res.status, 200);
    assertNoStore(res);
    const body = (await res.json()) as {
      success: boolean;
      data: { url: string; expiresAt: string; expiresInSeconds: number };
    };
    assert.deepEqual(Object.keys(body).sort(), ["data", "success"]);
    assert.equal(body.success, true);
    assert.deepEqual(Object.keys(body.data).sort(), ["expiresAt", "expiresInSeconds", "url"]);
    assert.ok(body.data.url.startsWith("https://r2.test/presign-get/"));
    assert.ok(!body.data.url.includes("token="));
    assert.equal(typeof body.data.expiresInSeconds, "number");
    const expiresAt = Date.parse(body.data.expiresAt);
    assert.ok(expiresAt >= before + body.data.expiresInSeconds * 1000 - 1_000);
    assert.ok(expiresAt <= Date.now() + body.data.expiresInSeconds * 1000);
  });

  test("200 for assisted access and for a Learn student's own photo", async () => {
    const { assetId, studentId } = await studentPhoto();
    signedIn(["school_admin"], SCHOOL_A, "assisted_access");
    assert.equal((await call(urlRoute, assetId)).status, 200);

    setActiveSchool(undefined);
    const token = await learnSession(studentId);
    const own = await call(urlRoute, assetId, { authorization: `Bearer ${token}` });
    assert.equal(own.status, 200);

    const other = await studentPhoto();
    const denied = await call(urlRoute, other.assetId, { authorization: `Bearer ${token}` });
    assert.equal(denied.status, 403);
  });
});

describe("GET /api/storage/assets/[assetId] (gateway)", () => {
  test("a previously public student photo now needs a session", async () => {
    const { assetId } = await studentPhoto("public");
    const res = await call(gatewayRoute, assetId);
    assert.equal(res.status, 401);
  });

  test("a valid special link token does not unlock a student photo", async () => {
    const studentId = await seedStudent();
    const { applicationId, token: trackerToken } = await seedApplicationWithTracker();
    const { requestId, token: requestToken } = await seedParentDocumentRequest({ studentId });
    const viaApplication = await seedAsset({
      visibility: "public",
      association: { type: "application", id: applicationId },
    });
    const viaRequest = await seedAsset({
      visibility: "public",
      association: { type: "request", id: requestId },
    });
    await setStudentPhoto(studentId, assetPath(viaRequest));

    for (const [assetId, token] of [
      [viaApplication, trackerToken],
      [viaRequest, requestToken],
    ] as const) {
      const res = await call(gatewayRoute, String(assetId), {}, `&token=${encodeURIComponent(token)}`);
      assert.equal(res.status, 401);
      assert.equal(res.headers.get("location"), null);
    }
  });

  test("an admission document still opens with its tracker token", async () => {
    const { applicationId, token } = await seedApplicationWithTracker();
    const assetId = await seedAsset({
      kind: "admission_document",
      mimeType: "application/pdf",
      association: { type: "application", id: applicationId },
    });
    const res = await call(gatewayRoute, String(assetId), {}, `&token=${encodeURIComponent(token)}`);
    assert.equal(res.status, 302);
    assert.ok(res.headers.get("location")?.startsWith("https://r2.test/presign-get/"));
  });

  test("a teacher avatar still redirects anonymously", async () => {
    const assetId = String(await seedAsset({ kind: "teacher_avatar", visibility: "public" }));
    const res = await call(gatewayRoute, assetId);
    assert.equal(res.status, 302);
    assert.ok(res.headers.get("location")?.startsWith("https://r2.test/presign-get/"));
    assert.equal(res.headers.get("cache-control"), "private, no-store");
  });
});
