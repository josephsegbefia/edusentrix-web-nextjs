import { useQuery } from "@tanstack/react-query";
type Grade = { _id: string; name: string; isActive: boolean; order?: number };

export function useGradeOptions() {
  return useQuery<Grade[]>({
    queryKey: ["grades", "active"],
    queryFn: async () => {
      const res = await fetch("/api/admin/grades?active=1");
      if (!res.ok) throw new Error("Failed to fetch grades");
      const json = await res.json();
      const rows = (json?.data ?? []) as Array<{
        _id?: string;
        id?: string;
        name?: string;
        isActive?: boolean;
        order?: number;
      }>;
      return rows
        .map((row) => ({
          _id: String(row._id ?? row.id ?? "").trim(),
          name: String(row.name ?? "").trim(),
          isActive: row.isActive !== false,
          order: row.order ?? 0,
        }))
        .filter((g) => g._id.length > 0);
    },
  });
}
