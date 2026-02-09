import { useQuery } from "@tanstack/react-query";

export type TeacherStudentDetailResponse = {
  success: boolean;
  data: {
    id: string;
    admissionNo: string | null;
    firstName: string;
    middleName: string | null;
    lastName: string;
    fullName: string;
    sex: "male" | "female" | null;
    dateOfBirth: string | null;
    photoUrl: string | null;
    status: "active" | "inactive" | "withdrawn";
    enrolledAt: string | null;
    grade: {
      id: string;
      name: string;
      code: string | null;
    } | null;
    classGroup: {
      id: string;
      name: string;
      label: string;
    } | null;
    guardians: Array<{
      id: string;
      fullName: string;
      relationship: string;
      phone: string | null;
      email: string | null;
      isPrimary: boolean;
      photoUrl: string | null;
    }>;
    attendanceSummary: {
      total: number;
      present: number;
      absent: number;
      late: number;
      excused: number;
      attendanceRate: number | null;
    };
    academicSummary: {
      periodLabel: string | null;
      overallAverage: number | null;
      subjectsCount: number;
      passedCount: number;
      topSubject: string | null;
      lowestSubject: string | null;
    };
    subjectPerformance: Array<{
      subjectId: string;
      subjectName: string;
      totalScore: number;
      gradeLetter: string;
      isPassed: boolean;
      lastUpdated: string | null;
    }>;
    recentAttendance: Array<{
      id: string;
      date: string;
      type: "homeroom" | "period";
      status: "present" | "absent" | "late" | "excused";
      periodNumber: number | null;
      lateMinutes: number | null;
      reason: string | null;
    }>;
    recentActivity: Array<{
      id: string;
      type: string;
      description: string;
      createdAt: string;
      user: {
        id: string;
        firstName: string | null;
        lastName: string | null;
        email: string | null;
      } | null;
    }>;
  };
};

export function useTeacherStudentDetail(studentId?: string) {
  return useQuery<TeacherStudentDetailResponse>({
    queryKey: ["teacher-student-detail", studentId],
    enabled: Boolean(studentId),
    queryFn: async () => {
      if (!studentId) {
        throw new Error("Missing student id");
      }

      const res = await fetch(`/api/teacher/students/profile/${studentId}`, {
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error("Failed to fetch student detail");
      }

      return res.json();
    },
    staleTime: 30_000,
  });
}
