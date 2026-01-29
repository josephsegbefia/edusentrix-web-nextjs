import { useQuery } from "@tanstack/react-query";

export type ClassRosterResponse = {
  success: boolean;
  data: {
    students: Array<{
      _id: string;
      firstName: string;
      lastName: string;
      middleName?: string;
      admissionNo?: string;
      photoUrl?: string;
    }>;
  };
};

export function useClassRoster(classGroupId?: string) {
  return useQuery<ClassRosterResponse>({
    queryKey: ["teacher-class-roster", classGroupId],
    queryFn: async () => {
      if (!classGroupId) {
        return { success: true, data: { students: [] } } as ClassRosterResponse;
      }
      const res = await fetch(`/api/teacher/students/${classGroupId}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to fetch class roster");
      return res.json();
    },
    enabled: !!classGroupId,
    staleTime: 60_000,
  });
}
