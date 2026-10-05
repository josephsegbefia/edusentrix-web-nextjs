import { retiredCronHandlers } from "@/lib/background/retired-cron";

export const dynamic = "force-dynamic";

export const { GET, POST } = retiredCronHandlers(
  "Email dispatch now uses Inngest",
  "EMAIL_DISPATCH_CRON_SECRET"
);
