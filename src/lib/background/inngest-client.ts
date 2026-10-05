import { Inngest } from "inngest";

export const INNGEST_APP_ID = "edusentrix";

let client: Inngest | undefined;

export function getInngestClient(): Inngest {
  if (!client) {
    client = new Inngest({ id: INNGEST_APP_ID });
  }
  return client;
}

export function isInngestConfigured(): boolean {
  return Boolean(process.env.INNGEST_EVENT_KEY && process.env.INNGEST_SIGNING_KEY);
}

export function shouldRegisterSmokeFunction(): boolean {
  return (
    process.env.NODE_ENV !== "production" || process.env.INNGEST_ALLOW_SMOKE === "true"
  );
}
