import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { StudentDetailDTO } from "@/hooks/admin/useStudentDetail";

export type StudentLifecycleStatus = StudentDetailDTO["status"];

async function patchStudentStatus(studentId: string, status: StudentLifecycleStatus) {
  const res = await fetch(`/api/admin/students/${studentId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Failed to update student status");
  }
  return res.json() as Promise<{ success: boolean }>;
}

export function useUpdateStudentStatus(studentId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (status: StudentLifecycleStatus) => {
      if (!studentId) throw new Error("Missing student id");
      return patchStudentStatus(studentId, status);
    },
    onSuccess: async () => {
      if (!studentId) return;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["students", "detail", studentId] }),
        queryClient.invalidateQueries({ queryKey: ["students"] }),
        queryClient.invalidateQueries({ queryKey: ["student-stats"] }),
      ]);
    },
  });
}
