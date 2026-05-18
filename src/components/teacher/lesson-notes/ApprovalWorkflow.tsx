"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock,
  CheckCircle,
  XCircle,
  Send,
  Undo2,
  AlertCircle,
  Loader2,
  ThumbsUp,
  ThumbsDown,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/useToast";
import type { LessonNoteStatus } from "@/types/lesson-notes";
import {
  useSubmitForApproval,
  useApproveLessonNote,
  useRejectLessonNote,
  useReturnToDraft,
  useApprovalStatus,
} from "@/hooks/teacher/useTeacherLessonNoteApproval";

// ============================================================================
// ApprovalStatusBadge - Displays the current approval status with icon
// ============================================================================

type ApprovalStatusBadgeProps = {
  status: LessonNoteStatus;
  className?: string;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
};

const statusConfig: Record<
  LessonNoteStatus,
  { label: string; icon: React.ElementType; colorClass: string }
> = {
  draft: {
    label: "Draft",
    icon: FileText,
    colorClass: "bg-gray-500/20 text-gray-300 border-gray-500/30",
  },
  submitted: {
    label: "Pending Approval",
    icon: Clock,
    colorClass: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  },
  approved: {
    label: "Approved",
    icon: CheckCircle,
    colorClass: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  },
  rejected: {
    label: "Needs Revision",
    icon: XCircle,
    colorClass: "bg-red-500/20 text-red-300 border-red-500/30",
  },
};

export function ApprovalStatusBadge({
  status,
  className,
  size = "md",
  showLabel = true,
}: ApprovalStatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.draft;
  const Icon = config.icon;

  const sizeClasses = {
    sm: "text-xs px-2 py-0.5 gap-1",
    md: "text-sm px-2.5 py-1 gap-1.5",
    lg: "text-base px-3 py-1.5 gap-2",
  };

  const iconSizes = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border font-medium",
        config.colorClass,
        sizeClasses[size],
        className
      )}
    >
      <Icon className={iconSizes[size]} />
      {showLabel && config.label}
    </span>
  );
}

// ============================================================================
// SubmitForApprovalButton - Button to submit a lesson note for approval
// ============================================================================

type SubmitForApprovalButtonProps = {
  noteId: string;
  currentStatus: LessonNoteStatus;
  disabled?: boolean;
  onSuccess?: () => void;
  className?: string;
};

export function SubmitForApprovalButton({
  noteId,
  currentStatus,
  disabled,
  onSuccess,
  className,
}: SubmitForApprovalButtonProps) {
  const toast = useToast();
  const [isConfirmOpen, setIsConfirmOpen] = React.useState(false);
  const submitMutation = useSubmitForApproval();

  const canSubmit = ["draft", "rejected"].includes(currentStatus);

  const handleSubmit = async () => {
    try {
      await submitMutation.mutateAsync(noteId);
      toast.success("Submitted for Approval", {
        description: "Your lesson note has been submitted for review.",
      });
      setIsConfirmOpen(false);
      onSuccess?.();
    } catch (error) {
      toast.error("Submission Failed", {
        description:
          error instanceof Error ? error.message : "Failed to submit",
      });
    }
  };

  if (!canSubmit) {
    return null;
  }

  return (
    <>
      <Button
        type="button"
        onClick={() => setIsConfirmOpen(true)}
        disabled={disabled || submitMutation.isPending}
        className={cn(
          "bg-amber-500/20 text-amber-100 hover:bg-amber-500/30",
          className
        )}
      >
        {submitMutation.isPending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Send className="mr-2 h-4 w-4" />
        )}
        Submit for Approval
      </Button>

      <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <DialogContent className="sm:max-w-md bg-[#1a1d24] border-white/10">
          <DialogHeader>
            <DialogTitle className="text-white">Submit for Approval</DialogTitle>
            <DialogDescription className="text-white/60">
              Submit this lesson note to your school for review. You can still edit it
              while it is waiting, and you will get an in-app notification when it is
              approved or sent back for changes.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setIsConfirmOpen(false)}
              className="border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitMutation.isPending}
              className="bg-amber-500/20 text-amber-100 hover:bg-amber-500/30"
            >
              {submitMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ============================================================================
// ReturnToDraftButton - Button to return a note to draft status
// ============================================================================

type ReturnToDraftButtonProps = {
  noteId: string;
  currentStatus: LessonNoteStatus;
  disabled?: boolean;
  onSuccess?: () => void;
  className?: string;
};

export function ReturnToDraftButton({
  noteId,
  currentStatus,
  disabled,
  onSuccess,
  className,
}: ReturnToDraftButtonProps) {
  const toast = useToast();
  const returnMutation = useReturnToDraft();

  const canReturn = ["submitted", "rejected"].includes(currentStatus);

  const handleReturn = async () => {
    try {
      await returnMutation.mutateAsync(noteId);
      toast.success("Returned to Draft", {
        description: "Your lesson note is back in draft mode for editing.",
      });
      onSuccess?.();
    } catch (error) {
      toast.error("Action Failed", {
        description:
          error instanceof Error ? error.message : "Failed to return to draft",
      });
    }
  };

  if (!canReturn) {
    return null;
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={handleReturn}
      disabled={disabled || returnMutation.isPending}
      className={cn(
        "border-white/10 bg-white/5 text-white/70 hover:bg-white/10",
        className
      )}
    >
      {returnMutation.isPending ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Undo2 className="mr-2 h-4 w-4" />
      )}
      Return to Draft
    </Button>
  );
}

// ============================================================================
// RejectionReasonAlert - Shows rejection reason with styling
// ============================================================================

type RejectionReasonAlertProps = {
  reason: string | null;
  className?: string;
};

export function RejectionReasonAlert({
  reason,
  className,
}: RejectionReasonAlertProps) {
  if (!reason) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "rounded-lg border border-red-500/30 bg-red-500/10 p-4",
        className
      )}
    >
      <div className="flex gap-3">
        <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-400" />
        <div>
          <h4 className="text-sm font-medium text-red-300">
            Revision Required
          </h4>
          <p className="mt-1 text-sm text-red-200/80">{reason}</p>
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================================
// ApprovalActionsPanel - Admin panel for approving/rejecting notes
// ============================================================================

type ApprovalActionsPanelProps = {
  noteId: string;
  currentStatus: LessonNoteStatus;
  isAdmin?: boolean;
  onActionComplete?: () => void;
  className?: string;
};

export function ApprovalActionsPanel({
  noteId,
  currentStatus,
  isAdmin = false,
  onActionComplete,
  className,
}: ApprovalActionsPanelProps) {
  const toast = useToast();
  const [showRejectDialog, setShowRejectDialog] = React.useState(false);
  const [showApproveDialog, setShowApproveDialog] = React.useState(false);
  const [rejectionReason, setRejectionReason] = React.useState("");
  const [approvalFeedback, setApprovalFeedback] = React.useState("");

  const approveMutation = useApproveLessonNote();
  const rejectMutation = useRejectLessonNote();

  const canTakeAction = isAdmin && currentStatus === "submitted";

  const handleApprove = async () => {
    try {
      await approveMutation.mutateAsync({
        noteId,
        feedback: approvalFeedback || undefined,
      });
      toast.success("Lesson Note Approved", {
        description: "The lesson note has been approved.",
      });
      setShowApproveDialog(false);
      setApprovalFeedback("");
      onActionComplete?.();
    } catch (error) {
      toast.error("Action Failed", {
        description:
          error instanceof Error ? error.message : "Failed to approve",
      });
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      toast.error("Reason Required", {
        description: "Please provide a reason for rejection.",
      });
      return;
    }

    try {
      await rejectMutation.mutateAsync({
        noteId,
        reason: rejectionReason,
      });
      toast.success("Lesson Note Rejected", {
        description: "The lesson note has been returned to the teacher.",
      });
      setShowRejectDialog(false);
      setRejectionReason("");
      onActionComplete?.();
    } catch (error) {
      toast.error("Action Failed", {
        description:
          error instanceof Error ? error.message : "Failed to reject",
      });
    }
  };

  if (!canTakeAction) {
    return null;
  }

  return (
    <>
      <div
        className={cn(
          "flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4",
          className
        )}
      >
        <Clock className="h-5 w-5 text-amber-400" />
        <span className="flex-grow text-sm text-amber-200">
          This lesson note is awaiting your approval.
        </span>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowRejectDialog(true)}
            className="border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20"
          >
            <ThumbsDown className="mr-1 h-4 w-4" />
            Reject
          </Button>
          <Button
            size="sm"
            onClick={() => setShowApproveDialog(true)}
            className="bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30"
          >
            <ThumbsUp className="mr-1 h-4 w-4" />
            Approve
          </Button>
        </div>
      </div>

      {/* Approve Dialog */}
      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent className="sm:max-w-md bg-[#1a1d24] border-white/10">
          <DialogHeader>
            <DialogTitle className="text-white">Approve Lesson Note</DialogTitle>
            <DialogDescription className="text-white/60">
              Confirm that this lesson note meets the required standards.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="feedback" className="text-white/80">
                Feedback (optional)
              </Label>
              <Textarea
                id="feedback"
                placeholder="Add any feedback or commendations..."
                value={approvalFeedback}
                onChange={(e) => setApprovalFeedback(e.target.value)}
                className="mt-1 border-white/10 bg-white/5 text-white placeholder:text-white/40"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowApproveDialog(false)}
              className="border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
            >
              Cancel
            </Button>
            <Button
              onClick={handleApprove}
              disabled={approveMutation.isPending}
              className="bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30"
            >
              {approveMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent className="sm:max-w-md bg-[#1a1d24] border-white/10">
          <DialogHeader>
            <DialogTitle className="text-white">Reject Lesson Note</DialogTitle>
            <DialogDescription className="text-white/60">
              Provide feedback to help the teacher improve their lesson note.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="reason" className="text-white/80">
                Reason for Rejection *
              </Label>
              <Textarea
                id="reason"
                placeholder="Explain what needs to be improved..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="mt-1 border-white/10 bg-white/5 text-white placeholder:text-white/40"
                rows={4}
                required
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowRejectDialog(false)}
              className="border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
            >
              Cancel
            </Button>
            <Button
              onClick={handleReject}
              disabled={rejectMutation.isPending || !rejectionReason.trim()}
              className="bg-red-500/20 text-red-300 hover:bg-red-500/30"
            >
              {rejectMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ============================================================================
// ApprovalTimeline - Shows approval history timeline
// ============================================================================

type ApprovalTimelineProps = {
  noteId: string;
  className?: string;
};

export function ApprovalTimeline({ noteId, className }: ApprovalTimelineProps) {
  const { data: status, isLoading } = useApprovalStatus(noteId);

  if (isLoading) {
    return (
      <div className={cn("flex items-center gap-2 text-white/50", className)}>
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Loading approval history...</span>
      </div>
    );
  }

  if (!status) {
    return null;
  }

  const events: Array<{
    label: string;
    date: string | null;
    icon: React.ElementType;
    color: string;
  }> = [];

  if (status.submittedAt) {
    events.push({
      label: "Submitted for approval",
      date: status.submittedAt,
      icon: Send,
      color: "text-amber-400",
    });
  }

  if (status.approvedAt) {
    events.push({
      label: `Approved${status.approvedBy ? ` by ${status.approvedBy}` : ""}`,
      date: status.approvedAt,
      icon: CheckCircle,
      color: "text-emerald-400",
    });
  }

  if (status.rejectionReason) {
    events.push({
      label: "Rejected - revision required",
      date: null,
      icon: XCircle,
      color: "text-red-400",
    });
  }

  if (events.length === 0) {
    return null;
  }

  return (
    <div className={cn("space-y-3", className)}>
      <h4 className="text-sm font-medium text-white/80">Approval History</h4>
      <div className="space-y-2">
        <AnimatePresence>
          {events.map((event, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="flex items-start gap-3"
            >
              <event.icon className={cn("h-4 w-4 mt-0.5", event.color)} />
              <div className="flex-grow">
                <p className="text-sm text-white/80">{event.label}</p>
                {event.date && (
                  <p className="text-xs text-white/50">
                    {new Date(event.date).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
