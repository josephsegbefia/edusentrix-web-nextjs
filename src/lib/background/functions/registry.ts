import type { InngestFunction } from "inngest";
import { shouldRegisterSmokeFunction } from "../inngest";
import { createEmailDispatchBackgroundJobFunction } from "./email-dispatch";
import { createSmokeBackgroundJobFunction } from "./smoke";

export function getRegisteredInngestFunctions(): InngestFunction.Any[] {
  const functions: InngestFunction.Any[] = [createEmailDispatchBackgroundJobFunction()];
  if (shouldRegisterSmokeFunction()) {
    functions.push(createSmokeBackgroundJobFunction());
  }
  return functions;
}
