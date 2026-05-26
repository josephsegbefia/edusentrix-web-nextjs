"use client";

import * as React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

type LearnLogoIconProps = {
  className?: string;
};

export function LearnLogoIcon({ className }: LearnLogoIconProps) {
  return (
    <Image
      src="/logo/learn/logo-mark-leo-learning.png"
      alt=""
      aria-hidden="true"
      width={24}
      height={24}
      className={cn("h-[1em] w-[1em] object-contain", className)}
    />
  );
}
