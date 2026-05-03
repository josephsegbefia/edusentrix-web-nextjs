"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { TeacherSchemeWizard } from "@/components/teacher/schemes/TeacherSchemeWizard";

export default function TeacherSchemeDetailPage() {
  const params = useParams<{ id: string }>();
  const schemeId = useMemo(() => String(params?.id || ""), [params]);

  if (!schemeId) {
    return (
      <div className="mx-auto w-full max-w-6xl p-4 md:p-6">
        <p className="text-sm text-white/70">Missing scheme id.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl p-4 md:p-6">
      <TeacherSchemeWizard schemeId={schemeId} />
    </div>
  );
}
