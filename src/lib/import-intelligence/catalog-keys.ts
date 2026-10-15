export type OpaqueCatalogEntry = {
  catalogKey: string;
  label: string;
  context?: Record<string, string | number | boolean | null>;
};

export function makeOpaqueCatalog<T extends { label: string }>(
  prefix: "SUBJECT" | "GRADE" | "CLASS" | "FIELD" | "OPTION",
  records: T[],
  context?: (record: T) => OpaqueCatalogEntry["context"]
): Array<OpaqueCatalogEntry & { record: T }> {
  return records.slice(0, 1000).map((record, index) => ({
    catalogKey: `${prefix}_${String(index + 1).padStart(3, "0")}`,
    label: record.label,
    context: context?.(record),
    record,
  }));
}

export function buildOpaqueCatalogLookup<T>(entries: Array<{ catalogKey: string; record: T }>) {
  return new Map(entries.map((entry) => [entry.catalogKey, entry.record]));
}

export function resolveOpaqueCatalogKey<T>(
  key: unknown,
  lookup: Map<string, T>
): T | null {
  return typeof key === "string" ? lookup.get(key) ?? null : null;
}
