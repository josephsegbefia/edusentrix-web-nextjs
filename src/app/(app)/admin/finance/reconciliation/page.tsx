import { redirect } from "next/navigation";

/** Legacy URL: reconciliation now lives under `/admin/finance/reconciliation/sessions`. */
export default function ReconciliationLegacyRedirectPage() {
  redirect("/admin/finance/reconciliation/sessions");
}
