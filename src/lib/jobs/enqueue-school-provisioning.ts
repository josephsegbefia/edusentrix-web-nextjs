import "server-only";

export { enqueueSchoolProvisioningBackgroundJob } from "@/lib/background/domain-enqueue";

export function schoolProvisioningActionUrl() {
  return "/admin/settings/payment-setup";
}
