"use client";

import * as React from "react";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useSchool } from "@/hooks/admin/useSchool";
import { Loader2, School } from "lucide-react";
import { SchoolHealthModal } from "@/components/nav/sidebars/SchoolHealthModal";

type SidebarRole =
  | "school_admin"
  | "teacher"
  | "parent"
  | "student"
  | "bursar"
  | "billing_owner";

type SidebarSchoolIdentityProps = {
  href: string;
  role: SidebarRole;
  collapsed?: boolean;
  className?: string;
};

const SCHOOL_PLACEHOLDER_SRC = "/placeholders/school-logo-placeholder.svg";

const ROLE_META: Record<
  SidebarRole,
  { label: string; shortLabel: string; accentColor: string; badgeClassName: string }
> = {
  school_admin: {
    label: "School Admin",
    shortLabel: "SA",
    accentColor: "violet",
    badgeClassName: "border-violet-500/25 bg-violet-500/10 text-violet-700 dark:text-violet-200",
  },
  teacher: {
    label: "Teacher",
    shortLabel: "T",
    accentColor: "emerald",
    badgeClassName: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200",
  },
  parent: {
    label: "Parent",
    shortLabel: "P",
    accentColor: "amber",
    badgeClassName: "border-amber-500/25 bg-amber-500/10 text-amber-800 dark:text-amber-200",
  },
  student: {
    label: "Student",
    shortLabel: "S",
    accentColor: "sky",
    badgeClassName: "border-sky-500/25 bg-sky-500/10 text-sky-800 dark:text-sky-200",
  },
  bursar: {
    label: "Bursar",
    shortLabel: "B",
    accentColor: "orange",
    badgeClassName: "border-orange-500/25 bg-orange-500/10 text-orange-800 dark:text-orange-200",
  },
  billing_owner: {
    label: "Billing Owner",
    shortLabel: "BO",
    accentColor: "cyan",
    badgeClassName: "border-cyan-500/25 bg-cyan-500/10 text-cyan-800 dark:text-cyan-200",
  },
};

function LogoFrame({
  src,
  alt,
  collapsed,
  roleShortLabel,
}: {
  src: string;
  alt: string;
  collapsed: boolean;
  roleShortLabel: string;
}) {
  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-2xl border border-(--m-border)",
        collapsed ? "h-11 w-11" : "h-12 w-12"
      )}
      style={{ backgroundColor: "var(--m-logo-bg)", boxShadow: "var(--m-logo-shadow)" }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-linear-to-br from-white/8 via-transparent to-cyan-400/6"
      />
      <Image
        src={src}
        alt={alt}
        fill
        sizes={collapsed ? "44px" : "48px"}
        className="object-contain p-1.5"
      />
      {collapsed && (
        <div className="absolute -bottom-0.5 -right-0.5 rounded-full border border-slate-950 bg-card px-1 py-0.5 text-[8px] font-bold tracking-wider text-(--m-fg)">
          {roleShortLabel}
        </div>
      )}
    </div>
  );
}

export function SidebarSchoolIdentity({
  href,
  role,
  collapsed = false,
  className,
}: SidebarSchoolIdentityProps) {
  const { data, isLoading, hasNoSchool, isError } = useSchool();
  const [modalOpen, setModalOpen] = React.useState(false);
  const school = data?.data;
  const roleMeta = ROLE_META[role];
  const motto = school?.motto?.trim() || null;

  if (collapsed) {
    return (
      <button
        onClick={() => setModalOpen(true)}
        className={cn("inline-flex rounded-2xl transition-opacity hover:opacity-90", className)}
        title={
          school?.name
            ? `${school.name} • ${roleMeta.label}`
            : `${roleMeta.label} workspace`
        }
      >
        <LogoFrame
          src={school?.logo || SCHOOL_PLACEHOLDER_SRC}
          alt={school?.name || "School"}
          collapsed
          roleShortLabel={roleMeta.shortLabel}
        />
        {school && (
          <SchoolHealthModal
            open={modalOpen}
            onOpenChange={setModalOpen}
            school={school}
            role={role}
            href={href}
          />
        )}
      </button>
    );
  }

  if (isLoading) {
    return (
      <div
        className={cn(
          "rounded-2xl bg-(--m-subtle) p-3.5",
          className
        )}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-(--m-subtle)">
            <Loader2 className="h-4 w-4 animate-spin m-faint" />
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-3.5 w-32 animate-pulse rounded bg-(--m-subtle)" />
            <div className="h-2.5 w-24 animate-pulse rounded bg-(--m-subtle)" />
          </div>
        </div>
      </div>
    );
  }

  const title = school?.name || (hasNoSchool ? "No School" : "School unavailable");
  const subtitle = motto
    ? `"${motto}"`
    : isError
      ? "Could not load"
      : "School profile";

  return (
    <>
      <button
        onClick={() => setModalOpen(true)}
        className={cn(
          "group w-full text-left rounded-2xl bg-(--m-subtle) p-3.5 transition-all duration-200 hover:bg-(--m-subtle)",
          className
        )}
      >
        <div className="flex items-center gap-3">
          <LogoFrame
            src={school?.logo || SCHOOL_PLACEHOLDER_SRC}
            alt={title}
            collapsed={false}
            roleShortLabel={roleMeta.shortLabel}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold tracking-tight text-(--m-fg)">
              {title}
            </p>
            {subtitle && (
              <p
                className={cn(
                  "mt-0.5 truncate text-[11px] leading-4",
                  motto ? "italic m-faint" : "m-faint"
                )}
              >
                {subtitle}
              </p>
            )}
            <div className="mt-1.5 flex items-center gap-1.5">
              <Badge
                variant="outline"
                className={cn(
                  "rounded-full px-2 py-0.5 text-[9px] font-semibold tracking-wider",
                  roleMeta.badgeClassName
                )}
              >
                {roleMeta.label}
              </Badge>
              {school?.type && (
                <span className="text-[9px] font-medium m-faint">
                  {school.type}
                </span>
              )}
            </div>
          </div>
        </div>
      </button>

      {school && (
        <SchoolHealthModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          school={school}
          role={role}
          href={href}
        />
      )}
    </>
  );
}
