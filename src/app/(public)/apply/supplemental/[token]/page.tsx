import type { Metadata } from "next";
import { PublicSupplementalUploadView } from "@/components/admissions/public/PublicSupplementalUploadView";

type Params = Promise<{ token: string }>;

export const metadata: Metadata = {
  title: "Upload document",
  robots: { index: false, follow: false },
};

export default async function SupplementalUploadPage({
  params,
}: {
  params: Params;
}) {
  const { token } = await params;
  return <PublicSupplementalUploadView token={token} />;
}
