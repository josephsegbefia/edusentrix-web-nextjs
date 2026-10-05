import type { InngestFunction } from "inngest";
import { shouldRegisterSmokeFunction } from "../inngest";
import { createSmokeBackgroundJobFunction } from "./smoke";

export function getRegisteredInngestFunctions(): InngestFunction.Any[] {
  const functions: InngestFunction.Any[] = [];
  if (shouldRegisterSmokeFunction()) {
    functions.push(createSmokeBackgroundJobFunction());
  }
  return functions;
}
