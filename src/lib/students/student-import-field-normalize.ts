export function normalizeImportSex(
  value: string | undefined
): "male" | "female" | undefined {
  if (!value?.trim()) return undefined;
  const normalized = value.trim().toLowerCase();
  if (["m", "male", "boy"].includes(normalized)) return "male";
  if (["f", "female", "girl"].includes(normalized)) return "female";
  return undefined;
}

export function normalizeImportStatus(
  value: string | undefined
): "active" | "inactive" | "withdrawn" {
  if (!value?.trim()) return "active";
  const normalized = value.trim().toLowerCase();
  if (["active", "current", "enrolled"].includes(normalized)) return "active";
  if (["inactive", "suspended"].includes(normalized)) return "inactive";
  if (["withdrawn", "left", "transferred", "alumni"].includes(normalized)) {
    return "withdrawn";
  }
  return "active";
}
