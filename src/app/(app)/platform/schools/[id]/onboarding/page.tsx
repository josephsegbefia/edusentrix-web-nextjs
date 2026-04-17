"use client";

import { useParams } from "next/navigation";
import { LaunchWizard } from "@/components/onboarding/LaunchWizard";

export default function PlatformAssistedOnboardingPage() {
  const params = useParams<{ id: string }>();
  const schoolId = Array.isArray(params?.id) ? params.id[0] : params?.id;

  return <LaunchWizard variant="platform" platformSchoolId={schoolId} />;
}
