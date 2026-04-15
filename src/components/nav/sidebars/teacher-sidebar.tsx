// src/components/nav/sidebars/teacher-sidebar.tsx
"use client";
import * as React from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import ActiveLink from "../active/ActiveLink";
import { useTeacherContext } from "@/hooks/teacher/useTeacherContext";
import { can } from "@/lib/auth/can";
import { PERMISSIONS, type Permission } from "@/lib/rbac";
import {
  LayoutDashboard,
  School,
  GraduationCap,
  Users,
  BookOpen,
  CalendarDays,
  Calendar,
  ClipboardCheck,
  CheckSquare,
  FileText,
  Bell,
  MessageSquare,
  Megaphone,
  AlertTriangle,
  BarChart3,
  Settings,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
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
import { useSubscription } from "@/hooks/useSubscription";
import { hasTierFeature, type SubscriptionFeatureKey } from "@/lib/billing/feature-access";
import { useSidebar } from "@/providers/sidebar-provider";

type NavSection = {
  title: string;
  items: Array<{
    label: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    exact?: boolean;
    feature?: SubscriptionFeatureKey;
  }>;
};

const navSections: NavSection[] = [
  {
    title: "Overview",
    items: [
      {
        label: "Dashboard",
        href: "/teacher",
        icon: LayoutDashboard,
        exact: true,
      },
    ],
  },
  {
    title: "Teaching",
    items: [
      {
        label: "My Classes",
        href: "/teacher/classes",
        icon: School,
      },
      {
        label: "Students",
        href: "/teacher/students",
        icon: GraduationCap,
      },
      {
        label: "Gradebook",
        href: "/teacher/gradebook",
        icon: BookOpen,
      },
      {
        label: "Attendance",
        href: "/teacher/attendance",
        icon: CalendarDays,
      },
      {
        label: "Calendar",
        href: "/teacher/calendar",
        icon: Calendar,
      },
    ],
  },
  {
    title: "Teacher Studio",
    items: [
      {
        label: "Assignments",
        href: "/teacher/studio/assignments",
        icon: ClipboardCheck,
      },
      {
        label: "Quizzes",
        href: "/teacher/studio/quizzes",
        icon: CheckSquare,
      },
      {
        label: "Projects",
        href: "/teacher/studio/projects",
        icon: FileText,
      },
      {
        label: "Resources",
        href: "/teacher/studio/resources",
        icon: FileText,
      },
      {
        label: "Submissions",
        href: "/teacher/studio/submissions",
        icon: Users,
      },
      {
        label: "Rubrics",
        href: "/teacher/studio/rubrics",
        icon: CheckSquare,
      },
    ],
  },
  {
    title: "Communication",
    items: [
      {
        label: "Notifications",
        href: "/teacher/notifications",
        icon: Bell,
      },
      {
        label: "Notices",
        href: "/teacher/communication/notices",
        icon: Megaphone,
      },
      {
        label: "Messages",
        href: "/teacher/communication/messages",
        icon: MessageSquare,
      },
      {
        label: "Escalations",
        href: "/teacher/communication/escalations",
        icon: AlertTriangle,
      },
    ],
  },
  {
    title: "Insights",
    items: [
      {
        label: "Analytics",
        href: "/teacher/analytics",
        icon: BarChart3,
        exact: true,
        feature: "reports",
      },
      {
        label: "At-Risk List",
        href: "/teacher/analytics/at-risk",
        icon: AlertTriangle,
      },
    ],
  },
  {
    title: "Resources",
    items: [
      {
        label: "Class Journal",
        href: "/teacher/journal",
        icon: FileText,
      },
      {
        label: "Lesson Notes",
        href: "/teacher/lesson-notes",
        icon: FileText,
      },
    ],
  },
  {
    title: "System",
    items: [
      {
        label: "Settings",
        href: "/teacher/settings",
        icon: Settings,
      },
    ],
  },
];

const sidebarTooltipClasses =
  "bg-white/10 text-white ring-1 ring-white/10 rounded-xl backdrop-blur-md border-0 px-3 py-2.5 text-sm font-medium shadow-lg";

function NavContent({
  onItemClick,
  collapsed,
}: {
  onItemClick?: () => void;
  collapsed: boolean;
}) {
  const pathname = usePathname();
  const { data } = useTeacherContext();
  const { data: subscription } = useSubscription();
  const permissions = data?.data.permissions as Permission[] | undefined;
  const studioEnabled = data?.data.features?.teacherStudioEnabled ?? true;
  const canViewStudio = can(permissions, PERMISSIONS.assignmentsView);
  const showStudio = studioEnabled && canViewStudio;
  const enabledFeatures = React.useMemo(
    () => (Array.isArray(subscription?.features) ? subscription.features : []),
    [subscription]
  );

  const sections = React.useMemo(
    () =>
      navSections
        .filter((section) =>
          section.title === "Teacher Studio" ? showStudio : true
        )
        .map((section) => ({
          ...section,
          items: section.items.filter(
            (item) => !item.feature || hasTierFeature(enabledFeatures, item.feature)
          ),
        }))
        .filter((section) => section.items.length > 0),
    [enabledFeatures, showStudio]
  );

  return (
    <nav className={cn("space-y-5", collapsed && "space-y-3")}>
      {sections.map((section, sectionIdx) => (
        <div key={section.title}>
          {!collapsed && (
            <div className="mb-2 px-3.5">
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/30">
                {section.title}
              </h3>
            </div>
          )}

          <div className={cn("space-y-0.5", collapsed && "space-y-1.5")}>
            {section.items.map(({ label, href, icon: Icon, exact }) => {
              const active =
                exact
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
                  <Icon className={cn("h-4 w-4 shrink-0", active && "text-emerald-300")} />
                  <span className="truncate">{label}</span>
                </ActiveLink>
              );
            })}
          </div>

          {sectionIdx < sections.length - 1 && (
            <Separator className={cn("mt-5 bg-white/4", collapsed && "mt-3")} />
          )}
        </div>
      ))}
    </nav>
  );
}

function DesktopSidebar() {
  const { collapsed, toggle } = useSidebar();

  React.useEffect(() => {
    const styleId = "teacher-sidebar-scrollbar-hide";
    if (!document.getElementById(styleId)) {
      const style = document.createElement("style");
      style.id = styleId;
      style.textContent = `
        .teacher-sidebar-scroll::-webkit-scrollbar {
          display: none;
        }
        .teacher-sidebar-scroll {
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
          "teacher-sidebar-scroll hidden md:flex fixed left-0 top-14 h-[calc(100vh-3.5rem)] shrink-0 flex-col border-r border-white/6 bg-[linear-gradient(180deg,rgba(15,21,36,0.97)_0%,rgba(10,14,26,0.99)_100%)] backdrop-blur-2xl transition-[width] duration-200 ease-in-out z-30",
          collapsed ? "w-16" : "w-72"
        )}
      >
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
              href="/teacher"
              role="teacher"
              collapsed={collapsed}
              className={cn(!collapsed && "min-w-0")}
            />
          </div>
        </div>

        <div
          className={cn(
            "flex-1 overflow-y-auto teacher-sidebar-scroll",
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
          <SheetTitle className="sr-only">Teacher Navigation Menu</SheetTitle>
          <div className="flex items-center justify-between">
            <SidebarSchoolIdentity
              href="/teacher"
              role="teacher"
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

        <div className="teacher-sidebar-scroll overflow-y-auto p-4">
          <NavContent onItemClick={() => onOpenChange(false)} collapsed={false} />
          <div className="mt-4 border-t border-white/5 pt-4">
            <SidebarFooterBranding />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function MobileMenuButton({
  onClick,
}: {
  onClick: () => void;
}) {
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

export default function TeacherSidebar() {
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
