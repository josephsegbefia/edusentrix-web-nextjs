"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type Props = React.SVGProps<SVGSVGElement>;

/**
 * Lion head icon for Leo AI branding. Designed to read clearly at small sizes.
 */
export function LeoIcon({ className, ...props }: Props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("size-4", className)}
      {...props}
    >
      {/* Mane - bold arcs, edge-to-edge */}
      <path d="M3 11 Q12 4 21 11" />
      <path d="M4 13 Q12 7 20 13" />
      {/* Face - fills most of the icon */}
      <circle cx="12" cy="14" r="7" />
      {/* Ears */}
      <path d="M6 10 L8.5 6 L11 10" />
      <path d="M18 10 L15.5 6 L13 10" />
      {/* Eyes */}
      <circle cx="9.5" cy="13.5" r="1.5" fill="currentColor" />
      <circle cx="14.5" cy="13.5" r="1.5" fill="currentColor" />
      {/* Nose */}
      <path d="M11.5 17 h1" />
    </svg>
  );
}
