import { requireParent } from "@/lib/auth/requireParent";
import { ParentLearnOverviewClient } from "@/components/learn/ParentLearnOverviewClient";

export default async function ParentLearnPage() {
  await requireParent({ mode: "page" });

  return <ParentLearnOverviewClient />;
}
