"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { TeacherSchemeReadOnlyView } from "@/components/teacher/schemes/TeacherSchemeReadOnlyView";

export default function TeacherSchemeDetailPage() {
  const params = useParams<{ id: string }>();
  const schemeId = useMemo(() => String(params?.id || ""), [params]);

  if (!schemeId) {
    return <p className="text-sm text-white/70">Missing scheme id.</p>;
  }

  return <TeacherSchemeReadOnlyView schemeId={schemeId} />;
}
