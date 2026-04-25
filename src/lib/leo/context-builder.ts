import "server-only";
import type { LeoPageContext, LeoPageEntityContext } from "@/lib/leo/types";

function readString(snapshot: Record<string, unknown> | null | undefined, key: string) {
  const value = snapshot?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeMode(value: string | null): LeoPageContext["mode"] {
  return value === "investigate" ? "investigate" : "explain";
}

function parseEntity(route: string | null): LeoPageEntityContext | null {
  if (!route) return null;

  const segments = route.split("?")[0].split("/").filter(Boolean);
  const adminIndex = segments.indexOf("admin");
  if (adminIndex === -1) return null;

  const resource = segments[adminIndex + 1];
  const id = segments[adminIndex + 2];
  if (!id) return null;

  if (resource === "classes") return { type: "class", id };
  if (resource === "teachers") return { type: "teacher", id };
  if (resource === "students") return { type: "student", id };

  return { type: "unknown", id };
}

export function buildLeoPageContext(
  snapshot?: Record<string, unknown> | null
): LeoPageContext {
  const route = readString(snapshot, "route");
  const tab = readString(snapshot, "tab");
  const mode = normalizeMode(readString(snapshot, "mode"));
  const explicitEntityType = readString(snapshot, "entityType");
  const explicitEntityId = readString(snapshot, "entityId");
  const inferredEntity = parseEntity(route);

  return {
    route,
    tab,
    mode,
    entity:
      explicitEntityType && explicitEntityId
        ? {
            type: ["class", "teacher", "student"].includes(explicitEntityType)
              ? (explicitEntityType as LeoPageEntityContext["type"])
              : "unknown",
            id: explicitEntityId,
          }
        : inferredEntity,
  };
}
