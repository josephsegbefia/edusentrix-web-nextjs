import { extractPlainText } from "@/components/ui/rich-text-editor";

export function containsHtmlMarkup(value: string | undefined | null): boolean {
  return Boolean(value && /<[a-z][\s\S]*>/i.test(value));
}

/** Strip HTML to readable plain text, preserving paragraph breaks. */
export function stripHtmlToPlainText(value: string | undefined | null): string {
  if (!value?.trim()) return "";
  const plain = extractPlainText(value);
  return plain
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n\n");
}

/** Single-line plain text for short Input fields. */
export function stripHtmlToSingleLine(value: string | undefined | null): string {
  return stripHtmlToPlainText(value).replace(/\n+/g, " ").trim();
}

export function sanitizeRichTextField(value: string | undefined | null): string {
  if (!value?.trim()) return "";
  return containsHtmlMarkup(value) ? stripHtmlToPlainText(value) : value;
}

export function sanitizePlainInputField(value: string | undefined | null): string {
  if (!value?.trim()) return "";
  return containsHtmlMarkup(value) ? stripHtmlToSingleLine(value) : value;
}
