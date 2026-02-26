"use client";

import React, { useState, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Crown,
  Users,
  Shield,
  Clock,
  Sparkles,
  Plus,
  Search,
  Award,
  UserCheck,
  Calendar,
  MapPin,
  Loader2,
  AlertCircle,
  X,
  GraduationCap,
  BookOpen,
  Settings,
  ArrowRight,
  CheckCircle2,
  TriangleAlert,
  WifiOff,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useSchoolRoles,
  useRemoveSchoolRole,
  type SchoolRoleDefinitionDTO,
  type SchoolRoleAssignmentDTO,
} from "@/hooks/admin/useSchoolRoles";
import {
  useTeacherDuties,
  useRemoveTeacherDuty,
  formatDays,
  type DutyDefinitionDTO,
  type DutyAssignmentDTO,
} from "@/hooks/admin/useTeacherDuties";
import {
  useClassRoleDefinitions,
  getRoleCategoryInfo,
  type ClassRoleCategory,
} from "@/hooks/admin/useClassRoles";
import { toast } from "sonner";
import { AssignSchoolRoleModal } from "@/components/modals/AssignSchoolRoleModal";
import { AssignTeacherDutyModal } from "@/components/modals/AssignTeacherDutyModal";
import { CreateSchoolRoleModal } from "@/components/modals/CreateSchoolRoleModal";
import { CreateDutyModal } from "@/components/modals/CreateDutyModal";
import { CreateClassRoleModal } from "@/components/modals/CreateClassRoleModal";
import { LeoIcon } from "@/components/icons/LeoIcon";
import {
  useRolesDutiesAIInsightsQuery,
  useRolesDutiesAIInsights,
  type RolesDutiesAIInsights,
} from "@/hooks/admin/useRolesDutiesAIInsights";

type ActiveTab = "student-roles" | "teacher-duties" | "class-roles";

function formatRelativeTime(isoDate: string | null): string {
  if (!isoDate) return "";
  const d = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString();
}

type AIInsightSeverity = "critical" | "attention" | "good";

type AIInsight = {
  id: string;
  title: string;
  detail: string;
  metric?: string;
  severity: AIInsightSeverity;
  actionLabel?: string;
  onAction?: () => void;
};

function RolesDutiesContent() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("student-roles");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showAIInsights, setShowAIInsights] = useState(true);
  const [assignRoleModalOpen, setAssignRoleModalOpen] = useState(false);
  const [assignDutyModalOpen, setAssignDutyModalOpen] = useState(false);
  const [createRoleModalOpen, setCreateRoleModalOpen] = useState(false);
  const [createDutyModalOpen, setCreateDutyModalOpen] = useState(false);
  const [createClassRoleModalOpen, setCreateClassRoleModalOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<SchoolRoleDefinitionDTO | null>(null);
  const [selectedDuty, setSelectedDuty] = useState<DutyDefinitionDTO | null>(null);
  const roleCategoryScrollRef = React.useRef<HTMLDivElement | null>(null);
  const [showRoleCategoryLeftHint, setShowRoleCategoryLeftHint] = useState(false);
  const [showRoleCategoryRightHint, setShowRoleCategoryRightHint] = useState(false);
  const classRoleCategoryScrollRef = React.useRef<HTMLDivElement | null>(null);
  const [showClassRoleCategoryLeftHint, setShowClassRoleCategoryLeftHint] = useState(false);
  const [showClassRoleCategoryRightHint, setShowClassRoleCategoryRightHint] = useState(false);
  const { data: cachedLeo, isLoading: cachedLeoLoading } = useRolesDutiesAIInsightsQuery(activeTab);
  const leoAI = useRolesDutiesAIInsights(activeTab);

  // Display: prefer mutation result (just generated), else cached from DB
  const leoInsights: RolesDutiesAIInsights | null =
    leoAI.data?.data ?? cachedLeo?.data ?? null;
  const leoGeneratedAt: string | null =
    leoAI.data?.generatedAt ?? cachedLeo?.generatedAt ?? null;
  const leoIsStale = cachedLeo?.isStale ?? false;

  const { data: rolesData, isLoading: rolesLoading, isError: rolesError, error: rolesErrorData } = useSchoolRoles(true);
  const { data: dutiesData, isLoading: dutiesLoading, isError: dutiesError, error: dutiesErrorData } = useTeacherDuties(true);
  const { data: classRolesData, isLoading: classRolesLoading, isError: classRolesError, error: classRolesErrorData } = useClassRoleDefinitions(true);
  const removeRoleMutation = useRemoveSchoolRole();
  const removeDutyMutation = useRemoveTeacherDuty();

  const handleRemoveRole = async (assignmentId: string) => {
    try {
      await removeRoleMutation.mutateAsync(assignmentId);
      toast.success("Role assignment removed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to remove role");
    }
  };

  const handleRemoveDuty = async (assignmentId: string) => {
    try {
      await removeDutyMutation.mutateAsync(assignmentId);
      toast.success("Duty assignment removed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to remove duty");
    }
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase();
  };

  const roleCategories = [
    { key: "prefect", label: "Prefects", icon: Crown, color: "text-amber-400" },
    { key: "council", label: "Student Council", icon: Users, color: "text-blue-400" },
    { key: "club", label: "Club Leaders", icon: Award, color: "text-emerald-400" },
    { key: "sports", label: "Sports", icon: Shield, color: "text-rose-400" },
    { key: "cultural", label: "Cultural", icon: GraduationCap, color: "text-purple-400" },
    { key: "service", label: "Service", icon: UserCheck, color: "text-cyan-400" },
    { key: "custom", label: "Custom", icon: Settings, color: "text-indigo-400" },
  ];

  const dutyCategories = [
    { key: "gate", label: "Gate Duty", icon: Shield, color: "text-rose-400" },
    { key: "assembly", label: "Assembly", icon: Users, color: "text-blue-400" },
    { key: "break", label: "Break Time", icon: Clock, color: "text-amber-400" },
    { key: "dining", label: "Dining", icon: UserCheck, color: "text-emerald-400" },
    { key: "sports", label: "Sports", icon: Award, color: "text-purple-400" },
    { key: "exam", label: "Examination", icon: GraduationCap, color: "text-cyan-400" },
  ];

  // Filter assignments based on search
  const filteredRoleAssignments = (rolesData?.assignments || []).filter((a) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      a.student?.fullName.toLowerCase().includes(q) ||
      a.role?.name.toLowerCase().includes(q)
    );
  });

  const filteredDutyAssignments = (dutiesData?.assignments || []).filter((a) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      a.teacher?.fullName.toLowerCase().includes(q) ||
      a.duty?.name.toLowerCase().includes(q)
    );
  });

  const getSearchPlaceholder = () => {
    if (activeTab === "student-roles") return "Search students or roles...";
    if (activeTab === "class-roles") return "Search class roles...";
    return "Search teachers or duties...";
  };

  // Helper to check if error is network-related
  const isNetworkError = (error: unknown): boolean => {
    if (!error) return false;
    const errorMessage = error instanceof Error ? error.message : String(error);
    return (
      errorMessage.includes("ETIMEOUT") ||
      errorMessage.includes("ECONNREFUSED") ||
      errorMessage.includes("ENOTFOUND") ||
      errorMessage.includes("network") ||
      errorMessage.includes("fetch") ||
      errorMessage.includes("Failed to fetch")
    );
  };

  const getErrorMessage = (error: unknown): string => {
    if (isNetworkError(error)) {
      return "Unable to connect. Please check your internet connection and try again.";
    }
    return error instanceof Error ? error.message : "An unexpected error occurred. Please try again.";
  };

  const updateRoleCategoryOverflowHints = React.useCallback(() => {
    const el = roleCategoryScrollRef.current;
    if (!el) return;

    const canScroll = el.scrollWidth > el.clientWidth + 2;
    if (!canScroll) {
      setShowRoleCategoryLeftHint(false);
      setShowRoleCategoryRightHint(false);
      return;
    }

    setShowRoleCategoryLeftHint(el.scrollLeft > 2);
    setShowRoleCategoryRightHint(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  }, []);

  React.useEffect(() => {
    const raf = requestAnimationFrame(updateRoleCategoryOverflowHints);
    const onResize = () => updateRoleCategoryOverflowHints();
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, [updateRoleCategoryOverflowHints, rolesData?.data?.length, activeTab]);

  const updateClassRoleCategoryOverflowHints = React.useCallback(() => {
    const el = classRoleCategoryScrollRef.current;
    if (!el) return;

    const canScroll = el.scrollWidth > el.clientWidth + 2;
    if (!canScroll) {
      setShowClassRoleCategoryLeftHint(false);
      setShowClassRoleCategoryRightHint(false);
      return;
    }

    setShowClassRoleCategoryLeftHint(el.scrollLeft > 2);
    setShowClassRoleCategoryRightHint(
      el.scrollLeft + el.clientWidth < el.scrollWidth - 2
    );
  }, []);

  React.useEffect(() => {
    const raf = requestAnimationFrame(updateClassRoleCategoryOverflowHints);
    const onResize = () => updateClassRoleCategoryOverflowHints();
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, [
    updateClassRoleCategoryOverflowHints,
    classRolesData?.data?.length,
    activeTab,
  ]);

  React.useEffect(() => {
    setSelectedCategory(null);
  }, [activeTab]);

  const roleAssignmentCounts = React.useMemo(() => {
    const counts = new Map<string, number>();
    (rolesData?.assignments || []).forEach((assignment) => {
      const roleId = assignment.role?.id;
      if (!roleId) return;
      counts.set(roleId, (counts.get(roleId) || 0) + 1);
    });
    return counts;
  }, [rolesData?.assignments]);

  const dutyAssignmentCounts = React.useMemo(() => {
    const counts = new Map<string, number>();
    (dutiesData?.assignments || []).forEach((assignment) => {
      const dutyId = assignment.duty?.id;
      if (!dutyId) return;
      counts.set(dutyId, (counts.get(dutyId) || 0) + 1);
    });
    return counts;
  }, [dutiesData?.assignments]);

  const activeInsightTone: Record<
    AIInsightSeverity,
    { border: string; bg: string; text: string; pill: string; icon: React.ComponentType<{ className?: string }> }
  > = {
    critical: {
      border: "border-rose-400/30",
      bg: "bg-rose-500/10",
      text: "text-rose-200",
      pill: "bg-rose-500/20 text-rose-100",
      icon: TriangleAlert,
    },
    attention: {
      border: "border-amber-400/30",
      bg: "bg-amber-500/10",
      text: "text-amber-100",
      pill: "bg-amber-500/20 text-amber-100",
      icon: Sparkles,
    },
    good: {
      border: "border-emerald-400/30",
      bg: "bg-emerald-500/10",
      text: "text-emerald-100",
      pill: "bg-emerald-500/20 text-emerald-100",
      icon: CheckCircle2,
    },
  };

  const aiInsights = React.useMemo<AIInsight[]>(() => {
    if (activeTab === "student-roles") {
      if (rolesLoading) {
        return [
          {
            id: "student-loading",
            title: "Building role health model",
            detail: "Analyzing current school role allocations...",
            severity: "attention",
          },
        ];
      }
      if (rolesError) {
        return [
          {
            id: "student-error",
            title: "AI analysis unavailable",
            detail: "Role data could not be loaded. Retry to get recommendations.",
            severity: "critical",
            actionLabel: "Retry",
            onAction: () => globalThis.location.reload(),
          },
        ];
      }

      const roleDefinitions = rolesData?.data || [];
      const roleAssignments = rolesData?.assignments || [];
      const unassignedDefinitions = roleDefinitions.filter(
        (role) => (roleAssignmentCounts.get(role.id) || 0) === 0
      );
      const overCapacityRoles = roleDefinitions
        .map((role) => {
          const assigned = roleAssignmentCounts.get(role.id) || 0;
          return { role, assigned };
        })
        .filter(
          ({ role, assigned }) =>
            typeof role.maxPerSchool === "number" && assigned > role.maxPerSchool
        )
        .sort((a, b) => b.assigned - a.assigned);
      const customRoles = roleDefinitions.filter((role) => role.category === "custom");

      const insights: AIInsight[] = [];

      if (roleAssignments.length === 0) {
        insights.push({
          id: "student-no-assignments",
          title: "No school roles assigned yet",
          detail: "Start by assigning core positions like prefects and council reps.",
          metric: "0 assigned",
          severity: "attention",
          actionLabel: "Assign first role",
          onAction: () => setAssignRoleModalOpen(true),
        });
      }

      if (overCapacityRoles.length > 0) {
        const top = overCapacityRoles[0];
        insights.push({
          id: "student-over-capacity",
          title: "Role cap exceeded",
          detail: `${top.role.name} has ${top.assigned} assignments against a cap of ${top.role.maxPerSchool}.`,
          metric: `${overCapacityRoles.length} over cap`,
          severity: "critical",
          actionLabel: "Review role",
          onAction: () => setSearchQuery(top.role.name),
        });
      }

      if (unassignedDefinitions.length > 0) {
        insights.push({
          id: "student-unused-roles",
          title: "Unutilized role definitions",
          detail: `${unassignedDefinitions.length} defined roles are currently unused.`,
          metric: `${unassignedDefinitions.length} unused`,
          severity: "attention",
          actionLabel: "Focus gap",
          onAction: () => {
            setSelectedCategory(unassignedDefinitions[0].category);
            setSearchQuery(unassignedDefinitions[0].name);
          },
        });
      }

      if (customRoles.length === 0) {
        insights.push({
          id: "student-no-custom",
          title: "No custom school role yet",
          detail: "Create school-specific leadership roles for your school culture.",
          severity: "good",
          actionLabel: "Create custom role",
          onAction: () => setCreateRoleModalOpen(true),
        });
      }

      if (insights.length === 0) {
        insights.push({
          id: "student-balanced",
          title: "School roles look balanced",
          detail: "Definitions are being used and no cap violations were detected.",
          metric: `${roleAssignments.length} active`,
          severity: "good",
        });
      }

      return insights.slice(0, 3);
    }

    if (activeTab === "teacher-duties") {
      if (dutiesLoading) {
        return [
          {
            id: "duty-loading",
            title: "Building duty workload model",
            detail: "Analyzing duty distribution by teacher and category...",
            severity: "attention",
          },
        ];
      }
      if (dutiesError) {
        return [
          {
            id: "duty-error",
            title: "AI analysis unavailable",
            detail: "Duty data could not be loaded. Retry to get recommendations.",
            severity: "critical",
            actionLabel: "Retry",
            onAction: () => globalThis.location.reload(),
          },
        ];
      }

      const dutyDefinitions = dutiesData?.data || [];
      const dutyAssignments = dutiesData?.assignments || [];
      const unassignedDefinitions = dutyDefinitions.filter(
        (duty) => (dutyAssignmentCounts.get(duty.id) || 0) === 0
      );
      const teacherLoad = new Map<string, { name: string; count: number }>();
      dutyAssignments.forEach((assignment) => {
        const teacherId = assignment.teacher?.id;
        if (!teacherId) return;
        const current = teacherLoad.get(teacherId) || {
          name: assignment.teacher?.fullName || "Teacher",
          count: 0,
        };
        current.count += 1;
        teacherLoad.set(teacherId, current);
      });
      const overloadedTeachers = Array.from(teacherLoad.values())
        .filter((entry) => entry.count >= 4)
        .sort((a, b) => b.count - a.count);
      const timeBoundAssignments = dutyAssignments.filter(
        (assignment) => Boolean(assignment.endDate)
      );

      const insights: AIInsight[] = [];

      if (dutyAssignments.length === 0) {
        insights.push({
          id: "duty-no-assignments",
          title: "No duties assigned yet",
          detail: "Start with critical duties such as gate, break, and assembly.",
          metric: "0 assigned",
          severity: "attention",
          actionLabel: "Assign first duty",
          onAction: () => setAssignDutyModalOpen(true),
        });
      }

      if (overloadedTeachers.length > 0) {
        const top = overloadedTeachers[0];
        insights.push({
          id: "duty-overloaded",
          title: "Potential duty overload detected",
          detail: `${top.name} currently has ${top.count} active duty allocations.`,
          metric: `${overloadedTeachers.length} teachers`,
          severity: "critical",
          actionLabel: "Review teacher",
          onAction: () => setSearchQuery(top.name),
        });
      }

      if (unassignedDefinitions.length > 0) {
        insights.push({
          id: "duty-unused-definitions",
          title: "Uncovered duty definitions",
          detail: `${unassignedDefinitions.length} duties are defined but not currently assigned.`,
          metric: `${unassignedDefinitions.length} uncovered`,
          severity: "attention",
          actionLabel: "Focus gap",
          onAction: () => {
            setSelectedCategory(unassignedDefinitions[0].category);
            setSearchQuery(unassignedDefinitions[0].name);
          },
        });
      }

      if (timeBoundAssignments.length > 0) {
        const target =
          timeBoundAssignments[0].teacher?.fullName ||
          timeBoundAssignments[0].duty?.name ||
          "";
        insights.push({
          id: "duty-time-bound",
          title: "Time-bound duties detected",
          detail: `${timeBoundAssignments.length} duty assignment(s) have a defined end date.`,
          metric: "Has end dates",
          severity: "good",
          actionLabel: target ? "Review schedule" : undefined,
          onAction: target ? () => setSearchQuery(target) : undefined,
        });
      }

      if (insights.length === 0) {
        insights.push({
          id: "duty-balanced",
          title: "Duty roster looks healthy",
          detail: "No overload or short-term duty gaps were detected.",
          metric: `${dutyAssignments.length} active`,
          severity: "good",
        });
      }

      return insights.slice(0, 3);
    }

    if (classRolesLoading) {
      return [
        {
          id: "class-loading",
          title: "Building class role model",
          detail: "Analyzing class role definitions and category coverage...",
          severity: "attention",
        },
      ];
    }
    if (classRolesError) {
      return [
        {
          id: "class-error",
          title: "AI analysis unavailable",
          detail: "Class role data could not be loaded. Retry to get recommendations.",
          severity: "critical",
          actionLabel: "Retry",
          onAction: () => globalThis.location.reload(),
        },
      ];
    }

    const roleDefinitions = classRolesData?.data || [];
    const customRoles = roleDefinitions.filter((role) => role.category === "custom");
    const missingCoreCategories = (
      ["leadership", "academic", "service", "social"] as ClassRoleCategory[]
    ).filter((category) => (classRolesData?.grouped?.[category] || []).length === 0);
    const unlimitedRoles = roleDefinitions.filter((role) => role.maxPerClass === null);

    const insights: AIInsight[] = [];

    if (roleDefinitions.length === 0) {
      insights.push({
        id: "class-empty",
        title: "No class role definitions yet",
        detail: "Create baseline roles before assigning them across class pages.",
        metric: "0 roles",
        severity: "attention",
        actionLabel: "Create class role",
        onAction: () => setCreateClassRoleModalOpen(true),
      });
    }

    if (missingCoreCategories.length > 0) {
      insights.push({
        id: "class-missing-core",
        title: "Core class role category missing",
        detail: `${missingCoreCategories.length} core category slot(s) have no role definition.`,
        metric: missingCoreCategories
          .map((category) => getRoleCategoryInfo(category).label)
          .join(", "),
        severity: "critical",
        actionLabel: "Focus category",
        onAction: () => setSelectedCategory(missingCoreCategories[0]),
      });
    }

    if (customRoles.length === 0) {
      insights.push({
        id: "class-no-custom",
        title: "No custom class role",
        detail: "Add school-specific roles for behavior, clubs, or pastoral structure.",
        severity: "attention",
        actionLabel: "Create custom role",
        onAction: () => setCreateClassRoleModalOpen(true),
      });
    }

    if (unlimitedRoles.length > 0) {
      insights.push({
        id: "class-unlimited",
        title: "Unlimited roles detected",
        detail: `${unlimitedRoles.length} role definition(s) have no per-class limit.`,
        metric: `${unlimitedRoles.length} unlimited`,
        severity: "good",
      });
    }

    if (insights.length === 0) {
      insights.push({
        id: "class-balanced",
        title: "Class role setup looks complete",
        detail: "Core categories are covered and ready for class-level assignment.",
        metric: `${roleDefinitions.length} roles`,
        severity: "good",
      });
    }

    return insights.slice(0, 3);
  }, [
    activeTab,
    classRolesData?.data,
    classRolesData?.grouped,
    classRolesError,
    classRolesLoading,
    dutiesData?.assignments,
    dutiesData?.data,
    dutiesError,
    dutiesLoading,
    roleAssignmentCounts,
    dutyAssignmentCounts,
    rolesData?.assignments,
    rolesData?.data,
    rolesError,
    rolesLoading,
  ]);

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="w-full px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white sm:text-3xl">
            Roles & Duties Management
          </h1>
          <p className="mt-1 text-sm text-white/60">
            Manage school-wide student roles and teacher duty assignments
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="mb-6 flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-1.5 overflow-x-auto">
          <button
            onClick={() => setActiveTab("student-roles")}
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all whitespace-nowrap",
              activeTab === "student-roles"
                ? "bg-brand text-black shadow-lg shadow-brand/20"
                : "text-white/60 hover:bg-white/5 hover:text-white"
            )}
          >
            <Crown className="h-4 w-4" />
            School Roles
          </button>
          <button
            onClick={() => setActiveTab("class-roles")}
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all whitespace-nowrap",
              activeTab === "class-roles"
                ? "bg-brand text-black shadow-lg shadow-brand/20"
                : "text-white/60 hover:bg-white/5 hover:text-white"
            )}
          >
            <BookOpen className="h-4 w-4" />
            Class Roles & Duties
          </button>
          <button
            onClick={() => setActiveTab("teacher-duties")}
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all whitespace-nowrap",
              activeTab === "teacher-duties"
                ? "bg-brand text-black shadow-lg shadow-brand/20"
                : "text-white/60 hover:bg-white/5 hover:text-white"
            )}
          >
            <Clock className="h-4 w-4" />
            Teacher Duties
          </button>
        </div>

        {/* Search & Actions Bar */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <input
              type="text"
              placeholder={getSearchPlaceholder()}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/5 py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-white/40 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            />
          </div>
          <div className="flex items-center gap-2">
            {activeTab === "student-roles" && (
              <>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      className="gap-2 border-white/10 bg-white/5 text-white hover:bg-white/10"
                    >
                      <Settings className="h-4 w-4" />
                      Manage
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="border border-white/10 bg-slate-900/95 text-slate-50 backdrop-blur-xl"
                  >
                    <DropdownMenuItem
                      onClick={() => setCreateRoleModalOpen(true)}
                      className="cursor-pointer gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      Create New Role
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  onClick={() => setAssignRoleModalOpen(true)}
                  className="group gap-2 bg-brand text-black shadow-lg shadow-brand/20 hover:opacity-90"
                >
                  <Plus className="h-4 w-4 transition-transform group-hover:rotate-90" />
                  Assign Role
                </Button>
              </>
            )}
            {activeTab === "class-roles" && (
              <>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      className="gap-2 border-white/10 bg-white/5 text-white hover:bg-white/10"
                    >
                      <Settings className="h-4 w-4" />
                      Manage
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="border border-white/10 bg-slate-900/95 text-slate-50 backdrop-blur-xl"
                  >
                    <DropdownMenuItem
                      onClick={() => setCreateClassRoleModalOpen(true)}
                      className="cursor-pointer gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      Create Custom Class Role
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <p className="text-sm text-white/50">
                  Assignments are handled inside each class page.
                </p>
              </>
            )}
            {activeTab === "teacher-duties" && (
              <>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      className="gap-2 border-white/10 bg-white/5 text-white hover:bg-white/10"
                    >
                      <Settings className="h-4 w-4" />
                      Manage
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="border border-white/10 bg-slate-900/95 text-slate-50 backdrop-blur-xl"
                  >
                    <DropdownMenuItem
                      onClick={() => setCreateDutyModalOpen(true)}
                      className="cursor-pointer gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      Create New Duty
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  onClick={() => setAssignDutyModalOpen(true)}
                  className="group gap-2 bg-brand text-black shadow-lg shadow-brand/20 hover:opacity-90"
                >
                  <Plus className="h-4 w-4 transition-transform group-hover:rotate-90" />
                  Assign Duty
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Health Check (rule-based, no AI cost) */}
        <div className="mb-6 overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="rounded-lg border border-white/15 bg-white/10 p-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              </span>
              <div>
                <p className="text-sm font-semibold text-white">Health Check</p>
                <p className="text-xs text-white/60">
                  Quick status based on current {activeTab.replace("-", " ")} data
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAIInsights((prev) => !prev)}
              className="border-white/15 bg-white/5 text-white hover:bg-white/10"
            >
              {showAIInsights ? "Hide" : "Show"}
            </Button>
          </div>

          {showAIInsights && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {aiInsights.map((insight) => {
                const tone = activeInsightTone[insight.severity];
                const Icon = tone.icon;
                return (
                  <div
                    key={insight.id}
                    className={cn(
                      "rounded-xl border p-3.5",
                      tone.border,
                      tone.bg
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5">
                        <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", tone.text)} />
                        <div>
                          <p className={cn("text-sm font-semibold", tone.text)}>
                            {insight.title}
                          </p>
                          <p className="mt-1 text-xs leading-relaxed text-white/75">
                            {insight.detail}
                          </p>
                        </div>
                      </div>
                      {insight.metric && (
                        <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium", tone.pill)}>
                          {insight.metric}
                        </span>
                      )}
                    </div>

                    {insight.onAction && insight.actionLabel && (
                      <button
                        onClick={insight.onAction}
                        className={cn(
                          "mt-3 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all",
                          tone.text,
                          "border border-white/15 bg-white/10 hover:bg-white/15"
                        )}
                      >
                        {insight.actionLabel}
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Leo AI Insights (on-demand, uses OpenAI) */}
        <div className="mb-6 overflow-hidden rounded-2xl border border-purple-500/20 bg-linear-to-r from-purple-500/10 via-indigo-500/5 to-transparent p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="rounded-lg border border-purple-400/30 bg-purple-500/20 p-1.5">
                <LeoIcon className="h-4 w-4 text-purple-200" />
              </span>
              <div>
                <p className="text-sm font-semibold text-white">Leo Insights & Recommendations</p>
                <p className="text-xs text-white/60">
                  AI-powered analysis for {activeTab.replace("-", " ")} — generate on demand
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4">
            {cachedLeoLoading && !leoInsights ? (
              <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-purple-400/30 bg-purple-500/5 px-6 py-8">
                <Loader2 className="h-5 w-5 animate-spin text-purple-400" />
                <span className="text-sm text-white/60">Loading saved insights...</span>
              </div>
            ) : leoAI.isError && !leoInsights ? (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-6 text-center">
                <p className="text-sm text-red-200 mb-2">
                  Leo couldn&apos;t generate insights
                </p>
                <p className="text-xs text-red-200/70 mb-4">{leoAI.error?.message}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => leoAI.mutate()}
                  disabled={leoAI.isPending}
                  className="gap-2 border-red-500/30 text-red-200 hover:bg-red-500/20"
                >
                  {leoAI.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : null}
                  Retry
                </Button>
              </div>
            ) : !leoInsights ? (
              <div className="rounded-xl border border-dashed border-purple-400/30 bg-purple-500/5 px-6 py-8 text-center">
                <div className="flex justify-center mb-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-purple-500/30 bg-purple-500/20">
                    <LeoIcon className="h-6 w-6 text-purple-300" />
                  </div>
                </div>
                <p className="text-sm text-white/70 mb-4">
                  Get AI-powered insights and recommendations for your {activeTab.replace("-", " ")} setup.
                </p>
                <Button
                  onClick={() => leoAI.mutate()}
                  disabled={leoAI.isPending}
                  className="gap-2 rounded-xl bg-purple-600 hover:bg-purple-700"
                >
                  {leoAI.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <LeoIcon className="h-4 w-4" />
                  )}
                  Generate with Leo
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {(leoGeneratedAt || leoIsStale) && (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-purple-400/20 bg-purple-500/10 px-3 py-2">
                    <span className="flex items-center gap-1.5 text-xs text-white/60">
                      <Clock className="h-3.5 w-3.5" />
                      Generated {formatRelativeTime(leoGeneratedAt)}
                    </span>
                    {leoIsStale && (
                      <span className="text-[10px] text-amber-400">
                        Data may have changed
                      </span>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => leoAI.mutate()}
                      disabled={leoAI.isPending}
                      className="h-7 gap-1 text-xs text-purple-200 hover:bg-purple-500/20"
                    >
                      {leoAI.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3.5 w-3.5" />
                      )}
                      Regenerate
                    </Button>
                  </div>
                )}
                <p className="text-sm text-white/90 leading-relaxed">{leoInsights.summary}</p>
                {leoInsights.insights.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-white/80 uppercase tracking-wide mb-2">
                      Insights
                    </h4>
                    <ul className="space-y-1.5">
                      {leoInsights.insights.map((insight, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-white/80">
                          <span className="text-purple-400 mt-0.5">•</span>
                          <span>{insight}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {leoInsights.recommendedActions.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-white/80 uppercase tracking-wide mb-2">
                      Recommended Actions
                    </h4>
                    <ul className="space-y-1.5">
                      {leoInsights.recommendedActions.map((action, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-white/80">
                          <ArrowRight className="h-3.5 w-3.5 text-purple-400 shrink-0 mt-0.5" />
                          <span>{action}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <AnimatePresence mode="wait">
          {activeTab === "student-roles" ? (
            <motion.div
              key="student-roles"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {/* Role Categories Quick View */}
              <div className="relative">
                <div
                  ref={roleCategoryScrollRef}
                  onScroll={updateRoleCategoryOverflowHints}
                  className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                >
                  {roleCategories.map((cat) => {
                    const Icon = cat.icon;
                    const count =
                      rolesData?.grouped?.[cat.key as keyof typeof rolesData.grouped]?.length || 0;
                    const assignmentCount = (rolesData?.assignments || []).filter(
                      (a) => a.role?.category === cat.key
                    ).length;
                    return (
                      <button
                        key={cat.key}
                        onClick={() =>
                          setSelectedCategory(selectedCategory === cat.key ? null : cat.key)
                        }
                        className={cn(
                          "group flex min-w-[140px] shrink-0 flex-1 flex-col items-center gap-2 rounded-xl border p-4 transition-all",
                          selectedCategory === cat.key
                            ? "border-brand/50 bg-brand/10"
                            : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10"
                        )}
                      >
                        <Icon className={cn("h-6 w-6", cat.color)} />
                        <span className="text-xs font-medium text-white">{cat.label}</span>
                        <span className="text-xs text-white/50">
                          {assignmentCount} assigned
                        </span>
                        <span className="text-[10px] text-white/40">
                          {count} role{count === 1 ? "" : "s"}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {showRoleCategoryLeftHint && (
                  <div className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-slate-950/95 via-slate-950/80 to-transparent" />
                )}
                {showRoleCategoryRightHint && (
                  <div className="pointer-events-none absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-slate-950/95 via-slate-950/80 to-transparent" />
                )}
                {showRoleCategoryRightHint && (
                  <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded-full border border-white/15 bg-black/40 px-2 py-0.5 text-[10px] font-medium text-white/70 backdrop-blur">
                    More
                  </div>
                )}
              </div>

              {/* Current Assignments */}
              <div className="rounded-xl border border-white/10 bg-white/5 p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-white">
                    Current Role Assignments
                  </h2>
                  {rolesData?.currentPeriod && (
                    <span className="rounded-full bg-brand/20 px-3 py-1 text-xs font-medium text-brand">
                      {rolesData.currentPeriod.yearLabel} - {rolesData.currentPeriod.term}
                    </span>
                  )}
                </div>

                {rolesLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-brand" />
                  </div>
                ) : rolesError ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <WifiOff className="h-10 w-10 text-rose-400/70" />
                    <p className="mt-3 text-sm font-medium text-rose-300">
                      Connection Error
                    </p>
                    <p className="mt-1 max-w-sm text-xs text-white/50">
                      {getErrorMessage(rolesErrorData)}
                    </p>
                    <Button
                      onClick={() => globalThis.location.reload()}
                      variant="outline"
                      className="mt-4 gap-2 border-white/10 text-white hover:bg-white/10"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Retry
                    </Button>
                  </div>
                ) : filteredRoleAssignments.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <AlertCircle className="h-10 w-10 text-white/30" />
                    <p className="mt-3 text-sm text-white/50">
                      No role assignments found
                    </p>
                    <Button
                      onClick={() => setAssignRoleModalOpen(true)}
                      variant="outline"
                      className="mt-4 gap-2 border-white/10 text-white hover:bg-white/10"
                    >
                      <Plus className="h-4 w-4" />
                      Assign First Role
                    </Button>
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {filteredRoleAssignments
                      .filter(
                        (a) => !selectedCategory || a.role?.category === selectedCategory
                      )
                      .map((assignment) => (
                        <RoleAssignmentCard
                          key={assignment.id}
                          assignment={assignment}
                          onRemove={() => handleRemoveRole(assignment.id)}
                          isRemoving={removeRoleMutation.isPending}
                          getInitials={getInitials}
                        />
                      ))}
                  </div>
                )}
              </div>

              {/* Available Roles */}
              <div className="rounded-xl border border-white/10 bg-white/5 p-5">
                <h2 className="mb-4 text-lg font-semibold text-white">
                  Available Roles
                </h2>
                {rolesError ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <WifiOff className="h-8 w-8 text-rose-400/70" />
                    <p className="mt-2 text-sm text-rose-300">Unable to load roles</p>
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {(rolesData?.data || [])
                      .filter((r) => !selectedCategory || r.category === selectedCategory)
                      .map((role) => (
                        <RoleDefinitionCard
                          key={role.id}
                          role={role}
                          assignmentCount={
                            (rolesData?.assignments || []).filter(
                              (a) => a.role?.id === role.id
                            ).length
                          }
                          onAssign={() => {
                            setSelectedRole(role);
                            setAssignRoleModalOpen(true);
                          }}
                        />
                      ))}
                  </div>
                )}
              </div>
            </motion.div>
          ) : activeTab === "teacher-duties" ? (
            <motion.div
              key="teacher-duties"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {/* Duty Categories Quick View */}
              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {dutyCategories.map((cat) => {
                  const Icon = cat.icon;
                  const assignmentCount = (dutiesData?.assignments || []).filter(
                    (a) => a.duty?.category === cat.key
                  ).length;
                  return (
                    <button
                      key={cat.key}
                      onClick={() =>
                        setSelectedCategory(selectedCategory === cat.key ? null : cat.key)
                      }
                      className={cn(
                        "group flex flex-col items-center gap-2 rounded-xl border p-4 transition-all",
                        selectedCategory === cat.key
                          ? "border-brand/50 bg-brand/10"
                          : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10"
                      )}
                    >
                      <Icon className={cn("h-6 w-6", cat.color)} />
                      <span className="text-xs font-medium text-white">{cat.label}</span>
                      <span className="text-xs text-white/50">
                        {assignmentCount} assigned
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Current Duty Assignments */}
              <div className="rounded-xl border border-white/10 bg-white/5 p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-white">
                    Current Duty Roster
                  </h2>
                  {dutiesData?.currentPeriod && (
                    <span className="rounded-full bg-brand/20 px-3 py-1 text-xs font-medium text-brand">
                      {dutiesData.currentPeriod.yearLabel} - {dutiesData.currentPeriod.term}
                    </span>
                  )}
                </div>

                {dutiesLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-brand" />
                  </div>
                ) : dutiesError ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <WifiOff className="h-10 w-10 text-rose-400/70" />
                    <p className="mt-3 text-sm font-medium text-rose-300">
                      Connection Error
                    </p>
                    <p className="mt-1 max-w-sm text-xs text-white/50">
                      {getErrorMessage(dutiesErrorData)}
                    </p>
                    <Button
                      onClick={() => globalThis.location.reload()}
                      variant="outline"
                      className="mt-4 gap-2 border-white/10 text-white hover:bg-white/10"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Retry
                    </Button>
                  </div>
                ) : filteredDutyAssignments.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <AlertCircle className="h-10 w-10 text-white/30" />
                    <p className="mt-3 text-sm text-white/50">
                      No duty assignments found
                    </p>
                    <Button
                      onClick={() => setAssignDutyModalOpen(true)}
                      variant="outline"
                      className="mt-4 gap-2 border-white/10 text-white hover:bg-white/10"
                    >
                      <Plus className="h-4 w-4" />
                      Assign First Duty
                    </Button>
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {filteredDutyAssignments
                      .filter(
                        (a) => !selectedCategory || a.duty?.category === selectedCategory
                      )
                      .map((assignment) => (
                        <DutyAssignmentCard
                          key={assignment.id}
                          assignment={assignment}
                          onRemove={() => handleRemoveDuty(assignment.id)}
                          isRemoving={removeDutyMutation.isPending}
                          getInitials={getInitials}
                        />
                      ))}
                  </div>
                )}
              </div>

              {/* Available Duties */}
              <div className="rounded-xl border border-white/10 bg-white/5 p-5">
                <h2 className="mb-4 text-lg font-semibold text-white">
                  Available Duties
                </h2>
                {dutiesError ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <WifiOff className="h-8 w-8 text-rose-400/70" />
                    <p className="mt-2 text-sm text-rose-300">Unable to load duties</p>
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {(dutiesData?.data || [])
                      .filter((d) => !selectedCategory || d.category === selectedCategory)
                      .map((duty) => (
                        <DutyDefinitionCard
                          key={duty.id}
                          duty={duty}
                          assignmentCount={
                            (dutiesData?.assignments || []).filter(
                              (a) => a.duty?.id === duty.id
                            ).length
                          }
                          onAssign={() => {
                            setSelectedDuty(duty);
                            setAssignDutyModalOpen(true);
                          }}
                        />
                      ))}
                  </div>
                )}
              </div>
            </motion.div>
          ) : null}

          {/* Class Roles Tab */}
          {activeTab === "class-roles" && (
            <motion.div
              key="class-roles"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              {/* Class Role Categories */}
              <div className="relative">
                <div
                  ref={classRoleCategoryScrollRef}
                  onScroll={updateClassRoleCategoryOverflowHints}
                  className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                >
                  {(["leadership", "academic", "service", "social", "custom"] as ClassRoleCategory[]).map((cat) => {
                    const info = getRoleCategoryInfo(cat);
                    const count = classRolesData?.grouped?.[cat]?.length || 0;
                    return (
                      <button
                        key={cat}
                        onClick={() =>
                          setSelectedCategory(selectedCategory === cat ? null : cat)
                        }
                        className={cn(
                          "group flex min-w-[140px] shrink-0 flex-1 flex-col items-center gap-2 rounded-xl border p-4 transition-all",
                          selectedCategory === cat
                            ? "border-brand/50 bg-brand/10"
                            : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10"
                        )}
                      >
                        <span className={cn("text-sm font-medium", info.color)}>
                          {info.label}
                        </span>
                        <span className="text-xs text-white/50">
                          {count} role{count !== 1 ? "s" : ""}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {showClassRoleCategoryLeftHint && (
                  <div className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-slate-950/95 via-slate-950/80 to-transparent" />
                )}
                {showClassRoleCategoryRightHint && (
                  <div className="pointer-events-none absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-slate-950/95 via-slate-950/80 to-transparent" />
                )}
                {showClassRoleCategoryRightHint && (
                  <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded-full border border-white/15 bg-black/40 px-2 py-0.5 text-[10px] font-medium text-white/70 backdrop-blur">
                    More
                  </div>
                )}
              </div>

              {/* Class Role Definitions */}
              <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-white">
                      Class Role Definitions
                    </h2>
                    <p className="text-xs text-white/50">
                      These roles can be assigned to students within each class
                    </p>
                  </div>
                  <Button
                    onClick={() => setCreateClassRoleModalOpen(true)}
                    variant="outline"
                    size="sm"
                    className="gap-2 border-white/10 bg-white/5 text-white hover:bg-white/10"
                  >
                    <Plus className="h-4 w-4" />
                    Create Custom Role
                  </Button>
                </div>

                {classRolesLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-brand" />
                  </div>
                ) : classRolesError ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <WifiOff className="h-10 w-10 text-rose-400/70" />
                    <p className="mt-3 text-sm font-medium text-rose-300">
                      Connection Error
                    </p>
                    <p className="mt-1 max-w-sm text-xs text-white/50">
                      {getErrorMessage(classRolesErrorData)}
                    </p>
                    <Button
                      onClick={() => globalThis.location.reload()}
                      variant="outline"
                      className="mt-4 gap-2 border-white/10 text-white hover:bg-white/10"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Retry
                    </Button>
                  </div>
                ) : (classRolesData?.data || []).length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <AlertCircle className="h-10 w-10 text-white/30" />
                    <p className="mt-3 text-sm text-white/50">
                      No class roles defined yet
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {(classRolesData?.data || [])
                      .filter((r) => !selectedCategory || r.category === selectedCategory)
                      .filter((r) => {
                        if (!searchQuery) return true;
                        return r.name.toLowerCase().includes(searchQuery.toLowerCase());
                      })
                      .map((role) => {
                        const info = getRoleCategoryInfo(role.category);
                        return (
                          <div
                            key={role.id}
                            className={cn(
                              "rounded-xl border p-4 transition-all",
                              info.borderColor,
                              info.bgColor
                            )}
                          >
                            <div className="flex items-start justify-between">
                              <div>
                                <p className={cn("text-sm font-medium", info.color)}>
                                  {role.name}
                                </p>
                                <p className="mt-0.5 text-xs capitalize text-white/50">
                                  {info.label}
                                </p>
                              </div>
                              {role.isDefault && (
                                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium text-white/60">
                                  Default
                                </span>
                              )}
                            </div>
                            {role.description && (
                              <p className="mt-2 line-clamp-2 text-xs text-white/40">
                                {role.description}
                              </p>
                            )}
                            <div className="mt-3 text-xs text-white/50">
                              {role.maxPerClass
                                ? `Max ${role.maxPerClass} per class`
                                : "Unlimited per class"}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>

              {/* Info Box */}
              <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-4">
                <div className="flex gap-3">
                  <BookOpen className="h-5 w-5 shrink-0 text-blue-400" />
                  <div>
                    <p className="text-sm font-medium text-blue-300">
                      Managing Class Roles
                    </p>
                    <p className="mt-1 text-xs text-blue-300/70">
                      Class roles are assigned to students on a per-class basis. To assign
                      a role to a student, navigate to the specific class page and use the
                      &quot;Roles&quot; tab. This allows each class to have their own Class Captain,
                      Subject Representatives, and other leadership positions.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Modals */}
      {/* Assignment Modals */}
      <AssignSchoolRoleModal
        open={assignRoleModalOpen}
        onOpenChange={setAssignRoleModalOpen}
        preselectedRole={selectedRole}
        roles={rolesData?.data || []}
      />

      <AssignTeacherDutyModal
        open={assignDutyModalOpen}
        onOpenChange={setAssignDutyModalOpen}
        preselectedDuty={selectedDuty}
        duties={dutiesData?.data || []}
      />

      {/* Create Definition Modals */}
      <CreateSchoolRoleModal
        open={createRoleModalOpen}
        onOpenChange={setCreateRoleModalOpen}
      />

      <CreateClassRoleModal
        open={createClassRoleModalOpen}
        onOpenChange={setCreateClassRoleModalOpen}
      />

      <CreateDutyModal
        open={createDutyModalOpen}
        onOpenChange={setCreateDutyModalOpen}
      />
    </div>
  );
}

// Role Assignment Card Component
function RoleAssignmentCard({
  assignment,
  onRemove,
  isRemoving,
  getInitials,
}: {
  assignment: SchoolRoleAssignmentDTO;
  onRemove: () => void;
  isRemoving: boolean;
  getInitials: (firstName: string, lastName: string) => string;
}) {
  return (
    <div
      className="group relative rounded-xl border border-white/10 bg-white/5 p-4 transition-all hover:border-white/20"
      style={{
        borderLeftColor: assignment.role?.badgeColor || undefined,
        borderLeftWidth: assignment.role?.badgeColor ? "3px" : undefined,
      }}
    >
      <button
        onClick={onRemove}
        disabled={isRemoving}
        className="absolute right-2 top-2 rounded-lg p-1.5 text-white/30 opacity-0 transition-all hover:bg-white/10 hover:text-rose-400 group-hover:opacity-100"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex items-start gap-3">
        <Avatar className="h-10 w-10 border-2 border-white/20">
          <AvatarImage
            src={assignment.student?.photoUrl || ""}
            alt={assignment.student?.fullName || ""}
          />
          <AvatarFallback className="bg-linear-to-br from-brand to-brand/60 text-sm font-semibold text-black">
            {getInitials(
              assignment.student?.firstName || "",
              assignment.student?.lastName || ""
            )}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="truncate text-sm font-medium text-white">
            {assignment.student?.fullName}
          </p>
          <p className="truncate text-xs text-white/50">
            {assignment.student?.className}
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
          style={{
            backgroundColor: `${assignment.role?.badgeColor}20`,
            color: assignment.role?.badgeColor || "#fff",
          }}
        >
          <Crown className="h-3 w-3" />
          {assignment.role?.name}
        </span>
      </div>
    </div>
  );
}

// Role Definition Card Component
function RoleDefinitionCard({
  role,
  assignmentCount,
  onAssign,
}: {
  role: SchoolRoleDefinitionDTO;
  assignmentCount: number;
  onAssign: () => void;
}) {
  const isFull = role.maxPerSchool && assignmentCount >= role.maxPerSchool;

  return (
    <div
      className="group rounded-xl border border-white/10 bg-white/5 p-4 transition-all hover:border-white/20"
      style={{
        borderLeftColor: role.badgeColor || undefined,
        borderLeftWidth: role.badgeColor ? "3px" : undefined,
      }}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-white">{role.name}</p>
          <p className="mt-0.5 text-xs capitalize text-white/50">{role.category}</p>
        </div>
        {role.badgeColor && (
          <div
            className="h-4 w-4 rounded-full"
            style={{ backgroundColor: role.badgeColor }}
          />
        )}
      </div>

      {role.description && (
        <p className="mt-2 line-clamp-2 text-xs text-white/40">{role.description}</p>
      )}

      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs text-white/50">
          {assignmentCount}
          {role.maxPerSchool ? ` / ${role.maxPerSchool}` : ""} assigned
        </span>
        <Button
          size="sm"
          variant="ghost"
          onClick={onAssign}
          disabled={!!isFull}
          className="h-7 gap-1 text-xs text-brand hover:bg-brand/10 hover:text-brand disabled:opacity-50"
        >
          <Plus className="h-3 w-3" />
          Assign
        </Button>
      </div>
    </div>
  );
}

// Duty Assignment Card Component
function DutyAssignmentCard({
  assignment,
  onRemove,
  isRemoving,
  getInitials,
}: {
  assignment: DutyAssignmentDTO;
  onRemove: () => void;
  isRemoving: boolean;
  getInitials: (firstName: string, lastName: string) => string;
}) {
  return (
    <div
      className="group relative rounded-xl border border-white/10 bg-white/5 p-4 transition-all hover:border-white/20"
      style={{
        borderLeftColor: assignment.duty?.color || undefined,
        borderLeftWidth: assignment.duty?.color ? "3px" : undefined,
      }}
    >
      <button
        onClick={onRemove}
        disabled={isRemoving}
        className="absolute right-2 top-2 rounded-lg p-1.5 text-white/30 opacity-0 transition-all hover:bg-white/10 hover:text-rose-400 group-hover:opacity-100"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex items-start gap-3">
        <Avatar className="h-10 w-10 border-2 border-white/20">
          <AvatarImage
            src={assignment.teacher?.photoUrl || ""}
            alt={assignment.teacher?.fullName || ""}
          />
          <AvatarFallback className="bg-linear-to-br from-indigo-500 to-purple-600 text-sm font-semibold text-white">
            {getInitials(
              assignment.teacher?.firstName || "",
              assignment.teacher?.lastName || ""
            )}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="truncate text-sm font-medium text-white">
            {assignment.teacher?.fullName}
          </p>
          <p className="truncate text-xs text-white/50">
            {assignment.duty?.name}
          </p>
        </div>
      </div>

      <div className="mt-3 space-y-1.5">
        <div className="flex items-center gap-2 text-xs text-white/60">
          <Calendar className="h-3.5 w-3.5" />
          {formatDays(assignment.days)}
        </div>
        <div className="flex items-center gap-2 text-xs text-white/60">
          <Clock className="h-3.5 w-3.5" />
          {assignment.startTime} - {assignment.endTime}
        </div>
        {assignment.duty?.location && (
          <div className="flex items-center gap-2 text-xs text-white/60">
            <MapPin className="h-3.5 w-3.5" />
            {assignment.duty.location}
          </div>
        )}
      </div>
    </div>
  );
}

// Duty Definition Card Component
function DutyDefinitionCard({
  duty,
  assignmentCount,
  onAssign,
}: {
  duty: DutyDefinitionDTO;
  assignmentCount: number;
  onAssign: () => void;
}) {
  return (
    <div
      className="group rounded-xl border border-white/10 bg-white/5 p-4 transition-all hover:border-white/20"
      style={{
        borderLeftColor: duty.color || undefined,
        borderLeftWidth: duty.color ? "3px" : undefined,
      }}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-white">{duty.name}</p>
          <p className="mt-0.5 text-xs capitalize text-white/50">{duty.category}</p>
        </div>
        {duty.color && (
          <div
            className="h-4 w-4 rounded-full"
            style={{ backgroundColor: duty.color }}
          />
        )}
      </div>

      {duty.description && (
        <p className="mt-2 line-clamp-2 text-xs text-white/40">{duty.description}</p>
      )}

      <div className="mt-3 space-y-1">
        {duty.defaultDays && duty.defaultDays.length > 0 && (
          <p className="text-xs text-white/50">
            {formatDays(duty.defaultDays)}
          </p>
        )}
        {duty.defaultStartTime && duty.defaultEndTime && (
          <p className="text-xs text-white/50">
            {duty.defaultStartTime} - {duty.defaultEndTime}
          </p>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs text-white/50">
          {assignmentCount} / {duty.minTeachersRequired}+ assigned
        </span>
        <Button
          size="sm"
          variant="ghost"
          onClick={onAssign}
          className="h-7 gap-1 text-xs text-brand hover:bg-brand/10 hover:text-brand"
        >
          <Plus className="h-3 w-3" />
          Assign
        </Button>
      </div>
    </div>
  );
}

export default function RolesDutiesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-slate-950 via-slate-900 to-slate-950">
          <Loader2 className="h-10 w-10 animate-spin text-brand" />
        </div>
      }
    >
      <RolesDutiesContent />
    </Suspense>
  );
}
