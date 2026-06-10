import { redirect } from "next/navigation";
import { requireFinanceStaff } from "@/lib/auth/requireFinanceStaff";

export default async function BursarHomePage() {
  await requireFinanceStaff({ mode: "page" });
  redirect("/admin/finance");
}
