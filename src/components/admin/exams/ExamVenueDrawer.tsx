"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { ResponsiveModal } from "@/components/ui/responsive-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
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
import { EXAM_VENUE_TYPES } from "@/constants/academics/exam-scheduling-engine";
import type { ExamVenueDTO, ExamVenueType } from "@/types/academics/exam-scheduling-engine";
import {
  useCreateExamVenue,
  useUpdateExamVenue,
  type ExamVenueBodyInput,
} from "@/hooks/admin/useExamVenues";
import { useBusyToast } from "@/hooks/useBusyToast";

const VENUE_TYPE_LABELS: Record<ExamVenueType, string> = {
  classroom: "Classroom",
  hall: "Hall",
  lab: "Lab",
  library: "Library",
  office: "Office",
  outdoor: "Outdoor",
  other: "Other",
};

type ExamVenueDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  venue?: ExamVenueDTO | null;
  onCompleted?: () => void;
};

function venueToForm(venue: ExamVenueDTO): ExamVenueBodyInput {
  return {
    name: venue.name,
    code: venue.code,
    type: venue.type,
    capacity: venue.capacity,
    locationNote: venue.locationNote,
    isActive: venue.isActive,
  };
}

function createDefaultVenueForm(): ExamVenueBodyInput {
  return {
    name: "",
    code: null,
    type: "classroom",
    capacity: null,
    locationNote: null,
    isActive: true,
  };
}

export function ExamVenueDrawer({
  open,
  onOpenChange,
  venue,
  onCompleted,
}: ExamVenueDrawerProps) {
  const busy = useBusyToast();
  const isEditing = Boolean(venue?.id);
  const [form, setForm] = React.useState<ExamVenueBodyInput>(createDefaultVenueForm());
  const createVenue = useCreateExamVenue();
  const updateVenue = useUpdateExamVenue();

  React.useEffect(() => {
    if (!open) return;
    setForm(venue ? venueToForm(venue) : createDefaultVenueForm());
  }, [open, venue]);

  function updateForm(patch: Partial<ExamVenueBodyInput>) {
    setForm((prev) => ({ ...prev, ...patch }));
  }

  async function handleSubmit() {
    if (!form.name.trim()) {
      busy.error("Venue name is required.");
      return;
    }

    const payload: ExamVenueBodyInput = {
      name: form.name.trim(),
      code: form.code?.trim() ? form.code.trim() : null,
      type: form.type ?? "classroom",
      capacity: form.capacity ?? null,
      locationNote: form.locationNote?.trim() ? form.locationNote.trim() : null,
      isActive: form.isActive ?? true,
    };

    const promise = isEditing
      ? updateVenue.mutateAsync({ id: venue!.id, input: payload })
      : createVenue.mutateAsync(payload);

    await busy.promise(promise, {
      loading: isEditing ? "Updating venue…" : "Creating venue…",
      success: isEditing ? "Venue updated" : "Venue created",
      error: (error) => (error instanceof Error ? error.message : "Could not save venue"),
    });

    onOpenChange(false);
    onCompleted?.();
  }

  const isSaving = createVenue.isPending || updateVenue.isPending;

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? "Edit exam venue" : "Add exam venue"}
      description="Rooms and halls used for exam sittings."
    >
      <div className={glassInsetClass}>
        <div className="space-y-4 p-4">
          <div className="space-y-2">
            <Label htmlFor="venue-name">Name</Label>
            <Input
              id="venue-name"
              value={form.name}
              onChange={(event) => updateForm({ name: event.target.value })}
              placeholder="Main Hall"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="venue-code">Code (optional)</Label>
              <Input
                id="venue-code"
                value={form.code ?? ""}
                onChange={(event) => updateForm({ code: event.target.value })}
                placeholder="HALL-1"
              />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <PremiumSelect
                value={form.type ?? "classroom"}
                onValueChange={(value) => updateForm({ type: value })}
              >
                <PremiumSelectTrigger>
                  <PremiumSelectValue placeholder="Select type" />
                </PremiumSelectTrigger>
                <PremiumSelectContent>
                  {EXAM_VENUE_TYPES.map((type) => (
                    <PremiumSelectItem key={type} value={type}>
                      {VENUE_TYPE_LABELS[type]}
                    </PremiumSelectItem>
                  ))}
                </PremiumSelectContent>
              </PremiumSelect>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="venue-capacity">Capacity (optional)</Label>
            <Input
              id="venue-capacity"
              type="number"
              min={1}
              value={form.capacity ?? ""}
              onChange={(event) =>
                updateForm({
                  capacity: event.target.value ? Number(event.target.value) : null,
                })
              }
              placeholder="120"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="venue-location">Location note (optional)</Label>
            <Textarea
              id="venue-location"
              value={form.locationNote ?? ""}
              onChange={(event) => updateForm({ locationNote: event.target.value })}
              placeholder="Block B, ground floor"
              rows={3}
            />
          </div>
          <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-4">
            <div>
              <p className="text-sm font-medium text-white">Active</p>
              <p className="text-xs text-white/50">Inactive venues stay hidden from new scheduling.</p>
            </div>
            <Switch
              checked={form.isActive ?? true}
              onCheckedChange={(checked) => updateForm({ isActive: checked })}
            />
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          className={glassSecondaryButtonClass}
          onClick={() => onOpenChange(false)}
          disabled={isSaving}
        >
          Cancel
        </Button>
        <Button
          type="button"
          className={glassPrimaryButtonClass}
          onClick={() => void handleSubmit()}
          disabled={isSaving}
        >
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : isEditing ? (
            "Save changes"
          ) : (
            "Create venue"
          )}
        </Button>
      </div>
    </ResponsiveModal>
  );
}
