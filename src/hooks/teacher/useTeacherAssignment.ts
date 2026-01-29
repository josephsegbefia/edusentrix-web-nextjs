import { useQuery } from "@tanstack/react-query";
import type { StudioAssignment } from "./useTeacherAssignments";

export type TeacherAssignmentResponse = {
  success: boolean;
  data: {
    assignment: StudioAssignment;
  };
};

export function useTeacherAssignment(id?: string) {
  return useQuery<TeacherAssignmentResponse>({
    queryKey: ["teacher-assignment", id],
    queryFn: async () => {
      if (!id) throw new Error("Missing assignment id");
      const res = await fetch(`/api/teacher/studio/assignments/${id}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to load assignment");
      return res.json();
    },
    enabled: Boolean(id),
    staleTime: 30_000,
  });
}
