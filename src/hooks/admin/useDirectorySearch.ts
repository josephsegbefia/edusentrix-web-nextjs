import { useQuery } from "@tanstack/react-query";
export type SubjectMini = { id: string; name: string };
export type ClassGroupMini = {
  id: string;
  name: string;
  gradeName?: string | null;
  label?: string | null;
};
export type TeacherMini = {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string | null;
  photoUrl: string | null;
};

export function useSubjectSearch(q: string) {
  return useQuery<{ success: true; data: SubjectMini[] }>({
    queryKey: ["subjects", "search", q],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("q", q);
      params.set("limit", "10");
      const res = await fetch(
        `/api/admin/subjects/search?${params.toString()}`,
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error("Failed to search subjects");
      return res.json();
    },
    enabled: q.length >= 0,
    staleTime: 20_000,
  });
}

export function useClassGroupSearch(q: string) {
  return useQuery<{ success: true; data: ClassGroupMini[] }>({
    queryKey: ["classGroups", "search", q],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("q", q);
      params.set("limit", "10");
      const res = await fetch(
        `/api/admin/class-groups/search?${params.toString()}`,
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error("Failed to search class groups");
      return res.json();
    },
    enabled: q.length >= 0,
    staleTime: 20_000,
  });
}

export function useTeacherSearch(q: string) {
  return useQuery<{ success: true; data: TeacherMini[] }>({
    queryKey: ["teachers", "search", q],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("q", q);
      params.set("limit", "10");
      const res = await fetch(
        `/api/admin/teachers/search?${params.toString()}`,
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error("Failed to search teachers");
      return res.json();
    },
    enabled: q.length >= 0,
    staleTime: 20_000,
  });
}
