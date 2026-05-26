"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  BookOpen,
  BookOpenCheck,
  CalendarCheck2,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  CheckSquare,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  CreditCard,
  FileCheck2,
  FileText,
  FolderKanban,
  GraduationCap,
  HelpCircle,
  KeyRound,
  Landmark,
  ListChecks,
  Megaphone,
  NotebookPen,
  Percent,
  Presentation,
  RefreshCw,
  Search,
  Send,
  Settings,
  ShieldAlert,
  Sparkles,
  Table2,
  TrendingUp,
  Users,
  Video,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { glassSecondaryButtonClass } from "@/lib/ui/glass-surfaces";

/** Serializable icon keys for use from Server Components. */
export const WORKSPACE_HEADER_ICONS = {
  "alert-triangle": AlertTriangle,
  "bar-chart-3": BarChart3,
  "book-open": BookOpen,
  "book-open-check": BookOpenCheck,
  "calendar-check-2": CalendarCheck2,
  "calendar-days": CalendarDays,
  "calendar-range": CalendarRange,
  "check-circle-2": CheckCircle2,
  "check-square": CheckSquare,
  "clipboard-check": ClipboardCheck,
  "clipboard-list": ClipboardList,
  "clock-3": Clock3,
  "credit-card": CreditCard,
  "file-check-2": FileCheck2,
  "file-text": FileText,
  "folder-kanban": FolderKanban,
  "graduation-cap": GraduationCap,
  "help-circle": HelpCircle,
  "key-round": KeyRound,
  "landmark": Landmark,
  "list-checks": ListChecks,
  "megaphone": Megaphone,
  "notebook-pen": NotebookPen,
  "percent": Percent,
  "presentation": Presentation,
  "refresh-cw": RefreshCw,
  "search": Search,
  "send": Send,
  "settings": Settings,
  "shield-alert": ShieldAlert,
  "sparkles": Sparkles,
  "table-2": Table2,
  "trending-up": TrendingUp,
  "users": Users,
  video: Video,
} as const satisfies Record<string, LucideIcon>;

export type WorkspaceHeaderIconName = keyof typeof WORKSPACE_HEADER_ICONS;

type WorkspacePageHeaderProps = {
  title: string;
  subtitle?: string;
  backHref?: string;
  backLabel?: string;
  /** Use from Server Components (serializable). */
  iconName?: WorkspaceHeaderIconName;
  /** Use from Client Components only. */
  icon?: LucideIcon;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
};

export function WorkspacePageHeader({
  title,
  subtitle,
  backHref,
  backLabel = "Back",
  iconName,
  icon: iconProp,
  badge,
  actions,
  className,
}: WorkspacePageHeaderProps) {
  const Icon = iconName ? WORKSPACE_HEADER_ICONS[iconName] : iconProp;

  return (
    <header className={cn("space-y-4", className)}>
      {backHref ? (
        <Button
          asChild
          variant="outline"
          size="sm"
          className={cn("gap-2 rounded-xl", glassSecondaryButtonClass)}
        >
          <Link href={backHref}>
            <ArrowLeft className="h-4 w-4" />
            {backLabel}
          </Link>
        </Button>
      ) : null}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          {Icon ? (
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-teal-400/30 bg-linear-to-br from-teal-500/20 to-cyan-500/15 shadow-inner shadow-white/5">
              <Icon className="h-6 w-6 text-teal-200" />
            </div>
          ) : null}
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="bg-linear-to-r from-teal-200 via-cyan-200 to-sky-300 bg-clip-text text-2xl font-extrabold tracking-tight text-transparent sm:text-3xl">
                {title}
              </h1>
              {badge}
            </div>
            {subtitle ? (
              <p className="max-w-2xl text-sm leading-relaxed text-white/60">{subtitle}</p>
            ) : null}
          </div>
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}
