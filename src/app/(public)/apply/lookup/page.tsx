// src/app/(public)/apply/lookup/page.tsx
// Lightweight parent self-service portal: a guardian enters their email and
// we send them tracker links for every admission application attached to it.

import type { Metadata } from "next";
import { PublicLookupView } from "@/components/admissions/public/PublicLookupView";

export const metadata: Metadata = {
  title: "Find my admission applications",
  robots: { index: false, follow: false },
};

export default function PublicLookupPage() {
  return <PublicLookupView />;
}
