// src/hooks/admin/usePollTemplates.ts
/**
 * React Query hooks for Poll Templates management.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { QuestionType, RevealResults, AudienceScope } from "./useCommunityPolls";

// ============================================================================
// Types
// ============================================================================

export type TemplateCategory =
  | "wellbeing"
  | "academic"
  | "decision"
  | "parent"
  | "quick"
  | "election"
  | "feedback"
  | "administrative";

export type TemplateAudienceType =
  | "students"
  | "parents"
  | "teachers"
  | "staff"
  | "students_and_parents"
  | "all";

export interface TemplateOptionDTO {
  label: string;
  imageUrl: string | null;
  order: number;
}

export interface TemplateQuestionDTO {
  prompt: string;
  description?: string;
  type: QuestionType;
  options?: TemplateOptionDTO[];
  required: boolean;
  allowOther: boolean;
  order: number;
}

export interface TemplateDefaultsDTO {
  durationDays: number;
  anonymity: "anonymous" | "identified" | "admin_only";
  revealResults: RevealResults;
  allowComments: boolean;
  minResponseRate: number;
  audienceScope: AudienceScope;
  audienceType: TemplateAudienceType;
  requiresApproval: boolean;
}

export interface TemplateListItemDTO {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  icon: string;
  color: string;
  questionCount: number;
  defaults: TemplateDefaultsDTO;
  isPlatformDefault: boolean;
  isSchoolSpecific: boolean;
  usageCount: number;
  isActive: boolean;
  createdAt: string;
}

export interface TemplateDetailDTO extends TemplateListItemDTO {
  questions: TemplateQuestionDTO[];
  updatedAt: string;
}

export interface TemplateCategoryInfo {
  id: TemplateCategory;
  name: string;
  icon: string;
  color: string;
  description: string;
}

interface TemplatesListResponse {
  data: TemplateListItemDTO[];
  grouped: Record<TemplateCategory, TemplateListItemDTO[]>;
  total: number;
}

// ============================================================================
// Category Info (for UI)
// ============================================================================

export const TEMPLATE_CATEGORIES: TemplateCategoryInfo[] = [
  { id: "wellbeing", name: "Student Wellbeing", icon: "heart", color: "rose", description: "Check-ins for student mental health and comfort" },
  { id: "academic", name: "Academic Feedback", icon: "book-open", color: "blue", description: "Teaching and learning feedback" },
  { id: "decision", name: "Decisions & Voting", icon: "vote", color: "indigo", description: "Polls for class and school decisions" },
  { id: "parent", name: "Parent Engagement", icon: "users", color: "cyan", description: "Surveys for parents" },
  { id: "quick", name: "Quick Polls", icon: "zap", color: "yellow", description: "Fast, simple single-question polls" },
  { id: "election", name: "Elections", icon: "award", color: "purple", description: "Class and school elections" },
  { id: "feedback", name: "Feedback", icon: "message-circle", color: "sky", description: "Event and facility feedback" },
  { id: "administrative", name: "Administrative", icon: "settings", color: "slate", description: "Operational and communication preferences" },
];

// ============================================================================
// Query Hooks
// ============================================================================

export function usePollTemplates(params?: {
  category?: TemplateCategory;
  includeInactive?: boolean;
}) {
  return useQuery<TemplatesListResponse>({
    queryKey: ["poll-templates", params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params?.category) searchParams.set("category", params.category);
      if (params?.includeInactive) searchParams.set("includeInactive", "true");

      const res = await fetch(`/api/admin/community/polls/templates?${searchParams.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to fetch templates");
      return res.json();
    },
    staleTime: 60_000, // Templates change less frequently
  });
}

export function usePollTemplate(templateId: string | undefined) {
  return useQuery<TemplateDetailDTO>({
    queryKey: ["poll-template", templateId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/community/polls/templates/${templateId}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to fetch template");
      return res.json();
    },
    enabled: !!templateId,
    staleTime: 60_000,
  });
}

// ============================================================================
// Mutation Hooks
// ============================================================================

export function useCreateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      name: string;
      description: string;
      category: TemplateCategory;
      icon?: string;
      color?: string;
      questions: Array<{
        prompt: string;
        description?: string;
        type: QuestionType;
        options?: Array<{
          label: string;
          imageUrl?: string | null;
          order?: number;
        }>;
        required?: boolean;
        allowOther?: boolean;
        order?: number;
      }>;
      defaults?: Partial<TemplateDefaultsDTO>;
    }) => {
      const res = await fetch("/api/admin/community/polls/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create template");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["poll-templates"] });
    },
  });
}

export function useUpdateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ templateId, data }: { templateId: string; data: Record<string, unknown> }) => {
      const res = await fetch(`/api/admin/community/polls/templates/${templateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update template");
      }
      return res.json();
    },
    onSuccess: (_, { templateId }) => {
      queryClient.invalidateQueries({ queryKey: ["poll-templates"] });
      queryClient.invalidateQueries({ queryKey: ["poll-template", templateId] });
    },
  });
}

export function useDeleteTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (templateId: string) => {
      const res = await fetch(`/api/admin/community/polls/templates/${templateId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to delete template");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["poll-templates"] });
    },
  });
}

export function useSeedTemplates() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/community/polls/templates/seed", {
        method: "POST",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to seed templates");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["poll-templates"] });
    },
  });
}
