import { useQuery } from "@tanstack/react-query";
type ClassGroup = {
  _id: string;
  name: string;
  isActive: boolean;
  gradeId: string;
};

export function useClassGroupOptions(gradeId: string) {
  return useQuery<ClassGroup[]>({
    enabled: !!gradeId,
    queryKey: ["class-groups", { gradeId }],
    queryFn: async () => {
      const res = await fetch(
        `/api/admin/class-groups?active=1&gradeId=${gradeId}`
      );
      if (!res.ok) throw new Error("Failed to fetch class groups");
      const json = await res.json();
      return (json?.data ?? []) as ClassGroup[];
    },
  });
}
