import { requirePageFeature } from "@/lib/subscriptions/require-page-feature";
import { FEATURE_KEYS } from "@/lib/subscriptions/feature-keys";
import { DigitalMarkingStudio } from "@/components/teacher/assess/DigitalMarkingStudio";

export default async function DigitalMarkingPage() {
  const gate = await requirePageFeature(FEATURE_KEYS.ASSESSMENT_EXAMINATIONS);
  if (gate) return gate;
  return <DigitalMarkingStudio />;
}
