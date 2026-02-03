"use client";

import { ComingSoonState } from "@/components/ui/coming-soon-state";

export function BulkGrading() {
  return (
    <ComingSoonState
      feature="Bulk grading"
      description="Quick batch grading tools will be available here."
      className="rounded-2xl border-white/10 bg-white/5 text-white"
    />
  );
}
