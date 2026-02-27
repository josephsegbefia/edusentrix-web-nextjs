function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return value === "true";
}

function envBoolean(keys: string[], fallback: boolean): boolean {
  for (const key of keys) {
    const value = process.env[key];
    if (value !== undefined) return parseBoolean(value, fallback);
  }
  return fallback;
}

export function isTimetableRebootEnabled(): boolean {
  return envBoolean(
    [
      "NEXT_PUBLIC_FEATURE_TIMETABLE_REBOOT_ENABLED",
      "FEATURE_TIMETABLE_REBOOT_ENABLED",
    ],
    true
  );
}

export function isTimetableDualWriteEnabled(): boolean {
  return envBoolean(
    [
      "NEXT_PUBLIC_FEATURE_TIMETABLE_DUAL_WRITE_ENABLED",
      "FEATURE_TIMETABLE_DUAL_WRITE_ENABLED",
    ],
    false
  );
}

export function isTimetableAdminPlannerEnabled(): boolean {
  return envBoolean(
    [
      "NEXT_PUBLIC_FEATURE_TIMETABLE_ADMIN_PLANNER_ENABLED",
      "FEATURE_TIMETABLE_ADMIN_PLANNER_ENABLED",
    ],
    true
  );
}

export function isTimetablePublishWorkflowEnabled(): boolean {
  return envBoolean(
    [
      "NEXT_PUBLIC_FEATURE_TIMETABLE_PUBLISH_WORKFLOW_ENABLED",
      "FEATURE_TIMETABLE_PUBLISH_WORKFLOW_ENABLED",
    ],
    true
  );
}

export function isTimetableRoleReadViewsEnabled(): boolean {
  return envBoolean(
    [
      "NEXT_PUBLIC_FEATURE_TIMETABLE_ROLE_READ_VIEWS_ENABLED",
      "FEATURE_TIMETABLE_ROLE_READ_VIEWS_ENABLED",
    ],
    true
  );
}

export function isTimetableApiWriteEnabled(): boolean {
  return isTimetableRebootEnabled() && isTimetableAdminPlannerEnabled();
}
