// src/components/modals/BulkAssignSubjectsModal.tsx
"use client";

import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { useBulkAssignSubjects } from "@/hooks/admin/useTeacherBulkOperations";
import { useSubjectSearch } from "@/hooks/admin/useDirectorySearch";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teacherIds: string[];
  teacherCount: number;
};

export function BulkAssignSubjectsModal({
  open,
  onOpenChange,
  teacherIds,
  teacherCount,
}: Props) {
  const [selectedSubjectIds, setSelectedSubjectIds] = React.useState<string[]>([]);
  const [subjectSearch, setSubjectSearch] = React.useState("");
  const bulkAssignSubjectsMutation = useBulkAssignSubjects();
  const { data: subjectsData } = useSubjectSearch(subjectSearch);
  const subjects = subjectsData?.data || [];

  React.useEffect(() => {
    if (!open) {
      setSelectedSubjectIds([]);
    }
  }, [open]);

  const handleToggleSubject = (subjectId: string) => {
    setSelectedSubjectIds((prev) =>
      prev.includes(subjectId)
        ? prev.filter((id) => id !== subjectId)
        : [...prev, subjectId]
    );
  };

  const handleSubmit = async () => {
    if (!teacherIds.length || !selectedSubjectIds.length) {
      toast.error("Please select at least one subject");
      return;
    }

    try {
      await bulkAssignSubjectsMutation.mutateAsync({
        teacherIds,
        subjectIds: selectedSubjectIds,
      });
      toast.success(`Subjects assigned to ${teacherCount} teacher(s)`);
      onOpenChange(false);
    } catch (e: unknown) {
      const error = e as { message?: string };
      toast.error(error.message || "Failed to assign subjects");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] border border-white/10 bg-linear-to-br from-white/10 to-transparent shadow-2xl shadow-black/30 backdrop-blur max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">Assign Subjects</DialogTitle>
          <DialogDescription className="text-sm">
            Assign subjects to {teacherCount} selected teacher{teacherCount !== 1 ? "s" : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Select Subjects</label>
            <div className="space-y-2">
              <input
                type="text"
                placeholder="Search subjects..."
                value={subjectSearch}
                onChange={(e) => setSubjectSearch(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm"
              />
              <div className="flex flex-wrap gap-2 min-h-[100px] p-3 rounded-lg border border-white/10 bg-white/5">
                {subjects.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {subjectSearch ? "No subjects found" : "Search for subjects..."}
                  </p>
                ) : (
                  subjects.map((subject) => (
                    <Badge
                      key={subject.id}
                      variant={selectedSubjectIds.includes(subject.id) ? "default" : "outline"}
                      className="cursor-pointer border-white/10 bg-white/5 hover:bg-white/10"
                      onClick={() => handleToggleSubject(subject.id)}
                    >
                      {subject.name}
                      {selectedSubjectIds.includes(subject.id) && (
                        <X className="ml-1 h-3 w-3" />
                      )}
                    </Badge>
                  ))
                )}
              </div>
            </div>
            {selectedSubjectIds.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {selectedSubjectIds.length} subject{selectedSubjectIds.length !== 1 ? "s" : ""} selected
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={bulkAssignSubjectsMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={bulkAssignSubjectsMutation.isPending || selectedSubjectIds.length === 0}
          >
            {bulkAssignSubjectsMutation.isPending ? "Assigning..." : "Assign Subjects"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
