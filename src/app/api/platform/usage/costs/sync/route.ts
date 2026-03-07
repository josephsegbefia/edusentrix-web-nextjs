import { POST as runProviderSync } from "@/app/api/platform/billing/provider-sync/route";
import type { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  return runProviderSync(req);
}
