const TEACHER_IMPORT_TEMPLATE_HEADERS = [
  "Teacher Name",
  "Phone",
  "Email",
] as const;

const TEACHER_IMPORT_TEMPLATE_EXAMPLE = [
  "Joseph Morgan Stanley",
  "0240000000",
  "joseph.stanley@example.com",
] as const;

function csvValue(value: string) {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export const TEACHER_IMPORT_TEMPLATE_CSV = [
  TEACHER_IMPORT_TEMPLATE_HEADERS,
  TEACHER_IMPORT_TEMPLATE_EXAMPLE,
]
  .map((row) => row.map(csvValue).join(","))
  .join("\n") + "\n";
