// src/app/(public)/apply/track/[token]/page.tsx
// Public, unauthenticated tracker page for applicants.

import type { Metadata } from "next";
import { PublicTrackerView } from "@/components/admissions/public/PublicTrackerView";

type Params = Promise<{ token: string }>;

export const metadata: Metadata = {
  title: "Application status",
  robots: { index: false, follow: false },
};

export default async function PublicTrackerPage({
  params,
}: {
  params: Params;
}) {
  const { token } = await params;
  return <PublicTrackerView token={token} />;
}
