export function sanitizeLessonHtml(input: string | null | undefined): string {
  const raw = String(input ?? "").trim();
  if (!raw) return "";
  return raw
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/\son[a-z]+\s*=\s*(['"]).*?\1/gi, "")
    .replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, "")
    .replace(/\s(href|src)\s*=\s*(['"])\s*javascript:[\s\S]*?\2/gi, "")
    .replace(/\s(href|src)\s*=\s*(['"])\s*data:(?!image\/(?:png|jpeg|jpg|gif|webp);)[\s\S]*?\2/gi, "");
}

export function normalizeSafeExternalUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function inferLessonFileType(mimeType?: string | null, fileName?: string | null) {
  const mime = String(mimeType ?? "").toLowerCase();
  const name = String(fileName ?? "").toLowerCase();
  if (mime.includes("pdf") || name.endsWith(".pdf")) return "pdf";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.includes("presentation") || name.endsWith(".ppt") || name.endsWith(".pptx")) return "slide";
  if (mime.includes("document") || name.endsWith(".doc") || name.endsWith(".docx")) return "document";
  return "other";
}
