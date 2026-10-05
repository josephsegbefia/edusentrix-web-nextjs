import type { InngestFunction } from "inngest";
import { shouldRegisterSmokeFunction } from "../inngest";
import { createEmailDispatchBackgroundJobFunction } from "./email-dispatch";
import { createSmokeBackgroundJobFunction } from "./smoke";
import { createAiLessonGenerationBackgroundJobFunction } from "./ai-lesson-generation";
import { createExploreGenerationBackgroundJobFunction } from "./explore-generation";
import { createAiLessonIllustrationBackgroundJobFunction } from "./ai-lesson-illustration";
import { createLibraryImportBackgroundJobFunction } from "./library-import";
import { createSchemeImportBackgroundJobFunction } from "./scheme-import";
import { createSchoolProvisioningBackgroundJobFunction } from "./school-provisioning";
import { createCommunicationOutboxBackgroundJobFunction } from "./communication-outbox";
import { createBulkImportBackgroundJobFunction } from "./bulk-import";
import { getRegisteredScheduleFunctions } from "./schedules";

export function getRegisteredInngestFunctions(): InngestFunction.Any[] {
  const functions: InngestFunction.Any[] = [
    createEmailDispatchBackgroundJobFunction(),
    createAiLessonGenerationBackgroundJobFunction(),
    createExploreGenerationBackgroundJobFunction(),
    createAiLessonIllustrationBackgroundJobFunction(),
    createLibraryImportBackgroundJobFunction(),
    createSchemeImportBackgroundJobFunction(),
    createSchoolProvisioningBackgroundJobFunction(),
    createCommunicationOutboxBackgroundJobFunction(),
    createBulkImportBackgroundJobFunction(),
    ...getRegisteredScheduleFunctions(),
  ];
  if (shouldRegisterSmokeFunction()) {
    functions.push(createSmokeBackgroundJobFunction());
  }
  return functions;
}
