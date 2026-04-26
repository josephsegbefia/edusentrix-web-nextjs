import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type AdmissionDelegateDTO = {
  userId: string;
  teacherId: string | null;
  firstName: string;
  lastName: string;
  email: string;
  photoUrl: string | null;
  assignedAt: string | null;
} | null;

const delegateKey = ["admissions", "delegate"] as const;

async function jsonOrThrow(res: Response) {
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error || "Request failed");
  return json;
}

export function useAdmissionDelegate() {
  return useQuery<{ data: AdmissionDelegateDTO }>({
    queryKey: delegateKey,
    queryFn: async () => {
      const res = await fetch("/api/admin/admissions/delegate", {
        cache: "no-store",
      });
      return jsonOrThrow(res);
    },
    staleTime: 30_000,
  });
}

export function useAssignAdmissionDelegate() {
  const qc = useQueryClient();
  return useMutation<
    { data: AdmissionDelegateDTO },
    Error,
    { teacherId: string }
  >({
    mutationFn: async ({ teacherId }) => {
      const res = await fetch("/api/admin/admissions/delegate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teacherId }),
      });
      return jsonOrThrow(res);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: delegateKey });
      void qc.invalidateQueries({ queryKey: ["teacher-context"] });
    },
  });
}

export function useRevokeAdmissionDelegate() {
  const qc = useQueryClient();
  return useMutation<{ data: null }, Error, void>({
    mutationFn: async () => {
      const res = await fetch("/api/admin/admissions/delegate", {
        method: "DELETE",
      });
      return jsonOrThrow(res);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: delegateKey });
      void qc.invalidateQueries({ queryKey: ["teacher-context"] });
    },
  });
}

export type TeacherPickerDTO = {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  photoUrl?: string | null;
  status?: string;
};

export function useTeacherPicker(searchTerm: string = "") {
  const term = searchTerm.trim();
  return useQuery<{ data: TeacherPickerDTO[] }>({
    queryKey: ["admissions", "teacher-picker", term],
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: "50",
        tab: "active",
      });
      if (term) params.set("search", term);
      const res = await fetch(`/api/admin/teachers?${params.toString()}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to load teachers");
      const list: Array<Record<string, unknown>> = Array.isArray(json?.data)
        ? json.data
        : Array.isArray(json?.data?.items)
          ? json.data.items
          : Array.isArray(json?.teachers)
            ? json.teachers
            : [];
      const items: TeacherPickerDTO[] = list
        .map((t) => ({
          _id: String(t._id ?? t.id ?? ""),
          firstName: String(t.firstName ?? ""),
          lastName: String(t.lastName ?? ""),
          email: String(t.email ?? ""),
          photoUrl: (t.photoUrl as string | null | undefined) ?? null,
          status: (t.status as string | undefined) ?? undefined,
        }))
        .filter((t) => t._id);
      return { data: items };
    },
    staleTime: 60_000,
  });
}
