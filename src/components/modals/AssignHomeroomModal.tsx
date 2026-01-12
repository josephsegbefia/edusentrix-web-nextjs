// src/components/modals/AssignHomeroomModal.tsx
"use client";

import * as React from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
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

import {
  useClassGroupSearch,
} from "@/hooks/admin/useDirectorySearch";
import {
  useAssignHomeroom,
  useTeacherHomeroom,
} from "@/hooks/admin/useTeachers";
import { premiumSelectContent, premiumMenuItem } from "@/components/ui/premium";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teacherId: string;
  teacherName: string;
};

export function AssignHomeroomModal({
  open,
  onOpenChange,
  teacherId,
  teacherName,
}: Props) {
  const [selectedClassGroupId, setSelectedClassGroupId] = React.useState<string | null>(null);
  const [selectedClassLabel, setSelectedClassLabel] = React.useState<string | null>(null);
  const [classOpen, setClassOpen] = React.useState(false);
  const [classQuery, setClassQuery] = React.useState("");
  const classQ = useDebouncedValue(classQuery, 250);
  const classGroupsQ = useClassGroupSearch(classQ);
  const { data: currentHomeroomData } = useTeacherHomeroom(teacherId);
  const currentHomeroom = currentHomeroomData?.data ?? null;

  const assignHomeroomMutation = useAssignHomeroom();

  const classItems = (classGroupsQ.data?.data ?? []).map((g) => ({
    id: g.id,
    label: g.label || g.name,
  }));

  // Reset selection when modal opens
  React.useEffect(() => {
    if (open) {
      setSelectedClassGroupId(null);
      setSelectedClassLabel(null);
      setClassQuery("");
      setClassOpen(false);
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!selectedClassGroupId) {
      toast.error("Please select a class group");
      return;
    }

    try {
      const result = await assignHomeroomMutation.mutateAsync({
        teacherId,
        classGroupId: selectedClassGroupId,
      });

      toast.success(result.message || "Homeroom assigned successfully");

      onOpenChange(false);
    } catch (e: unknown) {
      const error = e as { message?: string };
      toast.error(error.message || "Failed to assign homeroom");
    }
  };

  const isPending = assignHomeroomMutation.isPending;

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
                  <h1 className="text-lg font-semibold">Assign Homeroom</h1>
                  <p className="text-sm text-white/60">
                    Assign{" "}
                    <span className="font-medium text-white/85">
                      {teacherName}
                    </span>{" "}
                    as homeroom teacher.
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
                {currentHomeroom && (
                  <div className="rounded-lg border border-amber-400/20 bg-amber-500/10 p-3">
                    <p className="text-xs font-medium text-amber-100 mb-1">
                      Current Homeroom
                    </p>
                    <p className="text-sm text-amber-200">
                      {currentHomeroom.name}
                      {currentHomeroom.gradeName &&
                        ` (${currentHomeroom.gradeName})`}
                    </p>
                    <p className="text-xs text-amber-100/70 mt-1">
                      Selecting a new class will replace this assignment
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
                    Select Class Group
                  </Label>
                  <Popover open={classOpen} onOpenChange={setClassOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-10 w-full justify-between border-white/10 bg-white/5 text-white hover:bg-white/10 focus-visible:ring-1 focus-visible:ring-brand"
                      >
                        <span
                          className={cn(
                            "truncate",
                            selectedClassLabel
                              ? "text-white"
                              : "text-muted-foreground"
                          )}
                        >
                          {selectedClassLabel || "Search class groups..."}
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
                          placeholder="Search class groups…"
                          value={classQuery}
                          onValueChange={setClassQuery}
                          className="border-b border-neutral-800/60 bg-transparent"
                        />
                        <CommandList className="max-h-[300px] overflow-y-auto">
                          {classGroupsQ.isLoading ? (
                            <div className="px-3 py-3 text-sm text-neutral-400">
                              Searching…
                            </div>
                          ) : (
                            <>
                              <CommandEmpty className="py-6 text-center text-sm text-neutral-400">
                                No class groups found
                              </CommandEmpty>
                              <CommandGroup>
                                {classItems.map((it) => {
                                  const isSelected =
                                    selectedClassGroupId === it.id;
                                  return (
                                    <CommandItem
                                      key={it.id}
                                      value={it.id}
                                      onSelect={() => {
                                        setSelectedClassGroupId(it.id);
                                        setSelectedClassLabel(it.label);
                                        setClassOpen(false);
                                      }}
                                      className={cn(
                                        premiumMenuItem,
                                        "flex items-center justify-between"
                                      )}
                                    >
                                      <span className="truncate">
                                        {it.label}
                                      </span>
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

                <div className="rounded-lg border border-sky-400/20 bg-sky-500/10 p-3">
                  <p className="text-xs text-sky-100/80">
                    <span className="font-medium">Note:</span> If the selected
                    class already has a homeroom teacher, you'll need to remove
                    them first before assigning this teacher.
                  </p>
                </div>

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
                    disabled={isPending || !selectedClassGroupId}
                    className="gap-2 bg-brand text-black hover:opacity-90"
                  >
                    {isPending ? "Assigning…" : "Assign Homeroom"}
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
