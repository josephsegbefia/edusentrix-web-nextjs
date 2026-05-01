import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { validateCollaboratorTeacherIdsInput } from "../src/lib/lessons/collaboration";

test("validateCollaboratorTeacherIdsInput rejects invalid collaborator IDs", () => {
  const ownerId = new mongoose.Types.ObjectId();
  const validPeer = new mongoose.Types.ObjectId();

  const result = validateCollaboratorTeacherIdsInput({
    collaboratorTeacherIds: [String(validPeer), "bad-id"],
    ownerTeacherId: ownerId,
    allowedTeacherIds: [String(validPeer)],
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.status, 400);
    assert.match(result.error, /Invalid collaborator teacher ID/);
    assert.match(result.error, /bad-id/);
  }
});

test("validateCollaboratorTeacherIdsInput rejects disallowed same-format IDs", () => {
  const ownerId = new mongoose.Types.ObjectId();
  const inSchoolActive = new mongoose.Types.ObjectId();
  const outsideSchoolOrInactive = new mongoose.Types.ObjectId();

  const result = validateCollaboratorTeacherIdsInput({
    collaboratorTeacherIds: [String(inSchoolActive), String(outsideSchoolOrInactive)],
    ownerTeacherId: ownerId,
    allowedTeacherIds: [String(inSchoolActive)],
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.status, 400);
    assert.match(result.error, /not active teachers in this school/);
    assert.match(result.error, new RegExp(String(outsideSchoolOrInactive)));
  }
});

test("validateCollaboratorTeacherIdsInput normalizes dedupe and excludes owner", () => {
  const ownerId = new mongoose.Types.ObjectId();
  const peerA = new mongoose.Types.ObjectId();
  const peerB = new mongoose.Types.ObjectId();

  const result = validateCollaboratorTeacherIdsInput({
    collaboratorTeacherIds: [String(ownerId), String(peerA), String(peerA), String(peerB)],
    ownerTeacherId: ownerId,
    allowedTeacherIds: [String(peerA), String(peerB)],
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.deepEqual(
      result.collaboratorTeacherIds.map(String).sort(),
      [String(peerA), String(peerB)].sort()
    );
  }
});
