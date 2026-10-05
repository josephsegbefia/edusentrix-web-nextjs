import { retiredCronHandlers } from "@/lib/background/retired-cron";

export const dynamic = "force-dynamic";

export const { GET, POST } = retiredCronHandlers(
  "Library overdue marking now uses an Inngest schedule",
  "LIBRARY_CRON_SECRET"
);
