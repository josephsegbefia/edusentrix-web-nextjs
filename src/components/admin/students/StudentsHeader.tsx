"use client";

import { Button } from "@/components/ui/button";
import { Plus, Upload } from "lucide-react";

type StudentsHeaderProps = {
  onAddStudent: () => void;
  onImport?: () => void;
};

export function StudentsHeader({
  onAddStudent,
  onImport,
}: StudentsHeaderProps) {
  return (
    <div className="flex items-center gap-2">
      {onImport && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="hidden md:inline-flex"
          onClick={onImport}
        >
          <Upload className="h-4 w-4" />
          <span>Import Students</span>
        </Button>
      )}
      <Button type="button" variant="outline" size="sm" onClick={onAddStudent}>
        <Plus className="h-4 w-4" />
        <span>Add Student</span>
      </Button>
    </div>
  );
}
