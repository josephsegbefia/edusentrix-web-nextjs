"use client";

import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { StudentResultsProfileClient } from "@/components/student/results/StudentResultsProfileClient";

function ResultsPageFallback() {
  return (
    <div className="space-y-6 p-6 md:p-8">
      <Skeleton className="h-12 w-64 rounded-xl" />
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((key) => (
          <Skeleton key={key} className="h-24 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  );
}

export default function StudentResultsPage() {
  return (
    <Suspense fallback={<ResultsPageFallback />}>
      <StudentResultsProfileClient />
    </Suspense>
  );
}
