import { test } from "node:test";
import assert from "node:assert/strict";
import {
  gateFinanceStaffRoles,
  gateParentApiAccess,
  gatePlatformAdminUser,
  gateSchoolAdminRoles,
  gateTeacherApiAccess,
} from "../src/lib/auth/role-gates";

test("gatePlatformAdminUser: platform_admin passes; others 403", () => {
  assert.deepEqual(gatePlatformAdminUser(null), {
    ok: false,
    status: 403,
    error: "Forbidden",
  });
  assert.deepEqual(gatePlatformAdminUser({ role: "school_admin" }), {
    ok: false,
    status: 403,
    error: "Forbidden",
  });
  assert.deepEqual(gatePlatformAdminUser({ role: "platform_admin" }), { ok: true });
});

test("gateParentApiAccess: parent or school_admin passes", () => {
  assert.deepEqual(gateParentApiAccess(["teacher"]), {
    ok: false,
    status: 403,
    error: "Parent role required",
  });
  assert.deepEqual(gateParentApiAccess(["parent"]), { ok: true });
  assert.deepEqual(gateParentApiAccess(["school_admin"]), { ok: true });
  assert.deepEqual(gateParentApiAccess(["school_admin", "parent"]), { ok: true });
});

test("gateFinanceStaffRoles: school_admin or bursar passes", () => {
  assert.deepEqual(gateFinanceStaffRoles(["parent"]), {
    ok: false,
    status: 401,
    error: "Unauthorized",
  });
  assert.deepEqual(gateFinanceStaffRoles(["school_admin"]), { ok: true });
  assert.deepEqual(gateFinanceStaffRoles(["bursar"]), { ok: true });
});

test("gateSchoolAdminRoles: only school_admin passes", () => {
  assert.deepEqual(gateSchoolAdminRoles(["bursar"]), {
    ok: false,
    status: 401,
    error: "Unauthorized",
  });
  assert.deepEqual(gateSchoolAdminRoles(["school_admin"]), { ok: true });
});

test("gateTeacherApiAccess: teacher or school_admin passes", () => {
  assert.deepEqual(gateTeacherApiAccess(["parent"]), {
    ok: false,
    status: 403,
    error: "Insufficient permissions",
  });
  assert.deepEqual(gateTeacherApiAccess(["teacher"]), { ok: true });
  assert.deepEqual(gateTeacherApiAccess(["school_admin"]), { ok: true });
});
