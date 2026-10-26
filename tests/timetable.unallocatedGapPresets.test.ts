import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isUnallocatedGapPresetCode,
  unallocatedGapPresetLabel,
} from "../src/lib/timetable/unallocated-gap-presets";

test("unallocated gap presets support custom labels without changing existing presets", () => {
  assert.equal(isUnallocatedGapPresetCode("custom"), true);
  assert.equal(unallocatedGapPresetLabel("custom"), "Custom label");
  assert.equal(isUnallocatedGapPresetCode("planning"), true);
  assert.equal(unallocatedGapPresetLabel("planning"), "Teacher planning / prep");
});
