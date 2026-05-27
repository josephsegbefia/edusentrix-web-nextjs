import type { ReactNode } from "react";
import { requirePageFeature } from "@/lib/subscriptions/require-page-feature";
import { FEATURE_KEYS } from "@/lib/subscriptions/feature-keys";

export default async function Layout({ children }: { children: ReactNode }) {
  const gate = await requirePageFeature(FEATURE_KEYS.ACADEMIC_PERIODS);
  if (gate) return gate;
  return <>{children}</>;
}
