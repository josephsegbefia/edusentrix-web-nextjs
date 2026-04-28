"use client";

import { useQuery } from "@tanstack/react-query";

export type StudentDetailTabId =
  | "overview"
  | "academics"
  | "fees"
  | "behaviour"
  | "relationships"
  | "activity"
  | "insights";

export type StudentDetailDTO = {
  id: string;
  schoolId: string;
  admissionNo: string | null;
  firstName: string;
  middleName: string | null;
  lastName: string;
  fullName: string;
  sex: "male" | "female" | null;
  dateOfBirth: string | null;
  ageYears: number | null;
  photoUrl: string | null;
  status: "active" | "inactive" | "withdrawn" | "graduated";
  enrolledAt: string | null;

  // GES (Ghana Education Service)
  gesIndexNumber: string | null;
  gesSchoolCode: string | null;

  grade: {
    id: string;
    name: string;
    code: string | null;
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
    phone: string;
    email?: string | null;
    isPrimary: boolean;
    hasPlatformAccount: boolean;
  }>;
  feesSummary: {
    currentTermLabel: string;
    totalBilled: number;
    totalPaid: number;
    totalOutstanding: number;
    currency: string;
    status: "clear" | "partial" | "owing";
    lastPaymentDate?: string | null;
  } | null;
  academicSummary: {
    latestTermLabel?: string;
    overallAverage?: number;
    classPosition?: number;
    totalSubjects?: number;
    performanceTier?: "top" | "above_average" | "average" | "at_risk";
    trend?: "up" | "down" | "stable";
    isFromPreviousTerm?: boolean;
    previousTermLabel?: string;
  } | null;
  attendanceSummary: {
    presentPercent?: number;
    presentDays?: number;
    absentDays?: number;
    lateDays?: number;
  } | null;
  behaviourSummary: {
    incidentsCount?: number;
    lastIncidentDate?: string | null;
    positiveNotesCount?: number;
  } | null;
  recentActivity: Array<{
    id: string;
    type: string;
    description: string;
    createdAt: string;
    metadata?: Record<string, unknown>;
    user: {
      id: string;
      firstName: string | null;
      lastName: string | null;
      email: string | null;
    } | null;
  }>;

  // New: structures for richer tabs (currently stubbed from API)
  academicRecords: {
    terms: {
      id: string;
      label: string;
      average?: number;
      position?: number;
      totalSubjects?: number;
    }[];
    subjectsByTerm: {
      termId: string;
      subjects: {
        id: string;
        name: string;
        shortCode?: string;
        teacherName?: string;
        caScore?: number | null;
        examScore?: number | null;
        total?: number | null;
        gradeLetter?: string | null;
      }[];
    }[];
  } | null;

  feeTimeline: {
    id: string;
    type: "invoice" | "payment";
    label: string;
    termLabel?: string;
    amount: number;
    date: string;
    status?: "pending" | "paid" | "overdue" | "reversed";
    method?: string;
  }[];

  attendanceEvents: {
    id: string;
    date: string;
    status: "present" | "absent" | "late";
  }[];

  incidents: {
    id: string;
    date: string;
    type: string;
    severity: "low" | "medium" | "high";
    summary: string;
    recordedBy?: string;
  }[];

  documents: {
    id: string;
    name: string;
    type: string;
    uploadedAt: string;
    /** Present for files imported from admissions provisioning. */
    url?: string | null;
    source?: "admissions" | "school" | string | null;
    /** Sub-typing for staff vs parent-request uploads on the student record. */
    recordOrigin?: "staff" | "parent_request";
  }[];

  parentDocumentRequests?: Array<{
    id: string;
    label: string;
    message: string | null;
    fulfilledAt: string | null;
    requestedAt: string;
  }>;
};

export function useStudentDetail(studentId?: string) {
  return useQuery<StudentDetailDTO>({
    queryKey: ["admin-student-detail", studentId],
    enabled: Boolean(studentId),
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    queryFn: async () => {
      if (!studentId) {
        throw new Error("Missing student id");
      }

      const res = await fetch(`/api/admin/students/${studentId}`, {
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error("Failed to fetch student detail");
      }

      const json = await res.json();
      return json.data as StudentDetailDTO;
    },
    staleTime: 30_000,
  });
}
