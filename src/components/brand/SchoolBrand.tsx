// src/components/brand/SchoolBrand.tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useSchool } from "@/hooks/admin/useSchool";
import { Loader2, School } from "lucide-react";

type SchoolBrandProps = {
  /**
   * Size variant
   * - "sm": Small (32px icon, text-sm)
   * - "md": Medium (40px icon, text-base) - default
   * - "lg": Large (48px icon, text-lg)
   */
  size?: "sm" | "md" | "lg";
  /**
   * Whether to show the school name next to the logo/initials
   */
  showName?: boolean;
  /**
   * Whether the brand should be a link
   */
  href?: string | null;
  /**
   * Additional className for styling
   */
  className?: string;
};

const sizeMap = {
  sm: { icon: 32, text: "text-sm" },
  md: { icon: 40, text: "text-base" },
  lg: { icon: 48, text: "text-lg" },
};

/**
 * Generate initials from school name
 */
function getInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length === 0) return "S";
  if (words.length === 1) {
    return words[0].substring(0, 2).toUpperCase();
  }
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

export function SchoolBrand({
  size = "md",
  showName = true,
  href = null,
  className,
}: SchoolBrandProps) {
  const { data: schoolData, isLoading, hasNoSchool, isError } = useSchool();
  const school = schoolData?.data;
  const sizeConfig = sizeMap[size];

  // Determine if we have valid school data
  const hasSchool = schoolData && schoolData.success && school;

  const brandContent = (
    <div
      className={cn(
        "flex items-center gap-3",
        href && "transition-opacity hover:opacity-80",
        className
      )}
    >
      {isLoading ? (
        <div className="flex items-center gap-3">
          <div
            className="flex shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5"
            style={{ width: sizeConfig.icon, height: sizeConfig.icon }}
          >
            <Loader2 className="h-4 w-4 animate-spin text-white/40" />
          </div>
          {showName && (
            <div className="h-4 w-24 animate-pulse rounded bg-white/10" />
          )}
        </div>
      ) : hasSchool ? (
        <>
          {/* Logo or Initials */}
          <div
            className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-linear-to-br from-indigo-500/20 to-purple-500/20 shadow-sm"
            style={{ width: sizeConfig.icon, height: sizeConfig.icon }}
          >
            {school.logo ? (
              <Image
                src={school.logo}
                alt={school.name}
                width={sizeConfig.icon}
                height={sizeConfig.icon}
                className="object-cover"
              />
            ) : (
              <span className="font-bold text-white" style={{ fontSize: sizeConfig.icon * 0.4 }}>
                {getInitials(school.name)}
              </span>
            )}
          </div>

          {/* School Name */}
          {showName && (
            <span
              className={cn(
                "font-semibold text-white tracking-tight truncate",
                sizeConfig.text
              )}
            >
              {school.name}
            </span>
          )}
        </>
      ) : (
        <div className="flex items-center gap-3">
          <div
            className="flex shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5"
            style={{ width: sizeConfig.icon, height: sizeConfig.icon }}
          >
            <School className="h-4 w-4 text-white/40" />
          </div>
          {showName && (
            <span className={cn("text-white/60", sizeConfig.text)}>
              {hasNoSchool ? "No School" : isError ? "School unavailable" : "Loading..."}
            </span>
          )}
        </div>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="inline-block">
        {brandContent}
      </Link>
    );
  }

  return brandContent;
}
