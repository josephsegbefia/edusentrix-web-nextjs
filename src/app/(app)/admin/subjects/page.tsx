// src/app/(app)/admin/subjects/page.tsx
"use client";

import { WorkspaceScope } from "@/components/theme/workspace-scope";
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
  useClearSubjectOfferings,
  useCreateCustomSubjectOffering,
  useDeactivateSubjectOffering,
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
import { gradeMatchesTemplateCode, stageFromGradeBand } from "@/lib/subject-offerings/grade-bands";
import type {
  CurriculumCode,
  SubjectOfferingGradeBand,
  SubjectOfferingStage,
} from "@/models/SubjectOffering";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useConfirmationDialog } from "@/hooks/useConfirmationDialog";

function getInitialView(sp: URLSearchParams): SubjectsViewMode {
  const v = sp.get("view");
  return v === "table" ? "table" : "cards";
}

function formatOfferingLabel(value: string) {
  const label = value.replace(/_/g, " ");
  return label.toLowerCase() === "jhs" ? "JHS" : label;
}

const gradeBandOrder = [
  "lower_primary",
  "upper_primary",
  "jhs",
  "custom",
] as const;

const curriculumOptions: Array<{
  value: CurriculumCode;
  label: string;
  description: string;
}> = [
  {
    value: "ghana_nacca",
    label: "Ghana NaCCA",
    description: "Ghana basic-school curriculum, grouped by grade band.",
  },
  {
    value: "cambridge",
    label: "Cambridge",
    description: "Cambridge Primary and Lower Secondary subject catalog.",
  },
  {
    value: "ib_pyp",
    label: "IB PYP",
    description: "IB Primary Years Programme learning areas.",
  },
  {
    value: "ib_myp",
    label: "IB MYP",
    description: "IB Middle Years Programme subject groups.",
  },
  {
    value: "british_nc",
    label: "British National Curriculum",
    description: "British National Curriculum subject catalog.",
  },
  {
    value: "american",
    label: "American",
    description: "American elementary and middle-school subjects.",
  },
  {
    value: "montessori",
    label: "Montessori",
    description: "Add school-defined Montessori subjects or areas.",
  },
  {
    value: "custom",
    label: "Custom / school-defined",
    description: "A subject outside the built-in curriculum catalogs.",
  },
];

const subjectCategoryOptions = [
  ["core", "Core"],
  ["elective", "Elective"],
  ["foundation", "Foundation"],
  ["optional", "Optional"],
  ["learning_area", "Learning area"],
  ["co_curricular", "Co-curricular"],
  ["transdisciplinary_theme", "Transdisciplinary theme"],
  ["subject_group", "Subject group"],
  ["custom", "Custom"],
] as const;

function suggestedStageForCurriculum(
  curriculumCode: CurriculumCode,
  gradeBand: SubjectOfferingGradeBand
): SubjectOfferingStage {
  if (curriculumCode === "cambridge") {
    return gradeBand === "jhs" ? "cambridge_lower_secondary" : "cambridge_primary";
  }
  if (curriculumCode === "british_nc") {
    if (gradeBand === "jhs") return "british_key_stage_3";
    if (gradeBand === "upper_primary") return "british_key_stage_2";
    return "british_key_stage_1";
  }
  if (curriculumCode === "ib_pyp") return "ib_pyp";
  if (curriculumCode === "ib_myp") return "ib_myp";
  if (curriculumCode === "american") {
    return gradeBand === "jhs" ? "american_middle" : "american_elementary";
  }
  if (curriculumCode === "custom" || curriculumCode === "montessori" || curriculumCode === "hybrid") {
    return "custom";
  }
  return stageFromGradeBand(gradeBand);
}

function suggestedSubjectCode(
  curriculumCode: CurriculumCode,
  gradeBand: SubjectOfferingGradeBand,
  subjectFamily: string
): string {
  const curriculumPrefix = curriculumCode === "ghana_nacca"
    ? "NACCA"
    : curriculumCode === "custom"
      ? "CUSTOM"
      : curriculumCode.toUpperCase().replace(/[^A-Z0-9]+/g, "-");
  const bandPrefix =
    gradeBand === "lower_primary"
      ? "LP"
      : gradeBand === "upper_primary"
        ? "UP"
        : gradeBand === "jhs"
          ? "JHS"
          : gradeBand === "shs"
            ? "SHS"
            : "SUBJECT";
  const subjectToken = subjectFamily.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${curriculumPrefix}-${bandPrefix}-${subjectToken || "NEW"}`.slice(0, 80);
}

function gradeBandHeading(value: string) {
  if (value === "lower_primary") return "Lower Primary";
  if (value === "upper_primary") return "Upper Primary";
  if (value === "jhs") return "JHS";
  if (value === "custom") return "Custom";
  return formatOfferingLabel(value);
}

function isPreschoolGradeOption(grade: {
  code?: string | null;
  name?: string | null;
  stage?: string | null;
}) {
  const raw = `${grade.code ?? ""} ${grade.name ?? ""} ${grade.stage ?? ""}`
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "");
  return (
    raw.includes("CRECHE") ||
    raw.includes("NURSERY") ||
    raw.includes("KG1") ||
    raw.includes("KG2") ||
    raw.includes("KINDERGARTEN")
  );
}

function gradeBandForGrade(grade: {
  code?: string | null;
  name?: string | null;
  stage?: string | null;
}): string {
  const raw = `${grade.code ?? ""} ${grade.name ?? ""} ${grade.stage ?? ""}`
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "");
  if (/^(CRECHE|NURSERY|KG1|KG2)|KINDERGARTEN/.test(raw)) return "preschool";
  if (
    /(^|[^0-9])(P1|P2|P3|B1|B2|B3|BASIC1|BASIC2|BASIC3|PRIMARY1|PRIMARY2|PRIMARY3|GRADE1|GRADE2|GRADE3)/.test(
      raw
    )
  ) {
    return "lower_primary";
  }
  if (
    /(^|[^0-9])(P4|P5|P6|B4|B5|B6|BASIC4|BASIC5|BASIC6|PRIMARY4|PRIMARY5|PRIMARY6|GRADE4|GRADE5|GRADE6)/.test(
      raw
    )
  ) {
    return "upper_primary";
  }
  if (/JHS[123]/.test(raw) || raw.includes("JHS")) return "jhs";
  return "custom";
}

type CreatedCustomOffering = {
  id: string;
  displayName: string;
  code: string;
  gradeBand: string;
  category: string;
  gradeNames: string[];
  autoAssigned: boolean;
};

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
  const [setupMode, setSetupMode] = React.useState<"initial" | "add">("initial");
  const [gradeBandFilter, setGradeBandFilter] = React.useState(
    searchParams.get("gradeBand") === "preschool"
      ? "all"
      : searchParams.get("gradeBand") ?? "all"
  );
  const [categoryFilter, setCategoryFilter] = React.useState(searchParams.get("category") ?? "all");
  const [editSubjectModalOpen, setEditSubjectModalOpen] = React.useState(false);
  const [selectedSubject, setSelectedSubject] = React.useState<SubjectDTO | null>(null);
  const [offeringForClasses, setOfferingForClasses] = React.useState<SubjectOfferingDTO | null>(null);
  const [subjectForEdit, setSubjectForEdit] = React.useState<SubjectDTO | null>(null);
  const [selectedClassId, setSelectedClassId] = React.useState<string | undefined>();
  const deactivateOffering = useDeactivateSubjectOffering();
  const clearSubjectOfferings = useClearSubjectOfferings();
  const { confirm, confirmationDialog } = useConfirmationDialog();

  const searchInputRef = React.useRef<HTMLInputElement | null>(null);
  const debouncedSearch = useDebouncedValue(search, 400);
  const setupGradeId = searchParams.get("gradeId") ?? undefined;

  const { data, isLoading, isError } = useSubjectOfferings({
    search: debouncedSearch,
    isActive: activeFilter,
    gradeBand: gradeBandFilter,
    category: categoryFilter,
  });
  const { data: allActiveOfferingsData, isLoading: allActiveOfferingsLoading } =
    useSubjectOfferings({ isActive: true });
  const hasConfiguredOfferings = (allActiveOfferingsData?.data.length ?? 0) > 0;

  const offerings = (data?.data || []).filter(
    (offering) => offering.gradeBand !== "preschool"
  );
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
  const groupedSubjects = React.useMemo(() => {
    const map = new Map<string, SubjectDTO[]>();
    for (const subject of subjects) {
      const key = subject.gradeBand || "custom";
      map.set(key, [...(map.get(key) ?? []), subject]);
    }
    return Array.from(map.entries()).sort(([a], [b]) => {
      const ai = gradeBandOrder.indexOf(a as (typeof gradeBandOrder)[number]);
      const bi = gradeBandOrder.indexOf(b as (typeof gradeBandOrder)[number]);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
  }, [subjects]);
  const activeGradeBandHeading =
    gradeBandFilter === "all" ? null : gradeBandHeading(gradeBandFilter);

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

  React.useEffect(() => {
    if (searchParams.get("setup") === "1") {
      setSetupMode(searchParams.get("mode") === "add" ? "add" : "initial");
      setSetupOpen(true);
    }
  }, [searchParams]);

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

  const handleDelete = async (subjectOfferingId: string) => {
    const offering = offerings.find((item) => item.id === subjectOfferingId);
    const decision = await confirm({
      title: "Delete subject offering?",
      description: `This will remove "${offering?.displayName ?? "this subject"}" from active subject offering lists. Existing historical records are preserved.`,
      confirmLabel: "Delete subject",
      cancelLabel: "Cancel",
      intent: "destructive",
    });
    if (decision !== "confirm") return;
    await deactivateOffering.mutateAsync(subjectOfferingId);
    setActiveFilter(true);
  };

  const handleClearSetup = async () => {
    const decision = await confirm({
      title: "Clear subject offering setup?",
      description:
        "This will deactivate every active subject offering for this school, remove those offerings from class groups, deactivate current-period teacher assignments, and clear current-period timetable slots. Subject records and historical timetable records remain preserved.",
      confirmLabel: "Clear offering setup",
      cancelLabel: "Keep setup",
      intent: "destructive",
      className: "sm:max-w-xl",
    });
    if (decision !== "confirm") return;
    await clearSubjectOfferings.mutateAsync();
    setActiveFilter(true);
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
    <WorkspaceScope className="space-y-6 sm:space-y-8">
      {/* Premium Header */}
      <div className="relative overflow-hidden rounded-2xl border border-(--ws-line) bg-linear-to-br from-(--ws-panel-from) via-(--ws-panel-via) to-(--ws-panel-to) p-5 shadow-2xl shadow-black/40 sm:rounded-3xl sm:p-8">
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
                <Shapes className="h-5 w-5 text-(--ws-amber) sm:h-6 sm:w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-(--ws-fg) sm:text-3xl">
                  Subject Offerings
                </h1>
                <p className="text-xs text-(--ws-fg-70) sm:text-sm">
                  Curriculum-aware subject setup and assignments
                </p>
              </div>
            </div>
            <p className="hidden max-w-lg text-sm leading-relaxed text-(--ws-fg-70) sm:block">
              Manage the actual subjects taught by curriculum, stage, and grade
              band without mixing JHS, Primary, or custom offerings.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            <Button
              variant="outline"
              onClick={() => {
                setSetupMode("add");
                setSetupOpen(true);
              }}
              className="h-9 gap-2 rounded-xl border-(--ws-line) bg-(--ws-fill) px-4 text-xs text-(--ws-fg) hover:bg-(--ws-fill-strong) sm:h-10 sm:text-sm"
            >
              <Plus className="h-4 w-4" />
              <span>Add subject</span>
            </Button>
            <Button
              disabled={allActiveOfferingsLoading || hasConfiguredOfferings}
              onClick={() => {
                setSetupMode("initial");
                setSetupOpen(true);
              }}
              title={
                hasConfiguredOfferings
                  ? "Initial subject offerings are already set up. Use Add subject for another offering."
                  : undefined
              }
              className="group h-9 gap-2 rounded-xl bg-linear-to-r from-amber-300 to-orange-400 px-4 text-xs text-slate-950 shadow-lg shadow-amber-500/20 hover:from-amber-200 hover:to-orange-300 disabled:cursor-not-allowed disabled:opacity-50 sm:h-10 sm:text-sm"
            >
              <Plus className="h-4 w-4 transition-transform group-hover:rotate-90" />
              <span>Set Up Offerings</span>
            </Button>
            <Button
              variant="outline"
              disabled={allActiveOfferingsLoading || !hasConfiguredOfferings || clearSubjectOfferings.isPending}
              onClick={() => void handleClearSetup()}
              title={
                hasConfiguredOfferings
                  ? "Clear active offerings and the current academic-period timetable setup."
                  : "There are no active subject offerings to clear."
              }
              className="h-9 rounded-xl border-rose-400/25 bg-rose-500/10 px-3 text-xs text-(--ws-rose) hover:bg-rose-500/15 disabled:cursor-not-allowed disabled:opacity-50 sm:h-10 sm:text-sm"
            >
              {clearSubjectOfferings.isPending ? "Clearing…" : "Clear setup"}
            </Button>
          </div>
        </div>

        <div className="relative z-10 mt-4 hidden flex-wrap items-center gap-3 border-t border-(--ws-line) pt-4 sm:mt-6 sm:flex">
          <span className="text-[11px] uppercase tracking-wider text-(--ws-fg-70)">
            Shortcuts
          </span>
          <div className="flex items-center gap-1.5 rounded-full border border-(--ws-line) bg-(--ws-fill) px-2.5 py-1 text-[11px] text-(--ws-fg-70)">
            <kbd className="rounded bg-(--ws-fill-strong) px-1.5 py-0.5 font-mono text-[10px]">
              /
            </kbd>
            <span>Focus search</span>
          </div>
        </div>
      </div>

      {/* Quick stats */}
      <SubjectsQuickStatsSection />

      {/* Subject directory shell */}
      <Card className="relative overflow-hidden rounded-xl border border-(--ws-line) bg-linear-to-br from-(--ws-panel-from) via-(--ws-panel-via) to-(--ws-panel-to) shadow-2xl shadow-black/40 backdrop-blur-xl sm:rounded-2xl">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,var(--tw-gradient-stops))] from-amber-400/6 via-transparent to-transparent"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/15 to-transparent"
          aria-hidden="true"
        />

        <CardHeader className="relative z-10 border-b border-(--ws-line) pb-0">
          <div className="flex flex-col gap-3 pb-3 sm:gap-4 sm:pb-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-(--ws-line) bg-linear-to-br from-white/10 to-white/5 shadow-inner shadow-white/5 sm:h-11 sm:w-11 sm:rounded-xl">
                  <Sparkles className="h-4 w-4 text-(--ws-amber) sm:h-5 sm:w-5" />
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-slate-900 bg-teal-300 sm:h-3 sm:w-3" />
              </div>
              <div className="space-y-0.5">
                <CardTitle className="text-base font-semibold tracking-tight text-(--ws-fg) sm:text-lg">
                  Subject Offerings Directory
                </CardTitle>
                <p className="text-[11px] text-(--ws-fg-70) sm:text-xs">
                  Search, filter, and manage curriculum-aware offerings
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-2.5 py-1 text-[10px] font-medium text-(--ws-amber)">
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
      <Card className="relative overflow-hidden rounded-xl border border-(--ws-line) bg-linear-to-br from-(--ws-panel-from) via-(--ws-panel-via) to-(--ws-panel-to) shadow-2xl shadow-black/40 backdrop-blur-xl sm:rounded-2xl">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,var(--tw-gradient-stops))] from-cyan-500/5 via-transparent to-transparent"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/15 to-transparent"
          aria-hidden="true"
        />

        <CardHeader className="relative z-10 border-b border-(--ws-line) pb-0">
          <div className="flex flex-col gap-3 pb-3 sm:pb-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <CardTitle className="text-xs font-semibold uppercase tracking-[0.2em] text-(--ws-fg-70)">
                Directory Results
              </CardTitle>
              <p className="text-sm text-(--ws-fg-70)">
                {isLoading ? "Loading..." : `${totalFiltered} offerings found`}
              </p>
              {!isLoading && activeGradeBandHeading && (
                <p className="text-xs font-medium text-(--ws-amber)">
                  Now showing subject offerings for {activeGradeBandHeading}
                </p>
              )}
              {!isLoading && !activeGradeBandHeading && subjects.length > 0 && (
                <p className="text-xs text-(--ws-fg-70)">
                  Grouped by grade band for easier curriculum review.
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[10px] font-medium transition-colors",
                  viewMode === "cards"
                    ? "border-amber-300/20 bg-amber-300/10 text-(--ws-amber)"
                    : "border-(--ws-line) bg-(--ws-fill) text-(--ws-fg-70)"
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
                  <Shapes className="h-5 w-5 text-(--ws-amber)" />
                </div>
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-(--ws-fg-70)">
                  Loading subject offerings...
                </p>
                <p className="text-xs text-(--ws-fg-70)">
                  Fetching your curriculum-aware directory
                </p>
              </div>
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center gap-4 py-12 sm:py-16">
              <div className="flex h-14 w-14 items-center justify-center rounded-full border border-red-500/30 bg-red-500/10">
                <AlertCircle className="h-7 w-7 text-(--ws-rose)" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-(--ws-rose)">
                  Failed to load subject offerings
                </p>
                <p className="text-xs text-(--ws-rose)">
                  Please try refreshing the page
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="border-red-500/30 bg-red-500/10 text-(--ws-rose) hover:bg-red-500/20"
                onClick={() => window.location.reload()}
              >
                Retry
              </Button>
            </div>
          ) : subjects.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 py-12 sm:py-16">
              <div className="relative">
                <div className="flex h-20 w-20 items-center justify-center rounded-full border border-(--ws-line) bg-linear-to-br from-white/10 to-white/5">
                  <Shapes className="h-10 w-10 text-(--ws-amber)" />
                </div>
              </div>
              <div className="text-center">
                <p className="text-base font-medium text-(--ws-fg-70)">
                  No subject offerings found
                </p>
                <p className="mt-1 max-w-xs text-sm text-(--ws-fg-70)">
                  Start from your selected curriculum or create custom offerings
                  after the curriculum setup is ready.
                </p>
              </div>
              <Button
                onClick={() => {
                  setSetupMode("initial");
                  setSetupOpen(true);
                }}
                className="bg-linear-to-r from-amber-300 to-orange-400 text-slate-950 hover:from-amber-200 hover:to-orange-300"
              >
                Set Up Offerings
              </Button>
            </div>
          ) : (
            <div className="space-y-4 sm:space-y-5">
              <div className="flex flex-col gap-2 rounded-xl border border-(--ws-line) bg-linear-to-r from-white/5 to-transparent px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-2 text-xs text-(--ws-fg-70) sm:text-sm">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-300/15 text-[9px] font-bold text-(--ws-amber) sm:h-6 sm:w-6 sm:text-[10px]">
                    {subjects.length}
                  </span>
                  <span>
                    showing{" "}
                    <span className="font-medium text-(--ws-fg)">
                      {subjects.length}
                    </span>{" "}
                    offering{subjects.length === 1 ? "" : "s"}
                  </span>
                </div>
              </div>

              {viewMode === "cards" ? (
                gradeBandFilter === "all" ? (
                  <div className="space-y-6">
                    {groupedSubjects.map(([band, items]) => (
                      <section key={band} className="space-y-3">
                        <div className="flex items-center justify-between gap-3 border-b border-(--ws-line) pb-2">
                          <div>
                            <h2 className="text-sm font-semibold text-(--ws-fg)">
                              {gradeBandHeading(band)}
                            </h2>
                            <p className="text-xs text-(--ws-fg-70)">
                              {items.length} offering{items.length === 1 ? "" : "s"}
                            </p>
                          </div>
                          <span className="rounded-full border border-(--ws-line) bg-(--ws-fill) px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] text-(--ws-fg-70)">
                            {band.replace(/_/g, " ")}
                          </span>
                        </div>
                        <SubjectsCardGrid
                          subjects={items}
                          onView={handleView}
                          onEdit={handleEdit}
                          onAssignToClasses={handleAssignToClasses}
                          onAssignTeachers={handleAssignTeachers}
                          onDelete={handleDelete}
                        />
                      </section>
                    ))}
                  </div>
                ) : (
                  <SubjectsCardGrid
                    subjects={subjects}
                    onView={handleView}
                    onEdit={handleEdit}
                    onAssignToClasses={handleAssignToClasses}
                    onAssignTeachers={handleAssignTeachers}
                    onDelete={handleDelete}
                  />
                )
              ) : (
                gradeBandFilter === "all" ? (
                  <div className="space-y-6">
                    {groupedSubjects.map(([band, items]) => (
                      <section key={band} className="space-y-3">
                        <div className="flex items-center justify-between gap-3 border-b border-(--ws-line) pb-2">
                          <div>
                            <h2 className="text-sm font-semibold text-(--ws-fg)">
                              {gradeBandHeading(band)}
                            </h2>
                            <p className="text-xs text-(--ws-fg-70)">
                              {items.length} offering{items.length === 1 ? "" : "s"}
                            </p>
                          </div>
                        </div>
                        <SubjectsTable
                          subjects={items}
                          onView={handleView}
                          onEdit={handleEdit}
                          onAssignToClasses={handleAssignToClasses}
                          onAssignTeachers={handleAssignTeachers}
                          onDelete={handleDelete}
                        />
                      </section>
                    ))}
                  </div>
                ) : (
                  <SubjectsTable
                    subjects={subjects}
                    onView={handleView}
                    onEdit={handleEdit}
                    onAssignToClasses={handleAssignToClasses}
                    onAssignTeachers={handleAssignTeachers}
                    onDelete={handleDelete}
                  />
                )
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
        initialGradeId={setupGradeId}
        mode={setupMode}
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
      {confirmationDialog}
    </WorkspaceScope>
  );
}

function SetupSubjectOfferingsDialog({
  open,
  onOpenChange,
  initialGradeId,
  mode,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialGradeId?: string;
  mode: "initial" | "add";
}) {
  const { data: gradesData } = useGrades(true);
  const { data: classesData } = useClasses({ isActive: true });
  const setupMutation = useSetupSubjectOfferingsFromCurriculum();
  const createCustomOffering = useCreateCustomSubjectOffering();
  const assignOfferingToClasses = useAssignSubjectOfferingToClasses();
  const [curriculumCode, setCurriculumCode] = React.useState<CurriculumCode>("ghana_nacca");
  const [autoAssign, setAutoAssign] = React.useState(true);
  const [customForm, setCustomForm] = React.useState({
    subjectFamily: "",
    displayName: "",
    shortName: "",
    code: "",
    gradeBand: "custom",
    stage: "custom",
    category: "core",
  });
  const [displayNameWasEdited, setDisplayNameWasEdited] = React.useState(false);
  const [createdCustomOfferings, setCreatedCustomOfferings] = React.useState<
    CreatedCustomOffering[]
  >([]);
  const gradeRows = gradesData?.data;
  const grades = React.useMemo(
    () => (gradeRows ?? []).filter((grade) => !isPreschoolGradeOption(grade)),
    [gradeRows]
  );
  const initialGrade = initialGradeId
    ? grades.find((grade) => grade.id === initialGradeId)
    : null;
  const [selectedGradeIds, setSelectedGradeIds] = React.useState<string[]>([]);
  const [selectedCodes, setSelectedCodes] = React.useState<string[]>([]);
  const [selectedClassGroupIds, setSelectedClassGroupIds] = React.useState<string[]>([]);
  const selectedGrades = React.useMemo(
    () => grades.filter((grade) => selectedGradeIds.includes(grade.id)),
    [grades, selectedGradeIds]
  );
  const templates = React.useMemo(() => {
    const selectedGradeRows = selectedGrades.length > 0 ? selectedGrades : grades;
    return getSubjectOfferingTemplatesForCurriculum(curriculumCode).filter((template) => {
      if (template.gradeBand === "preschool") return false;
      return selectedGradeRows.some((grade) => gradeMatchesTemplateCode(grade, template.gradeCodes));
    });
  }, [curriculumCode, grades, selectedGrades]);
  const defaultTemplateCodes = React.useMemo(() => {
    const availableGrades = initialGrade ? [initialGrade] : grades;
    return getSubjectOfferingTemplatesForCurriculum(curriculumCode)
      .filter(
        (template) =>
          template.gradeBand !== "preschool" &&
          availableGrades.some((grade) => gradeMatchesTemplateCode(grade, template.gradeCodes))
      )
      .filter((template) => template.isDefault)
      .map((template) => template.code);
  }, [curriculumCode, grades, initialGrade]);
  const gradeIdsForBand = React.useCallback(
    (band: string) =>
      grades
        .filter((grade) => gradeBandForGrade(grade) === band)
        .map((grade) => grade.id),
    [grades]
  );
  const customGradeIds =
    customForm.gradeBand === "custom"
      ? selectedGradeIds
      : gradeIdsForBand(customForm.gradeBand);

  const classRows = classesData?.data;
  const classes = React.useMemo(() => classRows ?? [], [classRows]);
  const classesForSelectedGrades = React.useMemo(
    () => classes.filter((classGroup) => selectedGradeIds.includes(classGroup.grade.id)),
    [classes, selectedGradeIds]
  );

  React.useEffect(() => {
    if (!open) return;
    setSelectedGradeIds(
      mode === "add"
        ? initialGradeId
          ? [initialGradeId]
          : []
        : initialGradeId
          ? [initialGradeId]
          : grades.map((grade) => grade.id)
    );
    setSelectedCodes(
      mode === "add"
        ? []
        : defaultTemplateCodes
    );
    setSelectedClassGroupIds([]);
    setCreatedCustomOfferings([]);
    setDisplayNameWasEdited(false);
    setCustomForm({
      subjectFamily: "",
      displayName: "",
      shortName: "",
      code: "",
      gradeBand: "custom",
      stage: suggestedStageForCurriculum(curriculumCode, "custom"),
      category: curriculumCode === "custom" ? "custom" : "core",
    });
  }, [open, grades, initialGradeId, mode, curriculumCode, defaultTemplateCodes]);

  React.useEffect(() => {
    setSelectedClassGroupIds((current) =>
      current.filter((classGroupId) =>
        classesForSelectedGrades.some((classGroup) => classGroup.id === classGroupId)
      )
    );
  }, [classesForSelectedGrades]);

  const groupedTemplates = React.useMemo(() => {
    return templates.reduce<Record<string, CurriculumSubjectOfferingTemplate[]>>((acc, template) => {
      const key = template.gradeBand;
      acc[key] = acc[key] || [];
      acc[key].push(template);
      return acc;
    }, {});
  }, [templates]);
  const customOfferingsByBand = React.useMemo(() => {
    return createdCustomOfferings.reduce<Record<string, CreatedCustomOffering[]>>((acc, offering) => {
      const key = offering.gradeBand || "custom";
      acc[key] = acc[key] || [];
      acc[key].push(offering);
      return acc;
    }, {});
  }, [createdCustomOfferings]);
  const setupBands = React.useMemo(() => {
    const keys = new Set([
      ...Object.keys(groupedTemplates),
      ...Object.keys(customOfferingsByBand),
    ]);
    return Array.from(keys).sort((a, b) => {
      const ai = gradeBandOrder.indexOf(a as (typeof gradeBandOrder)[number]);
      const bi = gradeBandOrder.indexOf(b as (typeof gradeBandOrder)[number]);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
  }, [customOfferingsByBand, groupedTemplates]);

  const toggle = (value: string, list: string[], setter: (next: string[]) => void) => {
    setter(list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);
  };

  const applyCatalogTemplate = (template: CurriculumSubjectOfferingTemplate) => {
    const matchingGradeIds = grades
      .filter((grade) => gradeMatchesTemplateCode(grade, template.gradeCodes))
      .map((grade) => grade.id);
    const selectedMatchingGradeIds = selectedGradeIds.filter((id) => matchingGradeIds.includes(id));
    setSelectedGradeIds(selectedMatchingGradeIds.length > 0 ? selectedMatchingGradeIds : matchingGradeIds);
    setCustomForm({
      subjectFamily: template.subjectFamily,
      displayName: template.displayName,
      shortName: template.shortName,
      code: template.code,
      gradeBand: template.gradeBand,
      stage: template.stage,
      category: template.category,
    });
    setDisplayNameWasEdited(false);
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
    if (!subjectFamily || !code || customGradeIds.length === 0) return;
    const result = await createCustomOffering.mutateAsync({
      subjectFamily,
      displayName,
      shortName,
      code,
      curriculumCode,
      stage: customForm.stage,
      gradeBand: customForm.gradeBand,
      gradeIds: customGradeIds,
      category: customForm.category,
      lessonNoteTemplateVariant:
        curriculumCode === "ghana_nacca"
          ? customForm.gradeBand === "jhs"
            ? "nacca_jhs"
            : "nacca_primary"
          : curriculumCode === "custom"
            ? "custom"
            : "classic",
      reportCardGroup: customForm.category === "elective" ? "Electives" : customForm.category === "core" ? "Core" : "Other",
      autoAssignToMatchingClassGroups: mode === "initial" ? autoAssign : false,
    });
    if (result.success) {
      if (mode === "add" && selectedClassGroupIds.length > 0) {
        await assignOfferingToClasses.mutateAsync({
          subjectOfferingId: result.data.id,
          classGroupIds: selectedClassGroupIds,
        });
      }
      if (mode === "add") {
        onOpenChange(false);
        return;
      }
      const gradeNameMap = new Map(grades.map((grade) => [grade.id, grade.name]));
      setCreatedCustomOfferings((current) => [
        {
          id: result.data.id,
          displayName,
          code,
          gradeBand: customForm.gradeBand,
          category: customForm.category,
          gradeNames: customGradeIds.map((id) => gradeNameMap.get(id) || "Grade"),
          autoAssigned: autoAssign,
        },
        ...current,
      ]);
      setCustomForm({
        subjectFamily: "",
        displayName: "",
        shortName: "",
        code: "",
        gradeBand: "custom",
        stage: suggestedStageForCurriculum(curriculumCode, "custom"),
        category: curriculumCode === "custom" ? "custom" : "core",
      });
      setDisplayNameWasEdited(false);
    }
  }

  const canCreateTemplateOfferings = selectedCodes.length > 0 && selectedGradeIds.length > 0;
  const canFinishAfterCustomOnly =
    selectedCodes.length === 0 && createdCustomOfferings.length > 0;
  const isAddingSubject = mode === "add";
  const isCreatingCustom =
    createCustomOffering.isPending || assignOfferingToClasses.isPending;
  const suggestedCode = suggestedSubjectCode(
    curriculumCode,
    customForm.gradeBand as SubjectOfferingGradeBand,
    customForm.subjectFamily
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] !max-w-6xl overflow-hidden border-(--ws-line) bg-linear-to-br from-(--ws-panel-from) via-(--ws-panel-via) to-(--ws-panel-to) p-0 text-(--ws-fg) shadow-2xl shadow-black/60">
        <div className="relative overflow-hidden rounded-lg">
          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-amber-300/10 blur-3xl" />
          <div className="relative flex max-h-[88vh] flex-col">
            <div className="border-b border-(--ws-line) p-6">
              <DialogHeader className="space-y-3 text-left">
                <div className="flex items-start gap-3">
                  <div className="flex size-11 items-center justify-center rounded-2xl border border-amber-300/20 bg-amber-300/10">
                    <WandSparkles className="size-5 text-(--ws-amber)" />
                  </div>
                  <div>
                    <DialogTitle>
                      {isAddingSubject ? "Add subject offering" : "Set up subject offerings"}
                    </DialogTitle>
                    <DialogDescription className="mt-1 max-w-2xl text-(--ws-fg-70)">
                      {isAddingSubject
                        ? "Add a subject after initial setup, choose its grades, and optionally target specific class groups."
                        : "Generate curriculum-aware offerings, tie them to matching grades, and optionally assign them to class groups in those grades."}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>
            </div>

            <div className="space-y-5 overflow-y-auto p-6 lg:p-7">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-(--ws-fg-70)">
                    Curriculum source
                  </p>
                  <PremiumSelect
                    value={curriculumCode}
                    onValueChange={(value) => {
                      const nextCurriculum = value as CurriculumCode;
                      setCurriculumCode(nextCurriculum);
                      setCustomForm((current) => ({
                        ...current,
                        stage: suggestedStageForCurriculum(nextCurriculum, current.gradeBand as SubjectOfferingGradeBand),
                        category: nextCurriculum === "custom" ? "custom" : current.category === "custom" ? "core" : current.category,
                      }));
                    }}
                  >
                    <PremiumSelectTrigger>
                      <PremiumSelectValue />
                    </PremiumSelectTrigger>
                    <PremiumSelectContent>
                      {curriculumOptions.map((option) => (
                        <PremiumSelectItem key={option.value} value={option.value} description={option.description}>
                          {option.label}
                        </PremiumSelectItem>
                      ))}
                    </PremiumSelectContent>
                  </PremiumSelect>
                  <p className="text-xs leading-relaxed text-(--ws-fg-70)">
                    Use the curriculum the subject belongs to. If it is approved but missing from the catalog, add it here and keep this curriculum selected.
                  </p>
                </div>
                {isAddingSubject ? (
                  <div className="rounded-2xl border border-(--ws-line) bg-(--ws-fill) p-4 md:col-span-2">
                    <p className="text-sm font-medium text-(--ws-fg)">Add from the catalog or add a curriculum-approved subject</p>
                    <p className="mt-1 text-xs leading-relaxed text-(--ws-fg-70)">
                      Catalog suggestions use the selected curriculum and grades. You can still enter a new approved subject manually when the catalog has not caught up.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-(--ws-line) bg-(--ws-fill) p-4 md:col-span-2">
                    <label className="flex cursor-pointer items-start gap-3">
                      <Checkbox checked={autoAssign} onCheckedChange={(checked) => setAutoAssign(Boolean(checked))} />
                      <span>
                        <span className="block text-sm font-medium text-(--ws-fg)">Assign to matching class groups</span>
                        <span className="mt-1 block text-xs leading-relaxed text-(--ws-fg-70)">
                          {initialGrade
                            ? `This setup is currently scoped to ${initialGrade.name}.`
                            : "For example, Mathematics - JHS will be assigned to every class group inside JHS 1, JHS 2, and JHS 3."}
                        </span>
                      </span>
                    </label>
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-(--ws-line) bg-(--ws-fill) p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-(--ws-fg)">Grades covered</p>
                    <p className="text-xs text-(--ws-fg-70)">
                      {initialGrade
                        ? `Showing setup for ${initialGrade.name}. You can add more grades if needed.`
                        : "Only selected grades receive matching offerings."}
                    </p>
                  </div>
                  <span className="rounded-full border border-(--ws-line) bg-(--ws-fill) px-2.5 py-1 text-[10px] text-(--ws-fg-70)">
                    {selectedGradeIds.length} selected
                  </span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {grades.map((grade) => (
                    <label key={grade.id} className="flex cursor-pointer items-center gap-2 rounded-xl border border-(--ws-line) bg-(--ws-fill) p-3 text-sm text-(--ws-fg-70)">
                      <Checkbox checked={selectedGradeIds.includes(grade.id)} onCheckedChange={() => toggle(grade.id, selectedGradeIds, setSelectedGradeIds)} />
                      <span>{grade.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              {isAddingSubject && selectedGradeIds.length > 0 && templates.length > 0 && (
                <div className="rounded-2xl border border-(--ws-line) bg-(--ws-fill) p-4">
                  <div className="mb-3">
                    <p className="text-sm font-medium text-(--ws-fg)">Catalog suggestions</p>
                    <p className="text-xs leading-relaxed text-(--ws-fg-70)">
                      These subjects match the selected curriculum and grades. Choose one to fill the subject details below, then review the values before adding it.
                    </p>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {templates.map((template) => (
                      <button
                        key={template.code}
                        type="button"
                        onClick={() => applyCatalogTemplate(template)}
                        className={cn(
                          "rounded-xl border p-3 text-left transition",
                          customForm.code === template.code
                            ? "border-amber-300/45 bg-amber-300/10"
                            : "border-(--ws-line) bg-(--ws-fill) hover:border-amber-300/25 hover:bg-amber-300/5"
                        )}
                      >
                        <span className="block text-sm font-medium text-(--ws-fg)">{template.displayName}</span>
                        <span className="mt-1 block text-[10px] uppercase tracking-[0.1em] text-(--ws-fg-70)">
                          {template.code} · {template.category.replace(/_/g, " ")}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {!isAddingSubject && <div className="space-y-4">
                {setupBands.map((band) => {
                  const items = groupedTemplates[band] || [];
                  const customItems = customOfferingsByBand[band] || [];
                  const totalItems = items.length + customItems.length;

                  return (
                    <div key={band} className="rounded-2xl border border-(--ws-line) bg-(--ws-fill) p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <p className="text-sm font-semibold text-(--ws-fg)">{formatOfferingLabel(band)}</p>
                        <span className="text-xs text-(--ws-fg-70)">{totalItems} offerings</span>
                      </div>
                      <div className="grid gap-2 lg:grid-cols-2 xl:grid-cols-3">
                        {items.map((template) => (
                        <label key={template.code} className="flex cursor-pointer items-start gap-3 rounded-xl border border-(--ws-line) bg-(--ws-fill) p-3 transition hover:border-amber-300/25 hover:bg-amber-300/5">
                          <Checkbox checked={selectedCodes.includes(template.code)} onCheckedChange={() => toggle(template.code, selectedCodes, setSelectedCodes)} />
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium text-(--ws-fg)">{template.displayName}</span>
                            <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] uppercase tracking-[0.1em] text-(--ws-fg-70)">
                              <span>{template.code}</span>
                              <span className="rounded-full border border-(--ws-line) px-1.5 py-0.5">{template.category.replace(/_/g, " ")}</span>
                              <span className="rounded-full border border-(--ws-line) px-1.5 py-0.5">{template.lessonNoteTemplateVariant?.replace(/_/g, " ") ?? "classic"}</span>
                            </span>
                          </span>
                        </label>
                        ))}
                        {customItems.map((offering) => (
                          <div
                            key={offering.id}
                            className="flex items-start gap-3 rounded-xl border border-emerald-300/20 bg-emerald-300/[0.06] p-3"
                          >
                            <Checkbox checked disabled />
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-medium text-(--ws-fg)">
                                {offering.displayName}
                              </span>
                              <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] uppercase tracking-[0.1em] text-(--ws-fg-70)">
                                <span>{offering.code}</span>
                                <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-1.5 py-0.5 text-(--ws-emerald)">
                                  saved custom
                                </span>
                                <span className="rounded-full border border-(--ws-line) px-1.5 py-0.5">
                                  {offering.category.replace(/_/g, " ")}
                                </span>
                              </span>
                              <span className="mt-1 block text-xs text-(--ws-fg-70)">
                                {offering.gradeNames.join(", ")}
                              </span>
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>}

              {isAddingSubject && selectedGradeIds.length > 0 && (
                <div className="rounded-2xl border border-(--ws-line) bg-(--ws-fill) p-4">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-(--ws-fg)">Class groups (optional)</p>
                      <p className="text-xs leading-relaxed text-(--ws-fg-70)">
                        Leave these unselected to create the offering without assigning it to a class yet.
                      </p>
                    </div>
                    {classesForSelectedGrades.length > 0 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setSelectedClassGroupIds(
                            selectedClassGroupIds.length === classesForSelectedGrades.length
                              ? []
                              : classesForSelectedGrades.map((classGroup) => classGroup.id)
                          )
                        }
                        className="h-7 shrink-0 text-xs text-(--ws-amber) hover:text-(--ws-amber)"
                      >
                        {selectedClassGroupIds.length === classesForSelectedGrades.length
                          ? "Clear all"
                          : "Select all"}
                      </Button>
                    )}
                  </div>
                  {classesForSelectedGrades.length === 0 ? (
                    <p className="rounded-xl border border-amber-300/20 bg-amber-300/10 p-3 text-xs text-(--ws-amber)">
                      No active class groups exist in the selected grades. The offering will remain available for later assignment.
                    </p>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {classesForSelectedGrades.map((classGroup) => (
                        <label
                          key={classGroup.id}
                          className="flex cursor-pointer items-center gap-2 rounded-xl border border-(--ws-line) bg-(--ws-fill) p-3 text-sm text-(--ws-fg-70)"
                        >
                          <Checkbox
                            checked={selectedClassGroupIds.includes(classGroup.id)}
                            onCheckedChange={() =>
                              setSelectedClassGroupIds((current) =>
                                current.includes(classGroup.id)
                                  ? current.filter((id) => id !== classGroup.id)
                                  : [...current, classGroup.id]
                              )
                            }
                          />
                          <span>{classGroup.fullLabel}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="rounded-2xl border border-amber-300/15 bg-amber-300/[0.04] p-4">
                <div className="mb-4 flex flex-col gap-1">
                  <p className="text-sm font-semibold text-(--ws-fg)">
                    {isAddingSubject
                      ? "Subject details"
                      : curriculumCode === "custom"
                        ? "Add a custom subject offering"
                        : "Add a curriculum subject offering"}
                  </p>
                  <p className="text-xs text-(--ws-fg-70)">
                    {isAddingSubject
                      ? "This subject becomes available in the selected grades and optionally selected class groups."
                      : "Use this when a school teaches a subject that is not in the current catalog. Keep the curriculum source selected so the offering remains correctly classified."}
                  </p>
                </div>
                <div className="grid gap-3 lg:grid-cols-5">
                  <input
                    aria-label="Subject family"
                    value={customForm.subjectFamily}
                    onChange={(event) =>
                      setCustomForm((current) => ({
                        ...current,
                        subjectFamily: event.target.value,
                        displayName: displayNameWasEdited
                          ? current.displayName
                          : event.target.value,
                        shortName: event.target.value,
                      }))
                    }
                    placeholder="Subject family, e.g. Robotics"
                    className="h-11 rounded-xl border border-(--ws-line) bg-(--ws-fill) px-3 text-sm text-(--ws-fg) placeholder:text-(--ws-fg-50) outline-none focus:border-amber-300/35"
                  />
                  <input
                    aria-label="Display name"
                    value={customForm.displayName}
                    onChange={(event) => {
                      const displayName = event.target.value;
                      setCustomForm((current) => ({
                        ...current,
                        displayName,
                      }));
                      setDisplayNameWasEdited(displayName !== customForm.subjectFamily);
                    }}
                    placeholder="Display name"
                    className="h-11 rounded-xl border border-(--ws-line) bg-(--ws-fill) px-3 text-sm text-(--ws-fg) placeholder:text-(--ws-fg-50) outline-none focus:border-amber-300/35"
                  />
                  <input
                    aria-label="Subject code"
                    value={customForm.code}
                    onChange={(event) =>
                      setCustomForm((current) => ({
                        ...current,
                        code: event.target.value,
                      }))
                    }
                    placeholder={suggestedCode}
                    className="h-11 rounded-xl border border-(--ws-line) bg-(--ws-fill) px-3 text-sm uppercase text-(--ws-fg) placeholder:text-(--ws-fg-50) outline-none focus:border-amber-300/35"
                  />
                  <PremiumSelect
                    value={customForm.gradeBand}
                    onValueChange={(value) => {
                      const nextGradeBand = value as SubjectOfferingGradeBand;
                      setCustomForm((current) => ({
                        ...current,
                        gradeBand: nextGradeBand,
                        stage: suggestedStageForCurriculum(curriculumCode, nextGradeBand),
                      }));
                      if (value !== "custom") {
                        setSelectedGradeIds(gradeIdsForBand(value));
                      }
                    }}
                  >
                    <PremiumSelectTrigger>
                      <PremiumSelectValue placeholder="Grade band" />
                    </PremiumSelectTrigger>
                    <PremiumSelectContent>
                      <PremiumSelectItem value="lower_primary">Lower Primary</PremiumSelectItem>
                      <PremiumSelectItem value="upper_primary">Upper Primary</PremiumSelectItem>
                      <PremiumSelectItem value="jhs">JHS</PremiumSelectItem>
                      <PremiumSelectItem value="custom">Custom / selected grades</PremiumSelectItem>
                    </PremiumSelectContent>
                  </PremiumSelect>
                  <PremiumSelect
                    value={customForm.category}
                    onValueChange={(value) =>
                      setCustomForm((current) => ({ ...current, category: value }))
                    }
                  >
                    <PremiumSelectTrigger>
                      <PremiumSelectValue placeholder="Category" />
                    </PremiumSelectTrigger>
                    <PremiumSelectContent>
                      {subjectCategoryOptions.map(([value, label]) => (
                        <PremiumSelectItem key={value} value={value}>
                          {label}
                        </PremiumSelectItem>
                      ))}
                    </PremiumSelectContent>
                  </PremiumSelect>
                </div>
                <div className="mt-3 grid gap-2 text-xs text-(--ws-fg-70) sm:grid-cols-2">
                  <p>
                    <span className="font-medium text-(--ws-fg)">Subject family:</span> the academic subject used for grouping, for example Arabic or Robotics.
                  </p>
                  <p>
                    <span className="font-medium text-(--ws-fg)">Display name:</span> the name teachers and timetable users will see.
                  </p>
                  <p>
                    <span className="font-medium text-(--ws-fg)">Code:</span> a short unique identifier. Suggested value: <span className="font-mono text-(--ws-amber)">{suggestedCode}</span>{" "}
                    <button
                      type="button"
                      className="text-(--ws-cyan) underline underline-offset-2 hover:text-(--ws-fg)"
                      onClick={() => setCustomForm((current) => ({ ...current, code: suggestedCode }))}
                    >
                      use suggestion
                    </button>
                  </p>
                  <p>
                    <span className="font-medium text-(--ws-fg)">Grade band and category:</span> these guide reporting, lesson-note templates, and where the offering is suggested.
                  </p>
                </div>
                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-(--ws-fg-70)">
                    {isAddingSubject
                      ? "The offering will use the selected grades above. Class-group assignment is optional."
                      : customForm.gradeBand === "custom"
                        ? "Custom offering will use the selected grades above and can be assigned to matching class groups automatically."
                        : `${curriculumCode === "custom" ? "Custom" : "Curriculum"} offering will use ${formatOfferingLabel(customForm.gradeBand)} grades only and can be assigned to matching class groups automatically.`}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={
                      isCreatingCustom ||
                      !customForm.subjectFamily.trim() ||
                      !customForm.code.trim() ||
                      customGradeIds.length === 0
                    }
                    onClick={handleCreateCustom}
                    className="border-amber-300/20 bg-amber-300/10 text-(--ws-amber) hover:bg-amber-300/15"
                  >
                    {isAddingSubject
                      ? "Add subject offering"
                      : curriculumCode === "custom"
                        ? "Add custom offering"
                        : "Add curriculum offering"}
                  </Button>
                </div>
              </div>
            </div>

            <DialogFooter className="border-t border-(--ws-line) p-6">
              <Button variant="outline" className="border-(--ws-line) bg-(--ws-fill) text-(--ws-fg) hover:bg-(--ws-fill-strong)" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                className="bg-linear-to-r from-amber-300 to-orange-400 text-slate-950 hover:from-amber-200 hover:to-orange-300"
                disabled={
                  setupMutation.isPending ||
                  isCreatingCustom ||
                  (!isAddingSubject && !canCreateTemplateOfferings && !canFinishAfterCustomOnly)
                }
                onClick={() => {
                  if (isAddingSubject) {
                    onOpenChange(false);
                    return;
                  }
                  if (canCreateTemplateOfferings) {
                    void handleSubmit();
                    return;
                  }
                  onOpenChange(false);
                }}
              >
                {isAddingSubject
                  ? "Close"
                  : canCreateTemplateOfferings
                    ? "Create offerings"
                    : "Done"}
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
      <DialogContent className="w-[calc(100vw-2rem)] !max-w-4xl border-(--ws-line) bg-linear-to-br from-(--ws-panel-from) via-(--ws-panel-via) to-(--ws-panel-to) text-(--ws-fg)">
        <DialogHeader>
          <DialogTitle>Assign offering to class groups</DialogTitle>
          <DialogDescription className="text-(--ws-fg-70)">
            {offering?.displayName ?? "Subject offering"} can only be assigned to
            class groups inside its grade coverage.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {compatibleClasses.length === 0 ? (
            <div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4 text-sm text-(--ws-amber)">
              No compatible class groups were found for this offering.
            </div>
          ) : (
            compatibleClasses.map((classGroup) => (
              <label key={classGroup.id} className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-(--ws-line) bg-(--ws-fill) p-3">
                <span>
                  <span className="block text-sm font-medium text-(--ws-fg)">{classGroup.fullLabel}</span>
                  <span className="text-xs text-(--ws-fg-70)">{classGroup.grade.name}</span>
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
          <Button variant="outline" className="border-(--ws-line) bg-(--ws-fill) text-(--ws-fg) hover:bg-(--ws-fill-strong)" onClick={() => onOpenChange(false)}>
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
