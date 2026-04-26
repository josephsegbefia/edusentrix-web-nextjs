import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  AdmissionDocumentRequirement,
  AdmissionFormSection,
} from "@/lib/admissions/types";

export type AdmissionFormDTO = {
  id: string;
  cycleId: string;
  schoolId: string;
  version: number;
  sections: AdmissionFormSection[];
  documentRequirements: AdmissionDocumentRequirement[];
  consentText: string;
  localeDefault: string;
  updatedAt: string;
};

const formKey = (cycleId: string) =>
  ["admissions", "cycle", cycleId, "form"] as const;

async function jsonOrThrow(res: Response) {
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error || "Request failed");
  return json;
}

export function useAdmissionForm(cycleId: string | null) {
  return useQuery<{ data: AdmissionFormDTO }>({
    queryKey: cycleId ? formKey(cycleId) : ["admissions", "form-disabled"],
    queryFn: async () => {
      if (!cycleId) throw new Error("cycleId is required");
      const res = await fetch(
        `/api/admin/admissions/cycles/${cycleId}/form`,
        { cache: "no-store" }
      );
      return jsonOrThrow(res);
    },
    enabled: Boolean(cycleId),
    staleTime: 15_000,
  });
}

export type UpdateAdmissionFormInput = {
  sections: AdmissionFormSection[];
  documentRequirements: AdmissionDocumentRequirement[];
  consentText: string;
  localeDefault?: string;
};

export function useSaveAdmissionForm() {
  const qc = useQueryClient();
  return useMutation<
    { data: AdmissionFormDTO },
    Error,
    { cycleId: string; input: UpdateAdmissionFormInput }
  >({
    mutationFn: async ({ cycleId, input }) => {
      const res = await fetch(
        `/api/admin/admissions/cycles/${cycleId}/form`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        }
      );
      return jsonOrThrow(res);
    },
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: formKey(vars.cycleId) });
    },
  });
}

export function useResetAdmissionForm() {
  const qc = useQueryClient();
  return useMutation<{ data: AdmissionFormDTO }, Error, { cycleId: string }>({
    mutationFn: async ({ cycleId }) => {
      const res = await fetch(
        `/api/admin/admissions/cycles/${cycleId}/form/reset`,
        { method: "POST" }
      );
      return jsonOrThrow(res);
    },
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: formKey(vars.cycleId) });
    },
  });
}
