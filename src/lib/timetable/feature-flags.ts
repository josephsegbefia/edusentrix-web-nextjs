/**
 * When true, timetable read/write APIs, class-group slot APIs, and daily schedule
 * settings are disabled. UI routes remain and show a “coming soon” state.
 * Set env FEATURE_TIMETABLE_SUNSET=false to temporarily re-enable (e.g. local debugging).
 */
export function isTimetableModuleSunset(): boolean {
  if (process.env.FEATURE_TIMETABLE_SUNSET === "false") return false;
  if (process.env.FEATURE_TIMETABLE_SUNSET === "true") return true;
  return true;
}

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
  if (isTimetableModuleSunset()) return false;
  return envBoolean(
    [
      "NEXT_PUBLIC_FEATURE_TIMETABLE_REBOOT_ENABLED",
      "FEATURE_TIMETABLE_REBOOT_ENABLED",
    ],
    true
  );
}

export function isTimetableDualWriteEnabled(): boolean {
  if (isTimetableModuleSunset()) return false;
  return envBoolean(
    [
      "NEXT_PUBLIC_FEATURE_TIMETABLE_DUAL_WRITE_ENABLED",
      "FEATURE_TIMETABLE_DUAL_WRITE_ENABLED",
    ],
    false
  );
}

export function isTimetableAdminPlannerEnabled(): boolean {
  if (isTimetableModuleSunset()) return false;
  return envBoolean(
    [
      "NEXT_PUBLIC_FEATURE_TIMETABLE_ADMIN_PLANNER_ENABLED",
      "FEATURE_TIMETABLE_ADMIN_PLANNER_ENABLED",
    ],
    true
  );
}

export function isTimetablePublishWorkflowEnabled(): boolean {
  if (isTimetableModuleSunset()) return false;
  return envBoolean(
    [
      "NEXT_PUBLIC_FEATURE_TIMETABLE_PUBLISH_WORKFLOW_ENABLED",
      "FEATURE_TIMETABLE_PUBLISH_WORKFLOW_ENABLED",
    ],
    true
  );
}

export function isTimetableRoleReadViewsEnabled(): boolean {
  if (isTimetableModuleSunset()) return false;
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
