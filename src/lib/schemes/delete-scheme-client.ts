import { parseSchemeDeleteResponse } from "@/lib/schemes/scheme-delete-errors";

export async function deleteSchemeRequest(
  apiBasePath: "/api/admin/schemes" | "/api/teacher/schemes",
  schemeId: string,
  unlinkLessonNotes?: boolean,
) {
  const res = await fetch(`${apiBasePath}/${schemeId}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ unlinkLessonNotes: unlinkLessonNotes === true }),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !(json as { success?: boolean })?.success) {
    throw parseSchemeDeleteResponse(json, "Failed to delete scheme");
  }
}
