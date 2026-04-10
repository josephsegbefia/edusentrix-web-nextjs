type ResourceLike = {
  title?: unknown;
  url?: unknown;
  type?: unknown;
};

function toTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeLessonNoteResources(value: unknown) {
  if (!Array.isArray(value)) {
    return value;
  }

  return value.reduce<Array<{ title: string; url: string; type?: string }>>(
    (accumulator, entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        return accumulator;
      }

      const resource = entry as ResourceLike;
      const title = toTrimmedString(resource.title);
      const url = toTrimmedString(resource.url);
      const type = toTrimmedString(resource.type);

      // Ignore untouched placeholder rows entirely.
      if (!title && !url && !type) {
        return accumulator;
      }

      // A lesson-note resource idea without a title is not useful enough to persist.
      if (!title) {
        return accumulator;
      }

      accumulator.push({
        title,
        url,
        ...(type ? { type } : {}),
      });
      return accumulator;
    },
    []
  );
}

export function normalizeLessonNoteRequestBody<T>(value: T): T {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }

  const clone = { ...(value as Record<string, unknown>) };
  if ("resources" in clone) {
    clone.resources = normalizeLessonNoteResources(clone.resources);
  }
  return clone as T;
}
