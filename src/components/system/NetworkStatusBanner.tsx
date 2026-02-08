"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNetworkHealth, NetworkQuality } from "@/hooks/useNetworkHealth";
import { useOfflineQueue } from "@/hooks/useOfflineQueue";
import { Button } from "@/components/ui/button";
import {
  WifiOff,
  Wifi,
  AlertTriangle,
  RefreshCw,
  X,
  CloudOff,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";

type BannerConfig = {
  show: boolean;
  variant: "offline" | "degraded" | "poor" | "syncing" | "restored";
  bgGradient: string;
  borderColor: string;
  Icon: React.ElementType;
  iconColor: string;
  title: string;
  description: string;
  dismissable: boolean;
};

function getBannerConfig(
  quality: NetworkQuality,
  online: boolean,
  pendingCount: number,
  isProcessing: boolean
): BannerConfig {
  // Check if syncing
  if (isProcessing) {
    return {
      show: true,
      variant: "syncing",
      bgGradient: "from-blue-500/15 via-blue-500/5 to-transparent",
      borderColor: "border-blue-400/40",
      Icon: RefreshCw,
      iconColor: "text-blue-300",
      title: "Syncing Changes",
      description: `Processing ${pendingCount} queued operation${pendingCount !== 1 ? "s" : ""}...`,
      dismissable: false,
    };
  }

  // Offline state
  if (!online || quality === "offline") {
    return {
      show: true,
      variant: "offline",
      bgGradient: "from-gray-500/20 via-gray-500/10 to-transparent",
      borderColor: "border-gray-400/40",
      Icon: WifiOff,
      iconColor: "text-gray-300",
      title: "You Are Offline",
      description: pendingCount > 0
        ? `${pendingCount} change${pendingCount !== 1 ? "s" : ""} will sync when you reconnect.`
        : "Some features won't work until you reconnect.",
      dismissable: false,
    };
  }

  // Poor connection
  if (quality === "poor") {
    return {
      show: true,
      variant: "poor",
      bgGradient: "from-red-500/15 via-red-500/5 to-transparent",
      borderColor: "border-red-400/40",
      Icon: AlertTriangle,
      iconColor: "text-red-300",
      title: "Poor Connection",
      description: "Very slow network. Some actions may fail or take longer.",
      dismissable: true,
    };
  }

  // Degraded connection
  if (quality === "degraded") {
    return {
      show: true,
      variant: "degraded",
      bgGradient: "from-amber-500/15 via-amber-500/5 to-transparent",
      borderColor: "border-amber-400/40",
      Icon: Wifi,
      iconColor: "text-amber-300",
      title: "Slow Connection",
      description: "Network performance may be impacted.",
      dismissable: true,
    };
  }

  // Good connection - don't show banner
  return {
    show: false,
    variant: "restored",
    bgGradient: "",
    borderColor: "",
    Icon: CheckCircle2,
    iconColor: "",
    title: "",
    description: "",
    dismissable: true,
  };
}

const affectedFeatures = [
  { label: "Saving changes", affected: true },
  { label: "Creating records", affected: true },
  { label: "File uploads", affected: true },
  { label: "Live updates", affected: true },
];

const workingFeatures = [
  { label: "Viewing data", affected: false },
  { label: "Reading reports", affected: false },
  { label: "Navigation", affected: false },
];

export function NetworkStatusBanner() {
  const { quality, online } = useNetworkHealth(15000);
  const { pendingCount, isProcessing, processQueue } = useOfflineQueue();
  const [dismissed, setDismissed] = React.useState(false);
  const [showDetails, setShowDetails] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const prevQualityRef = React.useRef<NetworkQuality>(quality);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Reset dismissed state when status changes significantly
  React.useEffect(() => {
    if (prevQualityRef.current !== quality) {
      // Only reset if going from good to bad
      if (
        prevQualityRef.current === "good" &&
        (quality === "poor" || quality === "degraded" || quality === "offline")
      ) {
        setDismissed(false);
      }
      prevQualityRef.current = quality;
    }
  }, [quality]);

  if (!mounted) return null;

  const config = getBannerConfig(quality, online, pendingCount, isProcessing);

  if (!config.show || (dismissed && config.dismissable)) {
    return null;
  }

  const { Icon } = config;
  const isOffline = !online || quality === "offline";

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -48 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -48 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        className={cn(
          "relative z-50 w-full border-b backdrop-blur-md",
          `bg-linear-to-r ${config.bgGradient}`,
          config.borderColor
        )}
      >
        <div className="mx-auto max-w-7xl px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            {/* Main content */}
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                  isOffline
                    ? "bg-gray-500/20 border border-gray-400/30"
                    : config.variant === "poor"
                    ? "bg-red-500/20 border border-red-400/30"
                    : config.variant === "syncing"
                    ? "bg-blue-500/20 border border-blue-400/30"
                    : "bg-amber-500/20 border border-amber-400/30"
                )}
              >
                <Icon
                  className={cn(
                    "h-5 w-5",
                    config.iconColor,
                    config.variant === "syncing" && "animate-spin"
                  )}
                />
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-sm text-white truncate">
                  {config.title}
                </h3>
                <p className="text-xs text-white/70 truncate">
                  {config.description}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Pending queue indicator */}
              {pendingCount > 0 && !isProcessing && online && (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => processQueue()}
                  className="gap-1.5 bg-white/10 hover:bg-white/20 text-white border-0"
                >
                  <Clock className="h-3.5 w-3.5" />
                  Sync Now ({pendingCount})
                </Button>
              )}

              {/* Details toggle for offline state */}
              {isOffline && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDetails(!showDetails)}
                  className="text-white/70 hover:text-white hover:bg-white/10"
                >
                  {showDetails ? "Hide Details" : "Show Impact"}
                </Button>
              )}

              {/* Retry button when offline */}
              {isOffline && (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => window.location.reload()}
                  className="gap-1.5 bg-white/10 hover:bg-white/20 text-white border-0"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Retry
                </Button>
              )}

              {/* Dismiss button */}
              {config.dismissable && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setDismissed(true)}
                  className="h-8 w-8 text-white/50 hover:text-white hover:bg-white/10"
                  aria-label="Dismiss"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Expanded details for offline state */}
          <AnimatePresence>
            {showDetails && isOffline && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="mt-3 pt-3 border-t border-white/10"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Affected features */}
                  <div>
                    <h4 className="text-xs font-medium text-white/60 uppercase tracking-wider mb-2">
                      Unavailable Offline
                    </h4>
                    <ul className="space-y-1.5">
                      {affectedFeatures.map((feature) => (
                        <li
                          key={feature.label}
                          className="flex items-center gap-2 text-sm text-white/80"
                        >
                          <CloudOff className="h-3.5 w-3.5 text-red-400" />
                          {feature.label}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Working features */}
                  <div>
                    <h4 className="text-xs font-medium text-white/60 uppercase tracking-wider mb-2">
                      Still Available
                    </h4>
                    <ul className="space-y-1.5">
                      {workingFeatures.map((feature) => (
                        <li
                          key={feature.label}
                          className="flex items-center gap-2 text-sm text-white/80"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
                          {feature.label}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {pendingCount > 0 && (
                  <div className="mt-3 p-2 rounded-lg bg-white/5 border border-white/10">
                    <p className="text-xs text-white/60">
                      <Clock className="inline h-3 w-3 mr-1" />
                      {pendingCount} pending change{pendingCount !== 1 ? "s" : ""} will
                      automatically sync when you are back online.
                    </p>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
