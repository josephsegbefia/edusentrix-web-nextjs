const MAX_DISPLAY_NAME = 180;

export function sanitizeDisplayFileName(raw: string): string {
  const base = raw.replace(/\\/g, "/").split("/").pop()?.trim() || "file";
  const cleaned = base
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[<>:"|?*]/g, "_")
    .replace(/\s+/g, " ")
    .trim();
  const safe = cleaned.length > 0 ? cleaned : "file";
  return safe.slice(0, MAX_DISPLAY_NAME);
}

export function contentDispositionValue(
  fileName: string,
  mode: "inline" | "attachment"
): string {
  const sanitized = sanitizeDisplayFileName(fileName).replace(/"/g, "");
  const encoded = encodeURIComponent(sanitized);
  return `${mode}; filename="${sanitized}"; filename*=UTF-8''${encoded}`;
}
