/** Ordered core_v1 generation steps (spec §14–15). */
export const CORE_V1_STEP_DEFS = [
  { key: "academic_periods", label: "Academic periods" },
  { key: "grades", label: "Grades" },
  { key: "class_groups", label: "Class groups (one per grade)" },
  { key: "subjects", label: "Subjects" },
  { key: "staff_users", label: "Staff test accounts" },
  { key: "teachers", label: "Teachers" },
  { key: "teacher_assignments", label: "Teacher assignments" },
  { key: "students", label: "Students" },
  { key: "parents", label: "Parent / guardian accounts" },
  { key: "guardian_links", label: "Guardian–student links" },
  { key: "fee_structures", label: "Fee structures" },
  { key: "invoices", label: "Student invoices" },
  { key: "sample_payments", label: "Sample payments" },
  { key: "notices", label: "Notices" },
  { key: "library_placeholder", label: "Library & lessons (placeholder)" },
] as const;
