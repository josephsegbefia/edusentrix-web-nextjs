import assert from "node:assert/strict";
import { before, beforeEach, describe, test } from "node:test";
import { Types } from "mongoose";
import {
  setAssessmentRouteActiveSchool,
  setAssessmentRoutePremiumDecision,
  stubAssessmentRouteDeps,
} from "./assessment-route/helpers/stub-assessment-route-deps";

stubAssessmentRouteDeps();

const SCHOOL = new Types.ObjectId();
const ADMIN = new Types.ObjectId();
let postRoute: (request: Request, context: { params: Promise<{ outcomeId: string }> }) => Promise<Response>;

before(async () => {
  postRoute = (await import("../src/app/api/admin/assess/approved-outcomes/[outcomeId]/handoff/route")).POST;
});

beforeEach(() => {
  setAssessmentRouteActiveSchool(undefined);
  setAssessmentRoutePremiumDecision({ allowed: true });
});

function request(id = new Types.ObjectId().toString(), idempotencyKey?: string) {
  const headers = idempotencyKey ? { "x-idempotency-key": idempotencyKey } : undefined;
  return new Request("http://localhost/api/admin/assess/approved-outcomes/" + id + "/handoff", {
    method: "POST",
    headers,
  });
}

function params(id = new Types.ObjectId().toString()) {
  return { params: Promise.resolve({ outcomeId: id }) };
}

describe("POST /api/admin/assess/approved-outcomes/[outcomeId]/handoff", () => {
  test("rejects unauthenticated requests before database access", async () => {
    const response = await postRoute(request(), params());
    assert.equal(response.status, 401);
  });

  test("rejects non-admin active-school identities", async () => {
    setAssessmentRouteActiveSchool({ ok: true, context: { userId: ADMIN, schoolId: SCHOOL, roles: ["teacher"] } });
    const response = await postRoute(request(), params());
    assert.equal(response.status, 401);
  });

  test("rejects missing Premium entitlement before database access", async () => {
    setAssessmentRouteActiveSchool({ ok: true, context: { userId: ADMIN, schoolId: SCHOOL, roles: ["school_admin"] } });
    setAssessmentRoutePremiumDecision({ allowed: false, reason: "Premium Assess publication entitlement is not enabled.", statusCode: 403 });
    const response = await postRoute(request(), params());
    assert.equal(response.status, 403);
  });

  test("requires a valid idempotency key before attempting handoff", async () => {
    setAssessmentRouteActiveSchool({ ok: true, context: { userId: ADMIN, schoolId: SCHOOL, roles: ["school_admin"] } });
    const response = await postRoute(request(), params());
    assert.equal(response.status, 400);
  });

  test("rejects malformed outcome identifiers before attempting handoff", async () => {
    setAssessmentRouteActiveSchool({ ok: true, context: { userId: ADMIN, schoolId: SCHOOL, roles: ["school_admin"] } });
    const response = await postRoute(request("not-an-object-id", "handoff-route-test"), params("not-an-object-id"));
    assert.equal(response.status, 400);
  });
});
