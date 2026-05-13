// src/app/(app)/admin/subjects/page.tsx
"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Plus,
  AlertCircle,
  Shapes,
  Sparkles,
  Layers3,
  WandSparkles,
} from "lucide-react";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { SubjectsQuickStatsSection } from "@/components/admin/subjects/SubjectsQuickStatsSection";
import { SubjectsToolbar, type SubjectsViewMode } from "@/components/admin/subjects/SubjectsToolbar";
import { SubjectsCardGrid } from "@/components/admin/subjects/SubjectsCardGrid";
import { SubjectsTable } from "@/components/admin/subjects/SubjectsTable";
import { AssignTeacherToSubjectModal } from "@/components/modals/AssignTeacherToSubjectModal";
import { CreateSubjectModal } from "@/components/modals/CreateSubjectModal";
import type { SubjectDTO } from "@/hooks/admin/useSubjects";
import { notifyComingSoon } from "@/lib/ui/feature-notices";
import { cn } from "@/lib/utils";
import {
  useAssignSubjectOfferingToClasses,
  useCreateCustomSubjectOffering,
  useSetupSubjectOfferingsFromCurriculum,
  useSubjectOfferings,
  type SubjectOfferingDTO,
} from "@/hooks/admin/useSubjectOfferings";
import { useGrades } from "@/hooks/admin/useGrades";
import { useClasses } from "@/hooks/admin/useClasses";
import {
  getSubjectOfferingTemplatesForCurriculum,
  type CurriculumSubjectOfferingTemplate,
} from "@/constants/curriculum-subject-templates";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

function getInitialView(sp: URLSearchParams): SubjectsViewMode {
  const v = sp.get("view");
  return v === "table" ? "table" : "cards";
}

function formatOfferingLabel(value: string) {
  const label = value.replace(/_/g, " ");
  return label.toLowerCase() === "jhs" ? "JHS" : label;
}

export default function SubjectsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [viewMode, setViewMode] = React.useState<SubjectsViewMode>(() =>
    getInitialView(searchParams)
  );
  const [search, setSearch] = React.useState(searchParams.get("q") ?? "");
  const [activeFilter, setActiveFilter] = React.useState<boolean | undefined>(
    searchParams.get("isActive") === "true"
      ? true
      : searchParams.get("isActive") === "false"
      ? false
      : undefined
  );

  const [assignTeacherModalOpen, setAssignTeacherModalOpen] = React.useState(false);
  const [assignClassesModalOpen, setAssignClassesModalOpen] = React.useState(false);
  const [createSubjectModalOpen, setCreateSubjectModalOpen] = React.useState(false);
  const [setupOpen, setSetupOpen] = React.useState(false);
  const [gradeBandFilter, setGradeBandFilter] = React.useState(searchParams.get("gradeBand") ?? "all");
  const [categoryFilter, setCategoryFilter] = React.useState(searchParams.get("category") ?? "all");
  const [editSubjectModalOpen, setEditSubjectModalOpen] = React.useState(false);
  const [selectedSubject, setSelectedSubject] = React.useState<SubjectDTO | null>(null);
  const [offeringForClasses, setOfferingForClasses] = React.useState<SubjectOfferingDTO | null>(null);
  const [subjectForEdit, setSubjectForEdit] = React.useState<SubjectDTO | null>(null);
  const [selectedClassId, setSelectedClassId] = React.useState<string | undefined>();

  const searchInputRef = React.useRef<HTMLInputElement | null>(null);
  const debouncedSearch = useDebouncedValue(search, 400);

  const { data, isLoading, isError } = useSubjectOfferings({
    search: debouncedSearch,
    isActive: activeFilter,
    gradeBand: gradeBandFilter,
    category: categoryFilter,
  });

  const offerings = data?.data || [];
  const subjects: SubjectDTO[] = offerings.map((offering) => ({
    id: offering.id,
    subjectId: offering.subjectId,
    name: offering.displayName,
    shortName: offering.shortName,
    code: offering.code,
    curriculumCode: offering.curriculumCode,
    stage: offering.stage,
    gradeBand: offering.gradeBand,
    gradeNames: offering.gradeNames,
    category: offering.category,
    lessonNoteTemplateVariant: offering.lessonNoteTemplateVariant,
    classCount: offering.assignedClassGroupCount,
    teacherCount: offering.assignedTeacherCount,
    isActive: offering.isActive,
    createdAt: offering.createdAt,
    updatedAt: offering.updatedAt,
  }));
  const totalFiltered = subjects.length;

  // URL sync
  React.useEffect(() => {
    const params = new URLSearchParams();
    params.set("view", viewMode);
    if (debouncedSearch) params.set("q", debouncedSearch);
    if (activeFilter !== undefined) params.set("isActive", String(activeFilter));
    if (gradeBandFilter !== "all") params.set("gradeBand", gradeBandFilter);
    if (categoryFilter !== "all") params.set("category", categoryFilter);

    router.replace(`/admin/subjects?${params.toString()}`);
  }, [viewMode, debouncedSearch, activeFilter, gradeBandFilter, categoryFilter, router]);

  // Keyboard shortcuts
  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const isTyping =
        tag === "input" ||
        tag === "textarea" ||
        (target && target.getAttribute("contenteditable") === "true");

      if (e.key === "/" && !isTyping) {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select?.();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const handleAssignToClasses = (subjectId: string) => {
    const offering = offerings.find((item) => item.id === subjectId);
    if (offering) {
      setOfferingForClasses(offering);
      setAssignClassesModalOpen(true);
    }
  };

  const handleAssignTeachers = () => {
    notifyComingSoon("Assign teachers to subject offerings");
  };

  const handleView = (subjectOfferingId: string) => {
    router.push(`/admin/subjects/${subjectOfferingId}`);
  };

  const handleEdit = () => {
    notifyComingSoon("Edit subject offering");
  };

  const handleExport = () => {
    notifyComingSoon("Export subjects");
  };

  const handleOpenFilters = () => {
    if (activeFilter === undefined) setActiveFilter(true);
    else if (activeFilter === true) setActiveFilter(false);
    else setActiveFilter(undefined);
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Premium Header */}
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/90 via-slate-950/95 to-black p-5 shadow-2xl shadow-black/40 sm:rounded-3xl sm:p-8">
        <div
          className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-linear-to-br from-amber-400/18 via-orange-400/10 to-transparent blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-32 -left-32 h-80 w-80 rounded-full bg-linear-to-tr from-teal-400/12 via-emerald-400/5 to-transparent blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/20 to-transparent"
          aria-hidden="true"
        />

        <div className="relative z-10 flex flex-col gap-4 sm:gap-6 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2 sm:space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-300/15 bg-linear-to-br from-amber-300/16 via-orange-300/10 to-transparent shadow-lg shadow-amber-500/10 sm:h-12 sm:w-12 sm:rounded-2xl">
                <Shapes className="h-5 w-5 text-amber-100 sm:h-6 sm:w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                  Subject Offerings
                </h1>
                <p className="text-xs text-white/60 sm:text-sm">
                  Curriculum-aware subject setup and assignments
                </p>
              </div>
            </div>
            <p className="hidden max-w-lg text-sm leading-relaxed text-white/50 sm:block">
              Manage the actual subjects taught by curriculum, stage, and grade
              band without mixing JHS, Primary, or custom offerings.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            <Button
              onClick={() => {
                setSetupOpen(true);
              }}
              className="group h-9 gap-2 rounded-xl bg-linear-to-r from-amber-300 to-orange-400 px-4 text-xs text-slate-950 shadow-lg shadow-amber-500/20 hover:from-amber-200 hover:to-orange-300 sm:h-10 sm:text-sm"
            >
              <Plus className="h-4 w-4 transition-transform group-hover:rotate-90" />
              <span>Set Up Offerings</span>
            </Button>
          </div>
        </div>

        <div className="relative z-10 mt-4 hidden flex-wrap items-center gap-3 border-t border-white/10 pt-4 sm:mt-6 sm:flex">
          <span className="text-[11px] uppercase tracking-wider text-white/40">
            Shortcuts
          </span>
          <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/60">
            <kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px]">
              /
            </kbd>
            <span>Focus search</span>
          </div>
        </div>
      </div>

      {/* Quick stats */}
      <SubjectsQuickStatsSection />

      {/* Subject directory shell */}
      <Card className="relative overflow-hidden rounded-xl border border-white/10 bg-linear-to-br from-slate-900/80 via-slate-950/90 to-black shadow-2xl shadow-black/40 backdrop-blur-xl sm:rounded-2xl">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,var(--tw-gradient-stops))] from-amber-400/6 via-transparent to-transparent"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/15 to-transparent"
          aria-hidden="true"
        />

        <CardHeader className="relative z-10 border-b border-white/5 pb-0">
          <div className="flex flex-col gap-3 pb-3 sm:gap-4 sm:pb-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-linear-to-br from-white/10 to-white/5 shadow-inner shadow-white/5 sm:h-11 sm:w-11 sm:rounded-xl">
                  <Sparkles className="h-4 w-4 text-amber-200 sm:h-5 sm:w-5" />
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-slate-900 bg-teal-300 sm:h-3 sm:w-3" />
              </div>
              <div className="space-y-0.5">
                <CardTitle className="text-base font-semibold tracking-tight text-white sm:text-lg">
                  Subject Offerings Directory
                </CardTitle>
                <p className="text-[11px] text-white/50 sm:text-xs">
                  Search, filter, and manage curriculum-aware offerings
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-2.5 py-1 text-[10px] font-medium text-amber-100">
                {totalFiltered} total
              </span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="relative z-10 space-y-4 p-4 sm:space-y-5 sm:p-6">
          <SubjectsToolbar
            search={search}
            onSearchChange={setSearch}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            onOpenFilters={handleOpenFilters}
            onExportAll={handleExport}
            searchInputRef={searchInputRef}
          />
          <div className="grid gap-3 sm:grid-cols-3">
            <PremiumSelect value={gradeBandFilter} onValueChange={setGradeBandFilter}>
              <PremiumSelectTrigger icon={<Layers3 className="size-4" />}>
                <PremiumSelectValue placeholder="Grade band" />
              </PremiumSelectTrigger>
              <PremiumSelectContent>
                {[
                  ["all", "All grade bands"],
                  ["preschool", "Preschool"],
                  ["lower_primary", "Lower Primary"],
                  ["upper_primary", "Upper Primary"],
                  ["jhs", "JHS"],
                  ["custom", "Custom"],
                ].map(([value, label]) => (
                  <PremiumSelectItem key={value} value={value}>{label}</PremiumSelectItem>
                ))}
              </PremiumSelectContent>
            </PremiumSelect>
            <PremiumSelect value={categoryFilter} onValueChange={setCategoryFilter}>
              <PremiumSelectTrigger>
                <PremiumSelectValue placeholder="Category" />
              </PremiumSelectTrigger>
              <PremiumSelectContent>
                {[
                  ["all", "All categories"],
                  ["core", "Core"],
                  ["elective", "Elective"],
                  ["learning_area", "Learning area"],
                  ["co_curricular", "Co-curricular"],
                  ["custom", "Custom"],
                ].map(([value, label]) => (
                  <PremiumSelectItem key={value} value={value}>{label}</PremiumSelectItem>
                ))}
              </PremiumSelectContent>
            </PremiumSelect>
            <PremiumSelect
              value={activeFilter === undefined ? "all" : String(activeFilter)}
              onValueChange={(value) => setActiveFilter(value === "all" ? undefined : value === "true")}
            >
              <PremiumSelectTrigger>
                <PremiumSelectValue placeholder="Status" />
              </PremiumSelectTrigger>
              <PremiumSelectContent>
                <PremiumSelectItem value="all">All statuses</PremiumSelectItem>
                <PremiumSelectItem value="true">Active</PremiumSelectItem>
                <PremiumSelectItem value="false">Inactive</PremiumSelectItem>
              </PremiumSelectContent>
            </PremiumSelect>
          </div>
        </CardContent>
      </Card>

      {/* Data summary shell */}
      <Card className="relative overflow-hidden rounded-xl border border-white/10 bg-linear-to-br from-slate-900/80 via-slate-950/90 to-black shadow-2xl shadow-black/40 backdrop-blur-xl sm:rounded-2xl">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,var(--tw-gradient-stops))] from-cyan-500/5 via-transparent to-transparent"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/15 to-transparent"
          aria-hidden="true"
        />

        <CardHeader className="relative z-10 border-b border-white/5 pb-0">
          <div className="flex flex-col gap-3 pb-3 sm:pb-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <CardTitle className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">
                Directory Results
              </CardTitle>
              <p className="text-sm text-white/80">
                {isLoading ? "Loading..." : `${totalFiltered} offerings found`}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[10px] font-medium transition-colors",
                  viewMode === "cards"
                    ? "border-amber-300/20 bg-amber-300/10 text-amber-100"
                    : "border-white/10 bg-white/5 text-white/60"
                )}
              >
                {viewMode === "cards" ? "Cards" : "Table"} view
              </span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="relative z-10 p-4 sm:p-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center gap-4 py-12 sm:py-16">
              <div className="relative">
                <div className="h-12 w-12 animate-spin rounded-full border-2 border-amber-300/20 border-t-amber-300" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Shapes className="h-5 w-5 text-amber-200/70" />
                </div>
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-white/80">
                  Loading subject offerings...
                </p>
                <p className="text-xs text-white/50">
                  Fetching your curriculum-aware directory
                </p>
              </div>
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center gap-4 py-12 sm:py-16">
              <div className="flex h-14 w-14 items-center justify-center rounded-full border border-red-500/30 bg-red-500/10">
                <AlertCircle className="h-7 w-7 text-red-400" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-red-300">
                  Failed to load subject offerings
                </p>
                <p className="text-xs text-red-300/60">
                  Please try refreshing the page
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20"
                onClick={() => window.location.reload()}
              >
                Retry
              </Button>
            </div>
          ) : subjects.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 py-12 sm:py-16">
              <div className="relative">
                <div className="flex h-20 w-20 items-center justify-center rounded-full border border-white/10 bg-linear-to-br from-white/10 to-white/5">
                  <Shapes className="h-10 w-10 text-amber-100/45" />
                </div>
              </div>
              <div className="text-center">
                <p className="text-base font-medium text-white/80">
                  No subject offerings found
                </p>
                <p className="mt-1 max-w-xs text-sm text-white/50">
                  Start from your selected curriculum or create custom offerings
                  after the curriculum setup is ready.
                </p>
              </div>
              <Button
                onClick={() => setSetupOpen(true)}
                className="bg-linear-to-r from-amber-300 to-orange-400 text-slate-950 hover:from-amber-200 hover:to-orange-300"
              >
                Set Up Offerings
              </Button>
            </div>
          ) : (
            <div className="space-y-4 sm:space-y-5">
              <div className="flex flex-col gap-2 rounded-xl border border-white/10 bg-linear-to-r from-white/5 to-transparent px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-2 text-xs text-white/70 sm:text-sm">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-300/15 text-[9px] font-bold text-amber-100 sm:h-6 sm:w-6 sm:text-[10px]">
                    {subjects.length}
                  </span>
                  <span>
                    showing{" "}
                    <span className="font-medium text-white">
                      {subjects.length}
                    </span>{" "}
                    offering{subjects.length === 1 ? "" : "s"}
                  </span>
                </div>
              </div>

              {viewMode === "cards" ? (
                <SubjectsCardGrid
                  subjects={subjects}
                  onView={handleView}
                  onEdit={handleEdit}
                  onAssignToClasses={handleAssignToClasses}
                  onAssignTeachers={handleAssignTeachers}
                />
              ) : (
                <SubjectsTable
                  subjects={subjects}
                  onView={handleView}
                  onEdit={handleEdit}
                  onAssignToClasses={handleAssignToClasses}
                  onAssignTeachers={handleAssignTeachers}
                />
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modals */}
      <CreateSubjectModal
        open={createSubjectModalOpen}
        onOpenChange={setCreateSubjectModalOpen}
      />

      <SetupSubjectOfferingsDialog
        open={setupOpen}
        onOpenChange={setSetupOpen}
      />

      <CreateSubjectModal
        open={editSubjectModalOpen}
        onOpenChange={(open) => {
          setEditSubjectModalOpen(open);
          if (!open) {
            setSubjectForEdit(null);
          }
        }}
        subject={subjectForEdit}
      />

      <AssignSubjectOfferingToClassesDialog
        open={assignClassesModalOpen}
        onOpenChange={(open) => {
          setAssignClassesModalOpen(open);
          if (!open) setOfferingForClasses(null);
        }}
        offering={offeringForClasses}
      />

      {selectedSubject && (
        <AssignTeacherToSubjectModal
          open={assignTeacherModalOpen}
          onOpenChange={(open) => {
            setAssignTeacherModalOpen(open);
            if (!open) {
              setSelectedSubject(null);
              setSelectedClassId(undefined);
            }
          }}
          subject={selectedSubject}
          initialClassGroupId={selectedClassId}
        />
      )}
    </div>
  );
}

function SetupSubjectOfferingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: gradesData } = useGrades(true);
  const setupMutation = useSetupSubjectOfferingsFromCurriculum();
  const createCustomOffering = useCreateCustomSubjectOffering();
  const [curriculumCode, setCurriculumCode] = React.useState("ghana_nacca");
  const [autoAssign, setAutoAssign] = React.useState(true);
  const [customForm, setCustomForm] = React.useState({
    subjectFamily: "",
    displayName: "",
    shortName: "",
    code: "",
    gradeBand: "custom",
    stage: "custom",
    category: "custom",
  });
  const grades = gradesData?.data ?? [];
  const templates = React.useMemo(
    () => getSubjectOfferingTemplatesForCurriculum(curriculumCode as "ghana_nacca"),
    [curriculumCode]
  );
  const [selectedGradeIds, setSelectedGradeIds] = React.useState<string[]>([]);
  const [selectedCodes, setSelectedCodes] = React.useState<string[]>([]);

  React.useEffect(() => {
    if (!open) return;
    setSelectedGradeIds(grades.map((grade) => grade.id));
    setSelectedCodes(templates.filter((template) => template.isDefault).map((template) => template.code));
  }, [open, grades, templates]);

  const groupedTemplates = React.useMemo(() => {
    return templates.reduce<Record<string, CurriculumSubjectOfferingTemplate[]>>((acc, template) => {
      const key = template.gradeBand;
      acc[key] = acc[key] || [];
      acc[key].push(template);
      return acc;
    }, {});
  }, [templates]);

  const toggle = (value: string, list: string[], setter: (next: string[]) => void) => {
    setter(list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);
  };

  async function handleSubmit() {
    const result = await setupMutation.mutateAsync({
      curriculumCode,
      selectedOfferingCodes: selectedCodes,
      gradeIds: selectedGradeIds,
      autoAssignToMatchingClassGroups: autoAssign,
    });
    if (result.success) onOpenChange(false);
  }

  async function handleCreateCustom() {
    const subjectFamily = customForm.subjectFamily.trim();
    const displayName = customForm.displayName.trim() || subjectFamily;
    const shortName = customForm.shortName.trim() || subjectFamily;
    const code = customForm.code.trim().toUpperCase();
    if (!subjectFamily || !code || selectedGradeIds.length === 0) return;
    const result = await createCustomOffering.mutateAsync({
      subjectFamily,
      displayName,
      shortName,
      code,
      curriculumCode: "custom",
      stage: customForm.stage,
      gradeBand: customForm.gradeBand,
      gradeIds: selectedGradeIds,
      category: customForm.category,
      lessonNoteTemplateVariant: "custom",
      reportCardGroup: customForm.category === "elective" ? "Electives" : "Custom",
      autoAssignToMatchingClassGroups: autoAssign,
    });
    if (result.success) {
      setCustomForm({
        subjectFamily: "",
        displayName: "",
        shortName: "",
        code: "",
        gradeBand: "custom",
        stage: "custom",
        category: "custom",
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] !max-w-6xl overflow-hidden border-white/10 bg-linear-to-br from-slate-900 via-slate-950 to-black p-0 text-white shadow-2xl shadow-black/60">
        <div className="relative overflow-hidden rounded-lg">
          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-amber-300/10 blur-3xl" />
          <div className="relative flex max-h-[88vh] flex-col">
            <div className="border-b border-white/10 p-6">
              <DialogHeader className="space-y-3 text-left">
                <div className="flex items-start gap-3">
                  <div className="flex size-11 items-center justify-center rounded-2xl border border-amber-300/20 bg-amber-300/10">
                    <WandSparkles className="size-5 text-amber-100" />
                  </div>
                  <div>
                    <DialogTitle>Set up subject offerings</DialogTitle>
                    <DialogDescription className="mt-1 max-w-2xl text-white/55">
                      Generate curriculum-aware offerings, tie them to matching grades,
                      and optionally assign them to class groups in those grades.
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>
            </div>

            <div className="space-y-5 overflow-y-auto p-6 lg:p-7">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/55">
                    Curriculum
                  </p>
                  <PremiumSelect value={curriculumCode} onValueChange={setCurriculumCode}>
                    <PremiumSelectTrigger>
                      <PremiumSelectValue />
                    </PremiumSelectTrigger>
                    <PremiumSelectContent>
                      <PremiumSelectItem value="ghana_nacca" description="NaCCA grouped by preschool, primary, and JHS for Basic schools.">
                        Ghana NaCCA
                      </PremiumSelectItem>
                    </PremiumSelectContent>
                  </PremiumSelect>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 md:col-span-2">
                  <label className="flex cursor-pointer items-start gap-3">
                    <Checkbox checked={autoAssign} onCheckedChange={(checked) => setAutoAssign(Boolean(checked))} />
                    <span>
                      <span className="block text-sm font-medium text-white">Assign to matching class groups</span>
                      <span className="mt-1 block text-xs leading-relaxed text-white/50">
                        For example, Mathematics - JHS will be assigned to every
                        class group inside JHS 1, JHS 2, and JHS 3.
                      </span>
                    </span>
                  </label>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-white">Grades covered</p>
                    <p className="text-xs text-white/45">Only selected grades receive matching offerings.</p>
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] text-white/55">
                    {selectedGradeIds.length} selected
                  </span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {grades.map((grade) => (
                    <label key={grade.id} className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white/75">
                      <Checkbox checked={selectedGradeIds.includes(grade.id)} onCheckedChange={() => toggle(grade.id, selectedGradeIds, setSelectedGradeIds)} />
                      <span>{grade.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                {Object.entries(groupedTemplates).map(([band, items]) => (
                  <div key={band} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-sm font-semibold text-white">{formatOfferingLabel(band)}</p>
                      <span className="text-xs text-white/45">{items.length} offerings</span>
                    </div>
                    <div className="grid gap-2 lg:grid-cols-2 xl:grid-cols-3">
                      {items.map((template) => (
                        <label key={template.code} className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-black/20 p-3 transition hover:border-amber-300/25 hover:bg-amber-300/5">
                          <Checkbox checked={selectedCodes.includes(template.code)} onCheckedChange={() => toggle(template.code, selectedCodes, setSelectedCodes)} />
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium text-white">{template.displayName}</span>
                            <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] uppercase tracking-[0.1em] text-white/45">
                              <span>{template.code}</span>
                              <span className="rounded-full border border-white/10 px-1.5 py-0.5">{template.category.replace(/_/g, " ")}</span>
                              <span className="rounded-full border border-white/10 px-1.5 py-0.5">{template.lessonNoteTemplateVariant?.replace(/_/g, " ") ?? "classic"}</span>
                            </span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="rounded-2xl border border-amber-300/15 bg-amber-300/[0.04] p-4">
                <div className="mb-4 flex flex-col gap-1">
                  <p className="text-sm font-semibold text-white">Add a custom subject offering</p>
                  <p className="text-xs text-white/45">
                    Use this when a school teaches a subject outside the default NaCCA list.
                    Select one grade for a grade-specific offering, or multiple grades for a grade-band offering.
                  </p>
                </div>
                <div className="grid gap-3 lg:grid-cols-4">
                  <input
                    value={customForm.subjectFamily}
                    onChange={(event) =>
                      setCustomForm((current) => ({
                        ...current,
                        subjectFamily: event.target.value,
                        displayName: current.displayName || event.target.value,
                        shortName: current.shortName || event.target.value,
                      }))
                    }
                    placeholder="Subject family, e.g. Robotics"
                    className="h-11 rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-white placeholder:text-white/35 outline-none focus:border-amber-300/35"
                  />
                  <input
                    value={customForm.displayName}
                    onChange={(event) =>
                      setCustomForm((current) => ({
                        ...current,
                        displayName: event.target.value,
                      }))
                    }
                    placeholder="Display name"
                    className="h-11 rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-white placeholder:text-white/35 outline-none focus:border-amber-300/35"
                  />
                  <input
                    value={customForm.code}
                    onChange={(event) =>
                      setCustomForm((current) => ({
                        ...current,
                        code: event.target.value,
                      }))
                    }
                    placeholder="Code, e.g. CUSTOM-P4-ROB"
                    className="h-11 rounded-xl border border-white/10 bg-black/20 px-3 text-sm uppercase text-white placeholder:text-white/35 outline-none focus:border-amber-300/35"
                  />
                  <PremiumSelect
                    value={customForm.gradeBand}
                    onValueChange={(value) =>
                      setCustomForm((current) => ({
                        ...current,
                        gradeBand: value,
                        stage: value === "preschool" ? "kg" : value,
                      }))
                    }
                  >
                    <PremiumSelectTrigger>
                      <PremiumSelectValue placeholder="Grade band" />
                    </PremiumSelectTrigger>
                    <PremiumSelectContent>
                      <PremiumSelectItem value="preschool">Preschool</PremiumSelectItem>
                      <PremiumSelectItem value="lower_primary">Lower Primary</PremiumSelectItem>
                      <PremiumSelectItem value="upper_primary">Upper Primary</PremiumSelectItem>
                      <PremiumSelectItem value="jhs">JHS</PremiumSelectItem>
                      <PremiumSelectItem value="custom">Custom / selected grades</PremiumSelectItem>
                    </PremiumSelectContent>
                  </PremiumSelect>
                </div>
                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-white/45">
                    Custom offering will use the selected grades above and can be assigned to matching class groups automatically.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={
                      createCustomOffering.isPending ||
                      !customForm.subjectFamily.trim() ||
                      !customForm.code.trim() ||
                      selectedGradeIds.length === 0
                    }
                    onClick={handleCreateCustom}
                    className="border-amber-300/20 bg-amber-300/10 text-amber-50 hover:bg-amber-300/15"
                  >
                    Add custom offering
                  </Button>
                </div>
              </div>
            </div>

            <DialogFooter className="border-t border-white/10 p-6">
              <Button variant="outline" className="border-white/10 bg-white/5 text-white hover:bg-white/10" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                className="bg-linear-to-r from-amber-300 to-orange-400 text-slate-950 hover:from-amber-200 hover:to-orange-300"
                disabled={setupMutation.isPending || selectedCodes.length === 0 || selectedGradeIds.length === 0}
                onClick={handleSubmit}
              >
                Create offerings
              </Button>
            </DialogFooter>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AssignSubjectOfferingToClassesDialog({
  open,
  onOpenChange,
  offering,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  offering: SubjectOfferingDTO | null;
}) {
  const { data } = useClasses({ isActive: true });
  const assignMutation = useAssignSubjectOfferingToClasses();
  const classes = React.useMemo(() => data?.data ?? [], [data?.data]);
  const compatibleClasses = React.useMemo(() => {
    const compatibleGradeIds = new Set(offering?.gradeIds ?? []);
    return classes.filter((classGroup) => compatibleGradeIds.has(classGroup.grade.id));
  }, [classes, offering?.gradeIds]);
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);

  React.useEffect(() => {
    if (!open || !offering) return;
    setSelectedIds(
      compatibleClasses
        .filter((classGroup) => classGroup.subjectOfferingIds?.includes(offering.id))
        .map((classGroup) => classGroup.id)
    );
  }, [open, offering, compatibleClasses]);

  async function handleSave() {
    if (!offering) return;
    await assignMutation.mutateAsync({
      subjectOfferingId: offering.id,
      classGroupIds: selectedIds,
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] !max-w-4xl border-white/10 bg-linear-to-br from-slate-900 via-slate-950 to-black text-white">
        <DialogHeader>
          <DialogTitle>Assign offering to class groups</DialogTitle>
          <DialogDescription className="text-white/55">
            {offering?.displayName ?? "Subject offering"} can only be assigned to
            class groups inside its grade coverage.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {compatibleClasses.length === 0 ? (
            <div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4 text-sm text-amber-50">
              No compatible class groups were found for this offering.
            </div>
          ) : (
            compatibleClasses.map((classGroup) => (
              <label key={classGroup.id} className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
                <span>
                  <span className="block text-sm font-medium text-white">{classGroup.fullLabel}</span>
                  <span className="text-xs text-white/45">{classGroup.grade.name}</span>
                </span>
                <Checkbox
                  checked={selectedIds.includes(classGroup.id)}
                  onCheckedChange={() =>
                    setSelectedIds((current) =>
                      current.includes(classGroup.id)
                        ? current.filter((id) => id !== classGroup.id)
                        : [...current, classGroup.id]
                    )
                  }
                />
              </label>
            ))
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" className="border-white/10 bg-white/5 text-white hover:bg-white/10" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!offering || assignMutation.isPending} onClick={handleSave}>
            Save assignments
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
