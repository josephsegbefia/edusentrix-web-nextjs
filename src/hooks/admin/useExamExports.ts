import type { ExamExportMode, ExamExportPdfType } from "@/types/academics/exam-scheduling-engine";

function buildExportUrl(
  sessionId: string,
  format: "csv" | "pdf",
  params: Record<string, string | undefined>
) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const query = search.toString();
  const base = `/api/admin/exams/sessions/${encodeURIComponent(sessionId)}/export/${format}`;
  return query ? `${base}?${query}` : base;
}

async function downloadExportFile(url: string, fallbackFileName: string) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    let message = "Export failed";
    try {
      const json = (await res.json()) as { error?: string };
      if (json.error) message = json.error;
    } catch {
      // ignore parse errors
    }
    throw new Error(message);
  }

  const disposition = res.headers.get("Content-Disposition");
  const fileNameMatch = disposition?.match(/filename="([^"]+)"/);
  const fileName = fileNameMatch?.[1] ?? fallbackFileName;
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

export async function downloadExamTimetableCsvExport(input: {
  sessionId: string;
  mode: ExamExportMode;
}) {
  const url = buildExportUrl(input.sessionId, "csv", { mode: input.mode });
  await downloadExportFile(url, `exam-timetable-${input.mode}.csv`);
}

export async function downloadExamTimetablePdfExport(input: {
  sessionId: string;
  mode: ExamExportMode;
  type: ExamExportPdfType;
}) {
  const url = buildExportUrl(input.sessionId, "pdf", {
    mode: input.mode,
    type: input.type,
  });
  await downloadExportFile(url, `exam-timetable-${input.mode}-${input.type}.pdf`);
}
