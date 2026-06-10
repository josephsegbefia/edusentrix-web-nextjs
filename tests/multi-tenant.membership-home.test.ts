import { test } from "node:test";
import assert from "node:assert/strict";
import { homePathForMembershipRoles } from "../src/lib/auth/membership-home";

test("homePathForMembershipRoles: admin and finance homes", () => {
  assert.equal(homePathForMembershipRoles(["school_admin"]), "/admin");
  assert.equal(
    homePathForMembershipRoles(["billing_owner"]),
    "/admin/settings/payment-setup"
  );
  assert.equal(homePathForMembershipRoles(["bursar"]), "/bursar");
});

test("homePathForMembershipRoles: role homes and fallback", () => {
  assert.equal(homePathForMembershipRoles(["teacher"]), "/teacher");
  assert.equal(homePathForMembershipRoles(["parent"]), "/parent");
  assert.equal(homePathForMembershipRoles(["student"]), "/student");
  assert.equal(homePathForMembershipRoles(["staff"]), "/dashboard");
});

test("homePathForMembershipRoles: highest-priority role wins", () => {
  assert.equal(
    homePathForMembershipRoles(["parent", "teacher"]),
    "/teacher"
  );
  assert.equal(
    homePathForMembershipRoles(["teacher", "school_admin"]),
    "/admin"
  );
});
