/** Admin teacher workload: capacity-based seat estimate (not enrollment). */
export const ADMIN_TEACHER_SEAT_CAPACITY_METRIC = {
  label: "Seat capacity (est.)",
  shortDescription: "Planned seats across assigned classes",
  tooltip:
    "Adds up seat capacity for each unique class this teacher is assigned to in the current period. If a class has no capacity set, we use 30 seats. This measures planning load, not how many students are actually enrolled.",
} as const;

/** Teacher portal: active enrollment headcount. */
export const TEACHER_ENROLLED_STUDENTS_METRIC = {
  label: "Enrolled students",
  shortDescription: "Active students across your classes",
  tooltip:
    "Counts students with active enrollment in each assigned class group for the current period. If you teach more than one subject in the same class, that class is only counted once.",
} as const;
