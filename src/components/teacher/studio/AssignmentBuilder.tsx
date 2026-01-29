"use client";

import * as React from "react";
import { Plus, X } from "lucide-react";
import { useTeacherClasses } from "@/hooks/teacher/useTeacherClasses";
import { useTeacherRubrics } from "@/hooks/teacher/useTeacherRubrics";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CustomDatePicker } from "@/components/ui/custom-date-picker";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import {
  PremiumDropdownMenu,
  PremiumDropdownMenuCheckboxItem,
  PremiumDropdownMenuContent,
  PremiumDropdownMenuTrigger,
} from "@/components/ui/premium-dropdown-menu";

export type AssignmentAttachment = {
  name: string;
  url: string;
  type: "pdf" | "image" | "video" | "audio" | "link";
  size?: number;
};

export type AssignmentFormValues = {
  title: string;
  instructions: string;
  type: "assignment" | "quiz" | "project" | "practice";
  subjectId: string;
  classGroupIds: string[];
  dueDate: Date | null;
  latePolicy: "accept" | "reject" | "penalize";
  latePenaltyPercent?: number | null;
  maxScore: number;
  weight?: number | null;
  rubricId?: string | null;
  attachments: AssignmentAttachment[];
};

export type AssignmentBuilderProps = {
  initialValues?: Partial<AssignmentFormValues>;
  mode?: "create" | "edit";
  onSubmit: (values: AssignmentFormValues, options?: { publish?: boolean }) => Promise<void>;
  showPublish?: boolean;
};

const defaultValues: AssignmentFormValues = {
  title: "",
  instructions: "",
  type: "assignment",
  subjectId: "",
  classGroupIds: [],
  dueDate: new Date(),
  latePolicy: "accept",
  latePenaltyPercent: null,
  maxScore: 100,
  weight: null,
  rubricId: null,
  attachments: [],
};

export function AssignmentBuilder({
  initialValues,
  mode = "create",
  onSubmit,
  showPublish = true,
}: AssignmentBuilderProps) {
  const { data: classesData } = useTeacherClasses();
  const { data: rubricsData } = useTeacherRubrics();

  const [values, setValues] = React.useState<AssignmentFormValues>({
    ...defaultValues,
    ...initialValues,
  });

  React.useEffect(() => {
    if (initialValues) {
      setValues((prev) => ({ ...prev, ...initialValues }));
    }
  }, [initialValues]);

  const classAssignments = classesData?.data.classes || [];
  const subjectOptions = React.useMemo(() => {
    const map = new Map<string, string>();
    classAssignments.forEach((item: any) => {
      if (item.subjectId && item.subjectName) {
        map.set(item.subjectId, item.subjectName);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [classAssignments]);

  const classOptions = React.useMemo(() => {
    if (!values.subjectId) return [];
    return classAssignments
      .filter((item: any) => item.subjectId === values.subjectId)
      .map((item: any) => ({ id: item._id, name: item.name }));
  }, [classAssignments, values.subjectId]);

  const rubrics = rubricsData?.data.rubrics || [];

  const updateValue = <K extends keyof AssignmentFormValues>(
    key: K,
    value: AssignmentFormValues[K]
  ) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const toggleClassGroup = (id: string) => {
    setValues((prev) => {
      const next = new Set(prev.classGroupIds);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return { ...prev, classGroupIds: Array.from(next) };
    });
  };

  const handleSubmit = async (publish?: boolean) => {
    await onSubmit(values, { publish });
  };

  const addAttachment = () => {
    setValues((prev) => ({
      ...prev,
      attachments: [
        ...prev.attachments,
        { name: "", url: "", type: "link" },
      ],
    }));
  };

  const updateAttachment = (index: number, patch: Partial<AssignmentAttachment>) => {
    setValues((prev) => {
      const next = [...prev.attachments];
      next[index] = { ...next[index], ...patch };
      return { ...prev, attachments: next };
    });
  };

  const removeAttachment = (index: number) => {
    setValues((prev) => {
      const next = [...prev.attachments];
      next.splice(index, 1);
      return { ...prev, attachments: next };
    });
  };

  return (
    <div className="space-y-6">
      <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-lg">Assignment Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.2em] text-white/40">Title</label>
              <Input
                value={values.title}
                onChange={(event) => updateValue("title", event.target.value)}
                placeholder="Assignment title"
                className="border-white/10 bg-white/5 text-white/80"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.2em] text-white/40">Type</label>
              <PremiumSelect value={values.type} onValueChange={(value) => updateValue("type", value as AssignmentFormValues["type"])}>
                <PremiumSelectTrigger>
                  <PremiumSelectValue placeholder="Select type" />
                </PremiumSelectTrigger>
                <PremiumSelectContent>
                  <PremiumSelectItem value="assignment">Assignment</PremiumSelectItem>
                  <PremiumSelectItem value="quiz">Quiz</PremiumSelectItem>
                  <PremiumSelectItem value="project">Project</PremiumSelectItem>
                  <PremiumSelectItem value="practice">Practice</PremiumSelectItem>
                </PremiumSelectContent>
              </PremiumSelect>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.2em] text-white/40">Instructions</label>
            <Textarea
              value={values.instructions}
              onChange={(event) => updateValue("instructions", event.target.value)}
              placeholder="Provide clear instructions for students"
              className="min-h-[120px] border-white/10 bg-white/5 text-white/80"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.2em] text-white/40">Subject</label>
              <PremiumSelect
                value={values.subjectId || undefined}
                onValueChange={(value) => {
                  updateValue("subjectId", value);
                  updateValue("classGroupIds", []);
                }}
              >
                <PremiumSelectTrigger>
                  <PremiumSelectValue placeholder="Select subject" />
                </PremiumSelectTrigger>
                <PremiumSelectContent>
                  {subjectOptions.length === 0 && (
                    <PremiumSelectItem value="none" disabled>
                      No subjects available
                    </PremiumSelectItem>
                  )}
                  {subjectOptions.map((subject) => (
                    <PremiumSelectItem key={subject.id} value={subject.id}>
                      {subject.name}
                    </PremiumSelectItem>
                  ))}
                </PremiumSelectContent>
              </PremiumSelect>
            </div>

            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.2em] text-white/40">Classes</label>
              <PremiumDropdownMenu>
                <PremiumDropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full justify-between border border-white/10 bg-white/5 text-left text-white/80 hover:bg-white/10"
                  >
                    {values.classGroupIds.length > 0
                      ? `${values.classGroupIds.length} classes selected`
                      : "Select classes"}
                  </Button>
                </PremiumDropdownMenuTrigger>
                <PremiumDropdownMenuContent align="start" className="min-w-[220px]">
                  {classOptions.length === 0 && (
                    <PremiumDropdownMenuCheckboxItem checked={false} disabled>
                      Select a subject first
                    </PremiumDropdownMenuCheckboxItem>
                  )}
                  {classOptions.map((option) => (
                    <PremiumDropdownMenuCheckboxItem
                      key={option.id}
                      checked={values.classGroupIds.includes(option.id)}
                      onCheckedChange={() => toggleClassGroup(option.id)}
                    >
                      {option.name}
                    </PremiumDropdownMenuCheckboxItem>
                  ))}
                </PremiumDropdownMenuContent>
              </PremiumDropdownMenu>
              {values.classGroupIds.length > 0 && (
                <div className="text-xs text-white/50">
                  {classOptions
                    .filter((option) => values.classGroupIds.includes(option.id))
                    .map((option) => option.name)
                    .join(", ")}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.2em] text-white/40">Due Date</label>
              <CustomDatePicker
                value={values.dueDate}
                onChange={(date) => updateValue("dueDate", date)}
                placeholder="Select date"
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.2em] text-white/40">Max Score</label>
              <Input
                type="number"
                min={0}
                value={values.maxScore}
                onChange={(event) => updateValue("maxScore", Number(event.target.value))}
                className="border-white/10 bg-white/5 text-white/80"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.2em] text-white/40">Weight (optional)</label>
              <Input
                type="number"
                min={0}
                max={100}
                value={values.weight ?? ""}
                onChange={(event) => {
                  const value = event.target.value;
                  updateValue("weight", value === "" ? null : Number(value));
                }}
                className="border-white/10 bg-white/5 text-white/80"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.2em] text-white/40">Late Policy</label>
              <PremiumSelect
                value={values.latePolicy}
                onValueChange={(value) => updateValue("latePolicy", value as AssignmentFormValues["latePolicy"])}
              >
                <PremiumSelectTrigger>
                  <PremiumSelectValue placeholder="Select policy" />
                </PremiumSelectTrigger>
                <PremiumSelectContent>
                  <PremiumSelectItem value="accept">Accept late work</PremiumSelectItem>
                  <PremiumSelectItem value="reject">Reject late work</PremiumSelectItem>
                  <PremiumSelectItem value="penalize">Accept with penalty</PremiumSelectItem>
                </PremiumSelectContent>
              </PremiumSelect>
            </div>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.2em] text-white/40">Late Penalty %</label>
              <Input
                type="number"
                min={0}
                max={100}
                value={values.latePenaltyPercent ?? ""}
                onChange={(event) => {
                  const value = event.target.value;
                  updateValue("latePenaltyPercent", value === "" ? null : Number(value));
                }}
                disabled={values.latePolicy !== "penalize"}
                className="border-white/10 bg-white/5 text-white/80"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.2em] text-white/40">Rubric</label>
              <PremiumSelect
                value={values.rubricId || "none"}
                onValueChange={(value) => updateValue("rubricId", value === "none" ? null : value)}
              >
                <PremiumSelectTrigger>
                  <PremiumSelectValue placeholder="Select rubric" />
                </PremiumSelectTrigger>
                <PremiumSelectContent>
                  <PremiumSelectItem value="none">No rubric</PremiumSelectItem>
                  {rubrics.map((rubric) => (
                    <PremiumSelectItem key={rubric.id} value={rubric.id}>
                      {rubric.title}
                    </PremiumSelectItem>
                  ))}
                </PremiumSelectContent>
              </PremiumSelect>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Attachments</CardTitle>
          <Button type="button" variant="ghost" onClick={addAttachment} className="text-white/70 hover:bg-white/10">
            <Plus className="h-4 w-4" />
            Add attachment
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {values.attachments.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-white/50">
              No attachments added yet.
            </div>
          ) : (
            values.attachments.map((attachment, index) => (
              <div key={`${attachment.name}-${index}`} className="grid grid-cols-1 gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 md:grid-cols-[1.2fr_1.6fr_0.8fr_auto] md:items-center">
                <Input
                  value={attachment.name}
                  onChange={(event) => updateAttachment(index, { name: event.target.value })}
                  placeholder="File name"
                  className="border-white/10 bg-white/5 text-white/80"
                />
                <Input
                  value={attachment.url}
                  onChange={(event) => updateAttachment(index, { url: event.target.value })}
                  placeholder="https://"
                  className="border-white/10 bg-white/5 text-white/80"
                />
                <PremiumSelect
                  value={attachment.type}
                  onValueChange={(value) => updateAttachment(index, { type: value as AssignmentAttachment["type"] })}
                >
                  <PremiumSelectTrigger>
                    <PremiumSelectValue placeholder="Type" />
                  </PremiumSelectTrigger>
                  <PremiumSelectContent>
                    <PremiumSelectItem value="pdf">PDF</PremiumSelectItem>
                    <PremiumSelectItem value="image">Image</PremiumSelectItem>
                    <PremiumSelectItem value="video">Video</PremiumSelectItem>
                    <PremiumSelectItem value="audio">Audio</PremiumSelectItem>
                    <PremiumSelectItem value="link">Link</PremiumSelectItem>
                  </PremiumSelectContent>
                </PremiumSelect>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeAttachment(index)}
                  className="text-white/60 hover:bg-white/10 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <Button
          type="button"
          onClick={() => handleSubmit(false)}
          className="bg-white/10 text-white hover:bg-white/20"
        >
          {mode === "create" ? "Save Draft" : "Save Changes"}
        </Button>
        {showPublish && (
          <Button
            type="button"
            onClick={() => handleSubmit(true)}
            className="bg-indigo-500/20 text-indigo-100 hover:bg-indigo-500/30"
          >
            {mode === "create" ? "Publish Now" : "Publish"}
          </Button>
        )}
      </div>
    </div>
  );
}
