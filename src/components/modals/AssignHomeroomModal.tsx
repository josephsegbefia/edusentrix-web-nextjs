// src/components/modals/AssignHomeroomModal.tsx
"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] border border-white/10 bg-linear-to-br from-white/10 to-transparent shadow-2xl shadow-black/30 backdrop-blur">
        <DialogHeader>
          <DialogTitle className="text-xl">Assign Homeroom</DialogTitle>
          <DialogDescription className="text-sm">
            Assign <span className="font-medium text-white/90">{teacherName}</span> as homeroom teacher
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current homeroom info */}
          {currentHomeroom && (
            <div className="rounded-lg border border-amber-400/20 bg-amber-500/10 p-3">
              <p className="text-xs font-medium text-amber-100 mb-1">
                Current Homeroom
              </p>
              <p className="text-sm text-amber-200">
                {currentHomeroom.name}
                {currentHomeroom.gradeName && ` (${currentHomeroom.gradeName})`}
              </p>
              <p className="text-xs text-amber-100/70 mt-1">
                Selecting a new class will replace this assignment
              </p>
            </div>
          )}

          {/* Class group search combobox */}
          <div className="space-y-2">
            <Label className="text-sm">Select Class Group</Label>
            <Popover open={classOpen} onOpenChange={setClassOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 w-full justify-between border-white/10 bg-white/5 hover:bg-white/8"
                >
                  <span
                    className={cn(
                      "truncate",
                      selectedClassLabel ? "text-white" : "text-muted-foreground"
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
                  "w-[var(--radix-popover-trigger-width)] p-1"
                )}
              >
                <Command shouldFilter={false} className="bg-transparent">
                  <CommandInput
                    placeholder="Search class groups…"
                    value={classQuery}
                    onValueChange={setClassQuery}
                    className="border-b border-neutral-800/60 bg-transparent"
                  />
                  <CommandList>
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
                            const isSelected = selectedClassGroupId === it.id;
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

          <div className="rounded-lg border border-sky-400/20 bg-sky-500/10 p-3">
            <p className="text-xs text-sky-100/80">
              <span className="font-medium">Note:</span> If the selected class already has a homeroom teacher,
              you'll need to remove them first before assigning this teacher.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={assignHomeroomMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={assignHomeroomMutation.isPending || !selectedClassGroupId}
            className="gap-2"
          >
            {assignHomeroomMutation.isPending ? "Assigning…" : "Assign Homeroom"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
