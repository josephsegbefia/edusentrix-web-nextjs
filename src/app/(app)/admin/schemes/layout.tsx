import type { ReactNode } from "react";
import { requirePageFeature } from "@/lib/subscriptions/require-page-feature";
import { FEATURE_KEYS } from "@/lib/subscriptions/feature-keys";

export default async function SchemesLayout({ children }: { children: ReactNode }) {
  const gate = await requirePageFeature(FEATURE_KEYS.ACADEMICS_SCHEMES);
  if (gate) return gate;
  return <>{children}</>;
}
