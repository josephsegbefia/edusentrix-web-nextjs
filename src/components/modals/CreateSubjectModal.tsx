"use client";

import * as React from "react";
import { BookText, Layers3, Tag } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import {
  useCreateSubject,
  useUpdateSubject,
  type CreateSubjectPayload,
  type SubjectCategoryValue,
  type SubjectDTO,
} from "@/hooks/admin/useSubjects";
import { cn } from "@/lib/utils";

type CreateSubjectModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subject?: Pick<SubjectDTO, "id" | "name" | "code" | "isActive"> | null;
};

const categoryOptions: Array<{
  value: SubjectCategoryValue | "none";
  label: string;
  description: string;
}> = [
  {
    value: "none",
    label: "No category",
    description: "Keep the subject uncategorized for now.",
  },
  {
    value: "core",
    label: "Core",
    description: "Common compulsory subjects across the school.",
  },
  {
    value: "elective",
    label: "Elective",
    description: "Optional choices students can opt into.",
  },
  {
    value: "foundation",
    label: "Foundation",
    description: "Foundational curriculum areas and starter subjects.",
  },
  {
    value: "optional",
    label: "Optional",
    description: "Available when needed but not standard for everyone.",
  },
  {
    value: "transdisciplinary_theme",
    label: "Theme",
    description: "Integrated learning themes across multiple subjects.",
  },
  {
    value: "subject_group",
    label: "Subject group",
    description: "High-level groupings used in some curricula.",
  },
];

const inputClassName =
  "h-11 rounded-xl border-white/10 bg-white/5 text-white placeholder:text-white/35 focus-visible:border-amber-300/40 focus-visible:ring-amber-300/25";

function getDefaultFormState() {
  return {
    name: "",
    code: "",
    category: "none" as SubjectCategoryValue | "none",
    isActive: true,
  };
}

export function CreateSubjectModal({
  open,
  onOpenChange,
  subject,
}: CreateSubjectModalProps) {
  const createSubject = useCreateSubject();
  const updateSubject = useUpdateSubject();
  const [form, setForm] = React.useState(getDefaultFormState);
  const isEditing = !!subject;
  const isPending = createSubject.isPending || updateSubject.isPending;

  React.useEffect(() => {
    if (!open) {
      setForm(getDefaultFormState());
      return;
    }

    setForm({
      name: subject?.name ?? "",
      code: subject?.code ?? "",
      category: "none",
      isActive: subject?.isActive ?? true,
    });
  }, [open, subject]);

  const canSubmit = form.name.trim().length > 0 && !isPending;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;

    try {
      const result = isEditing
        ? await updateSubject.mutateAsync({
            subjectId: subject.id,
            name: form.name.trim(),
            code: form.code.trim() ? form.code.trim().toUpperCase() : null,
            isActive: form.isActive,
          })
        : await createSubject.mutateAsync({
            name: form.name.trim(),
            code: form.code.trim() ? form.code.trim().toUpperCase() : null,
            category: form.category === "none" ? null : form.category,
            isActive: form.isActive,
          } satisfies CreateSubjectPayload);

      if (result.success) {
        onOpenChange(false);
      }
    } catch {
      // Error feedback is already handled in the mutation hook.
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl border-white/10 bg-linear-to-br from-slate-900 via-slate-950 to-black p-0 text-white shadow-2xl shadow-black/50">
        <div className="relative overflow-hidden rounded-lg">
          <div
            className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-linear-to-br from-amber-400/15 via-orange-300/8 to-transparent blur-3xl"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute -bottom-20 -left-20 h-56 w-56 rounded-full bg-linear-to-tr from-teal-400/10 via-emerald-300/5 to-transparent blur-3xl"
            aria-hidden="true"
          />

          <form onSubmit={handleSubmit} className="relative space-y-6 p-6">
            <DialogHeader className="space-y-3 text-left">
              <div className="flex items-start gap-3">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-amber-300/20 bg-linear-to-br from-amber-300/16 to-orange-300/10">
                  <BookText className="size-5 text-amber-100" />
                </div>
                <div className="min-w-0 space-y-1">
                  <DialogTitle className="text-xl font-semibold text-white">
                    {isEditing ? "Edit subject" : "Create subject"}
                  </DialogTitle>
                  <DialogDescription className="max-w-md text-sm leading-relaxed text-white/55">
                    {isEditing
                      ? "Update the subject name, code, and status without leaving the directory."
                      : "Add a subject to your school directory so you can assign it to classes and teachers."}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label
                  htmlFor="subject-name"
                  className="text-xs font-semibold uppercase tracking-[0.18em] text-white/65"
                >
                  Subject name
                </Label>
                <Input
                  id="subject-name"
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  placeholder="e.g. Mathematics"
                  className={inputClassName}
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="subject-code"
                  className="text-xs font-semibold uppercase tracking-[0.18em] text-white/65"
                >
                  Subject code
                </Label>
                <div className="relative">
                  <Tag className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/35" />
                  <Input
                    id="subject-code"
                    value={form.code}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        code: event.target.value,
                      }))
                    }
                    placeholder="e.g. MATH"
                    className={cn(inputClassName, "pl-10 uppercase")}
                  />
                </div>
              </div>

              {!isEditing && (
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-[0.18em] text-white/65">
                    Category
                  </Label>
                  <PremiumSelect
                    value={form.category}
                    onValueChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        category: value as SubjectCategoryValue | "none",
                      }))
                    }
                  >
                    <PremiumSelectTrigger icon={<Layers3 className="size-4" />}>
                      <PremiumSelectValue placeholder="Select category" />
                    </PremiumSelectTrigger>
                    <PremiumSelectContent>
                      {categoryOptions.map((option) => (
                        <PremiumSelectItem
                          key={option.value}
                          value={option.value}
                          description={option.description}
                        >
                          {option.label}
                        </PremiumSelectItem>
                      ))}
                    </PremiumSelectContent>
                  </PremiumSelect>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-white">
                    Make this subject active now
                  </p>
                  <p className="text-sm text-white/50">
                    Active subjects are immediately available in assignments and
                    setup flows.
                  </p>
                </div>
                <Switch
                  checked={form.isActive}
                  onCheckedChange={(checked) =>
                    setForm((current) => ({
                      ...current,
                      isActive: checked,
                    }))
                  }
                />
              </div>
            </div>

            <DialogFooter className="gap-2 border-t border-white/10 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="border-white/10 bg-white/5 text-white hover:bg-white/10"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!canSubmit}
                className="bg-linear-to-r from-amber-300 to-orange-400 text-slate-950 hover:from-amber-200 hover:to-orange-300"
              >
                {isPending
                  ? isEditing
                    ? "Saving..."
                    : "Creating..."
                  : isEditing
                  ? "Save Changes"
                  : "Create Subject"}
              </Button>
            </DialogFooter>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
