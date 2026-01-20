// src/components/brand/LogoIcon.tsx
"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

type LogoIconProps = {
  /**
   * Size variant for the icon
   * - "sm": Small (48px)
   * - "md": Medium (56px) - default
   * - "lg": Large (80px)
   * - "xl": Extra Large (104px)
   * - "2xl": Extra Extra Large (144px)
   */
  size?: "sm" | "md" | "lg" | "xl" | "2xl";
  /**
   * Additional className for styling
   */
  className?: string;
  /**
   * Whether to show a subtle glow effect
   */
  glow?: boolean;
};

const sizeMap = {
  sm: 48,
  md: 56,
  lg: 80,
  xl: 104,
  "2xl": 144,
};

export function LogoIcon({
  size = "md",
  className,
  glow = true,
}: LogoIconProps) {
  const iconSize = sizeMap[size];

  return (
    <div
      className={cn("relative shrink-0", className)}
      style={{ width: iconSize, height: iconSize }}
    >
      <Image
        src="/logo/edusentrix-logo.png"
        alt="EduSentrix"
        width={iconSize}
        height={iconSize}
        priority
        className="object-contain"
        style={
          glow
            ? {
                filter: "drop-shadow(0 0 8px rgba(14, 165, 233, 0.3))",
              }
            : undefined
        }
      />
    </div>
  );
}
