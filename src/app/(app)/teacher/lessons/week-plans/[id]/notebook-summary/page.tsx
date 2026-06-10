"use client";

import { useParams } from "next/navigation";
import { LessonWeekNotebookSummaryView } from "@/components/lessons/LessonWeekNotebookSummaryView";

export default function TeacherWeekNotebookSummaryPage() {
  const params = useParams<{ id: string }>();
  const weekPlanId = typeof params?.id === "string" ? params.id : null;

  if (!weekPlanId) {
    return <p className="p-6 text-sm text-white/60">Invalid week plan.</p>;
  }

  return (
    <div className="space-y-6">
      <LessonWeekNotebookSummaryView weekPlanId={weekPlanId} />
    </div>
  );
}
