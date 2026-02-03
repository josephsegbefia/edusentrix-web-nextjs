import { toast } from "sonner";

type ComingSoonOptions = {
  description?: string;
};

export function notifyComingSoon(
  feature: string,
  options?: ComingSoonOptions
) {
  toast.info(`${feature} is coming soon.`, {
    description: options?.description ?? "This action is not available yet.",
  });
}
