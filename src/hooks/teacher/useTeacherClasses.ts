import { useQuery } from "@tanstack/react-query";

export type TeacherClass = {
  _id: string;
  gradeId: string;
  name: string;
  gradeName: string;
  subjectName: string;
  subjectId: string;
  studentCount: number;
  schedule: Array<{
    dayOfWeek: number | null;
    startTime: string | null;
    endTime: string | null;
  }>;
  isHomeroom: boolean;
};

export type TeacherClassesResponse = {
  success: boolean;
  data: {
    classes: TeacherClass[];
  };
};

export function useTeacherClasses() {
  return useQuery<TeacherClassesResponse>({
    queryKey: ["teacher-classes"],
    queryFn: async () => {
      const res = await fetch("/api/teacher/classes", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to fetch teacher classes");
      return res.json();
    },
    staleTime: 60_000,
  });
}
