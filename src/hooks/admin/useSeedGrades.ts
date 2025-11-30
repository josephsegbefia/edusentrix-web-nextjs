import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useBusyToast } from "../useBusyToast";

export function useSeedGrades() {
  const qc = useQueryClient();
  const busy = useBusyToast();

  return useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/grades/seed", { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onMutate: () => busy.toast("Seeding grades..."),
    onSuccess: () => {
      busy.success("Grades seeded successfully");
      qc.invalidateQueries({ queryKey: ["grades"] });
    },
    onError: () => {
      busy.error("Failed to seed grades");
    },
  });
}
