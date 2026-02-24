import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

type AIBudget = {
  dateKey: string;
  tokenCapPerDay: number;
  requestCapPerDay: number;
  tokensUsedToday: number;
  requestsUsedToday: number;
  tokensRemainingToday: number;
  requestsRemainingToday: number;
  estimatedCostUsdToday: number;
  canGenerate: boolean;
  reason: string | null;
};

export type AccountBrief = {
  headline: string;
  riskLevel: "low" | "medium" | "high";
  overview: string;
  keyPoints: string[];
  recommendedActions: string[];
};

export type AccountBriefResponse = {
  feature: "fees_account_brief";
  studentId: string;
  periodId: string | null;
  source: "cache" | "rule_based" | "ai";
  cacheStatus: "fresh" | "stale" | "missing";
  generatedAt: string | null;
  promptVersion: number;
  dataFingerprint: string;
  modelUsed: string | null;
  tokenUsage:
    | {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
      }
    | null;
  budget: AIBudget;
  brief: AccountBrief;
};

export function useFeesAccountBrief(
  studentId: string | undefined,
  periodId?: string | null
) {
  return useQuery<AccountBriefResponse>({
    queryKey: ["fees-ai", "account-brief", studentId, periodId || "all"],
    enabled: Boolean(studentId),
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("studentId", String(studentId));
      if (periodId) params.set("periodId", periodId);

      const res = await fetch(
        `/api/admin/fees/ai/account-brief?${params.toString()}`,
        { cache: "no-store" }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to load AI account brief");
      }
      return json.data as AccountBriefResponse;
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}

export function useRegenerateFeesAccountBrief() {
  const queryClient = useQueryClient();
  return useMutation<
    AccountBriefResponse,
    Error,
    { studentId: string; periodId?: string | null; force?: boolean }
  >({
    mutationFn: async (payload) => {
      const res = await fetch("/api/admin/fees/ai/account-brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to generate AI account brief");
      }
      return json.data as AccountBriefResponse;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["fees-ai", "account-brief", variables.studentId],
      });
    },
  });
}

export type ReminderTemplateTone = "friendly" | "firm" | "urgent";
export type ReminderChannel = "email" | "sms" | "whatsapp";

export type ReminderTemplateResponse = {
  feature: "fees_reminder_template";
  channel: ReminderChannel;
  tone: ReminderTemplateTone;
  source: "cache" | "rule_based" | "ai";
  cacheStatus: "fresh" | "stale" | "missing";
  generatedAt: string | null;
  promptVersion: number;
  dataFingerprint: string;
  modelUsed: string | null;
  tokenUsage:
    | {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
      }
    | null;
  budget: AIBudget;
  template: {
    subject: string | null;
    message: string;
    rationale: string;
    tone: ReminderTemplateTone;
  };
};

type ReminderTemplateInput = {
  channel: ReminderChannel;
  tone: ReminderTemplateTone;
  onlyPrimaryGuardian?: boolean;
  classGroupId?: string;
};

function buildTemplateQuery(input: ReminderTemplateInput) {
  const params = new URLSearchParams();
  params.set("channel", input.channel);
  params.set("tone", input.tone);
  params.set(
    "onlyPrimaryGuardian",
    String(Boolean(input.onlyPrimaryGuardian))
  );
  if (input.classGroupId) {
    params.set("classGroupId", input.classGroupId);
  }
  return params.toString();
}

export function useFeeReminderAIDraft(
  input: ReminderTemplateInput,
  enabled = true
) {
  return useQuery<ReminderTemplateResponse>({
    queryKey: [
      "fees-ai",
      "reminder-template",
      input.channel,
      input.tone,
      Boolean(input.onlyPrimaryGuardian),
      input.classGroupId || "all",
    ],
    enabled,
    queryFn: async () => {
      const res = await fetch(
        `/api/admin/fees/reminders/ai-template?${buildTemplateQuery(input)}`,
        { cache: "no-store" }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to load AI reminder draft");
      }
      return json.data as ReminderTemplateResponse;
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}

export function useGenerateFeeReminderAIDraft() {
  const queryClient = useQueryClient();

  return useMutation<
    ReminderTemplateResponse,
    Error,
    ReminderTemplateInput & { force?: boolean }
  >({
    mutationFn: async (payload) => {
      const res = await fetch("/api/admin/fees/reminders/ai-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to generate AI reminder draft");
      }
      return json.data as ReminderTemplateResponse;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: [
          "fees-ai",
          "reminder-template",
          variables.channel,
          variables.tone,
          Boolean(variables.onlyPrimaryGuardian),
          variables.classGroupId || "all",
        ],
      });
    },
  });
}
