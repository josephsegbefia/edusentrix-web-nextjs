import { useQuery } from "@tanstack/react-query";
import type { LessonNoteFormData, LessonNotePeriodPlanningContext } from "@/types/lesson-notes";

type ApiInitialData = Omit<Partial<LessonNoteFormData>, "weekOf" | "date" | "weekEndingDate"> & {
  weekOf: string;
  date?: string;
  weekEndingDate?: string | null;
};

type Response = {
  success: boolean;
  data?: {
    initialData: ApiInitialData;
    scheme: { id: string; title: string; status: string };
    item: {
      id: string;
      title: string;
      weekNumber: number | null;
      weekEndingDate?: string | null;
      weekEndingLabel?: string | null;
    };
    periodPlanning?: LessonNotePeriodPlanningContext;
  };
  error?: string;
};

export function useLessonNoteFromSchemeItem(schemeItemId: string | null) {
  return useQuery({
    queryKey: ["lesson-note-from-scheme-item", schemeItemId],
    queryFn: async () => {
      if (!schemeItemId) throw new Error("Missing scheme row");
      const params = new URLSearchParams({ schemeItemId });
      const res = await fetch(`/api/teacher/lesson-notes/from-scheme-item?${params.toString()}`, {
        cache: "no-store",
      });
      const json = (await res.json().catch(() => null)) as Response | null;
      if (!res.ok || !json?.success || !json.data) {
        throw new Error(json?.error || "Could not prepare lesson note");
      }
      return {
        ...json.data,
        periodPlanning: json.data.periodPlanning,
        initialData: {
          ...json.data.initialData,
          weekOf: new Date(json.data.initialData.weekOf),
          date: json.data.initialData.date ? new Date(json.data.initialData.date) : undefined,
          weekEndingDate: json.data.initialData.weekEndingDate
            ? new Date(json.data.initialData.weekEndingDate)
            : undefined,
        },
      };
    },
    enabled: Boolean(schemeItemId),
    staleTime: 15_000,
  });
}
