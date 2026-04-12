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
} from "lucide-react";
import {
  premiumSideItem,
  premiumSideItemActive,
} from "@/components/ui/premium";
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

function NavContent({ onItemClick }: { onItemClick?: () => void }) {
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
    <nav className="space-y-6">
      {sections.map((section, sectionIdx) => (
        <div key={section.title}>
          <div className="mb-2.5 px-3">
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white/40">
              {section.title}
            </h3>
          </div>

          <div className="space-y-1">
            {section.items.map(({ label, href, icon: Icon, exact }) => {
              const active =
                exact
                  ? pathname === href
                  : pathname === href || pathname.startsWith(href + "/");
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

          {sectionIdx < sections.length - 1 && (
            <Separator className="mt-6 bg-white/5" />
          )}
        </div>
      ))}
    </nav>
  );
}

function DesktopSidebar() {
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
    <aside className="sidebar-scroll hidden md:flex fixed left-0 top-14 w-72 h-[calc(100vh-3.5rem)] shrink-0 flex-col border-r border-white/6 bg-[linear-gradient(180deg,rgba(15,21,36,0.97)_0%,rgba(10,14,26,0.99)_100%)] backdrop-blur-2xl">
      <div className="border-b border-white/5 p-4">
        <SidebarSchoolIdentity href="/teacher" role="teacher" />
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-4 sidebar-scroll">
        <NavContent />
      </div>
      <div className="shrink-0 border-t border-white/5 px-4 pb-4 pt-3">
        <SidebarFooterBranding />
      </div>
    </aside>
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

        <div className="sidebar-scroll overflow-y-auto p-4">
          <NavContent onItemClick={() => onOpenChange(false)} />
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
