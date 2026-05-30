import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  AssessmentItemDTO,
} from "@/types/academics/assessment-engine";
import type {
  ExamAssessmentLinkStatusDTO,
  ExamLinkableAssessmentItemDTO,
  ExamTimetableEntryDTO,
} from "@/types/academics/exam-scheduling-engine";

type ExamAssessmentLinkStatusResponse = {
  success: boolean;
  data: ExamAssessmentLinkStatusDTO;
  error?: string;
};

type ExamAssessmentLinkCandidatesResponse = {
  success: boolean;
  data: ExamLinkableAssessmentItemDTO[];
  error?: string;
};

type CreateLinkedAssessmentItemsResponse = {
  success: boolean;
  data: {
    status: ExamAssessmentLinkStatusDTO;
    createdItems: AssessmentItemDTO[];
    entry: ExamTimetableEntryDTO;
  };
  error?: string;
};

type LinkExistingAssessmentItemResponse = {
  success: boolean;
  data: {
    status: ExamAssessmentLinkStatusDTO;
    assessmentItem: AssessmentItemDTO;
    entry: ExamTimetableEntryDTO;
  };
  error?: string;
};

type UnlinkAssessmentLinkResponse = {
  success: boolean;
  data: {
    status: ExamAssessmentLinkStatusDTO;
    entry: ExamTimetableEntryDTO;
  };
  error?: string;
};

function assessmentLinkKey(sessionId: string, entryId: string) {
  return ["examAssessmentLink", sessionId, entryId] as const;
}

function assessmentLinkCandidatesKey(
  sessionId: string,
  entryId: string,
  classGroupId: string
) {
  return ["examAssessmentLinkCandidates", sessionId, entryId, classGroupId] as const;
}

async function parseJson<T>(res: Response): Promise<T> {
  return res.json() as Promise<T>;
}

export function useExamAssessmentLinkStatus(
  sessionId: string | null,
  entryId: string | null,
  enabled = true
) {
  return useQuery<ExamAssessmentLinkStatusResponse>({
    queryKey: assessmentLinkKey(sessionId ?? "", entryId ?? ""),
    enabled: Boolean(sessionId && entryId && enabled),
    queryFn: async () => {
      const res = await fetch(
        `/api/admin/exams/sessions/${encodeURIComponent(sessionId!)}/entries/${encodeURIComponent(entryId!)}/assessment-link`,
        { cache: "no-store" }
      );
      const json = await parseJson<ExamAssessmentLinkStatusResponse>(res);
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Failed to load assessment link status");
      }
      return json;
    },
  });
}

export function useExamAssessmentLinkCandidates(
  sessionId: string | null,
  entryId: string | null,
  classGroupId: string | null,
  enabled = true
) {
  return useQuery<ExamAssessmentLinkCandidatesResponse>({
    queryKey: assessmentLinkCandidatesKey(
      sessionId ?? "",
      entryId ?? "",
      classGroupId ?? ""
    ),
    enabled: Boolean(sessionId && entryId && classGroupId && enabled),
    queryFn: async () => {
      const params = new URLSearchParams({ classGroupId: classGroupId! });
      const res = await fetch(
        `/api/admin/exams/sessions/${encodeURIComponent(sessionId!)}/entries/${encodeURIComponent(entryId!)}/assessment-link/candidates?${params.toString()}`,
        { cache: "no-store" }
      );
      const json = await parseJson<ExamAssessmentLinkCandidatesResponse>(res);
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Failed to load assessment items");
      }
      return json;
    },
  });
}

function invalidateAssessmentQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  sessionId: string,
  entryId: string
) {
  queryClient.invalidateQueries({ queryKey: ["examTimetableEntries", sessionId] });
  queryClient.invalidateQueries({ queryKey: assessmentLinkKey(sessionId, entryId) });
  queryClient.invalidateQueries({
    queryKey: ["examAssessmentLinkCandidates", sessionId, entryId],
  });
  queryClient.invalidateQueries({
    queryKey: ["examMissingAssessmentLinks", sessionId],
  });
}

export function useCreateLinkedAssessmentItems(sessionId: string, entryId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input?: {
      classGroupIds?: string[];
      maxScore?: number;
      componentKey?: string | null;
      title?: string;
    }) => {
      const res = await fetch(
        `/api/admin/exams/sessions/${encodeURIComponent(sessionId)}/entries/${encodeURIComponent(entryId)}/assessment-link`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input ?? {}),
        }
      );
      const json = await parseJson<CreateLinkedAssessmentItemsResponse>(res);
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Failed to create linked assessment items");
      }
      return json.data;
    },
    onSuccess: () => {
      invalidateAssessmentQueries(queryClient, sessionId, entryId);
    },
  });
}

export function useLinkExistingAssessmentItem(sessionId: string, entryId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { assessmentItemId: string; classGroupId: string }) => {
      const res = await fetch(
        `/api/admin/exams/sessions/${encodeURIComponent(sessionId)}/entries/${encodeURIComponent(entryId)}/assessment-link`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        }
      );
      const json = await parseJson<LinkExistingAssessmentItemResponse>(res);
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Failed to link assessment item");
      }
      return json.data;
    },
    onSuccess: () => {
      invalidateAssessmentQueries(queryClient, sessionId, entryId);
    },
  });
}

export function useUnlinkExamAssessmentItem(sessionId: string, entryId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input?: { classGroupId?: string }) => {
      const res = await fetch(
        `/api/admin/exams/sessions/${encodeURIComponent(sessionId)}/entries/${encodeURIComponent(entryId)}/assessment-link`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input ?? {}),
        }
      );
      const json = await parseJson<UnlinkAssessmentLinkResponse>(res);
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Failed to unlink assessment item");
      }
      return json.data;
    },
    onSuccess: () => {
      invalidateAssessmentQueries(queryClient, sessionId, entryId);
    },
  });
}
