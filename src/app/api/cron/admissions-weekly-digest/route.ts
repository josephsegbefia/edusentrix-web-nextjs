import { retiredCronHandlers } from "@/lib/background/retired-cron";

export const dynamic = "force-dynamic";

export const { GET, POST } = retiredCronHandlers(
  "Admissions weekly digest now uses an Inngest schedule",
  "ADMISSIONS_DIGEST_CRON_SECRET"
);
