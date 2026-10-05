import { serve } from "inngest/next";
import { getInngestClient } from "@/lib/background/inngest";
import { getRegisteredInngestFunctions } from "@/lib/background/functions/registry";

export const { GET, POST, PUT } = serve({
  client: getInngestClient(),
  functions: getRegisteredInngestFunctions(),
});
