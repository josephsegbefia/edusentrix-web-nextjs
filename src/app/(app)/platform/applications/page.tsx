// Server Component
import { Suspense } from "react";

import ApplicationsFilters from "@/components/platform/applications/ApplicationsFilters";
import MetricsPanel from "@/components/platform/applications/MetricsPanel";
import ApplicationsList from "@/components/platform/applications/ApplicationsList";
import { SectionErrorBoundary } from "@/components/common/SectionErrorBoundary";
import { MetricsSkeleton, CardsSkeleton } from "@/components/common/Skeletons";
import { requireUser } from "@/lib/auth/get-current-user";
import { assertRole } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

export default async function ApplicationsPage() {
  const user = await requireUser();
  assertRole(user, ["platform_admin"]);

  return (
    <div className="space-y-6">
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm pb-6 pt-2 -mx-4 px-4">
        <h1 className="text-2xl md:text-3xl font-semibold mb-6">
          Applications
        </h1>
        {/* Filters (client), always renderable */}
        <ApplicationsFilters />
      </div>

      {/* Metrics are nice-to-have; don't block page */}
      <SectionErrorBoundary>
        <Suspense fallback={<MetricsSkeleton />}>
          <MetricsPanel />
        </Suspense>
      </SectionErrorBoundary>

      {/* List in its own boundary */}
      <SectionErrorBoundary>
        <Suspense fallback={<CardsSkeleton count={6} />}>
          <ApplicationsList />
        </Suspense>
      </SectionErrorBoundary>
    </div>
  );
}
