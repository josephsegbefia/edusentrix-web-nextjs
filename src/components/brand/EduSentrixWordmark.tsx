import { EDUSENTRIX_WORDMARK_GRADIENT_STYLE } from "@/lib/branding";
import { cn } from "@/lib/utils";

type EduSentrixWordmarkProps = {
  className?: string;
  /** Render as inline (span) or block (div). Default span. */
  as?: "span" | "div";
  /**
   * `gradient` keeps the brand gradient.
   * `adaptive` follows the marketing foreground token (navy in light, white in dark).
   */
  tone?: "gradient" | "adaptive";
};

/** Brand name with the product logo gradient (purple → blue → cyan). */
export function EduSentrixWordmark({
  className,
  as: Tag = "span",
  tone = "gradient",
}: EduSentrixWordmarkProps) {
  if (tone === "adaptive") {
    return (
      <Tag className={cn("font-semibold tracking-tight text-(--m-fg)", className)}>
        EduSentrix
      </Tag>
    );
  }

  return (
    <Tag className={cn("font-semibold tracking-tight", className)} style={EDUSENTRIX_WORDMARK_GRADIENT_STYLE}>
      EduSentrix
    </Tag>
  );
}
