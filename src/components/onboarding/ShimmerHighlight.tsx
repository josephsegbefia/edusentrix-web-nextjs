"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";
import clsx from "clsx";

type ShimmerHighlightProps = {
  children: ReactNode;
  enabled?: boolean;
  className?: string;
};

export function ShimmerHighlight({
  children,
  enabled = true,
  className,
}: ShimmerHighlightProps) {
  if (!enabled) {
    return <>{children}</>;
  }

  return (
    <div className={clsx("relative", className)}>
      {/* Pulsing border glow */}
      <motion.div
        className="absolute -inset-0.5 rounded-xl"
        animate={{
          boxShadow: [
            "0 0 0 0 rgba(139, 92, 246, 0.4)",
            "0 0 0 4px rgba(139, 92, 246, 0.2)",
            "0 0 0 8px rgba(139, 92, 246, 0.1)",
            "0 0 0 4px rgba(139, 92, 246, 0.2)",
            "0 0 0 0 rgba(139, 92, 246, 0.4)",
          ],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        style={{
          background:
            "linear-gradient(135deg, rgba(139, 92, 246, 0.3), rgba(168, 85, 247, 0.2))",
        }}
      />
      {/* Inner border pulse */}
      <motion.div
        className="absolute -inset-px rounded-xl border-2 border-brand/50"
        animate={{
          opacity: [0.5, 1, 0.5],
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
      {/* Content */}
      <div className="relative">{children}</div>
    </div>
  );
}
