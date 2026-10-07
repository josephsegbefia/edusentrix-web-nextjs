import Image from "next/image";
import { EduSentrixWordmark } from "@/components/brand/EduSentrixWordmark";
import { EDUSENTRIX_LOGO_ALT, EDUSENTRIX_LOGO_PATH } from "@/lib/branding";
import { cn } from "@/lib/utils";

type BrandMarkProps = {
  size?: "sm" | "md";
  showTagline?: boolean;
  className?: string;
  wordmarkClassName?: string;
};

const tileClass = {
  sm: "h-9 w-9 rounded-xl",
  md: "h-11 w-14 rounded-2xl sm:h-14 sm:w-[4.35rem]",
} as const;

export function BrandMark({
  size = "md",
  showTagline = false,
  className,
  wordmarkClassName,
}: BrandMarkProps) {
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2.5 sm:gap-3", className)}>
      <span
        className={cn(
          "relative flex shrink-0 items-center justify-center overflow-hidden border border-(--m-border)",
          tileClass[size]
        )}
        style={{
          backgroundColor: "var(--m-logo-bg)",
          boxShadow: "var(--m-logo-shadow)",
        }}
      >
        <Image
          src={EDUSENTRIX_LOGO_PATH}
          alt={EDUSENTRIX_LOGO_ALT}
          fill
          sizes={size === "sm" ? "36px" : "70px"}
          className="object-contain p-1"
          priority={size === "md"}
        />
      </span>
      <span className="flex min-w-0 flex-col">
        <EduSentrixWordmark
          tone="adaptive"
          className={cn(
            size === "sm" ? "text-lg" : "text-lg sm:text-[1.35rem]",
            wordmarkClassName
          )}
        />
        {showTagline ? (
          <span className="m-faint hidden text-[11px] font-medium uppercase tracking-[0.22em] sm:block">
            School OS for Africa
          </span>
        ) : null}
      </span>
    </span>
  );
}
