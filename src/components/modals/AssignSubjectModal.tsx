// src/components/modals/AssignSubjectModal.tsx
"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Loader2, BookOpen, X } from "lucide-react";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

import { Button } from "@/components/ui/button";
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
  useAssignSubjects,
  useTeacherSubjects,
} from "@/hooks/admin/useTeachers";
import { useSubjectOfferings, type SubjectOfferingDTO } from "@/hooks/admin/useSubjectOfferings";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teacherId: string;
  teacherName: string;
};

function offeringSubtitle(offering: SubjectOfferingDTO) {
  if (offering.gradeNames?.length) {
    return offering.gradeNames.join(", ");
  }
  if (offering.gradeBand) {
    return offering.gradeBand.replace(/_/g, " ");
  }
  return offering.subjectFamily || "School subject offering";
}

export function AssignSubjectModal({
  open,
  onOpenChange,
  teacherId,
  teacherName,
}: Props) {
  const [selectedOfferingIds, setSelectedOfferingIds] = React.useState<Set<string>>(
    new Set()
  );
  const [selectedOfferingsById, setSelectedOfferingsById] = React.useState<
    Map<string, SubjectOfferingDTO>
  >(new Map());
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const debouncedSearch = useDebouncedValue(searchQuery, 250);

  const offeringsQ = useSubjectOfferings({
    search: debouncedSearch,
    isActive: true,
    enabled: open,
  });
  const { data: existingSubjectsData } = useTeacherSubjects(teacherId);
  const existingSubjects = existingSubjectsData?.data ?? [];
  const existingOfferingIds = new Set(existingSubjects.map((s) => s.id));

  const assignSubjectsMutation = useAssignSubjects();

  const availableOfferings = (offeringsQ.data?.data ?? []).filter(
    (offering) => !existingOfferingIds.has(offering.id)
  );

  React.useEffect(() => {
    if (open) {
      setSelectedOfferingIds(new Set());
      setSelectedOfferingsById(new Map());
      setSearchQuery("");
      setPickerOpen(false);
    }
  }, [open]);

  const handleToggleOffering = (offering: SubjectOfferingDTO) => {
    setSelectedOfferingIds((prev) => {
      const next = new Set(prev);
      if (next.has(offering.id)) {
        next.delete(offering.id);
      } else {
        next.add(offering.id);
      }
      return next;
    });
    setSelectedOfferingsById((prev) => {
      const next = new Map(prev);
      if (next.has(offering.id)) {
        next.delete(offering.id);
      } else {
        next.set(offering.id, offering);
      }
      return next;
    });
  };

  const handleRemoveSelected = (offeringId: string) => {
    setSelectedOfferingIds((prev) => {
      const next = new Set(prev);
      next.delete(offeringId);
      return next;
    });
    setSelectedOfferingsById((prev) => {
      const next = new Map(prev);
      next.delete(offeringId);
      return next;
    });
  };

  const handleSubmit = async () => {
    if (selectedOfferingIds.size === 0) {
      toast.error("Please select at least one subject offering");
      return;
    }

    try {
      const result = await assignSubjectsMutation.mutateAsync({
        teacherId,
        subjectOfferingIds: Array.from(selectedOfferingIds),
      });

      toast.success(result.message || "Subject offerings assigned successfully", {
        description: result.data?.subjectNames?.join(", ") || undefined,
      });

      onOpenChange(false);
    } catch (e: unknown) {
      const error = e as { message?: string };
      toast.error(error.message || "Failed to assign subject offerings");
    }
  };

  const selectedOfferings = Array.from(selectedOfferingsById.values());

  const isPending = assignSubjectsMutation.isPending;

  React.useEffect(() => {
    if (!open) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isPending) onOpenChange(false);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, isPending, onOpenChange]);

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        aria-modal="true"
        role="dialog"
      >
        <div
          className="absolute inset-0 bg-black/70 backdrop-blur-[2px]"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !isPending) onOpenChange(false);
          }}
        />

        <div className="relative z-10 flex min-h-full items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-[860px] overflow-hidden rounded-2xl border border-white/10 bg-neutral-950 text-white shadow-2xl shadow-black/40"
          >
            <div className="px-6 pt-6">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <h1 className="text-lg font-semibold">Assign Subject Offerings</h1>
                  <p className="text-sm text-white/60">
                    Add grade-scoped subject offerings for{" "}
                    <span className="font-medium text-white/85">
                      {teacherName}
                    </span>
                    .
                  </p>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={isPending}
                  className="h-9 w-9 rounded-full text-white/70 hover:bg-white/10 hover:text-white"
                  onClick={() => onOpenChange(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="mt-5 h-px bg-white/10" />
            </div>

            <div className="max-h-[70vh] overflow-y-auto px-6 py-6">
              <div className="space-y-4">
                {selectedOfferings.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
                      Selected ({selectedOfferings.length})
                    </Label>
                    <div className="flex flex-wrap gap-2 rounded-xl border border-white/10 bg-white/5 p-3">
                      {selectedOfferings.map((offering) => (
                        <Badge
                          key={offering.id}
                          variant="outline"
                          className="gap-1.5 border-cyan-400/25 bg-cyan-400/10 pr-1 text-cyan-100"
                        >
                          {offering.displayName}
                          <button
                            type="button"
                            onClick={() => handleRemoveSelected(offering.id)}
                            className="ml-1 rounded-full p-0.5 hover:bg-cyan-400/20"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
                    Search Subject Offerings
                  </Label>
                  <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className={cn(
                          "h-11 w-full cursor-pointer justify-between rounded-xl border-white/10 bg-black/30 px-3 text-white shadow-inner shadow-black/20 hover:border-cyan-300/25 hover:bg-black/40 hover:text-white",
                          "focus-visible:border-cyan-300/60 focus-visible:ring-cyan-400/20 data-[state=open]:border-cyan-300/40 data-[state=open]:bg-cyan-400/10"
                        )}
                      >
                        <span className="flex min-w-0 items-center gap-2 truncate text-left">
                          <BookOpen className="h-4 w-4 shrink-0 text-cyan-200/75" />
                          <span
                            className={cn(
                              "truncate",
                              selectedOfferingIds.size > 0
                                ? "text-white"
                                : "text-white/40"
                            )}
                          >
                            {selectedOfferingIds.size > 0
                              ? `${selectedOfferingIds.size} offering${
                                  selectedOfferingIds.size === 1 ? "" : "s"
                                } selected`
                              : "Search subject offerings to assign…"}
                          </span>
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-white/40" />
                      </Button>
                    </PopoverTrigger>

                    <PopoverContent
                      className="z-[300] w-(--radix-popover-trigger-width) overflow-hidden rounded-2xl border border-white/10 bg-slate-950/98 p-0 text-white shadow-2xl shadow-black/50 backdrop-blur-xl"
                      align="start"
                      sideOffset={8}
                    >
                      <Command
                        shouldFilter={false}
                        className="bg-transparent text-white [&_[cmdk-input-wrapper]]:h-12 [&_[cmdk-input-wrapper]]:border-b [&_[cmdk-input-wrapper]]:border-white/10 [&_[cmdk-input-wrapper]]:bg-black/20 [&_[cmdk-input-wrapper]_svg]:text-cyan-200/70 [&_[cmdk-list]]:max-h-80"
                      >
                        <CommandInput
                          placeholder="Type a subject, grade, or code…"
                          value={searchQuery}
                          onValueChange={setSearchQuery}
                          className="text-white placeholder:text-white/35"
                        />
                        <CommandList>
                          {offeringsQ.isLoading ? (
                            <CommandEmpty>
                              <span className="inline-flex items-center gap-2 text-white/55">
                                <Loader2 className="h-4 w-4 animate-spin text-cyan-200" />
                                Searching subject offerings…
                              </span>
                            </CommandEmpty>
                          ) : offeringsQ.isError ? (
                            <CommandEmpty>
                              <div className="px-4 py-3 text-center">
                                <p className="font-medium text-amber-200/90">
                                  Could not load subject offerings
                                </p>
                                <p className="mt-2 text-xs leading-5 text-white/50">
                                  {offeringsQ.error instanceof Error
                                    ? offeringsQ.error.message
                                    : "Try again in a moment."}
                                </p>
                              </div>
                            </CommandEmpty>
                          ) : availableOfferings.length === 0 ? (
                            <CommandEmpty>
                              <div className="px-4 py-3 text-center">
                                <BookOpen className="mx-auto h-7 w-7 text-white/25" />
                                <p className="mt-2 font-medium text-white/75">
                                  {existingOfferingIds.size > 0
                                    ? "All matching offerings are already assigned"
                                    : "No subject offerings found"}
                                </p>
                                <p className="mt-1 text-xs leading-5 text-white/45">
                                  Set up offerings under Admin → Subjects, then
                                  search by subject name, grade, or code.
                                </p>
                              </div>
                            </CommandEmpty>
                          ) : (
                            <CommandGroup
                              heading="Matching subject offerings"
                              className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-white/40"
                            >
                              {availableOfferings.map((offering) => {
                                const isSelected = selectedOfferingIds.has(
                                  offering.id
                                );
                                return (
                                  <CommandItem
                                    key={offering.id}
                                    value={offering.id}
                                    onSelect={() => handleToggleOffering(offering)}
                                    className="mx-1 cursor-pointer rounded-xl px-3 py-3 text-white/80 data-[selected=true]:bg-cyan-400/10 data-[selected=true]:text-white"
                                  >
                                    <Check
                                      className={cn(
                                        "mr-1 h-4 w-4 shrink-0 text-cyan-200",
                                        isSelected ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center justify-between gap-3">
                                        <p className="truncate font-medium">
                                          {offering.displayName}
                                        </p>
                                        {offering.code ? (
                                          <span className="shrink-0 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-2 py-0.5 text-[11px] font-medium text-cyan-100">
                                            {offering.code}
                                          </span>
                                        ) : null}
                                      </div>
                                      <p className="mt-1 truncate text-xs text-white/48">
                                        {offeringSubtitle(offering)}
                                      </p>
                                    </div>
                                  </CommandItem>
                                );
                              })}
                            </CommandGroup>
                          )}
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                {existingSubjects.length > 0 && (
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <p className="mb-2 text-xs font-medium uppercase tracking-[0.2em] text-muted">
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
                          {s.gradeNames?.length ? (
                            <span className="text-white/40">
                              {" "}
                              · {s.gradeNames.join(", ")}
                            </span>
                          ) : null}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between gap-2 border-t border-white/10 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                    disabled={isPending}
                    className="gap-2 border-white/10 bg-white/5 text-white hover:bg-white/10"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={handleSubmit}
                    disabled={isPending || selectedOfferingIds.size === 0}
                    className="gap-2 bg-brand text-black hover:opacity-90"
                  >
                    {isPending
                      ? "Assigning…"
                      : `Assign ${selectedOfferingIds.size} Offering${
                          selectedOfferingIds.size !== 1 ? "s" : ""
                        }`}
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
