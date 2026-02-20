"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Component to safely render HTML content with proper styling
 * Strips empty paragraphs and handles basic formatting
 */

interface HtmlContentProps {
  html: string | undefined | null;
  className?: string;
  fallback?: string;
}

export function HtmlContent({ html, className, fallback = "—" }: HtmlContentProps) {
  if (!html || html === "<p></p>" || html.trim() === "") {
    return <span className={cn("text-white/40 italic", className)}>{fallback}</span>;
  }

  return (
    <div
      className={cn(
        "prose prose-sm prose-invert max-w-none",
        "prose-p:text-white/80 prose-p:my-1",
        "prose-strong:text-white prose-em:text-white/80",
        "prose-ul:text-white/80 prose-ol:text-white/80 prose-li:text-white/80",
        "prose-li:marker:text-white/50",
        "prose-headings:text-white prose-headings:mt-2 prose-headings:mb-1",
        className
      )}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/**
 * Extract plain text from HTML
 * Useful for previews and quality checks
 */
export function extractPlainText(html: string | undefined | null): string {
  if (!html) return "";
  
  // Server-side or simple extraction
  if (typeof window === "undefined") {
    return html
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .trim();
  }

  // Client-side: use DOM
  const div = document.createElement("div");
  div.innerHTML = html;
  return div.textContent || div.innerText || "";
}

/**
 * Check if HTML content is effectively empty
 */
export function isHtmlEmpty(html: string | undefined | null): boolean {
  if (!html) return true;
  const text = extractPlainText(html);
  return text.trim().length === 0;
}
