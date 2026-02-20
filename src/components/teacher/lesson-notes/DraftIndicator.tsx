"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Cloud, CloudOff, CheckCircle, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================================================
// Types
// ============================================================================

type DraftStatus = "saving" | "saved" | "pending" | "error" | "offline";

type DraftIndicatorProps = {
  lastSaved: Date | null;
  hasPendingChanges: boolean;
  isOffline?: boolean;
  className?: string;
};

// ============================================================================
// Component
// ============================================================================

export function DraftIndicator({
  lastSaved,
  hasPendingChanges,
  isOffline = false,
  className,
}: DraftIndicatorProps) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  // Determine status
  let status: DraftStatus;
  if (isOffline && hasPendingChanges) {
    status = "offline";
  } else if (hasPendingChanges) {
    status = "saving";
  } else if (lastSaved) {
    status = "saved";
  } else {
    status = "pending";
  }

  // Format last saved time
  const formatTime = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);

    if (diffSeconds < 5) return "Just now";
    if (diffSeconds < 60) return `${diffSeconds}s ago`;
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const statusConfig = {
    saving: {
      Icon: Loader2,
      iconClass: "text-blue-400 animate-spin",
      label: "Saving...",
      bgClass: "bg-blue-500/10 border-blue-500/20",
    },
    saved: {
      Icon: CheckCircle,
      iconClass: "text-emerald-400",
      label: lastSaved ? `Saved ${formatTime(lastSaved)}` : "Saved",
      bgClass: "bg-emerald-500/10 border-emerald-500/20",
    },
    pending: {
      Icon: Cloud,
      iconClass: "text-white/40",
      label: "Not saved",
      bgClass: "bg-white/5 border-white/10",
    },
    error: {
      Icon: AlertCircle,
      iconClass: "text-red-400",
      label: "Save failed",
      bgClass: "bg-red-500/10 border-red-500/20",
    },
    offline: {
      Icon: CloudOff,
      iconClass: "text-amber-400",
      label: "Offline - Draft saved locally",
      bgClass: "bg-amber-500/10 border-amber-500/20",
    },
  };

  const config = statusConfig[status];
  const { Icon } = config;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={status}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.15 }}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs border",
          config.bgClass,
          className
        )}
      >
        <Icon className={cn("h-3 w-3", config.iconClass)} />
        <span className="text-white/70">{config.label}</span>
      </motion.div>
    </AnimatePresence>
  );
}

// ============================================================================
// DraftRecoveryPrompt - Prompt to recover a saved draft
// ============================================================================

type DraftRecoveryPromptProps = {
  lastSaved: Date | null;
  onRecover: () => void;
  onDiscard: () => void;
  className?: string;
};

export function DraftRecoveryPrompt({
  lastSaved,
  onRecover,
  onDiscard,
  className,
}: DraftRecoveryPromptProps) {
  const [visible, setVisible] = React.useState(true);

  if (!visible || !lastSaved) return null;

  const timeAgo = (() => {
    const now = new Date();
    const diffMs = now.getTime() - lastSaved.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
    if (diffHours > 0) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    if (diffMinutes > 0) return `${diffMinutes} minute${diffMinutes > 1 ? "s" : ""} ago`;
    return "moments ago";
  })();

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={cn(
        "rounded-lg border border-blue-500/30 bg-blue-500/10 p-4",
        className
      )}
    >
      <div className="flex items-start gap-3">
        <Cloud className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
        <div className="flex-grow">
          <h4 className="text-sm font-medium text-blue-200">
            Unsaved Draft Found
          </h4>
          <p className="mt-1 text-sm text-blue-200/70">
            You have an unsaved draft from {timeAgo}. Would you like to continue
            where you left off?
          </p>
        </div>
      </div>
      <div className="mt-4 flex gap-2 justify-end">
        <button
          type="button"
          onClick={() => {
            onDiscard();
            setVisible(false);
          }}
          className="px-3 py-1.5 text-sm text-white/60 hover:text-white hover:bg-white/10 rounded-md transition-colors"
        >
          Discard
        </button>
        <button
          type="button"
          onClick={() => {
            onRecover();
            setVisible(false);
          }}
          className="px-3 py-1.5 text-sm bg-blue-500/20 text-blue-200 hover:bg-blue-500/30 rounded-md transition-colors"
        >
          Recover Draft
        </button>
      </div>
    </motion.div>
  );
}
