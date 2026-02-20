import { useQuery } from "@tanstack/react-query";

export type TeacherResourceSummary = {
  id: string;
  title: string;
  description: string | null;
  url: string;
  type: "link" | "pdf" | "video" | "image" | "doc" | "slides" | "other";
  tags: string[];
  subject: { id: string; name: string } | null;
  classGroups: Array<{ id: string; name: string }>;
  sharedWith: Array<{
    targetType: "teacher" | "student" | "parent";
    targetId: string;
    targetName: string;
    targetAvatarUrl: string | null;
    targetSubtitle: string | null;
    sharedAt: string | null;
  }>;
  createdAt: string | null;
};

export type TeacherResourcesResponse = {
  success: boolean;
  data: {
    resources: TeacherResourceSummary[];
  };
};

export type TeacherResourcesFilters = {
  search?: string;
  type?: string;
  tag?: string;
  subjectId?: string;
  classGroupId?: string;
  limit?: number;
};

export function useTeacherResources(filters: TeacherResourcesFilters = {}, enabled = true) {
  return useQuery<TeacherResourcesResponse>({
    queryKey: ["teacher-resources", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.search) params.set("search", filters.search);
      if (filters.type) params.set("type", filters.type);
      if (filters.tag) params.set("tag", filters.tag);
      if (filters.subjectId) params.set("subjectId", filters.subjectId);
      if (filters.classGroupId) params.set("classGroupId", filters.classGroupId);
      if (filters.limit) params.set("limit", String(filters.limit));

      const res = await fetch(`/api/teacher/studio/resources?${params.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to fetch resources");
      return res.json();
    },
    enabled,
    staleTime: 60_000,
  });
}
