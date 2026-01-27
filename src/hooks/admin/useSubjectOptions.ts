import { useQuery } from "@tanstack/react-query";

type Subject = { _id: string; name: string; isActive: boolean };

export function useSubjectOptions() {
  return useQuery<Subject[]>({
    queryKey: ["subjects", "active"],
    queryFn: async () => {
      const res = await fetch("/api/admin/subjects?active=1");
      if (!res.ok) throw new Error("Failed to fetch subjects");
      const json = await res.json();
      return (json?.data ?? []) as Subject[];
    },
  });
}
