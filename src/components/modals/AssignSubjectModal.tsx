// src/components/modals/AssignSubjectModal.tsx
"use client";

import * as React from "react";
import { Check, ChevronsUpDown, X, Search } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";

import {
  useSubjectSearch,
} from "@/hooks/admin/useDirectorySearch";
import {
  useAssignSubjects,
  useTeacherSubjects,
  type TeacherSubjectDTO,
} from "@/hooks/admin/useTeachers";
import { premiumSelectContent, premiumMenuItem } from "@/components/ui/premium";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teacherId: string;
  teacherName: string;
};

export function AssignSubjectModal({
  open,
  onOpenChange,
  teacherId,
  teacherName,
}: Props) {
  const [selectedSubjectIds, setSelectedSubjectIds] = React.useState<Set<string>>(new Set());
  const [subjectOpen, setSubjectOpen] = React.useState(false);
  const [subjectQuery, setSubjectQuery] = React.useState("");
  const subjectQ = useDebouncedValue(subjectQuery, 250);
  const subjectsQ = useSubjectSearch(subjectQ);
  const { data: existingSubjectsData } = useTeacherSubjects(teacherId);
  const existingSubjects = existingSubjectsData?.data ?? [];
  const existingSubjectIds = new Set(existingSubjects.map((s) => s.id));

  const assignSubjectsMutation = useAssignSubjects();

  // Filter out already assigned subjects from search results
  const availableSubjects = (subjectsQ.data?.data ?? []).filter(
    (s) => !existingSubjectIds.has(s.id)
  );

  const subjectItems = availableSubjects.map((s) => ({
    id: s.id,
    label: s.name,
  }));

  // Reset selection when modal opens
  React.useEffect(() => {
    if (open) {
      setSelectedSubjectIds(new Set());
      setSubjectQuery("");
      setSubjectOpen(false);
    }
  }, [open]);

  const handleToggleSubject = (subjectId: string) => {
    setSelectedSubjectIds((prev) => {
      const next = new Set(prev);
      if (next.has(subjectId)) {
        next.delete(subjectId);
      } else {
        next.add(subjectId);
      }
      return next;
    });
  };

  const handleRemoveSelected = (subjectId: string) => {
    setSelectedSubjectIds((prev) => {
      const next = new Set(prev);
      next.delete(subjectId);
      return next;
    });
  };

  const handleSubmit = async () => {
    if (selectedSubjectIds.size === 0) {
      toast.error("Please select at least one subject");
      return;
    }

    try {
      const result = await assignSubjectsMutation.mutateAsync({
        teacherId,
        subjectIds: Array.from(selectedSubjectIds),
      });

      toast.success(result.message || "Subjects assigned successfully", {
        description: result.data?.subjectNames?.join(", ") || undefined,
      });

      onOpenChange(false);
    } catch (e: unknown) {
      const error = e as { message?: string };
      toast.error(error.message || "Failed to assign subjects");
    }
  };

  const selectedSubjects = Array.from(selectedSubjectIds)
    .map((id) => availableSubjects.find((s) => s.id === id))
    .filter(Boolean) as Array<{ id: string; name: string }>;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] border border-white/10 bg-linear-to-br from-white/10 to-transparent shadow-2xl shadow-black/30 backdrop-blur">
        <DialogHeader>
          <DialogTitle className="text-xl">Assign Subjects</DialogTitle>
          <DialogDescription className="text-sm">
            Add subjects to <span className="font-medium text-white/90">{teacherName}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Selected subjects display */}
          {selectedSubjects.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
                Selected Subjects ({selectedSubjects.length})
              </Label>
              <div className="flex flex-wrap gap-2 rounded-lg border border-white/10 bg-white/5 p-3">
                {selectedSubjects.map((s) => (
                  <Badge
                    key={s.id}
                    variant="outline"
                    className="border-brand/30 bg-brand/10 text-brand gap-1.5 pr-1"
                  >
                    {s.name}
                    <button
                      type="button"
                      onClick={() => handleRemoveSelected(s.id)}
                      className="ml-1 rounded-full hover:bg-brand/20 p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Subject search combobox */}
          <div className="space-y-2">
            <Label className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
              Search Subjects
            </Label>
            <Popover open={subjectOpen} onOpenChange={setSubjectOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 w-full justify-between border border-white/10 bg-white/5 text-white hover:bg-white/8"
                >
                  <span className={cn("truncate", subjectQuery ? "text-white" : "text-muted-foreground")}>
                    {subjectQuery || "Search subjects to assign..."}
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 opacity-70" />
                </Button>
              </PopoverTrigger>

              <PopoverContent
                className={cn(
                  premiumSelectContent,
                  "w-[var(--radix-popover-trigger-width)] p-1 max-h-[400px]"
                )}
              >
                <Command shouldFilter={false} className="bg-transparent">
                  <CommandInput
                    placeholder="Search subjects…"
                    value={subjectQuery}
                    onValueChange={setSubjectQuery}
                    className="border-b border-neutral-800/60 bg-transparent"
                  />
                  <CommandList className="max-h-[300px] overflow-y-auto">
                    {subjectsQ.isLoading ? (
                      <div className="px-3 py-3 text-sm text-neutral-400">
                        Searching…
                      </div>
                    ) : (
                      <>
                        <CommandEmpty className="py-6 text-center text-sm text-neutral-400">
                          {existingSubjectIds.size > 0
                            ? "All available subjects are already assigned"
                            : "No subjects found"}
                        </CommandEmpty>
                        <CommandGroup>
                          {subjectItems.map((it) => {
                            const isSelected = selectedSubjectIds.has(it.id);
                            return (
                              <CommandItem
                                key={it.id}
                                value={it.id}
                                onSelect={() => handleToggleSubject(it.id)}
                                className={cn(
                                  premiumMenuItem,
                                  "flex items-center justify-between"
                                )}
                              >
                                <span className="truncate">{it.label}</span>
                                {isSelected && (
                                  <Check className="h-4 w-4 text-neutral-300" />
                                )}
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      </>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Already assigned subjects info */}
          {existingSubjects.length > 0 && (
            <div className="rounded-lg border border-white/10 bg-white/5 p-3">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted mb-2">
                Already Assigned ({existingSubjects.length})
              </p>
              <div className="flex flex-wrap gap-2">
                {existingSubjects.map((s) => (
                  <Badge
                    key={s.id}
                    variant="outline"
                    className="border-white/10 bg-white/5 text-white/60"
                  >
                    {s.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 border-t border-white/10 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={assignSubjectsMutation.isPending}
            className="gap-2 border-white/10 bg-white/5 text-white hover:bg-white/10"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={assignSubjectsMutation.isPending || selectedSubjectIds.size === 0}
            className="gap-2 bg-brand text-black hover:opacity-90"
          >
            {assignSubjectsMutation.isPending
              ? "Assigning…"
              : `Assign ${selectedSubjectIds.size} Subject${selectedSubjectIds.size !== 1 ? "s" : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
