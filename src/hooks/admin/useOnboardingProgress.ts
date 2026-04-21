import { useQuery } from "@tanstack/react-query";
import { useAdminMetrics } from "./useAdminMetrics";

export type OnboardingStep =
  | "academic_period"
  | "class_groups"
  | "teachers"
  | "students"
  | "complete";

export type OnboardingProgress = {
  step: OnboardingStep;
  hasAcademicPeriod: boolean;
  hasClassGroups: boolean;
  hasTeachers: boolean;
  hasStudents: boolean;
  isActionEnabled: (action: string) => boolean;
  nextAction: string | null;
  progressPercentage: number;
  isLoading: boolean;
  /** After metrics load: limit school admin sidebar to Dashboard only until all setup steps are done. */
  shouldRestrictSchoolAdminNav: boolean;
};

export function useOnboardingProgress(): OnboardingProgress {
  const { data: metrics, isLoading: metricsLoading } = useAdminMetrics();

  // Fetch class groups count
  const { data: classGroupsData, isLoading: classGroupsLoading } = useQuery({
    queryKey: ["class-groups", "count"],
    queryFn: async () => {
      const res = await fetch("/api/admin/class-groups?active=1", {
        cache: "no-store",
      });
      if (!res.ok) return { count: 0 };
      const json = await res.json();
      const list = Array.isArray(json) ? json : json?.data || [];
      return { count: Array.isArray(list) ? list.length : 0 };
    },
    staleTime: 30_000,
  });

  const isLoading = metricsLoading || classGroupsLoading;

  const hasAcademicPeriod = !!metrics?.period;
  const hasClassGroups = (classGroupsData?.count ?? 0) > 0;
  const hasTeachers = (metrics?.teachers?.total ?? 0) > 0;
  const hasStudents = (metrics?.students?.total ?? 0) > 0;

  // Determine current step
  let step: OnboardingStep = "academic_period";
  let nextAction: string | null = "academic_period";
  let progressPercentage = 0;

  if (hasAcademicPeriod) {
    progressPercentage = 25;
    step = "class_groups";
    nextAction = "create_class_group";
    if (hasClassGroups) {
      progressPercentage = 50;
      step = "teachers";
      nextAction = "add_teacher";
      if (hasTeachers) {
        progressPercentage = 75;
        step = "students";
        nextAction = "add_student";
        if (hasStudents) {
          progressPercentage = 100;
          step = "complete";
          nextAction = null;
        }
      }
    }
  }

  const isActionEnabled = (action: string): boolean => {
    // If onboarding is complete, enable everything
    if (step === "complete") {
      return true;
    }

    // Academic period button is always enabled (it's the first step)
    if (action === "academic_period") {
      return nextAction === "academic_period";
    }

    // Only enable actions that match the current nextAction
    if (action === "create_class_group") {
      return nextAction === "create_class_group";
    }

    if (action === "add_teacher") {
      return nextAction === "add_teacher";
    }

    if (action === "add_student") {
      return nextAction === "add_student";
    }

    // All other actions disabled until onboarding is complete
    if (action === "other") {
      return false;
    }

    return false;
  };

  return {
    step,
    hasAcademicPeriod,
    hasClassGroups,
    hasTeachers,
    hasStudents,
    isActionEnabled,
    nextAction,
    progressPercentage,
    isLoading,
    shouldRestrictSchoolAdminNav: !isLoading && step !== "complete",
  };
}
