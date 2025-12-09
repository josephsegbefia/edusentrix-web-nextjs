"use client";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Select } from "@/components/ui/select";

type StudentsPaginationProps = {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  pageSizeOptions: readonly number[] | number[];
  onChangePage: (page: number) => void;
  onChangePageSize: (size: number) => void;
};

export function StudentsPagination({
  page,
  totalPages,
  total,
  pageSize,
  pageSizeOptions,
  onChangePage,
  onChangePageSize,
}: StudentsPaginationProps) {
  if (totalPages <= 1 && total <= pageSize) return null;

  const canPrev = page > 1;
  const canNext = page < totalPages;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-linear-to-br from-white/5 to-transparent px-4 py-3 text-xs text-muted-foreground shadow-lg shadow-black/15 backdrop-blur md:flex-row md:items-center md:justify-between min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-md border border-white/10 bg-black/30 px-2 py-1 text-[11px]">
          Showing{" "}
          <span className="font-semibold text-foreground">
            {start}-{end}
          </span>{" "}
          of{" "}
          <span className="font-semibold text-foreground">
            {total.toLocaleString()}
          </span>{" "}
          students
        </span>
        <span className="rounded-md border border-white/10 bg-black/30 px-2 py-1 text-[11px]">
          Page <span className="font-semibold text-foreground">{page}</span> of{" "}
          <span className="font-semibold text-foreground">{totalPages}</span>
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-3 md:justify-end">
        <div className="flex items-center gap-1 text-[11px]">
          <span className="text-muted-foreground/80">Rows per page</span>
          <select
            value={pageSize}
            onChange={(e) => onChangePageSize(Number(e.target.value))}
            className={cn(
              "h-7 rounded-md border border-white/15 bg-black/40 px-2 text-[11px] text-foreground",
              "focus:outline-none focus:ring-1 foucs:ring-ring/60"
            )}
          >
            {pageSizeOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-full border border-white/10 bg-black/30 text-muted-foreground hover:bg-white/10 hover:text-foreground"
            disabled={!canPrev}
            onClick={() => canPrev && onChangePage(page - 1)}
          >
            <ChevronLeft className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-full border border-white/10 bg-black/30 text-muted-foreground hover:bg-white/10 hover:text-foreground"
            disabled={!canNext}
            onClick={() => canNext && onChangePage(page + 1)}
          >
            <ChevronRight className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
