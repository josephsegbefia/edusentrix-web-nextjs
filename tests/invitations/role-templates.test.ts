import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  invitationTemplateKeyForRole,
} from "../../src/lib/invitations/templates";
import type { InvitationRole } from "../../src/lib/roles";

describe("invitation role template mapping", () => {
  test("maps every supported role explicitly and never falls back to teacher for admins", () => {
    const expected: Record<InvitationRole, string> = {
      teacher: "TEACHER_INVITE",
      parent: "PARENT_INVITE",
      bursar: "BURSAR_INVITE",
      billing_owner: "BILLING_OWNER_INVITE",
      school_admin: "SCHOOL_ADMIN_INVITE",
      staff: "USER_INVITE",
    };

    for (const [role, templateKey] of Object.entries(expected)) {
      assert.equal(invitationTemplateKeyForRole(role as InvitationRole), templateKey);
    }

    assert.notEqual(invitationTemplateKeyForRole("school_admin"), "TEACHER_INVITE");
    assert.notEqual(invitationTemplateKeyForRole("staff"), "TEACHER_INVITE");
  });
});
