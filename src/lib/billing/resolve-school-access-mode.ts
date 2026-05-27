/** Subscription access modes — kept for type compatibility; gating removed. */
export type SchoolAccessMode =
  | "full"
  | "trial_limited"
  | "pilot_limited"
  | "grace"
  | "restricted_read_only"
  | "suspended";

/** All schools have full access until subscription gating is rebuilt. */
export async function resolveSchoolAccessMode(): Promise<SchoolAccessMode> {
  return "full";
}

export function resolveAccessModeFromSubscription(): SchoolAccessMode {
  return "full";
}
