import { useQuery } from "@tanstack/react-query";
type Grade = { _id: string; name: string; isActive: boolean; order?: number };

export function useGradeOptions() {
  return useQuery<Grade[]>({
    queryKey: ["grades", "active"],
    queryFn: async () => {
      const res = await fetch("/api/admin/grades?active=1");
      if (!res.ok) throw new Error("Failed to fetch grades");
      const json = await res.json();
      return (json?.data ?? []) as Grade[];
    },
  });
}
