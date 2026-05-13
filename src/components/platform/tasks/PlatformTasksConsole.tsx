"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CustomDatePicker } from "@/components/ui/custom-date-picker";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import { Textarea } from "@/components/ui/textarea";
import { PLATFORM_TASK_CATEGORIES, PLATFORM_TASK_STATUSES, type PlatformTaskCategory, type PlatformTaskStatus, type PlatformTaskPriority } from "@/models/PlatformTask";

type TaskRow = {
  id: string;
  schoolName: string | null;
  title: string;
  category: PlatformTaskCategory;
  priority: PlatformTaskPriority;
  status: PlatformTaskStatus;
  assignedToName: string | null;
  dueAt: string | null;
};

type Option = { id: string; name: string; userId?: string };

export function PlatformTasksConsole({
  tasks,
  schoolOptions,
  staffOptions,
}: {
  tasks: TaskRow[];
  schoolOptions: Option[];
  staffOptions: Option[];
}) {
  const router = useRouter();
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [schoolId, setSchoolId] = React.useState("none");
  const [assignedToUserId, setAssignedToUserId] = React.useState("none");
  const [category, setCategory] = React.useState<PlatformTaskCategory>("school_onboarding");
  const [priority, setPriority] = React.useState<PlatformTaskPriority>("normal");
  const [status, setStatus] = React.useState<PlatformTaskStatus>("todo");
  const [dueAt, setDueAt] = React.useState<Date | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function createTask() {
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/platform/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          schoolId: schoolId === "none" ? null : schoolId,
          assignedToUserId: assignedToUserId === "none" ? null : assignedToUserId,
          category,
          priority,
          status,
          dueAt: dueAt?.toISOString() || null,
        }),
      });
      const payload = await res.json();
      if (!res.ok || !payload.success) throw new Error(payload.error || "Failed to create task");
      setTitle("");
      setDescription("");
      setMessage("Task created and audited.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create task");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      {message ? <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{message}</div> : null}
      {error ? <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</div> : null}

      <section className="rounded-3xl border border-white/10 bg-white/5 p-5 text-white">
        <h2 className="text-lg font-semibold">Create Task</h2>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Task title" className="h-11 rounded-2xl border border-white/10 bg-black/20 px-4 text-sm text-white outline-none placeholder:text-white/30" />
          <PremiumSelect value={schoolId} onValueChange={setSchoolId}>
            <PremiumSelectTrigger><PremiumSelectValue placeholder="School" /></PremiumSelectTrigger>
            <PremiumSelectContent>
              <PremiumSelectItem value="none">No school</PremiumSelectItem>
              {schoolOptions.map((school) => <PremiumSelectItem key={school.id} value={school.id}>{school.name}</PremiumSelectItem>)}
            </PremiumSelectContent>
          </PremiumSelect>
          <PremiumSelect value={assignedToUserId} onValueChange={setAssignedToUserId}>
            <PremiumSelectTrigger><PremiumSelectValue placeholder="Assignee" /></PremiumSelectTrigger>
            <PremiumSelectContent>
              <PremiumSelectItem value="none">Unassigned</PremiumSelectItem>
              {staffOptions.map((staff) => <PremiumSelectItem key={staff.id} value={staff.userId || staff.id}>{staff.name}</PremiumSelectItem>)}
            </PremiumSelectContent>
          </PremiumSelect>
          <PremiumSelect value={category} onValueChange={(v) => setCategory(v as PlatformTaskCategory)}>
            <PremiumSelectTrigger><PremiumSelectValue placeholder="Category" /></PremiumSelectTrigger>
            <PremiumSelectContent>
              {PLATFORM_TASK_CATEGORIES.map((item) => <PremiumSelectItem key={item} value={item}>{item.replace(/_/g, " ")}</PremiumSelectItem>)}
            </PremiumSelectContent>
          </PremiumSelect>
          <PremiumSelect value={priority} onValueChange={(v) => setPriority(v as PlatformTaskPriority)}>
            <PremiumSelectTrigger><PremiumSelectValue placeholder="Priority" /></PremiumSelectTrigger>
            <PremiumSelectContent>
              {(["low", "normal", "high", "urgent"] as const).map((item) => <PremiumSelectItem key={item} value={item}>{item}</PremiumSelectItem>)}
            </PremiumSelectContent>
          </PremiumSelect>
          <PremiumSelect value={status} onValueChange={(v) => setStatus(v as PlatformTaskStatus)}>
            <PremiumSelectTrigger><PremiumSelectValue placeholder="Status" /></PremiumSelectTrigger>
            <PremiumSelectContent>
              {PLATFORM_TASK_STATUSES.map((item) => <PremiumSelectItem key={item} value={item}>{item.replace(/_/g, " ")}</PremiumSelectItem>)}
            </PremiumSelectContent>
          </PremiumSelect>
          <CustomDatePicker label="Due date" value={dueAt} onChange={setDueAt} placeholder="No due date" />
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Task details" className="min-h-24 border-white/10 bg-black/20 text-white placeholder:text-white/30 lg:col-span-2" />
        </div>
        <Button disabled={!title.trim() || busy} onClick={() => void createTask()} className="mt-5 bg-cyan-400 text-slate-950 hover:bg-cyan-300">
          <Plus className="mr-2 h-4 w-4" />
          {busy ? "Creating..." : "Create Task"}
        </Button>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/5 p-5 text-white">
        <h2 className="text-lg font-semibold">Task Queue</h2>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead><tr className="border-b border-white/10 text-left text-white/45"><th className="pb-3">Task</th><th className="pb-3">School</th><th className="pb-3">Assignee</th><th className="pb-3">Priority</th><th className="pb-3">Status</th><th className="pb-3">Due</th></tr></thead>
            <tbody>
              {tasks.map((task) => (
                <tr key={task.id} className="border-b border-white/5">
                  <td className="py-3 pr-4 text-white">{task.title}<p className="text-xs text-white/40">{task.category.replace(/_/g, " ")}</p></td>
                  <td className="py-3 pr-4 text-white/60">{task.schoolName || "No school"}</td>
                  <td className="py-3 pr-4 text-white/60">{task.assignedToName || "Unassigned"}</td>
                  <td className="py-3 pr-4 text-white/60">{task.priority}</td>
                  <td className="py-3 pr-4 text-white/60">{task.status.replace(/_/g, " ")}</td>
                  <td className="py-3 text-white/60">{task.dueAt ? new Date(task.dueAt).toLocaleDateString() : "No date"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {tasks.length === 0 ? <div className="rounded-2xl border border-white/10 bg-black/20 p-8 text-center text-sm text-white/45">No platform tasks yet.</div> : null}
        </div>
      </section>
    </div>
  );
}
