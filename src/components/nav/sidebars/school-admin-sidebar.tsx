// src/components/nav/sidebars/school-admin-sidebar.tsx
"use client";
import * as React from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import ActiveLink from "../active/ActiveLink";
import {
  LayoutDashboard,
  GraduationCap,
  BookOpen,
  Calendar,
  CalendarDays,
  CalendarRange,
  DollarSign,
  FileText,
  BarChart3,
  Settings,
  School,
  UserCog,
  Mail,
  ClipboardCheck,
  Menu,
  X,
  Crown,
  Vote,
  Heart,
  Landmark,
  Wallet,
  Receipt,
  FileSearch,
  Send,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  ShoppingBag,
  ClipboardList,
  Video,
  Lock,
  ScrollText,
  Share2,
  Library,
  Bookmark,
  RefreshCw,
  ScanLine,
  AlertTriangle,
  BarChart2,
  Upload,
  History,
  Megaphone,
  ChevronDown,
  ClipboardSignature,
} from "lucide-react";
import {
  premiumSideItem,
  premiumSideItemActive,
} from "@/components/ui/premium";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarSchoolIdentity } from "@/components/nav/sidebars/SidebarSchoolIdentity";
import { SidebarFooterBranding } from "@/components/nav/sidebars/SidebarFooterBranding";
import { useSidebar } from "@/providers/sidebar-provider";
import { useSchool } from "@/hooks/admin/useSchool";
import { useOnboardingProgress } from "@/hooks/admin/useOnboardingProgress";

type NavItemBase = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
};

type NavItem = NavItemBase & {
  children?: NavItemBase[];
  /** When true, children can be hidden even on a store or supply route. */
  allowCollapseWhenActive?: boolean;
};

type NavSection = {
  title: string;
  items: NavItem[];
};

const CURRICULUM_SHORT_LABELS: Record<string, string> = {
  ghana_nacca: "NaCCA",
  cambridge: "Cambridge",
  ib_pyp: "IB PYP",
  ib_myp: "IB MYP",
  british_nc: "British NC",
  american: "American",
  hybrid: "Hybrid",
};

const navSections: NavSection[] = [
  {
    title: "Overview",
    items: [
      {
        label: "Dashboard",
        href: "/admin",
        icon: LayoutDashboard,
        exact: true,
      },
    ],
  },
  {
    title: "People",
    items: [
      {
        label: "Students",
        href: "/admin/students",
        icon: GraduationCap,
      },
      {
        label: "Teachers",
        href: "/admin/teachers",
        icon: UserCog,
      },
      {
        label: "Roles & Duties",
        href: "/admin/roles-duties",
        icon: Crown,
      },
      {
        label: "Staff Attendance",
        href: "/admin/staff-attendance",
        icon: ClipboardCheck,
      },
      {
        label: "Invitations",
        href: "/admin/invitations",
        icon: Mail,
      },
      {
        label: "Admissions",
        href: "/admin/admissions",
        icon: ClipboardSignature,
      },
      {
        label: "Delegations",
        href: "/admin/delegations",
        icon: Share2,
      },
    ],
  },
  {
    title: "Academics",
    items: [
      {
        label: "Grades",
        href: "/admin/grades",
        icon: School,
      },
      {
        label: "Subjects",
        href: "/admin/subjects",
        icon: BookOpen,
      },
      {
        label: "Lesson Notes",
        href: "/admin/lesson-notes",
        icon: FileText,
      },
      {
        label: "Lesson analytics",
        href: "/admin/lessons/analytics",
        icon: BarChart3,
      },
      {
        label: "Lesson audit log",
        href: "/admin/lessons/audit",
        icon: ScrollText,
      },
      {
        label: "Curriculum",
        href: "/admin/settings/curriculum",
        icon: GraduationCap,
      },
      {
        label: "Timetable Hub",
        href: "/admin/timetable",
        icon: CalendarDays,
      },
      {
        label: "Academic Calendar",
        href: "/admin/academic-calendar",
        icon: CalendarRange,
      },
      {
        label: "Academic Periods",
        href: "/admin/periods",
        icon: Calendar,
      },
      {
        label: "Promotions",
        href: "/admin/promotions",
        icon: TrendingUp,
      },
    ],
  },
  {
    title: "Community",
    items: [
      {
        label: "Meetings",
        href: "/admin/meetings",
        icon: Video,
      },
      {
        label: "Polls",
        href: "/admin/community/polls",
        icon: Vote,
      },
      {
        label: "Fundraising",
        href: "/admin/community/fundraising",
        icon: Heart,
      },
    ],
  },
  {
    title: "Operations",
    items: [
      {
        label: "Financial Center",
        href: "/admin/finance",
        icon: Landmark,
        exact: true,
      },
      {
        label: "Subscription",
        href: "/admin/billing",
        icon: Wallet,
      },
      {
        label: "Reconciliation",
        href: "/admin/finance/reconciliation/sessions",
        icon: FileSearch,
      },
      {
        label: "Fees & Payments",
        href: "/admin/fees",
        icon: DollarSign,
      },
      {
        label: "School store",
        href: "/admin/store",
        icon: ShoppingBag,
        exact: false,
        allowCollapseWhenActive: true,
        children: [
          {
            label: "Supply programs",
            href: "/admin/supplies",
            icon: ClipboardList,
          },
        ],
      },
      {
        label: "Expenses",
        href: "/admin/expenses",
        icon: Receipt,
      },
      {
        label: "Disbursements",
        href: "/admin/finance/disbursements",
        icon: Send,
      },
      {
        label: "Reports",
        href: "/admin/reports",
        icon: BarChart3,
      },
      {
        label: "Documents",
        href: "/admin/documents",
        icon: FileText,
      },
      {
        label: "Library",
        href: "/admin/library",
        icon: Library,
        exact: true,
        children: [
          {
            label: "Circulation",
            href: "/admin/library/circulation",
            icon: RefreshCw,
          },
          {
            label: "Scan & lookup",
            href: "/admin/library/scan",
            icon: ScanLine,
          },
          {
            label: "Overdue & fines",
            href: "/admin/library/overdue",
            icon: AlertTriangle,
          },
          {
            label: "Reports",
            href: "/admin/library/reports",
            icon: BarChart2,
          },
          {
            label: "CSV import",
            href: "/admin/library/imports",
            icon: Upload,
          },
          {
            label: "Borrowing history",
            href: "/admin/library/history",
            icon: History,
          },
          {
            label: "Reservations",
            href: "/admin/library/reservations",
            icon: Bookmark,
          },
          {
            label: "Patron notices",
            href: "/admin/library/notices",
            icon: Megaphone,
          },
        ],
      },
    ],
  },
  {
    title: "System",
    items: [
      {
        label: "Email",
        href: "/admin/email",
        icon: Mail,
      },
      {
        label: "Settings",
        href: "/admin/settings",
        icon: Settings,
      },
    ],
  },
];

const sidebarTooltipClasses =
  "bg-white/10 text-white ring-1 ring-white/10 rounded-xl backdrop-blur-md border-0 px-3 py-2.5 text-sm font-medium shadow-lg";

function CurriculumBadge({ collapsed }: { collapsed: boolean }) {
  const { data } = useSchool();
  const { shouldRestrictSchoolAdminNav } = useOnboardingProgress();
  const currCode = data?.data?.curriculumCode;

  if (!currCode) return null;

  const label = CURRICULUM_SHORT_LABELS[currCode] || currCode;
  const locked = shouldRestrictSchoolAdminNav;

  if (collapsed) {
    const icon = (
      <span
        className={cn(
          "flex h-8 w-8 mx-auto items-center justify-center rounded-lg border border-brand/20 bg-brand/10 transition-colors",
          locked ? "cursor-not-allowed opacity-50" : "hover:bg-brand/15"
        )}
        aria-disabled={locked}
      >
        <BookOpen className="h-3.5 w-3.5 text-brand" />
      </span>
    );
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>
          {locked ? (
            icon
          ) : (
            <ActiveLink
              href="/admin/settings/curriculum"
              className="flex h-8 w-8 mx-auto items-center justify-center rounded-lg border border-brand/20 bg-brand/10 transition-colors hover:bg-brand/15"
            >
              <BookOpen className="h-3.5 w-3.5 text-brand" />
            </ActiveLink>
          )}
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={8} className={sidebarTooltipClasses}>
          {locked
            ? `${label} curriculum — unlock after school setup on the Dashboard`
            : `${label} Curriculum`}
        </TooltipContent>
      </Tooltip>
    );
  }

  if (locked) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>
          <span
            className="flex cursor-not-allowed items-center gap-2 rounded-lg border border-brand/15 bg-brand/5 px-3 py-1.5 opacity-50"
            aria-disabled="true"
          >
            <BookOpen className="h-3.5 w-3.5 text-brand" />
            <span className="text-[11px] font-semibold text-brand tracking-wide">
              {label}
            </span>
            <Lock className="ml-auto h-3 w-3 text-white/35" />
          </span>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={8} className={sidebarTooltipClasses}>
          Complete school setup on the Dashboard to open curriculum settings.
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <ActiveLink
      href="/admin/settings/curriculum"
      className="flex items-center gap-2 rounded-lg border border-brand/15 bg-brand/5 px-3 py-1.5 transition-colors hover:bg-brand/10"
    >
      <BookOpen className="h-3.5 w-3.5 text-brand" />
      <span className="text-[11px] font-semibold text-brand tracking-wide">
        {label}
      </span>
    </ActiveLink>
  );
}

const NAV_LOCK_TOOLTIP =
  "Complete school setup on the Dashboard to unlock this section.";

function pathInNavGroupTree(
  pathname: string,
  parentHref: string,
  children: NavItemBase[]
): boolean {
  if (pathname === parentHref || pathname.startsWith(`${parentHref}/`)) return true;
  return children.some(
    (c) => pathname === c.href || pathname.startsWith(`${c.href}/`)
  );
}

function isAdminDashboardItem(href: string, exact?: boolean) {
  return href === "/admin" && !!exact;
}

function NavContent({
  onItemClick,
  collapsed,
}: {
  onItemClick?: () => void;
  collapsed: boolean;
}) {
  const pathname = usePathname();
  const { shouldRestrictSchoolAdminNav } = useOnboardingProgress();
  const [navGroupExpanded, setNavGroupExpanded] = React.useState<Record<string, boolean>>(
    {}
  );

  React.useEffect(() => {
    setNavGroupExpanded((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const section of navSections) {
        for (const item of section.items) {
          const kids = item.children ?? [];
          if (kids.length === 0) continue;
          if (!pathInNavGroupTree(pathname, item.href, kids)) {
            if (next[item.href] !== undefined) {
              delete next[item.href];
              changed = true;
            }
          }
        }
      }
      return changed ? next : prev;
    });
  }, [pathname]);

  return (
    <nav className={cn("space-y-5", collapsed && "space-y-3")}>
      {navSections.map((section, sectionIdx) => (
        <div key={section.title}>
          {!collapsed && (
            <div className="mb-2 px-3.5">
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/30">
                {section.title}
              </h3>
            </div>
          )}

          <div className={cn("space-y-0.5", collapsed && "space-y-1.5")}>
            {section.items.map((item) => {
              const { label, href, icon: Icon, exact, children, allowCollapseWhenActive } =
                item;
              const childList = children ?? [];
              const locked =
                shouldRestrictSchoolAdminNav && !isAdminDashboardItem(href, exact);

              const routeActive = (path: string, ex?: boolean) =>
                ex ? pathname === path : pathname === path || pathname.startsWith(`${path}/`);

              if (childList.length > 0) {
                const inTree = pathInNavGroupTree(pathname, href, childList);
                const alwaysToggle = !!allowCollapseWhenActive;
                const groupExpanded = alwaysToggle
                  ? navGroupExpanded[href] !== undefined
                    ? navGroupExpanded[href]
                    : inTree
                  : inTree || (navGroupExpanded[href] ?? false);
                const toggleGroup = () => {
                  if (!alwaysToggle && inTree) return;
                  if (alwaysToggle) {
                    const current =
                      navGroupExpanded[href] !== undefined ? navGroupExpanded[href] : inTree;
                    setNavGroupExpanded((p) => ({ ...p, [href]: !current }));
                  } else {
                    setNavGroupExpanded((p) => ({
                      ...p,
                      [href]: !((p[href] ?? false)),
                    }));
                  }
                };
                const parentActiveCollapsed = inTree;
                const parentActiveExpanded =
                  routeActive(href, exact) ||
                  childList.some((c) => routeActive(c.href, c.exact));

                if (collapsed) {
                  if (locked) {
                    return (
                      <Tooltip key={href} delayDuration={0}>
                        <TooltipTrigger asChild>
                          <span
                            className={cn(
                              "flex h-10 w-10 mx-auto cursor-not-allowed items-center justify-center rounded-xl",
                              "text-white/30 opacity-60"
                            )}
                            aria-disabled="true"
                          >
                            <Icon className="h-4 w-4 shrink-0" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent
                          side="right"
                          sideOffset={8}
                          className={sidebarTooltipClasses}
                        >
                          {label} — {NAV_LOCK_TOOLTIP}
                        </TooltipContent>
                      </Tooltip>
                    );
                  }
                  return (
                    <Tooltip key={href} delayDuration={0}>
                      <TooltipTrigger asChild>
                        <ActiveLink
                          href={href}
                          exact={false}
                          onClick={onItemClick}
                          className={cn(
                            "flex h-10 w-10 mx-auto items-center justify-center rounded-xl",
                            "text-white/50 hover:text-white hover:bg-white/7 transition-all duration-200",
                            parentActiveCollapsed &&
                              "bg-white/9 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
                          )}
                          activeClassName="nav-active"
                        >
                          <Icon className="h-4 w-4 shrink-0" />
                        </ActiveLink>
                      </TooltipTrigger>
                      <TooltipContent side="right" sideOffset={8} className={sidebarTooltipClasses}>
                        {label}
                      </TooltipContent>
                    </Tooltip>
                  );
                }

                if (locked) {
                  return (
                    <Tooltip key={href} delayDuration={0}>
                      <TooltipTrigger asChild>
                        <span
                          className={cn(
                            premiumSideItem,
                            "cursor-not-allowed opacity-45 pointer-events-auto"
                          )}
                          aria-disabled="true"
                          tabIndex={0}
                        >
                          <Icon className="h-4 w-4 shrink-0 text-white/40" />
                          <span className="truncate">{label}</span>
                          <Lock className="ml-auto h-3.5 w-3.5 shrink-0 text-white/25" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent
                        side="right"
                        sideOffset={8}
                        className={sidebarTooltipClasses}
                      >
                        {NAV_LOCK_TOOLTIP}
                      </TooltipContent>
                    </Tooltip>
                  );
                }

                return (
                  <div key={href} className="space-y-0.5">
                    <div className="flex min-w-0 items-stretch gap-0.5">
                      <ActiveLink
                        href={href}
                        exact={exact}
                        onClick={onItemClick}
                        className={cn(
                          premiumSideItem,
                          "min-w-0 flex-1 pr-1",
                          parentActiveExpanded && premiumSideItemActive
                        )}
                        activeClassName="nav-active"
                      >
                        <Icon
                          className={cn(
                            "h-4 w-4 shrink-0",
                            parentActiveExpanded && "text-violet-400"
                          )}
                        />
                        <span className="truncate">{label}</span>
                      </ActiveLink>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          toggleGroup();
                        }}
                        className={cn(
                          premiumSideItem,
                          "w-9 shrink-0 justify-center px-0 text-white/50 hover:text-white",
                          !alwaysToggle && inTree && "cursor-default opacity-60"
                        )}
                        aria-expanded={groupExpanded}
                        aria-label={groupExpanded ? `Collapse ${label}` : `Expand ${label}`}
                      >
                        <ChevronDown
                          className={cn(
                            "h-4 w-4 transition-transform duration-200",
                            !groupExpanded && "-rotate-90"
                          )}
                        />
                      </button>
                    </div>
                    {groupExpanded ? (
                      <div className="relative ml-3.5 space-y-0.5 border-l border-white/10 pl-3">
                        {childList.map((child) => {
                          const ChildIcon = child.icon;
                          const childActive = routeActive(child.href, child.exact);
                          return (
                            <ActiveLink
                              key={child.href}
                              href={child.href}
                              exact={child.exact}
                              onClick={onItemClick}
                              className={cn(
                                premiumSideItem,
                                "text-[13px]",
                                childActive && premiumSideItemActive
                              )}
                              activeClassName="nav-active"
                            >
                              <ChildIcon
                                className={cn(
                                  "h-3.5 w-3.5 shrink-0",
                                  childActive && "text-violet-400"
                                )}
                              />
                              <span className="truncate">{child.label}</span>
                            </ActiveLink>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                );
              }

              const active = routeActive(href, exact);

              if (collapsed) {
                if (locked) {
                  return (
                    <Tooltip key={href} delayDuration={0}>
                      <TooltipTrigger asChild>
                        <span
                          className={cn(
                            "flex h-10 w-10 mx-auto cursor-not-allowed items-center justify-center rounded-xl",
                            "text-white/30 opacity-60"
                          )}
                          aria-disabled="true"
                        >
                          <Icon className="h-4 w-4 shrink-0" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent
                        side="right"
                        sideOffset={8}
                        className={sidebarTooltipClasses}
                      >
                        {label} — {NAV_LOCK_TOOLTIP}
                      </TooltipContent>
                    </Tooltip>
                  );
                }
                return (
                  <Tooltip key={href} delayDuration={0}>
                    <TooltipTrigger asChild>
                      <ActiveLink
                        href={href}
                        exact={exact}
                        onClick={onItemClick}
                        className={cn(
                          "flex h-10 w-10 mx-auto items-center justify-center rounded-xl",
                          "text-white/50 hover:text-white hover:bg-white/7 transition-all duration-200",
                          active &&
                            "bg-white/9 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
                        )}
                        activeClassName="nav-active"
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                      </ActiveLink>
                    </TooltipTrigger>
                    <TooltipContent side="right" sideOffset={8} className={sidebarTooltipClasses}>
                      {label}
                    </TooltipContent>
                  </Tooltip>
                );
              }

              if (locked) {
                return (
                  <Tooltip key={href} delayDuration={0}>
                    <TooltipTrigger asChild>
                      <span
                        className={cn(
                          premiumSideItem,
                          "cursor-not-allowed opacity-45 pointer-events-auto"
                        )}
                        aria-disabled="true"
                        tabIndex={0}
                      >
                        <Icon className="h-4 w-4 shrink-0 text-white/40" />
                        <span className="truncate">{label}</span>
                        <Lock className="ml-auto h-3.5 w-3.5 shrink-0 text-white/25" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent
                      side="right"
                      sideOffset={8}
                      className={sidebarTooltipClasses}
                    >
                      {NAV_LOCK_TOOLTIP}
                    </TooltipContent>
                  </Tooltip>
                );
              }

              return (
                <ActiveLink
                  key={href}
                  href={href}
                  exact={exact}
                  onClick={onItemClick}
                  className={cn(
                    premiumSideItem,
                    active && premiumSideItemActive
                  )}
                  activeClassName="nav-active"
                >
                  <Icon className={cn("h-4 w-4 shrink-0", active && "text-violet-400")} />
                  <span className="truncate">{label}</span>
                </ActiveLink>
              );
            })}
          </div>

          {sectionIdx < navSections.length - 1 && (
            <Separator
              className={cn("mt-5 bg-white/4", collapsed && "mt-3")}
            />
          )}
        </div>
      ))}
    </nav>
  );
}

function DesktopSidebar() {
  const { collapsed, toggle } = useSidebar();

  React.useEffect(() => {
    const styleId = "sidebar-scrollbar-hide";
    if (!document.getElementById(styleId)) {
      const style = document.createElement("style");
      style.id = styleId;
      style.textContent = `
        .sidebar-scroll::-webkit-scrollbar {
          display: none;
        }
        .sidebar-scroll {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  return (
    <TooltipProvider>
      <aside
        className={cn(
          "sidebar-scroll hidden md:flex flex-col fixed left-0 top-14 h-[calc(100vh-3.5rem)] shrink-0 border-r border-white/6 bg-[linear-gradient(180deg,rgba(15,21,36,0.97)_0%,rgba(10,14,26,0.99)_100%)] backdrop-blur-2xl transition-[width] duration-200 ease-in-out z-30",
          collapsed ? "w-16" : "w-72"
        )}
      >
        {/* Brand header */}
        <div
          className={cn(
            "border-b border-white/5 shrink-0",
            collapsed ? "px-2 py-4" : "px-5 py-4"
          )}
        >
          <div className={cn("flex", collapsed ? "justify-center" : "justify-end")}>
            <button
              type="button"
              onClick={toggle}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/50 hover:text-white hover:bg-white/10 hover:border-white/15 transition-all duration-150"
            >
              {collapsed ? (
                <ChevronRight className="h-3.5 w-3.5" />
              ) : (
                <ChevronLeft className="h-3.5 w-3.5" />
              )}
            </button>
          </div>

          <div className={cn("mt-2", collapsed ? "flex justify-center" : "min-w-0")}>
            <SidebarSchoolIdentity
              href="/admin"
              role="school_admin"
              collapsed={collapsed}
              className={cn(!collapsed && "min-w-0")}
            />
          </div>
        </div>

        {/* Curriculum Badge */}
        <div
          className={cn("shrink-0", collapsed ? "px-1 pt-3" : "px-5 pt-3")}
        >
          <CurriculumBadge collapsed={collapsed} />
        </div>

        {/* Navigation */}
        <div
          className={cn(
            "flex-1 overflow-y-auto sidebar-scroll",
            collapsed ? "px-1 py-3" : "px-3 py-4"
          )}
        >
          <NavContent collapsed={collapsed} />
        </div>

        <div
          className={cn(
            "shrink-0 border-t border-white/5",
            collapsed ? "px-2 pb-3 pt-2" : "px-4 pb-4 pt-3"
          )}
        >
          <SidebarFooterBranding collapsed={collapsed} />
        </div>

      </aside>
    </TooltipProvider>
  );
}

function MobileSidebar({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="w-[300px] border-r border-white/6 bg-[linear-gradient(180deg,rgba(15,21,36,0.98)_0%,rgba(10,14,26,1)_100%)] p-0 sm:w-[320px]"
      >
        <SheetHeader className="border-b border-white/5 px-5 py-4">
          <SheetTitle className="sr-only">
            School Admin Navigation Menu
          </SheetTitle>
          <div className="flex items-center justify-between">
            <SidebarSchoolIdentity
              href="/admin"
              role="school_admin"
              className="min-w-0 flex-1"
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              className="h-8 w-8 rounded-lg text-white/60 hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close menu</span>
            </Button>
          </div>
        </SheetHeader>

        <div className="px-4 pt-3">
          <CurriculumBadge collapsed={false} />
        </div>

        <div className="sidebar-scroll overflow-y-auto p-4">
          <NavContent
            onItemClick={() => onOpenChange(false)}
            collapsed={false}
          />
          <div className="mt-4 border-t border-white/5 pt-4">
            <SidebarFooterBranding />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function MobileMenuButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onClick}
      className="md:hidden h-9 w-9 border border-white/10 bg-card/95 backdrop-blur-sm text-white hover:bg-white/10 hover:border-white/20"
    >
      <Menu className="h-5 w-5" />
      <span className="sr-only">Open menu</span>
    </Button>
  );
}

export default function SchoolAdminSidebar() {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  const pathname = usePathname();
  React.useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  return (
    <>
      <div className="fixed left-4 top-[calc(3.5rem+0.75rem)] z-40 md:hidden">
        <MobileMenuButton onClick={() => setMobileMenuOpen(true)} />
      </div>

      <DesktopSidebar />

      <MobileSidebar open={mobileMenuOpen} onOpenChange={setMobileMenuOpen} />
    </>
  );
}
