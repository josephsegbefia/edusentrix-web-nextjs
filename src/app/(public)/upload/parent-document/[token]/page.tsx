import type { Metadata } from "next";
import { PublicStudentParentDocumentUploadView } from "@/components/students/public/PublicStudentParentDocumentUploadView";

type Params = Promise<{ token: string }>;

function normalizeUploadToken(raw: string): string {
  try {
    return decodeURIComponent(raw.trim());
  } catch {
    return raw.trim();
  }
}

export const metadata: Metadata = {
  title: "Upload document",
  robots: { index: false, follow: false },
};

export default async function StudentParentDocumentUploadPage({
  params,
}: {
  params: Params;
}) {
  const { token: raw } = await params;
  return (
    <PublicStudentParentDocumentUploadView token={normalizeUploadToken(raw)} />
  );
}
