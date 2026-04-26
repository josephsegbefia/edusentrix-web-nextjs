"use client";

import * as React from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  CalendarDays,
  CheckCircle2,
  Loader2,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import { format } from "date-fns/format";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  useUpdateAdmissionApplication,
  type AdmissionApplicationListItem,
} from "@/hooks/admissions/useAdmissionApplications";

type KanbanColumnId =
  | "submitted"
  | "under_review"
  | "interview_scheduled"
  | "waitlisted";

const COLUMNS: Array<{
  id: KanbanColumnId;
  label: string;
  helper: string;
  tone: string;
}> = [
  {
    id: "submitted",
    label: "New",
    helper: "Just landed",
    tone: "border-blue-500/30 bg-blue-500/10 text-blue-100",
  },
  {
    id: "under_review",
    label: "Under review",
    helper: "Being looked at",
    tone: "border-amber-500/30 bg-amber-500/10 text-amber-100",
  },
  {
    id: "interview_scheduled",
    label: "Interview",
    helper: "Conversation set up",
    tone: "border-violet-500/30 bg-violet-500/10 text-violet-100",
  },
  {
    id: "waitlisted",
    label: "Waitlisted",
    helper: "Holding for capacity",
    tone: "border-amber-500/30 bg-amber-500/10 text-amber-100",
  },
];

type ApplicationsKanbanProps = {
  items: AdmissionApplicationListItem[];
  onOpen: (id: string) => void;
};

function isMovable(app: AdmissionApplicationListItem): boolean {
  return (
    !app.hasDecision &&
    !app.provisioned &&
    app.status !== "withdrawn" &&
    app.status !== "expired" &&
    app.status !== "accepted" &&
    app.status !== "rejected"
  );
}

export function ApplicationsKanban({ items, onOpen }: ApplicationsKanbanProps) {
  const update = useUpdateAdmissionApplication();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );
  const [activeId, setActiveId] = React.useState<string | null>(null);

  const groups = React.useMemo(() => {
    const map: Record<KanbanColumnId, AdmissionApplicationListItem[]> = {
      submitted: [],
      under_review: [],
      interview_scheduled: [],
      waitlisted: [],
    };
    for (const item of items) {
      if (item.status in map) {
        map[item.status as KanbanColumnId].push(item);
      }
    }
    return map;
  }, [items]);

  const overflow = items.filter(
    (i) => !(i.status in groups) || !isMovable(i)
  );

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;
    const id = String(active.id);
    const target = String(over.id) as KanbanColumnId;
    const item = items.find((i) => i.id === id);
    if (!item) return;
    if (item.status === target) return;
    if (!isMovable(item)) {
      toast.error("Decisions can't be undone by drag — open the application.");
      return;
    }
    if (
      target !== "submitted" &&
      target !== "under_review" &&
      target !== "interview_scheduled" &&
      target !== "waitlisted"
    ) {
      return;
    }

    update.mutate(
      { applicationId: id, patch: { status: target } },
      {
        onSuccess: () => toast.success("Status updated"),
        onError: (err) => toast.error(err.message || "Could not update status"),
      }
    );
  }

  const activeItem = activeId
    ? items.find((i) => i.id === activeId) ?? null
    : null;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-3 text-xs text-cyan-100">
        Drag a card between columns to update its status. Decisions
        (Accept, Reject, Provision) are made by opening the application —
        they intentionally aren&apos;t drag-targets.
      </div>

      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="grid gap-3 lg:grid-cols-4">
          {COLUMNS.map((col) => (
            <Column
              key={col.id}
              column={col}
              items={groups[col.id]}
              onOpen={onOpen}
              isPending={update.isPending}
            />
          ))}
        </div>

        <DragOverlay dropAnimation={null}>
          {activeItem ? <Card item={activeItem} dragging /> : null}
        </DragOverlay>
      </DndContext>

      {overflow.length > 0 ? (
        <section className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
          <div className="mb-3 flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-white/40" />
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/55">
              Locked applications ({overflow.length})
            </p>
          </div>
          <p className="mb-3 text-xs text-white/55">
            These have a final decision or are withdrawn / expired. They
            can&apos;t be dragged but you can still open them.
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {overflow.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onOpen(item.id)}
                className="rounded-xl border border-white/10 bg-black/30 p-3 text-left text-xs text-white/70 hover:bg-white/5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-white/90">
                    {item.applicant.firstName} {item.applicant.lastName}
                  </span>
                  <Badge
                    variant="outline"
                    className="border-white/10 bg-white/5 text-[10px] uppercase tracking-wide"
                  >
                    {item.status.replace("_", " ")}
                  </Badge>
                </div>
                <p className="mt-1 text-[11px] text-white/40">
                  {item.referenceCode}
                </p>
              </button>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function Column({
  column,
  items,
  onOpen,
  isPending,
}: {
  column: (typeof COLUMNS)[number];
  items: AdmissionApplicationListItem[];
  onOpen: (id: string) => void;
  isPending: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-h-[280px] flex-col rounded-2xl border bg-slate-950/60 p-3 transition",
        isOver
          ? "border-cyan-400/50 bg-cyan-500/5"
          : "border-white/10"
      )}
    >
      <header className="mb-3 flex items-center justify-between">
        <div>
          <Badge variant="outline" className={`border ${column.tone}`}>
            {column.label}
          </Badge>
          <p className="mt-1 text-[11px] text-white/40">{column.helper}</p>
        </div>
        <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-white/55">
          {items.length}
        </span>
      </header>

      <div className="flex flex-1 flex-col gap-2">
        {items.length === 0 ? (
          <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-white/10 px-3 py-6 text-center text-[11px] text-white/35">
            Drop cards here
          </div>
        ) : (
          items.map((item) => (
            <DraggableCard
              key={item.id}
              item={item}
              onOpen={onOpen}
              dim={isPending}
            />
          ))
        )}
      </div>
    </div>
  );
}

function DraggableCard({
  item,
  onOpen,
  dim,
}: {
  item: AdmissionApplicationListItem;
  onOpen: (id: string) => void;
  dim?: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: item.id,
    disabled: !isMovable(item),
  });
  const style: React.CSSProperties = {
    opacity: isDragging ? 0.4 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={style}
      onDoubleClick={() => onOpen(item.id)}
      className={cn(
        "cursor-grab active:cursor-grabbing rounded-xl border border-white/10 bg-black/40 p-2.5 text-xs transition hover:border-cyan-400/30",
        dim && "opacity-70"
      )}
    >
      <Card item={item} />
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onOpen(item.id);
        }}
        className="mt-2 inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-white/70 hover:bg-white/10"
      >
        Open
      </button>
    </div>
  );
}

function Card({
  item,
  dragging = false,
}: {
  item: AdmissionApplicationListItem;
  dragging?: boolean;
}) {
  return (
    <div
      className={cn(
        "space-y-1.5 rounded-lg",
        dragging &&
          "rounded-xl border border-cyan-400/30 bg-slate-950 p-2.5 shadow-2xl"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold text-white">
          {item.applicant.firstName} {item.applicant.lastName}
        </p>
        <span className="font-mono text-[10px] text-white/40">
          {item.referenceCode}
        </span>
      </div>
      <p className="text-[11px] text-white/55">
        {item.applicant.intendedGradeName ?? "Grade pending"}
      </p>
      <div className="flex items-center justify-between text-[10px] text-white/40">
        <span className="inline-flex items-center gap-1">
          <CalendarDays className="h-3 w-3" />
          {item.submittedAt
            ? format(new Date(item.submittedAt), "MMM d")
            : "—"}
        </span>
        <span className="inline-flex items-center gap-1">
          {item.documentsCount > 0 ? (
            <CheckCircle2 className="h-3 w-3 text-emerald-400" />
          ) : (
            <XCircle className="h-3 w-3 text-white/40" />
          )}
          {item.documentsCount} docs
        </span>
      </div>
    </div>
  );
}

export function KanbanLoadingSkeleton() {
  return (
    <div className="grid gap-3 lg:grid-cols-4">
      {COLUMNS.map((c) => (
        <div
          key={c.id}
          className="flex h-64 items-center justify-center rounded-2xl border border-white/10 bg-slate-950/60 text-sm text-white/55"
        >
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          {c.label}
        </div>
      ))}
    </div>
  );
}
