export function formatStudentSexLabel(
  sex: "male" | "female" | null | undefined
): string | null {
  if (sex === "male") return "Male";
  if (sex === "female") return "Female";
  return null;
}
