import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/get-current-user";
import { assertRole } from "@/lib/auth/guards";

export default async function BursarHomePage() {
  const user = await requireUser();
  assertRole(user, ["bursar"]);
  redirect("/admin/finance");
}
