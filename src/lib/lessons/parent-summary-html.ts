import "server-only";

const MAX_PARENT_SUMMARY_HTML_BYTES = 48_000;

/**
 * Teacher-supplied HTML for parent-facing lesson summaries.
 * Strip script tags and bound size; caregivers only see this when the school enables the feature.
 */
export function normalizeParentSummaryHtmlInput(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const noScripts = trimmed
    .replace(/<\/script/gi, "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
  return noScripts.length > MAX_PARENT_SUMMARY_HTML_BYTES
    ? noScripts.slice(0, MAX_PARENT_SUMMARY_HTML_BYTES)
    : noScripts;
}
