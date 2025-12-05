"use client";

import { useEffect, useState } from "react";
import { useNetworkHealth, NetworkQuality } from "@/hooks/useNetworkHealth";
import { Wifi, WifiOff } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

function getIndicatorConfig(quality: NetworkQuality, online: boolean) {
  if (!online || quality === "offline") {
    return {
      color: "bg-gray-500",
      icon: WifiOff,
      label: "Offline",
      description: "No internet connection",
    };
  }

  switch (quality) {
    case "poor":
      return {
        color: "bg-red-500",
        icon: Wifi,
        label: "Poor Connection",
        description: "Very slow network. Some actions may fail.",
      };
    case "degraded":
      return {
        color: "bg-yellow-500",
        icon: Wifi,
        label: "Degraded Connection",
        description: "Network performance may be impacted.",
      };
    case "good":
      return {
        color: "bg-green-500",
        icon: Wifi,
        label: "Good Connection",
        description: "Network is operating normally.",
      };
    default:
      return {
        color: "bg-gray-500",
        icon: Wifi,
        label: "Unknown",
        description: "Unable to determine network status.",
      };
  }
}

export function NetworkIndicator() {
  const [mounted, setMounted] = useState(false);
  const { quality, online, effectiveType, downlink, probeRtt } = useNetworkHealth(20000);

  // Prevent hydration mismatch by only rendering after mount
  useEffect(() => {
    setMounted(true);
  }, []);

  // Use a consistent default state for SSR
  const config = mounted
    ? getIndicatorConfig(quality, online)
    : {
        color: "bg-gray-500",
        icon: Wifi,
        label: "Checking Connection",
        description: "Determining network status...",
      };

  const Icon = config.icon;

  const tooltipText = mounted
    ? [
        config.label,
        effectiveType && `Network: ${effectiveType}`,
        typeof downlink === "number" && `Downlink: ${downlink.toFixed(1)}Mbps`,
        typeof probeRtt === "number" && `RTT: ${Math.round(probeRtt)}ms`,
      ]
        .filter(Boolean)
        .join(" • ")
    : config.label;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-white/5 transition-colors"
            aria-label={config.label}
          >
            <div className="relative">
              <Icon className="h-4 w-4 text-white/60" />
              <span
                className={`absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border-2 border-card ${config.color}`}
              />
            </div>
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <p className="text-sm">{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
