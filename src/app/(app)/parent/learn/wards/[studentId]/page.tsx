import { Suspense } from "react";
import { requireParent } from "@/lib/auth/requireParent";
import { ParentLearnWardClient } from "@/components/learn/ParentLearnWardClient";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ studentId: string }>;
};

export default async function ParentLearnWardPage({ params }: PageProps) {
  await requireParent({ mode: "page" });
  const { studentId } = await params;

  return (
    <Suspense fallback={null}>
      <ParentLearnWardClient studentId={studentId} />
    </Suspense>
  );
}
