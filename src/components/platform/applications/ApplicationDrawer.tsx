"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";

type ApplicationDetail = {
  _id: string;
  payload?: unknown; // whatever else you return
  audit?: Array<{ action: string; by?: string; at: string; note?: string }>;
};

export default function ApplicationDrawer({
  open,
  id,
  onOpenChange,
}: {
  open: boolean;
  id: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["applications:detail", id],
    enabled: open && !!id,
    queryFn: async () => {
      const res = await fetch(`/api/platform/applications/${id}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("detail");
      return (await res.json()) as ApplicationDetail;
    },
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md bg-card border-l border-white/10"
      >
        <SheetHeader>
          <SheetTitle>Application Details</SheetTitle>
        </SheetHeader>

        {isLoading && (
          <div className="mt-4 space-y-3">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-32 w-full" />
          </div>
        )}

        {isError && (
          <div className="mt-4 text-rose-300">
            Failed to load details. Please try again later.
          </div>
        )}

        {data && (
          <div className="mt-4 space-y-4">
            <div className="text-sm text-muted">ID: {data._id}</div>

            {data.payload !== undefined && data.payload !== null && (
              <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                <div className="text-sm mb-1">Payload</div>
                <pre className="text-xs text-white/80 overflow-auto">
                  {JSON.stringify(data.payload, null, 2)}
                </pre>
              </div>
            )}

            {data.audit?.length ? (
              <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                <div className="text-sm mb-2">Audit</div>
                <ul className="text-sm space-y-2">
                  {data.audit.map((a, i) => (
                    <li key={i} className="text-muted">
                      <span className="text-white/90">{a.action}</span>{" "}
                      {a.by ? `by ${a.by}` : ""} ·{" "}
                      {new Date(a.at).toLocaleString()}
                      {a.note ? ` — ${a.note}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
