import { retiredCronHandlers } from "@/lib/background/retired-cron";

export const dynamic = "force-dynamic";

export const { GET, POST } = retiredCronHandlers(
  "Subscription renewal notices now use an Inngest schedule",
  "SUBSCRIPTION_CRON_SECRET"
);
