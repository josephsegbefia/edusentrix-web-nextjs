"use client";

import { useQuery } from "@tanstack/react-query";

export type StudentDetailTabId =
  | "overview"
  | "academics"
  | "fees"
  | "behaviour"
  | "relationships"
  | "activity";

export type StudentDetailDTO = {
  id: string;
  schoolId: string;
  admissionNumber: string;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  fullName: string;
  sex: "male" | "female" | null;
  dateOfBirth: string | null;
  ageYears: number | null;
  photoUrl?: string | null;
  status: "active" | "inactive" | "withdrawn";
  enrolledAt: string | null;
  grade: {
    id: string;
    name: string;
    code: string;
    label: string;
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
    email?: string | null;
    phone?: string | null;
    photoUrl?: string | null;
    isPrimary: boolean;
  }>;
  feesSummary: {
    currentTermLabel: string;
    totalBilled: number;
    totalPaid: number;
    totalOutstanding: number;
    status: "clear" | "partial" | "owing";
    latestPaymentDate?: string | null;
  };
  academicSummary: {
    latestTermLabel?: string;
    overallAverage?: number | null;
    classPosition?: number | null;
    totalSubjects?: number;
    performanceTier?: "top" | "above_average" | "average" | "at_risk" | "poor";
    trend?: "up" | "down" | "stable";
  } | null;
  behaviourSummary: {
    incidentCount?: number;
    lastIncidentDate?: string | null;
    positiveNoteCount?: number;
  } | null;
  recentActivity: Array<{
    id: string;
    type: string;
    description: string;
    createdAt: string;
    user: {
      id: string;
      firstName: string;
      lastName: string | null;
      email: string | null;
    } | null;
  }>;
};

export function useStudentDetail(studentId?: string) {
  return useQuery<StudentDetailDTO>({
    queryKey: ["admin-student-detail", studentId],
    enabled: Boolean(studentId),
    queryFn: async () => {
      if (!studentId) throw new Error("Student ID is required");
      const res = await fetch(`/api/admin/students/${studentId}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to fetch student detail");
      const json = await res.json();
      return json.data as StudentDetailDTO;
    },
  });
}
