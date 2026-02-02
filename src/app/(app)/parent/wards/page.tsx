// src/app/(app)/parent/wards/page.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Users,
  ChevronRight,
  ArrowLeft,
  Search,
  AlertCircle,
  CheckCircle2,
  Clock,
  GraduationCap,
  ClipboardCheck,
  DollarSign,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useParentDashboard, FeeStatus } from "@/hooks/parent/useParentDashboard";
import { cn } from "@/lib/utils";

function FeeStatusBadge({ status }: { status: FeeStatus }) {
  const config: Record<FeeStatus, { icon: React.ElementType; label: string; className: string }> = {
    clear: {
      icon: CheckCircle2,
      label: "Fees Clear",
      className: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    },
    partial: {
      icon: Clock,
      label: "Partial",
      className: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    },
    owing: {
      icon: AlertCircle,
      label: "Owing",
      className: "bg-rose-500/20 text-rose-300 border-rose-500/30",
    },
  };

  const { icon: StatusIcon, label, className } = config[status];

  return (
    <Badge variant="outline" className={cn("gap-1", className)}>
      <StatusIcon className="h-3 w-3" />
      {label}
    </Badge>
  );
}

function WardCard({
  ward,
  onClick,
}: {
  ward: {
    id: string;
    name: string;
    firstName: string;
    lastName: string;
    photoUrl: string | null;
    classGroup: string;
    admissionNo: string | null;
    relationship: string;
    feeStatus: FeeStatus;
    outstandingAmount: number;
    isPrimary: boolean;
  };
  onClick?: () => void;
}) {
  const initials = `${ward.firstName?.[0] || ""}${ward.lastName?.[0] || ""}`.toUpperCase();

  return (
    <button
      onClick={onClick}
      className="group relative flex w-full flex-col rounded-xl border border-white/10 bg-gradient-to-br from-white/5 to-transparent p-5 text-left transition-all duration-200 hover:border-white/20 hover:shadow-lg hover:scale-[1.01]"
    >
      {/* Header */}
      <div className="flex items-start gap-4 mb-4">
        {/* Avatar */}
        <div className="relative h-14 w-14 shrink-0">
          {ward.photoUrl ? (
            <img
              src={ward.photoUrl}
              alt={ward.name}
              className="h-14 w-14 rounded-full object-cover border-2 border-white/10"
            />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand/20 text-brand font-semibold text-xl border-2 border-brand/30">
              {initials}
            </div>
          )}
          {ward.isPrimary && (
            <div className="absolute -bottom-0.5 -right-0.5 h-5 w-5 rounded-full bg-brand flex items-center justify-center">
              <CheckCircle2 className="h-3.5 w-3.5 text-white" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-lg text-white truncate">{ward.name}</h3>
            <span className="text-xs text-white/40">({ward.relationship})</span>
          </div>
          <p className="text-sm text-white/60">{ward.classGroup || "No class assigned"}</p>
          {ward.admissionNo && (
            <p className="text-xs text-white/40 mt-1">Adm. No: {ward.admissionNo}</p>
          )}
        </div>

        <ChevronRight className="h-5 w-5 text-white/40 transition-transform group-hover:translate-x-0.5" />
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-3 pt-4 border-t border-white/10">
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 text-purple-300 mb-1">
            <GraduationCap className="h-4 w-4" />
          </div>
          <p className="text-xs text-white/60">Academics</p>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 text-blue-300 mb-1">
            <ClipboardCheck className="h-4 w-4" />
          </div>
          <p className="text-xs text-white/60">Attendance</p>
        </div>
        <div className="text-center">
          <FeeStatusBadge status={ward.feeStatus} />
          {ward.outstandingAmount > 0 && (
            <p className="text-xs text-rose-300 mt-1">
              GH₵ {ward.outstandingAmount.toLocaleString()}
            </p>
          )}
        </div>
      </div>
    </button>
  );
}

function WardCardSkeleton() {
  return (
    <div className="flex flex-col rounded-xl border border-white/10 bg-gradient-to-br from-white/5 to-transparent p-5">
      <div className="flex items-start gap-4 mb-4">
        <Skeleton className="h-14 w-14 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3 pt-4 border-t border-white/10">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    </div>
  );
}

export default function ParentWardsPage() {
  const router = useRouter();
  const { data, isLoading, error } = useParentDashboard();
  const [searchQuery, setSearchQuery] = React.useState("");

  const { wards = [] } = data || {};

  // Filter wards by search query
  const filteredWards = React.useMemo(() => {
    if (!searchQuery.trim()) return wards;
    const query = searchQuery.toLowerCase();
    return wards.filter(
      (ward) =>
        ward.name.toLowerCase().includes(query) ||
        ward.classGroup?.toLowerCase().includes(query) ||
        ward.admissionNo?.toLowerCase().includes(query)
    );
  }, [wards, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
            className="shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">My Children</h1>
            <p className="text-muted-foreground">
              View and manage your wards&apos; information
            </p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
        <Input
          type="search"
          placeholder="Search by name, class, or admission number..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 bg-white/5 border-white/10"
        />
      </div>

      {/* Error State */}
      {error && (
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-rose-300">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            <span>Failed to load wards. Please try again.</span>
          </div>
        </div>
      )}

      {/* Wards Grid */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <WardCardSkeleton />
          <WardCardSkeleton />
          <WardCardSkeleton />
        </div>
      ) : filteredWards.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center">
          <Users className="mx-auto h-12 w-12 text-white/40 mb-4" />
          {wards.length === 0 ? (
            <>
              <h3 className="text-lg font-medium text-white mb-2">No Wards Linked</h3>
              <p className="text-sm text-white/60 mb-4">
                You don&apos;t have any children linked to your account yet.
              </p>
              <p className="text-xs text-white/40">
                Please contact the school administration to link your children.
              </p>
            </>
          ) : (
            <>
              <h3 className="text-lg font-medium text-white mb-2">No Results Found</h3>
              <p className="text-sm text-white/60">
                No wards match your search &quot;{searchQuery}&quot;
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredWards.map((ward) => (
            <WardCard
              key={ward.id}
              ward={ward}
              onClick={() => router.push(`/parent/wards/${ward.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
