import { test } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import {
  isProfileMediaUploadFolder,
  resolveMembershipSchoolUploadAccess,
} from "../src/lib/uploads/membership-upload-access";

test("resolveMembershipSchoolUploadAccess: requested school in memberships is allowed", () => {
  const result = resolveMembershipSchoolUploadAccess({
    requestedSchoolId: "507f1f77bcf86cd799439012",
    activeSchoolId: null,
    membershipSchoolIds: [
      "507f1f77bcf86cd799439011",
      "507f1f77bcf86cd799439012",
    ],
  });

  assert.deepEqual(result, {
    allowed: true,
    effectiveSchoolId: "507f1f77bcf86cd799439012",
  });
});

test("resolveMembershipSchoolUploadAccess: legacy active school fallback", () => {
  const legacySchoolId = new mongoose.Types.ObjectId().toString();
  const result = resolveMembershipSchoolUploadAccess({
    activeSchoolId: legacySchoolId,
    membershipSchoolIds: [legacySchoolId],
  });

  assert.deepEqual(result, {
    allowed: true,
    effectiveSchoolId: legacySchoolId,
  });
});

test("isProfileMediaUploadFolder: avatars and branding only", () => {
  assert.equal(isProfileMediaUploadFolder("school-admins/avatars"), true);
  assert.equal(isProfileMediaUploadFolder("school/branding"), true);
  assert.equal(isProfileMediaUploadFolder("documents/teachers"), false);
});
