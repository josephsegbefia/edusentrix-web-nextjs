import { retiredCronHandlers } from "@/lib/background/retired-cron";

export const dynamic = "force-dynamic";

export const { GET, POST } = retiredCronHandlers(
  "IMAP recovery now uses an Inngest schedule",
  "IMAP_RECOVERY_CRON_SECRET"
);
