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
import { SchoolBrand } from "@/components/brand/SchoolBrand";
import { useSidebar } from "@/providers/sidebar-provider";
import { useSchool } from "@/hooks/admin/useSchool";

type NavSection = {
  title: string;
  items: Array<{
    label: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    exact?: boolean;
  }>;
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
        label: "Curriculum",
        href: "/admin/settings/curriculum",
        icon: GraduationCap,
      },
      {
        label: "Master Timetable",
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
        label: "Reconciliation Queue",
        href: "/admin/finance/reconciliation",
        icon: FileSearch,
      },
      {
        label: "Fees & Payments",
        href: "/admin/fees",
        icon: DollarSign,
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
    ],
  },
  {
    title: "System",
    items: [
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
  const currCode = data?.data?.curriculumCode;

  if (!currCode) return null;

  const label = CURRICULUM_SHORT_LABELS[currCode] || currCode;

  if (collapsed) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>
          <ActiveLink
            href="/admin/settings/curriculum"
            className="flex h-8 w-8 mx-auto items-center justify-center rounded-lg border border-brand/20 bg-brand/10 transition-colors hover:bg-brand/15"
          >
            <BookOpen className="h-3.5 w-3.5 text-brand" />
          </ActiveLink>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={8} className={sidebarTooltipClasses}>
          {label} Curriculum
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

function NavContent({
  onItemClick,
  collapsed,
}: {
  onItemClick?: () => void;
  collapsed: boolean;
}) {
  const pathname = usePathname();

  return (
    <nav className={cn("space-y-6", collapsed && "space-y-4")}>
      {navSections.map((section, sectionIdx) => (
        <div key={section.title}>
          {!collapsed && (
            <div className="mb-2.5 px-3">
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white/40">
                {section.title}
              </h3>
            </div>
          )}

          <div className={cn("space-y-1", collapsed && "space-y-1.5")}>
            {section.items.map(({ label, href, icon: Icon, exact }) => {
              const active = exact
                ? pathname === href
                : pathname === href || pathname.startsWith(href + "/");

              if (collapsed) {
                return (
                  <Tooltip key={href} delayDuration={0}>
                    <TooltipTrigger asChild>
                      <ActiveLink
                        href={href}
                        exact={exact}
                        onClick={onItemClick}
                        className={cn(
                          "flex h-10 w-10 mx-auto items-center justify-center rounded-xl",
                          "text-white/60 hover:text-white hover:bg-white/8 transition-all duration-150",
                          active &&
                            "bg-white/10 text-white ring-1 ring-white/10"
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
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{label}</span>
                </ActiveLink>
              );
            })}
          </div>

          {sectionIdx < navSections.length - 1 && (
            <Separator
              className={cn("mt-6 bg-white/5", collapsed && "mt-4")}
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
          "sidebar-scroll hidden md:flex flex-col fixed left-0 top-14 h-[calc(100vh-3.5rem)] shrink-0 border-r border-neutral-900 bg-card transition-[width] duration-200 ease-in-out z-30",
          collapsed ? "w-16" : "w-64"
        )}
      >
        {/* Brand header with dragonfly-style trigger placement */}
        <div
          className={cn(
            "border-b border-neutral-900 shrink-0",
            collapsed ? "px-2 py-4" : "px-4 py-4"
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
            {collapsed ? (
              <SchoolBrand size="sm" showName={false} href="/admin" />
            ) : (
              <div className="min-w-0">
                <SchoolBrand
                  size="md"
                  showName
                  href="/admin"
                  className="min-w-0"
                />
              </div>
            )}
          </div>
        </div>

        {/* Curriculum Badge */}
        <div
          className={cn("shrink-0", collapsed ? "px-1 pt-3" : "px-4 pt-3")}
        >
          <CurriculumBadge collapsed={collapsed} />
        </div>

        {/* Navigation */}
        <div
          className={cn(
            "flex-1 overflow-y-auto sidebar-scroll",
            collapsed ? "px-1 py-3" : "p-4"
          )}
        >
          <NavContent collapsed={collapsed} />
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
        className="w-[280px] border-r border-neutral-900 bg-card p-0 sm:w-[300px]"
      >
        <SheetHeader className="border-b border-neutral-900 px-4 py-4">
          <SheetTitle className="sr-only">
            School Admin Navigation Menu
          </SheetTitle>
          <div className="flex items-center justify-between">
            <SchoolBrand size="md" showName href="/admin" />
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
