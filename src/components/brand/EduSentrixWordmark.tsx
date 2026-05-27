import { EDUSENTRIX_WORDMARK_GRADIENT_STYLE } from "@/lib/branding";
import { cn } from "@/lib/utils";

type EduSentrixWordmarkProps = {
  className?: string;
  /** Render as inline (span) or block (div). Default span. */
  as?: "span" | "div";
};

/** Brand name with the product logo gradient (purple → blue → cyan). */
export function EduSentrixWordmark({ className, as: Tag = "span" }: EduSentrixWordmarkProps) {
  return (
    <Tag className={cn("font-semibold tracking-tight", className)} style={EDUSENTRIX_WORDMARK_GRADIENT_STYLE}>
      EduSentrix
    </Tag>
  );
}
