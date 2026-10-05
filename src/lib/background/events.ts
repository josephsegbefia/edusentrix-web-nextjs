import type { BackgroundJobKind } from "./job-kinds";

export const BACKGROUND_JOB_REQUESTED_EVENT = "edusentrix/background-job.requested" as const;

export type BackgroundJobRequestedEventData = {
  jobId: string;
  kind: BackgroundJobKind;
  schoolId?: string;
  initiatedByUserId?: string;
  correlationId?: string;
};

export type BackgroundJobRequestedEvent = {
  id: string;
  name: typeof BACKGROUND_JOB_REQUESTED_EVENT;
  data: BackgroundJobRequestedEventData;
};

export const BACKGROUND_JOB_EVENT_DATA_KEYS = [
  "jobId",
  "kind",
  "schoolId",
  "initiatedByUserId",
  "correlationId",
] as const;

export function buildBackgroundJobRequestedEvent(input: {
  jobId: string;
  kind: BackgroundJobKind;
  schoolId?: string | null;
  initiatedByUserId?: string | null;
  correlationId?: string | null;
}): BackgroundJobRequestedEvent {
  const data: BackgroundJobRequestedEventData = {
    jobId: input.jobId,
    kind: input.kind,
  };
  if (input.schoolId) data.schoolId = input.schoolId;
  if (input.initiatedByUserId) data.initiatedByUserId = input.initiatedByUserId;
  if (input.correlationId) data.correlationId = input.correlationId;
  return {
    id: input.jobId,
    name: BACKGROUND_JOB_REQUESTED_EVENT,
    data,
  };
}
