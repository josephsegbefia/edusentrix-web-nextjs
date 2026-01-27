// src/components/brand/Logo.tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

type LogoProps = {
  /**
   * Size variant for the logo
   * - "sm": Small (48px height)
   * - "md": Medium (56px height) - default
   * - "lg": Large (80px height)
   * - "xl": Extra Large (104px height)
   * - "2xl": Extra Extra Large (144px height)
   */
  size?: "sm" | "md" | "lg" | "xl" | "2xl";
  /**
   * Whether to show the text "EduSentrix" next to the logo
   */
  showText?: boolean;
  /**
   * Whether the logo should be a link to the home page
   */
  href?: string | null;
  /**
   * Additional className for styling
   */
  className?: string;
  /**
   * Text size variant when showText is true
   */
  textSize?: "sm" | "md" | "lg";
};

const sizeMap = {
  sm: 48,
  md: 56,
  lg: 80,
  xl: 104,
  "2xl": 144,
};

const textSizeMap = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-lg",
};

export function Logo({
  size = "md",
  showText = false,
  href = "/",
  className,
  textSize = "md",
}: LogoProps) {
  const logoSize = sizeMap[size];
  const logoHeight = logoSize;
  const logoWidth = logoSize; // Adjust if your logo is not square

  const logoContent = (
    <div
      className={cn(
        "flex items-center justify-center gap-3",
        href && "transition-opacity hover:opacity-80",
        className
      )}
    >
      <div
        className="relative shrink-0 flex items-center justify-center"
        style={{ width: logoWidth, height: logoHeight }}
      >
        <Image
          src="/logo/edusentrix-logo.png"
          alt="EduSentrix Logo"
          width={logoWidth}
          height={logoHeight}
          priority
          className="object-contain w-full h-full"
          style={{
            filter: "drop-shadow(0 0 8px rgba(14, 165, 233, 0.3))",
          }}
        />
      </div>
      {showText && (
        <span
          className={cn(
            "font-semibold text-white tracking-tight leading-none",
            textSizeMap[textSize]
          )}
        >
          EduSentrix
        </span>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="inline-block">
        {logoContent}
      </Link>
    );
  }

  return logoContent;
}
