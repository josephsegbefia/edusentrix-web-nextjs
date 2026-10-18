import type { ReactNode } from "react";
import { WorkspaceScope } from "@/components/theme/workspace-scope";
import { requirePageFeature } from "@/lib/subscriptions/require-page-feature";
import { FEATURE_KEYS } from "@/lib/subscriptions/feature-keys";

export default async function AssessmentsLayout({ children }: { children: ReactNode }) {
  const gate = await requirePageFeature(FEATURE_KEYS.ASSESSMENT_EXAMINATIONS);
  if (gate) return gate;
  return <WorkspaceScope>{children}</WorkspaceScope>;
}
