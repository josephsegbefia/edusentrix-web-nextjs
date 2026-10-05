import type { InngestFunction } from "inngest";
import { shouldRegisterSmokeFunction } from "../inngest";
import { createEmailDispatchBackgroundJobFunction } from "./email-dispatch";
import { createSmokeBackgroundJobFunction } from "./smoke";
import { createAiLessonGenerationBackgroundJobFunction } from "./ai-lesson-generation";
import { createExploreGenerationBackgroundJobFunction } from "./explore-generation";
import { createAiLessonIllustrationBackgroundJobFunction } from "./ai-lesson-illustration";

export function getRegisteredInngestFunctions(): InngestFunction.Any[] {
  const functions: InngestFunction.Any[] = [
    createEmailDispatchBackgroundJobFunction(),
    createAiLessonGenerationBackgroundJobFunction(),
    createExploreGenerationBackgroundJobFunction(),
    createAiLessonIllustrationBackgroundJobFunction(),
  ];
  if (shouldRegisterSmokeFunction()) {
    functions.push(createSmokeBackgroundJobFunction());
  }
  return functions;
}
