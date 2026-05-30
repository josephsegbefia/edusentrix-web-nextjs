"use client";

import * as React from "react";
import {
  Building2,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  ToggleLeft,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GlassPanel } from "@/components/ui/glass-panel";
import { WorkspacePageHeader } from "@/components/ui/workspace-page-header";
import { WorkspacePageShell } from "@/components/ui/workspace-page-shell";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import {
  glassInsetClass,
  glassPrimaryButtonClass,
  glassSecondaryButtonClass,
} from "@/lib/ui/glass-surfaces";
import { cn } from "@/lib/utils";
import type { ExamVenueDTO } from "@/types/academics/exam-scheduling-engine";
import { ExamVenueDrawer } from "@/components/admin/exams/ExamVenueDrawer";
import { ExamWorkspaceErrorState } from "@/components/admin/exams/ExamWorkspaceErrorState";
import {
  useDeactivateExamVenue,
  useExamVenues,
} from "@/hooks/admin/useExamVenues";
import { useBusyToast } from "@/hooks/useBusyToast";
import { useConfirmationDialog } from "@/hooks/useConfirmationDialog";

function VenueRow({
  venue,
  onEdit,
  onDeactivate,
  deactivating,
}: {
  venue: ExamVenueDTO;
  onEdit: () => void;
  onDeactivate: () => void;
  deactivating: boolean;
}) {
  return (
    <div className={cn(glassInsetClass, "p-4")}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-white">{venue.name}</h3>
            <Badge
              variant="outline"
              className={
                venue.isActive
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
                  : "border-white/10 bg-white/5 text-white/45"
              }
            >
              {venue.isActive ? "Active" : "Inactive"}
            </Badge>
            <Badge variant="outline" className="border-white/10 bg-white/5 text-white/60">
              {venue.type}
            </Badge>
          </div>
          <p className="mt-2 text-sm text-white/60">
            {venue.code ? `Code: ${venue.code}` : "No code"} ·{" "}
            {venue.capacity ? `Capacity: ${venue.capacity}` : "Capacity not set"}
          </p>
          {venue.locationNote ? (
            <p className="mt-1 text-xs text-white/45">{venue.locationNote}</p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={glassSecondaryButtonClass}
            onClick={onEdit}
          >
            <Pencil className="mr-2 h-3.5 w-3.5" />
            Edit
          </Button>
          {venue.isActive ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-amber-500/30 text-amber-100 hover:bg-amber-500/10"
              onClick={onDeactivate}
              disabled={deactivating}
            >
              <ToggleLeft className="mr-2 h-3.5 w-3.5" />
              Deactivate
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function ExamVenuesPage() {
  const busy = useBusyToast();
  const confirm = useConfirmationDialog();
  const [activeFilter, setActiveFilter] = React.useState("all");
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [editingVenue, setEditingVenue] = React.useState<ExamVenueDTO | null>(null);

  const {
    data: venuesData,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useExamVenues({
    activeOnly: activeFilter === "active",
  });
  const deactivateVenue = useDeactivateExamVenue();

  const venues = (venuesData?.data ?? []).filter((venue) =>
    activeFilter === "inactive" ? !venue.isActive : true
  );

  function openCreateDrawer() {
    setEditingVenue(null);
    setDrawerOpen(true);
  }

  function openEditDrawer(venue: ExamVenueDTO) {
    setEditingVenue(venue);
    setDrawerOpen(true);
  }

  async function handleDeactivate(venue: ExamVenueDTO) {
    const confirmed = await confirm({
      title: "Deactivate venue?",
      description: `"${venue.name}" will be hidden from new exam scheduling. Existing timetable entries keep their venue reference.`,
      confirmLabel: "Deactivate",
      destructive: true,
    });
    if (!confirmed) return;

    await busy.promise(deactivateVenue.mutateAsync(venue.id), {
      loading: "Deactivating venue…",
      success: "Venue deactivated",
      error: (error) =>
        error instanceof Error ? error.message : "Could not deactivate venue",
    });
  }

  return (
    <WorkspacePageShell>
      <WorkspacePageHeader
        icon={Building2}
        title="Exam Venues"
        subtitle="Manage rooms and halls used for exam sittings."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className={glassSecondaryButtonClass}
              onClick={() => void refetch()}
              disabled={isFetching}
            >
              <RefreshCw className={cn("mr-2 h-4 w-4", isFetching && "animate-spin")} />
              Refresh
            </Button>
            <Button type="button" className={glassPrimaryButtonClass} onClick={openCreateDrawer}>
              <Plus className="mr-2 h-4 w-4" />
              Add venue
            </Button>
          </div>
        }
      />

      <GlassPanel className="p-4 sm:p-6">
        <div className="mb-6">
          <PremiumSelect value={activeFilter} onValueChange={setActiveFilter}>
            <PremiumSelectTrigger className="w-full sm:w-[220px]">
              <PremiumSelectValue placeholder="Filter venues" />
            </PremiumSelectTrigger>
            <PremiumSelectContent>
              <PremiumSelectItem value="all">All venues</PremiumSelectItem>
              <PremiumSelectItem value="active">Active only</PremiumSelectItem>
              <PremiumSelectItem value="inactive">Inactive only</PremiumSelectItem>
            </PremiumSelectContent>
          </PremiumSelect>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-white/60">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Loading venues…
          </div>
        ) : isError ? (
          <ExamWorkspaceErrorState
            title="Could not load exam venues"
            description={
              error instanceof Error ? error.message : "Something went wrong loading exam venues."
            }
            onRetry={() => void refetch()}
            retrying={isFetching}
          />
        ) : venues.length === 0 ? (
          <div className={cn(glassInsetClass, "px-6 py-12 text-center")}>
            <Building2 className="mx-auto h-10 w-10 text-cyan-300/80" />
            <h3 className="mt-4 text-lg font-semibold text-white">No exam venues yet</h3>
            <p className="mx-auto mt-2 max-w-xl text-sm text-white/60">
              Add classrooms, halls, and labs before scheduling exam papers.
            </p>
            <Button
              type="button"
              className={cn(glassPrimaryButtonClass, "mt-6")}
              onClick={openCreateDrawer}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add venue
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {venues.map((venue) => (
              <VenueRow
                key={venue.id}
                venue={venue}
                onEdit={() => openEditDrawer(venue)}
                onDeactivate={() => void handleDeactivate(venue)}
                deactivating={deactivateVenue.isPending}
              />
            ))}
          </div>
        )}
      </GlassPanel>

      <ExamVenueDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        venue={editingVenue}
        onCompleted={() => setEditingVenue(null)}
      />
    </WorkspacePageShell>
  );
}
