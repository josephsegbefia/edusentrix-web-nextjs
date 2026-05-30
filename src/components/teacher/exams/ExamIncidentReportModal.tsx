"use client";

import * as React from "react";
import { Modal } from "@/components/ui/responsive-modal";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import { EXAM_INCIDENT_SEVERITIES, EXAM_INCIDENT_TYPES } from "@/constants/academics/exam-scheduling-engine";
import { glassPrimaryButtonClass, glassSecondaryButtonClass } from "@/lib/ui/glass-surfaces";
import { cn } from "@/lib/utils";

const INCIDENT_LABELS: Record<(typeof EXAM_INCIDENT_TYPES)[number], string> = {
  late_start: "Late start",
  student_absence: "Student absence",
  teacher_absence: "Teacher absence",
  material_issue: "Material issue",
  misconduct: "Misconduct",
  emergency: "Emergency",
  other: "Other",
};

type ExamIncidentReportModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dutyTitle: string;
  submitting?: boolean;
  onSubmit: (input: {
    type: string;
    severity: string;
    description: string;
    actionTaken?: string | null;
  }) => Promise<void>;
};

export function ExamIncidentReportModal({
  open,
  onOpenChange,
  dutyTitle,
  submitting,
  onSubmit,
}: ExamIncidentReportModalProps) {
  const [type, setType] = React.useState<(typeof EXAM_INCIDENT_TYPES)[number]>("other");
  const [severity, setSeverity] = React.useState<(typeof EXAM_INCIDENT_SEVERITIES)[number]>("medium");
  const [description, setDescription] = React.useState("");
  const [actionTaken, setActionTaken] = React.useState("");

  React.useEffect(() => {
    if (!open) {
      setType("other");
      setSeverity("medium");
      setDescription("");
      setActionTaken("");
    }
  }, [open]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    await onSubmit({
      type,
      severity,
      description: description.trim(),
      actionTaken: actionTaken.trim() || null,
    });
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Report exam incident"
      description={`Describe what happened during ${dutyTitle}. School admins can review this report.`}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label>Incident type</Label>
          <PremiumSelect value={type} onValueChange={(value) => setType(value as typeof type)}>
            <PremiumSelectTrigger>
              <PremiumSelectValue placeholder="Select type" />
            </PremiumSelectTrigger>
            <PremiumSelectContent>
              {EXAM_INCIDENT_TYPES.map((option) => (
                <PremiumSelectItem key={option} value={option}>
                  {INCIDENT_LABELS[option]}
                </PremiumSelectItem>
              ))}
            </PremiumSelectContent>
          </PremiumSelect>
        </div>

        <div className="space-y-2">
          <Label>Severity</Label>
          <PremiumSelect
            value={severity}
            onValueChange={(value) => setSeverity(value as typeof severity)}
          >
            <PremiumSelectTrigger>
              <PremiumSelectValue placeholder="Select severity" />
            </PremiumSelectTrigger>
            <PremiumSelectContent>
              {EXAM_INCIDENT_SEVERITIES.map((option) => (
                <PremiumSelectItem key={option} value={option}>
                  {option.charAt(0).toUpperCase() + option.slice(1)}
                </PremiumSelectItem>
              ))}
            </PremiumSelectContent>
          </PremiumSelect>
        </div>

        <div className="space-y-2">
          <Label htmlFor="incident-description">Description</Label>
          <Textarea
            id="incident-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="What happened and who was affected?"
            rows={4}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="incident-action">Action taken (optional)</Label>
          <Textarea
            id="incident-action"
            value={actionTaken}
            onChange={(event) => setActionTaken(event.target.value)}
            placeholder="Any immediate steps you took in the exam room"
            rows={3}
          />
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            className={cn("rounded-xl", glassSecondaryButtonClass)}
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            className={cn("rounded-xl", glassPrimaryButtonClass)}
            disabled={submitting || !description.trim()}
          >
            Submit report
          </Button>
        </div>
      </form>
    </Modal>
  );
}
