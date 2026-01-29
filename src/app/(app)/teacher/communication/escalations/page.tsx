"use client";

import * as React from "react";
import { AlertTriangle, Plus, RefreshCcw } from "lucide-react";
import { useTeacherEscalations } from "@/hooks/teacher/useTeacherEscalations";
import { useTeacherClasses } from "@/hooks/teacher/useTeacherClasses";
import { useClassRoster } from "@/hooks/teacher/useClassRoster";
import { useTeacherContext } from "@/hooks/teacher/useTeacherContext";
import { useBusyToast } from "@/hooks/useBusyToast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import {
  PremiumDropdownMenu,
  PremiumDropdownMenuContent,
  PremiumDropdownMenuItem,
  PremiumDropdownMenuTrigger,
} from "@/components/ui/premium-dropdown-menu";
import { can } from "@/lib/auth/can";
import { PERMISSIONS, type Permission } from "@/lib/rbac";

const statusOptions = [
  { value: "all", label: "All statuses" },
  { value: "open", label: "Open" },
  { value: "in_review", label: "In review" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];

const typeOptions = [
  { value: "discipline", label: "Discipline" },
  { value: "academic", label: "Academic" },
  { value: "welfare", label: "Welfare" },
  { value: "other", label: "Other" },
];

const statusTone: Record<string, string> = {
  open: "bg-rose-500/20 text-rose-200",
  in_review: "bg-amber-500/20 text-amber-200",
  resolved: "bg-emerald-500/20 text-emerald-200",
  closed: "bg-white/10 text-white/50",
};

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString();
}

export default function TeacherEscalationsPage() {
  const busyToast = useBusyToast();
  const { data: contextData } = useTeacherContext();
  const permissions = contextData?.data.permissions as Permission[] | undefined;
  const canEscalate = can(permissions, PERMISSIONS.escalationsCreate);

  const [statusFilter, setStatusFilter] = React.useState("all");
  const { data, isLoading, refetch } = useTeacherEscalations(
    statusFilter === "all" ? undefined : statusFilter
  );

  const { data: classesData } = useTeacherClasses();
  const classOptions = (classesData?.data.classes || []).map((cls) => ({
    id: cls._id,
    name: cls.name,
  }));

  const [createOpen, setCreateOpen] = React.useState(false);
  const [selectedClassId, setSelectedClassId] = React.useState(classOptions[0]?.id || "");
  const [selectedStudentId, setSelectedStudentId] = React.useState("");
  const [type, setType] = React.useState("academic");
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");

  const { data: rosterData } = useClassRoster(createOpen ? selectedClassId : undefined);
  const roster = rosterData?.data.students || [];

  React.useEffect(() => {
    if (!selectedClassId && classOptions.length > 0) {
      setSelectedClassId(classOptions[0].id);
    }
  }, [classOptions, selectedClassId]);

  React.useEffect(() => {
    if (roster.length === 0) {
      setSelectedStudentId("");
      return;
    }
    if (!roster.some((student) => student._id === selectedStudentId)) {
      setSelectedStudentId(roster[0]._id);
    }
  }, [roster, selectedStudentId]);

  const escalations = data?.data.escalations || [];

  const handleCreate = async () => {
    if (!title.trim() || !description.trim()) {
      busyToast.error("Title and description are required");
      return;
    }

    await busyToast.promise(
      fetch("/api/teacher/escalations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: selectedStudentId || undefined,
          type,
          title: title.trim(),
          description: description.trim(),
        }),
      }).then(async (res) => {
        const payload = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(payload?.error || "Failed to create escalation");
        }
        return payload;
      }),
      {
        loading: "Creating escalation...",
        success: "Escalation logged",
        error: "Failed to create escalation",
      }
    );

    setCreateOpen(false);
    setTitle("");
    setDescription("");
    await refetch();
  };

  const handleStatusUpdate = async (id: string, nextStatus: string) => {
    await busyToast.promise(
      fetch(`/api/teacher/escalations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      }).then(async (res) => {
        const payload = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(payload?.error || "Failed to update escalation");
        }
        return payload;
      }),
      {
        loading: "Updating escalation...",
        success: "Escalation updated",
        error: "Failed to update escalation",
      }
    );
    await refetch();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Escalations</h1>
          <p className="text-sm text-white/60">Log concerns that require admin or counselor follow-up.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => refetch()}
            className="border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
          >
            <RefreshCcw className="h-4 w-4" />
            Refresh
          </Button>
          {canEscalate && (
            <Button
              onClick={() => setCreateOpen(true)}
              className="bg-rose-500/20 text-rose-100 hover:bg-rose-500/30"
            >
              <Plus className="h-4 w-4" />
              New escalation
            </Button>
          )}
        </div>
      </div>

      {!canEscalate && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
          Escalation reporting is disabled for your role.
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 sm:flex-row sm:items-center">
        <div className="min-w-[180px]">
          <PremiumSelect value={statusFilter} onValueChange={setStatusFilter}>
            <PremiumSelectTrigger>
              <PremiumSelectValue placeholder="Filter status" />
            </PremiumSelectTrigger>
            <PremiumSelectContent>
              {statusOptions.map((opt) => (
                <PremiumSelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </PremiumSelectItem>
              ))}
            </PremiumSelectContent>
          </PremiumSelect>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="h-24 animate-pulse rounded-2xl border border-white/10 bg-white/5" />
          ))}
        </div>
      ) : escalations.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-white/60">
          No escalations logged yet.
        </div>
      ) : (
        <div className="space-y-4">
          {escalations.map((esc) => (
            <Card
              key={esc.id}
              className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur"
            >
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-lg text-white">{esc.title}</CardTitle>
                  <div className="text-xs text-white/50">
                    {esc.type.toUpperCase()} · Logged {formatDate(esc.createdAt)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={statusTone[esc.status]}>{esc.status.replace("_", " ")}</Badge>
                  {canEscalate && (
                    <PremiumDropdownMenu>
                      <PremiumDropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-white/60 hover:text-white">
                          <AlertTriangle className="h-4 w-4" />
                        </Button>
                      </PremiumDropdownMenuTrigger>
                      <PremiumDropdownMenuContent align="end">
                        {statusOptions
                          .filter((opt) => opt.value !== "all")
                          .map((opt) => (
                            <PremiumDropdownMenuItem
                              key={opt.value}
                              onClick={() => handleStatusUpdate(esc.id, opt.value)}
                            >
                              Mark {opt.label}
                            </PremiumDropdownMenuItem>
                          ))}
                      </PremiumDropdownMenuContent>
                    </PremiumDropdownMenu>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-white/60">
                <p>{esc.description}</p>
                {esc.student && (
                  <div className="text-xs text-white/50">
                    Student: {esc.student.name} {esc.student.admissionNo ? `(${esc.student.admissionNo})` : ""}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="border-white/10 bg-[#0f0f14] text-white">
          <DialogHeader>
            <DialogTitle className="text-lg">Log escalation</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">Class group</label>
                <PremiumSelect value={selectedClassId} onValueChange={setSelectedClassId}>
                  <PremiumSelectTrigger>
                    <PremiumSelectValue placeholder="Select class" />
                  </PremiumSelectTrigger>
                  <PremiumSelectContent>
                    {classOptions.map((cls) => (
                      <PremiumSelectItem key={cls.id} value={cls.id}>
                        {cls.name}
                      </PremiumSelectItem>
                    ))}
                  </PremiumSelectContent>
                </PremiumSelect>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">Student (optional)</label>
                <PremiumSelect value={selectedStudentId} onValueChange={setSelectedStudentId}>
                  <PremiumSelectTrigger>
                    <PremiumSelectValue placeholder="Select student" />
                  </PremiumSelectTrigger>
                  <PremiumSelectContent>
                    {roster.map((student) => (
                      <PremiumSelectItem key={student._id} value={student._id}>
                        {student.firstName} {student.lastName}
                      </PremiumSelectItem>
                    ))}
                  </PremiumSelectContent>
                </PremiumSelect>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">Type</label>
              <PremiumSelect value={type} onValueChange={setType}>
                <PremiumSelectTrigger>
                  <PremiumSelectValue placeholder="Select type" />
                </PremiumSelectTrigger>
                <PremiumSelectContent>
                  {typeOptions.map((opt) => (
                    <PremiumSelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </PremiumSelectItem>
                  ))}
                </PremiumSelectContent>
              </PremiumSelect>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">Title</label>
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Escalation summary"
                className="border-white/10 bg-white/5 text-white"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">Description</label>
              <Textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Provide the full context and actions taken so far"
                className="min-h-[120px] border-white/10 bg-white/5 text-white"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} className="border-white/10 text-white/60">
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!canEscalate}
              className="bg-rose-500/20 text-rose-100 hover:bg-rose-500/30"
            >
              Log escalation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
