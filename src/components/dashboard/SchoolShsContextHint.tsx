"use client";

import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useSchool } from "@/hooks/admin/useSchool";

type Variant = "admin" | "parent";

/**
 * SHS-only contextual copy so Basic schools see no extra noise.
 * Uses GET /api/school (via useSchool) — no new API.
 */
export function SchoolShsContextHint({ variant }: { variant: Variant }) {
  const { data, isLoading } = useSchool();
  const type = data?.data?.type;

  if (isLoading || type !== "SHS") {
    return null;
  }

  if (variant === "admin") {
    return (
      <Alert className="border-cyan-500/20 bg-cyan-500/10 text-cyan-100">
        <GraduationCap className="h-4 w-4 text-cyan-200" />
        <AlertTitle className="text-cyan-50">Senior High</AlertTitle>
        <AlertDescription className="text-cyan-100/85">
          Align academic periods and published results so families see a clear path through SHS. National exams are run by WAEC separately—use reports for school progress.{" "}
          <Link
            href="/admin/reports"
            className="font-medium text-cyan-200 underline-offset-2 hover:underline"
          >
            Reports
          </Link>
          {" · "}
          <Link
            href="/admin/grades"
            className="font-medium text-cyan-200 underline-offset-2 hover:underline"
          >
            Grades
          </Link>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert className="border-teal-500/25 bg-teal-500/10 text-teal-100">
      <GraduationCap className="h-4 w-4 text-teal-200" />
      <AlertTitle className="text-teal-50">Senior High progress</AlertTitle>
      <AlertDescription className="text-teal-100/85">
        Term results here show your child&apos;s progress at this school. WASSCE and other national certificates are awarded by WAEC when eligible—not generated in this app.
      </AlertDescription>
    </Alert>
  );
}
