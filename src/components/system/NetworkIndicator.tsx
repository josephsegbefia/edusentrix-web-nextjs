"use client";

import { useEffect, useState } from "react";
import { useNetworkHealth, NetworkQuality } from "@/hooks/useNetworkHealth";
import { useConnectionHistory } from "@/hooks/useConnectionHistory";
import { useOfflineQueue } from "@/hooks/useOfflineQueue";
import {
  Wifi,
  WifiOff,
  Activity,
  Clock,
  Trash2,
  RefreshCw,
  Radio,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

function getIndicatorConfig(quality: NetworkQuality, online: boolean) {
  if (!online || quality === "offline") {
    return {
      color: "bg-gray-500",
      pulseColor: "bg-gray-400",
      icon: WifiOff,
      label: "Offline",
      description: "No internet connection",
    };
  }

  switch (quality) {
    case "poor":
      return {
        color: "bg-red-500",
        pulseColor: "bg-red-400",
        icon: Wifi,
        label: "Poor Connection",
        description: "Very slow network. Some actions may fail.",
      };
    case "degraded":
      return {
        color: "bg-yellow-500",
        pulseColor: "bg-yellow-400",
        icon: Wifi,
        label: "Degraded Connection",
        description: "Network performance may be impacted.",
      };
    case "good":
      return {
        color: "bg-green-500",
        pulseColor: "bg-green-400",
        icon: Wifi,
        label: "Good Connection",
        description: "Network is operating normally.",
      };
    default:
      return {
        color: "bg-gray-500",
        pulseColor: "bg-gray-400",
        icon: Wifi,
        label: "Unknown",
        description: "Unable to determine network status.",
      };
  }
}

function formatTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  if (diff < 60000) return "Just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(timestamp).toLocaleDateString();
}

function getEventIcon(type: string) {
  switch (type) {
    case "offline":
      return <WifiOff className="h-3 w-3 text-gray-400" />;
    case "online":
      return <Wifi className="h-3 w-3 text-green-400" />;
    case "quality_change":
      return <Activity className="h-3 w-3 text-blue-400" />;
    case "sse_disconnect":
      return <Radio className="h-3 w-3 text-orange-400" />;
    case "sse_connect":
      return <Radio className="h-3 w-3 text-green-400" />;
    case "probe_failed":
      return <AlertCircle className="h-3 w-3 text-red-400" />;
    default:
      return <Activity className="h-3 w-3 text-white/40" />;
  }
}

export function NetworkIndicator() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const {
    quality,
    online,
    effectiveType,
    downlink,
    probeRtt,
    sseState,
    isSSEConnected,
  } = useNetworkHealth(20000);
  const { events, summary, clearHistory } = useConnectionHistory();
  const { pendingCount, processQueue, isProcessing } = useOfflineQueue();

  useEffect(() => {
    setMounted(true);
  }, []);

  const config = mounted
    ? getIndicatorConfig(quality, online)
    : {
        color: "bg-gray-500",
        pulseColor: "bg-gray-400",
        icon: Wifi,
        label: "Checking Connection",
        description: "Determining network status...",
      };

  const Icon = config.icon;
  const showPulse =
    mounted && (quality === "poor" || quality === "offline" || !online);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-white/5 transition-colors"
          aria-label={config.label}
          aria-haspopup="dialog"
          aria-expanded={open}
        >
          <div className="relative">
            <Icon className="h-4 w-4 text-white/60" />
            <span
              className={cn(
                "absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border-2 border-card",
                config.color
              )}
            />
            {showPulse && (
              <span
                className={cn(
                  "absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full animate-ping",
                  config.pulseColor
                )}
              />
            )}
          </div>
          {/* Pending queue badge */}
          {pendingCount > 0 && (
            <span className="flex items-center justify-center h-4 min-w-[1rem] px-1 text-[10px] font-medium bg-amber-500 text-black rounded-full">
              {pendingCount}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        side="bottom"
        align="end"
        className="w-80 p-0 border border-white/10 bg-slate-950/95 backdrop-blur-md"
      >
        {/* Current Status Header */}
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-lg",
                quality === "good" || (online && quality !== "poor")
                  ? "bg-green-500/20 border border-green-500/30"
                  : quality === "poor"
                  ? "bg-red-500/20 border border-red-500/30"
                  : "bg-gray-500/20 border border-gray-500/30"
              )}
            >
              <Icon
                className={cn(
                  "h-5 w-5",
                  quality === "good" || (online && quality !== "poor")
                    ? "text-green-300"
                    : quality === "poor"
                    ? "text-red-300"
                    : "text-gray-300"
                )}
              />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-sm text-white">
                {config.label}
              </h4>
              <p className="text-xs text-white/60 truncate">
                {config.description}
              </p>
            </div>
          </div>

          {/* Network metrics */}
          {mounted && online && (
            <div className="mt-3 flex flex-wrap gap-2">
              {effectiveType && (
                <span className="inline-flex items-center gap-1 rounded-md bg-white/5 px-2 py-1 text-xs text-white/70">
                  <Activity className="h-3 w-3" />
                  {effectiveType.toUpperCase()}
                </span>
              )}
              {typeof downlink === "number" && (
                <span className="inline-flex items-center gap-1 rounded-md bg-white/5 px-2 py-1 text-xs text-white/70">
                  ↓ {downlink.toFixed(1)} Mbps
                </span>
              )}
              {typeof probeRtt === "number" && (
                <span className="inline-flex items-center gap-1 rounded-md bg-white/5 px-2 py-1 text-xs text-white/70">
                  <Clock className="h-3 w-3" />
                  {Math.round(probeRtt)}ms
                </span>
              )}
            </div>
          )}

          {/* SSE Status */}
          <div className="mt-3 flex items-center gap-2">
            <Radio
              className={cn(
                "h-3.5 w-3.5",
                isSSEConnected ? "text-green-400" : "text-amber-400"
              )}
            />
            <span className="text-xs text-white/60">
              {sseState === "connected"
                ? "Live updates active"
                : sseState === "reconnecting"
                ? "Reconnecting..."
                : sseState === "connecting"
                ? "Connecting..."
                : "Live updates paused"}
            </span>
          </div>

          {/* Pending queue */}
          {pendingCount > 0 && (
            <div className="mt-3 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <div className="flex items-center justify-between">
                <span className="text-xs text-amber-200">
                  {pendingCount} pending change
                  {pendingCount !== 1 ? "s" : ""}
                </span>
                {online && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => processQueue()}
                    disabled={isProcessing}
                    className="h-6 px-2 text-xs text-amber-200 hover:text-amber-100 hover:bg-amber-500/20"
                  >
                    {isProcessing ? (
                      <RefreshCw className="h-3 w-3 animate-spin mr-1" />
                    ) : (
                      <RefreshCw className="h-3 w-3 mr-1" />
                    )}
                    Sync
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Connection History */}
        <div className="p-3">
          <div className="flex items-center justify-between mb-2">
            <h5 className="text-xs font-medium text-white/60 uppercase tracking-wider">
              Recent Activity
            </h5>
            {events.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearHistory}
                className="h-6 px-2 text-xs text-white/40 hover:text-white/60"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>

          {events.length === 0 ? (
            <p className="text-xs text-white/40 py-2 text-center">
              No recent connection events
            </p>
          ) : (
            <div className="max-h-[140px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
              <div className="space-y-2 pr-1">
                {events.slice(0, 10).map((event) => (
                  <div
                    key={event.id}
                    className="flex items-start gap-2 text-xs"
                  >
                    <div className="mt-0.5">{getEventIcon(event.type)}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white/80 truncate">
                        {event.details || event.type.replace("_", " ")}
                      </p>
                      <p className="text-white/40">
                        {formatTime(event.timestamp)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Summary Footer */}
        <div className="px-3 pb-3">
          <Separator className="mb-3 bg-white/10" />
          <div className="flex items-center justify-between text-xs text-white/40">
            <span>
              {summary.offlineCount} offline event
              {summary.offlineCount !== 1 ? "s" : ""} today
            </span>
            {summary.lastOffline && (
              <span>Last: {formatTime(summary.lastOffline)}</span>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
