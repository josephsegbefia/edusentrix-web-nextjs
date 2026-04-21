export type SetupReadinessPriority = "blocking" | "high" | "medium";

export type SetupReadinessItem = {
  id: string;
  title: string;
  description: string;
  done: boolean;
  priority: SetupReadinessPriority;
  href: string;
  ctaLabel: string;
};

export type SchoolSetupReadinessResult = {
  items: SetupReadinessItem[];
  completionPercent: number;
  incompleteCount: number;
  coachMessage: string;
};
