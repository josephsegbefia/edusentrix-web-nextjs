import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveMembershipSchoolUploadAccess } from "../src/lib/uploads/membership-upload-access";
import { normalizeIdentityEmail } from "../src/lib/auth/canonical-user";
import {
  gateFinanceStaffRoles,
  gateSchoolAdminRoles,
  gateStudentApiAccess,
  gateTeacherApiAccess,
} from "../src/lib/auth/role-gates";

test("normalizeIdentityEmail trims and lowercases", () => {
  assert.equal(normalizeIdentityEmail("  Parent@School.COM "), "parent@school.com");
  assert.equal(normalizeIdentityEmail(""), "");
});

test("resolveMembershipSchoolUploadAccess: active membership school is allowed", () => {
  const result = resolveMembershipSchoolUploadAccess({
    requestedSchoolId: "507f1f77bcf86cd799439011",
    activeSchoolId: "507f1f77bcf86cd799439011",
    membershipSchoolIds: ["507f1f77bcf86cd799439011"],
  });

  assert.deepEqual(result, {
    allowed: true,
    effectiveSchoolId: "507f1f77bcf86cd799439011",
  });
});

test("resolveMembershipSchoolUploadAccess: rejects school outside memberships", () => {
  const result = resolveMembershipSchoolUploadAccess({
    requestedSchoolId: "507f1f77bcf86cd799439012",
    activeSchoolId: "507f1f77bcf86cd799439011",
    membershipSchoolIds: ["507f1f77bcf86cd799439011"],
  });

  assert.equal(result.allowed, false);
  if (!result.allowed) {
    assert.match(result.reason, /Forbidden/);
  }
});

test("guard membership roles: admin, teacher, finance, student", () => {
  assert.deepEqual(gateSchoolAdminRoles(["school_admin"]), { ok: true });
  assert.deepEqual(gateTeacherApiAccess(["teacher"]), { ok: true });
  assert.deepEqual(gateFinanceStaffRoles(["bursar"]), { ok: true });
  assert.deepEqual(gateStudentApiAccess(["student"]), { ok: true });

  assert.equal(gateSchoolAdminRoles(["teacher"]).ok, false);
  assert.equal(gateTeacherApiAccess(["parent"]).ok, false);
  assert.equal(gateFinanceStaffRoles(["parent"]).ok, false);
  assert.equal(gateStudentApiAccess(["parent"]).ok, false);
});
