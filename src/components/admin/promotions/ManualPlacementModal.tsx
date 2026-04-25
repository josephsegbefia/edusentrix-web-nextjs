"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { useClassGroupOptions } from "@/hooks/admin/useClassGroupOptions";
import { useGradeOptions } from "@/hooks/admin/useGradeOptions";
import type { PromotionDecisionDTO } from "@/hooks/admin/usePromotionDecisions";
import { Loader2, MapPin } from "lucide-react";

type ManualPlacementModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  decision: PromotionDecisionDTO | null;
  isPending: boolean;
  onConfirm: (input: {
    targetGradeId: string;
    targetClassGroupId: string;
    reasonText: string;
    version: number;
  }) => Promise<void>;
};

export function ManualPlacementModal({
  open,
  onOpenChange,
  decision,
  isPending,
  onConfirm,
}: ManualPlacementModalProps) {
  const { data: grades = [] } = useGradeOptions();
  const [targetGradeId, setTargetGradeId] = React.useState("");
  const [targetClassGroupId, setTargetClassGroupId] = React.useState("");
  const [reasonText, setReasonText] = React.useState("");
  const { data: classGroups = [], isLoading: classesLoading } =
    useClassGroupOptions(targetGradeId);

  React.useEffect(() => {
    if (!decision) return;
    setTargetGradeId(decision.targetGradeId || "");
    setTargetClassGroupId(decision.targetClassGroupId || "");
    setReasonText("");
  }, [decision]);

  React.useEffect(() => {
    setTargetClassGroupId("");
  }, [targetGradeId]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!decision || !targetGradeId || !targetClassGroupId || !reasonText.trim()) {
      return;
    }

    await onConfirm({
      targetGradeId,
      targetClassGroupId,
      reasonText: reasonText.trim(),
      version: decision.version,
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-white/10 bg-slate-900 text-white sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-amber-300" />
            Set target placement
          </DialogTitle>
        </DialogHeader>

        {decision ? (
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="font-medium text-white">{decision.studentName}</p>
              <p className="mt-1 text-xs text-white/50">
                Current placement: {decision.fromGradeName} {decision.fromClassGroupName}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-white/70">Target grade</Label>
                <PremiumSelect value={targetGradeId} onValueChange={setTargetGradeId}>
                  <PremiumSelectTrigger className="h-9 w-full rounded-xl">
                    <PremiumSelectValue placeholder="Select grade" />
                  </PremiumSelectTrigger>
                  <PremiumSelectContent>
                    {grades.map((grade) => (
                      <PremiumSelectItem key={grade._id} value={grade._id}>
                        {grade.name}
                      </PremiumSelectItem>
                    ))}
                  </PremiumSelectContent>
                </PremiumSelect>
              </div>

              <div className="space-y-2">
                <Label className="text-white/70">Target class</Label>
                <PremiumSelect
                  value={targetClassGroupId}
                  onValueChange={setTargetClassGroupId}
                  disabled={!targetGradeId || classesLoading}
                >
                  <PremiumSelectTrigger className="h-9 w-full rounded-xl">
                    <PremiumSelectValue
                      placeholder={classesLoading ? "Loading classes..." : "Select class"}
                    />
                  </PremiumSelectTrigger>
                  <PremiumSelectContent>
                    {classGroups.map((classGroup) => (
                      <PremiumSelectItem key={classGroup._id} value={classGroup._id}>
                        {classGroup.name}
                      </PremiumSelectItem>
                    ))}
                  </PremiumSelectContent>
                </PremiumSelect>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-white/70">Reason</Label>
              <Textarea
                value={reasonText}
                onChange={(event) => setReasonText(event.target.value)}
                rows={3}
                required
                placeholder="Explain why this class is the right placement..."
                className="border-white/10 bg-white/5 text-white placeholder:text-white/35"
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  isPending || !targetGradeId || !targetClassGroupId || !reasonText.trim()
                }
                className="gap-2"
              >
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Save placement
              </Button>
            </DialogFooter>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
