"use client";

import * as React from "react";
import { Filter, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";

export type AssignmentFiltersValue = {
  status?: string;
  type?: string;
  subjectId?: string;
  classGroupId?: string;
  search?: string;
};

export type AssignmentFiltersProps = {
  subjects: Array<{ id: string; name: string }>;
  classGroups: Array<{ id: string; name: string }>;
  value: AssignmentFiltersValue;
  onChange: (next: AssignmentFiltersValue) => void;
};

export function AssignmentFilters({
  subjects,
  classGroups,
  value,
  onChange,
}: AssignmentFiltersProps) {
  const update = (patch: Partial<AssignmentFiltersValue>) => {
    onChange({ ...value, ...patch });
  };

  const clearFilters = () => {
    onChange({});
  };

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 md:flex-row md:items-center md:justify-between">
      <div className="flex flex-1 flex-col gap-3 md:flex-row md:items-center">
        <div className="flex w-full items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70">
          <Search className="h-4 w-4 text-white/40" />
          <Input
            value={value.search || ""}
            onChange={(event) => update({ search: event.target.value })}
            placeholder="Search assignments"
            className="h-7 border-0 bg-transparent px-0 py-0 text-sm text-white/80 focus-visible:ring-0"
          />
        </div>

        <PremiumSelect value={value.status || "all"} onValueChange={(next) => update({ status: next === "all" ? undefined : next })}>
          <PremiumSelectTrigger icon={<Filter className="h-4 w-4" />}>
            <PremiumSelectValue placeholder="Status" />
          </PremiumSelectTrigger>
          <PremiumSelectContent>
            <PremiumSelectItem value="all">All status</PremiumSelectItem>
            <PremiumSelectItem value="draft">Draft</PremiumSelectItem>
            <PremiumSelectItem value="published">Published</PremiumSelectItem>
            <PremiumSelectItem value="closed">Closed</PremiumSelectItem>
            <PremiumSelectItem value="archived">Archived</PremiumSelectItem>
          </PremiumSelectContent>
        </PremiumSelect>

        <PremiumSelect value={value.type || "all"} onValueChange={(next) => update({ type: next === "all" ? undefined : next })}>
          <PremiumSelectTrigger>
            <PremiumSelectValue placeholder="Type" />
          </PremiumSelectTrigger>
          <PremiumSelectContent>
            <PremiumSelectItem value="all">All types</PremiumSelectItem>
            <PremiumSelectItem value="assignment">Assignment</PremiumSelectItem>
            <PremiumSelectItem value="quiz">Quiz</PremiumSelectItem>
            <PremiumSelectItem value="project">Project</PremiumSelectItem>
            <PremiumSelectItem value="practice">Practice</PremiumSelectItem>
          </PremiumSelectContent>
        </PremiumSelect>

        <PremiumSelect value={value.subjectId || "all"} onValueChange={(next) => update({ subjectId: next === "all" ? undefined : next })}>
          <PremiumSelectTrigger>
            <PremiumSelectValue placeholder="Subject" />
          </PremiumSelectTrigger>
          <PremiumSelectContent>
            <PremiumSelectItem value="all">All subjects</PremiumSelectItem>
            {subjects.map((subject) => (
              <PremiumSelectItem key={subject.id} value={subject.id}>
                {subject.name}
              </PremiumSelectItem>
            ))}
          </PremiumSelectContent>
        </PremiumSelect>

        <PremiumSelect
          value={value.classGroupId || "all"}
          onValueChange={(next) => update({ classGroupId: next === "all" ? undefined : next })}
        >
          <PremiumSelectTrigger>
            <PremiumSelectValue placeholder="Class" />
          </PremiumSelectTrigger>
          <PremiumSelectContent>
            <PremiumSelectItem value="all">All classes</PremiumSelectItem>
            {classGroups.map((group) => (
              <PremiumSelectItem key={group.id} value={group.id}>
                {group.name}
              </PremiumSelectItem>
            ))}
          </PremiumSelectContent>
        </PremiumSelect>
      </div>

      <Button
        type="button"
        variant="ghost"
        onClick={clearFilters}
        className="w-full text-white/60 hover:bg-white/10 hover:text-white md:w-auto"
      >
        Clear filters
      </Button>
    </div>
  );
}
