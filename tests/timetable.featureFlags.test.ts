import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isTimetableAdminPlannerEnabled,
  isTimetableApiWriteEnabled,
  isTimetableDualWriteEnabled,
  isTimetableModuleSunset,
  isTimetablePublishWorkflowEnabled,
  isTimetableRebootEnabled,
  isTimetableRoleReadViewsEnabled,
} from "../src/lib/timetable/feature-flags";

test("timetable module is sunset by default (all flags off)", () => {
  const backup = { ...process.env };
  delete process.env.FEATURE_TIMETABLE_SUNSET;
  try {
    assert.equal(isTimetableModuleSunset(), true);
    assert.equal(isTimetableRebootEnabled(), false);
    assert.equal(isTimetableApiWriteEnabled(), false);
  } finally {
    process.env = backup;
  }
});

test("timetable feature flags use safe defaults", () => {
  const backup = { ...process.env };
  process.env.FEATURE_TIMETABLE_SUNSET = "false";
  delete process.env.NEXT_PUBLIC_FEATURE_TIMETABLE_REBOOT_ENABLED;
  delete process.env.FEATURE_TIMETABLE_REBOOT_ENABLED;
  delete process.env.NEXT_PUBLIC_FEATURE_TIMETABLE_ADMIN_PLANNER_ENABLED;
  delete process.env.FEATURE_TIMETABLE_ADMIN_PLANNER_ENABLED;
  delete process.env.NEXT_PUBLIC_FEATURE_TIMETABLE_PUBLISH_WORKFLOW_ENABLED;
  delete process.env.FEATURE_TIMETABLE_PUBLISH_WORKFLOW_ENABLED;
  delete process.env.NEXT_PUBLIC_FEATURE_TIMETABLE_ROLE_READ_VIEWS_ENABLED;
  delete process.env.FEATURE_TIMETABLE_ROLE_READ_VIEWS_ENABLED;
  delete process.env.NEXT_PUBLIC_FEATURE_TIMETABLE_DUAL_WRITE_ENABLED;
  delete process.env.FEATURE_TIMETABLE_DUAL_WRITE_ENABLED;

  try {
    assert.equal(isTimetableRebootEnabled(), true);
    assert.equal(isTimetableAdminPlannerEnabled(), true);
    assert.equal(isTimetablePublishWorkflowEnabled(), true);
    assert.equal(isTimetableRoleReadViewsEnabled(), true);
    assert.equal(isTimetableDualWriteEnabled(), false);
    assert.equal(isTimetableApiWriteEnabled(), true);
  } finally {
    process.env = backup;
  }
});

test("NEXT_PUBLIC timetable flags are honored when provided", () => {
  const backup = { ...process.env };
  process.env.FEATURE_TIMETABLE_SUNSET = "false";
  process.env.NEXT_PUBLIC_FEATURE_TIMETABLE_REBOOT_ENABLED = "false";
  process.env.NEXT_PUBLIC_FEATURE_TIMETABLE_ADMIN_PLANNER_ENABLED = "false";
  process.env.NEXT_PUBLIC_FEATURE_TIMETABLE_PUBLISH_WORKFLOW_ENABLED = "false";
  process.env.NEXT_PUBLIC_FEATURE_TIMETABLE_ROLE_READ_VIEWS_ENABLED = "false";
  process.env.NEXT_PUBLIC_FEATURE_TIMETABLE_DUAL_WRITE_ENABLED = "true";

  try {
    assert.equal(isTimetableRebootEnabled(), false);
    assert.equal(isTimetableAdminPlannerEnabled(), false);
    assert.equal(isTimetablePublishWorkflowEnabled(), false);
    assert.equal(isTimetableRoleReadViewsEnabled(), false);
    assert.equal(isTimetableDualWriteEnabled(), true);
    assert.equal(isTimetableApiWriteEnabled(), false);
  } finally {
    process.env = backup;
  }
});

test("NEXT_PUBLIC flag takes precedence over server flag in mixed environments", () => {
  const backup = { ...process.env };
  process.env.FEATURE_TIMETABLE_SUNSET = "false";
  process.env.NEXT_PUBLIC_FEATURE_TIMETABLE_REBOOT_ENABLED = "true";
  process.env.FEATURE_TIMETABLE_REBOOT_ENABLED = "false";

  try {
    assert.equal(isTimetableRebootEnabled(), true);
  } finally {
    process.env = backup;
  }
});
