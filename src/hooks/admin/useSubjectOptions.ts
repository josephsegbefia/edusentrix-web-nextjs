import { useQuery } from "@tanstack/react-query";

type Subject = { _id: string; name: string; isActive: boolean };

export function useSubjectOptions() {
  return useQuery<Subject[]>({
    queryKey: ["subjects", "active"],
    queryFn: async () => {
      const res = await fetch("/api/admin/subjects?isActive=true");
      if (!res.ok) throw new Error("Failed to fetch subjects");
      const json = await res.json();
      const rows = (json?.data ?? []) as Array<{
        _id?: string;
        id?: string;
        name?: string;
        isActive?: boolean;
      }>;
      return rows.map((row) => ({
        _id: String(row._id ?? row.id ?? ""),
        name: String(row.name ?? ""),
        isActive: row.isActive !== false,
      }));
    },
  });
}
