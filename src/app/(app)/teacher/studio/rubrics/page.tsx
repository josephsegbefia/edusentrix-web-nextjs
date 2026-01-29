"use client";

import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import { useTeacherRubrics } from "@/hooks/teacher/useTeacherRubrics";
import { useBusyToast } from "@/hooks/useBusyToast";
import { useTeacherContext } from "@/hooks/teacher/useTeacherContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { can } from "@/lib/auth/can";
import { PERMISSIONS, type Permission } from "@/lib/rbac";

type Criterion = {
  title: string;
  description?: string | null;
  maxScore: number;
  weight?: number | null;
};

type RubricEditorState = {
  id?: string;
  title: string;
  description: string;
  criteria: Criterion[];
};

const emptyRubric: RubricEditorState = {
  title: "",
  description: "",
  criteria: [{ title: "", description: "", maxScore: 10, weight: null }],
};

export default function TeacherRubricsPage() {
  const busyToast = useBusyToast();
  const { data: contextData } = useTeacherContext();
  const permissions = contextData?.data.permissions as Permission[] | undefined;
  const canManageRubrics = can(permissions, PERMISSIONS.assignmentsCreate);
  const { data, isLoading, refetch } = useTeacherRubrics();
  const rubrics = data?.data.rubrics || [];

  const [editor, setEditor] = React.useState<RubricEditorState | null>(null);

  if (!canManageRubrics) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-white/70">
        You do not have permission to manage rubrics.
      </div>
    );
  }

  const openCreate = () => setEditor({ ...emptyRubric });

  const openEdit = (rubric: any) =>
    setEditor({
      id: rubric.id,
      title: rubric.title,
      description: rubric.description || "",
      criteria: rubric.criteria.map((criterion: any) => ({
        title: criterion.title,
        description: criterion.description || "",
        maxScore: criterion.maxScore,
        weight: criterion.weight ?? null,
      })),
    });

  const updateEditor = (patch: Partial<RubricEditorState>) => {
    setEditor((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  const updateCriterion = (index: number, patch: Partial<Criterion>) => {
    setEditor((prev) => {
      if (!prev) return prev;
      const next = [...prev.criteria];
      next[index] = { ...next[index], ...patch };
      return { ...prev, criteria: next };
    });
  };

  const addCriterion = () => {
    setEditor((prev) =>
      prev
        ? {
            ...prev,
            criteria: [
              ...prev.criteria,
              { title: "", description: "", maxScore: 10, weight: null },
            ],
          }
        : prev
    );
  };

  const removeCriterion = (index: number) => {
    setEditor((prev) => {
      if (!prev) return prev;
      const next = [...prev.criteria];
      next.splice(index, 1);
      return { ...prev, criteria: next.length ? next : prev.criteria };
    });
  };

  const saveRubric = async () => {
    if (!editor) return;
    if (!editor.title.trim()) {
      busyToast.warning("Provide a rubric title.");
      return;
    }
    if (editor.criteria.some((criterion) => !criterion.title.trim())) {
      busyToast.warning("Fill in all rubric criteria titles.");
      return;
    }

    const payload = {
      title: editor.title,
      description: editor.description || null,
      criteria: editor.criteria.map((criterion) => ({
        title: criterion.title,
        description: criterion.description || null,
        maxScore: Number(criterion.maxScore),
        weight: criterion.weight ?? null,
      })),
    };

    const method = editor.id ? "PATCH" : "POST";
    const url = editor.id
      ? `/api/teacher/studio/rubrics/${editor.id}`
      : "/api/teacher/studio/rubrics";

    await busyToast.promise(
      fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Failed to save rubric");
        return data;
      }),
      {
        loading: "Saving rubric...",
        success: "Rubric saved",
        error: "Failed to save rubric",
      }
    );

    setEditor(null);
    await refetch();
  };

  const deleteRubric = async (id: string) => {
    await busyToast.promise(
      fetch(`/api/teacher/studio/rubrics/${id}`, { method: "DELETE" }).then(async (res) => {
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data?.error || "Failed to delete rubric");
        }
        return res.json();
      }),
      {
        loading: "Deleting rubric...",
        success: "Rubric deleted",
        error: "Failed to delete rubric",
      }
    );
    await refetch();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Rubrics</h1>
          <p className="text-sm text-white/60">Build reusable grading rubrics.</p>
        </div>
        <Button onClick={openCreate} className="bg-indigo-500/20 text-indigo-100 hover:bg-indigo-500/30">
          <Plus className="h-4 w-4" />
          New rubric
        </Button>
      </div>

      {editor && (
        <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-lg">{editor.id ? "Edit rubric" : "Create rubric"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.2em] text-white/40">Title</label>
              <Input
                value={editor.title}
                onChange={(event) => updateEditor({ title: event.target.value })}
                className="border-white/10 bg-white/5 text-white/80"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.2em] text-white/40">Description</label>
              <Textarea
                value={editor.description}
                onChange={(event) => updateEditor({ description: event.target.value })}
                className="min-h-[90px] border-white/10 bg-white/5 text-white/80"
              />
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs uppercase tracking-[0.2em] text-white/40">Criteria</label>
                <Button type="button" variant="ghost" onClick={addCriterion} className="text-white/60 hover:bg-white/10">
                  <Plus className="h-4 w-4" />
                  Add criterion
                </Button>
              </div>
              {editor.criteria.map((criterion, index) => (
                <div key={`${criterion.title}-${index}`} className="grid grid-cols-1 gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 md:grid-cols-[1.2fr_1.6fr_0.6fr_auto]">
                  <Input
                    value={criterion.title}
                    onChange={(event) => updateCriterion(index, { title: event.target.value })}
                    placeholder="Criterion title"
                    className="border-white/10 bg-white/5 text-white/80"
                  />
                  <Input
                    value={criterion.description || ""}
                    onChange={(event) => updateCriterion(index, { description: event.target.value })}
                    placeholder="Description"
                    className="border-white/10 bg-white/5 text-white/80"
                  />
                  <Input
                    type="number"
                    min={0}
                    value={criterion.maxScore}
                    onChange={(event) => updateCriterion(index, { maxScore: Number(event.target.value) })}
                    className="border-white/10 bg-white/5 text-white/80"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeCriterion(index)}
                    className="text-white/60 hover:bg-white/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <Button type="button" variant="ghost" onClick={() => setEditor(null)} className="text-white/60 hover:bg-white/10">
                Cancel
              </Button>
              <Button type="button" onClick={saveRubric} className="bg-indigo-500/20 text-indigo-100 hover:bg-indigo-500/30">
                Save rubric
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, idx) => (
            <div key={idx} className="h-24 animate-pulse rounded-2xl border border-white/10 bg-white/5" />
          ))}
        </div>
      ) : rubrics.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-white/60">
          No rubrics yet. Create your first rubric.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {rubrics.map((rubric) => (
            <Card key={rubric.id} className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg text-white">{rubric.title}</CardTitle>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => openEdit(rubric)} className="text-white/60 hover:bg-white/10">
                    Edit
                  </Button>
                  <Button variant="ghost" onClick={() => deleteRubric(rubric.id)} className="text-rose-200 hover:bg-rose-500/10">
                    Delete
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-white/60">
                <p>{rubric.description || "No description"}</p>
                <p>{rubric.criteria.length} criteria</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
