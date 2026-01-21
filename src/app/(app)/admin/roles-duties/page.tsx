"use client";

import React, { useState, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Crown,
  Users,
  Shield,
  Clock,
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

type ActiveTab = "student-roles" | "teacher-duties" | "class-roles";

function RolesDutiesContent() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("student-roles");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [assignRoleModalOpen, setAssignRoleModalOpen] = useState(false);
  const [assignDutyModalOpen, setAssignDutyModalOpen] = useState(false);
  const [createRoleModalOpen, setCreateRoleModalOpen] = useState(false);
  const [createDutyModalOpen, setCreateDutyModalOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<SchoolRoleDefinitionDTO | null>(null);
  const [selectedDuty, setSelectedDuty] = useState<DutyDefinitionDTO | null>(null);

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
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
            Class Roles
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
                  className="gap-2 bg-brand text-black shadow-lg shadow-brand/20 hover:opacity-90"
                >
                  <Plus className="h-4 w-4" />
                  Assign Role
                </Button>
              </>
            )}
            {activeTab === "class-roles" && (
              <p className="text-sm text-white/50">
                Class roles are managed per class. Visit a class to assign roles.
              </p>
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
                  className="gap-2 bg-brand text-black shadow-lg shadow-brand/20 hover:opacity-90"
                >
                  <Plus className="h-4 w-4" />
                  Assign Duty
                </Button>
              </>
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
              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
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
          ) : (
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
          )}

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
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
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
                        "group flex flex-col items-center gap-2 rounded-xl border p-4 transition-all",
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

              {/* Class Role Definitions */}
              <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-white">
                    Class Role Definitions
                  </h2>
                  <p className="text-xs text-white/50">
                    These roles can be assigned to students within each class
                  </p>
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
          <AvatarFallback className="bg-gradient-to-br from-brand to-brand/60 text-sm font-semibold text-black">
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
          <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-600 text-sm font-semibold text-white">
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
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
          <Loader2 className="h-10 w-10 animate-spin text-brand" />
        </div>
      }
    >
      <RolesDutiesContent />
    </Suspense>
  );
}
