"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  glassPanelClass,
  glassPanelGlowCyanClass,
  glassPanelGlowTealClass,
  glassPanelTopShineClass,
} from "@/lib/ui/glass-surfaces";

type GlassPanelProps = React.HTMLAttributes<HTMLDivElement> & {
  glow?: "teal" | "cyan" | "both" | "none";
  as?: "motion.div" | "div";
};

export function GlassPanel({
  children,
  className,
  glow = "teal",
  as: Tag = "div",
  ...props
}: GlassPanelProps) {
  return (
    <Tag className={cn(glassPanelClass, className)} {...props}>
      <div className={glassPanelTopShineClass} aria-hidden="true" />
      {glow === "teal" || glow === "both" ? (
        <div className={glassPanelGlowTealClass} aria-hidden="true" />
      ) : null}
      {glow === "cyan" || glow === "both" ? (
        <div className={glassPanelGlowCyanClass} aria-hidden="true" />
      ) : null}
      <div className="relative z-10">{children}</div>
    </Tag>
  );
}
