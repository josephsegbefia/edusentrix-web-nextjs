"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { isTimetableRoleReadViewsEnabled } from "@/lib/timetable/feature-flags";
import ActiveLink from "../active/ActiveLink";
import {
  LayoutDashboard,
  ClipboardList,
  CalendarClock,
  CalendarDays,
  BarChart3,
  Bell,
  UserCircle2,
  Menu,
  X,
} from "lucide-react";
import {
  premiumSideItem,
  premiumSideItemActive,
} from "@/components/ui/premium";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SchoolBrand } from "@/components/brand/SchoolBrand";

type NavSection = {
  title: string;
  items: Array<{
    label: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    exact?: boolean;
  }>;
};

const TIMETABLE_ROLE_VIEWS_ENABLED = isTimetableRoleReadViewsEnabled();

const navSections: NavSection[] = [
  {
    title: "Overview",
    items: [
      {
        label: "Dashboard",
        href: "/student",
        icon: LayoutDashboard,
        exact: true,
      },
    ],
  },
  {
    title: "Learning",
    items: [
      {
        label: "Assignments",
        href: "/student/assignments",
        icon: ClipboardList,
      },
      {
        label: "Results",
        href: "/student/results",
        icon: BarChart3,
      },
      ...(TIMETABLE_ROLE_VIEWS_ENABLED
        ? [
            {
              label: "My Timetable",
              href: "/student/timetable",
              icon: CalendarClock,
            },
          ]
        : []),
      {
        label: "Calendar",
        href: "/student/calendar",
        icon: CalendarDays,
      },
    ],
  },
  {
    title: "Account",
    items: [
      {
        label: "Notices",
        href: "/student/notices",
        icon: Bell,
      },
      {
        label: "Profile",
        href: "/student/profile",
        icon: UserCircle2,
      },
    ],
  },
];

function NavContent({ onItemClick }: { onItemClick?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="space-y-6">
      {navSections.map((section, sectionIdx) => (
        <div key={section.title}>
          <div className="mb-2.5 px-3">
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white/40">
              {section.title}
            </h3>
          </div>

          <div className="space-y-1">
            {section.items.map(({ label, href, icon: Icon, exact }) => {
              const active = exact
                ? pathname === href
                : pathname === href || pathname.startsWith(`${href}/`);

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
            <Separator className="mt-6 bg-white/5" />
          )}
        </div>
      ))}
    </nav>
  );
}

function DesktopSidebar() {
  React.useEffect(() => {
    const styleId = "student-sidebar-scrollbar-hide";
    if (document.getElementById(styleId)) return;

    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      .student-sidebar-scroll::-webkit-scrollbar {
        display: none;
      }
      .student-sidebar-scroll {
        -ms-overflow-style: none;
        scrollbar-width: none;
      }
    `;
    document.head.appendChild(style);
  }, []);

  return (
    <aside className="student-sidebar-scroll hidden md:block fixed left-0 top-14 w-64 h-[calc(100vh-3.5rem)] shrink-0 border-r border-neutral-900 bg-card overflow-y-auto">
      <div className="border-b border-neutral-900 px-4 py-4">
        <SchoolBrand size="md" showName href="/student" />
      </div>
      <div className="p-4">
        <NavContent />
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
        className="w-[280px] border-r border-neutral-900 bg-card p-0 sm:w-[300px]"
      >
        <SheetHeader className="border-b border-neutral-900 px-4 py-4">
          <SheetTitle className="sr-only">Student Navigation Menu</SheetTitle>
          <div className="flex items-center justify-between">
            <SchoolBrand size="md" showName href="/student" />
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

        <div className="student-sidebar-scroll overflow-y-auto p-4">
          <NavContent onItemClick={() => onOpenChange(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}

function StudentMobileMenuButton({ onClick }: { onClick: () => void }) {
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

export default function StudentSidebar() {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const pathname = usePathname();

  React.useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  return (
    <>
      <div className="fixed left-4 top-[calc(3.5rem+0.75rem)] z-40 md:hidden">
        <StudentMobileMenuButton onClick={() => setMobileMenuOpen(true)} />
      </div>
      <DesktopSidebar />
      <MobileSidebar open={mobileMenuOpen} onOpenChange={setMobileMenuOpen} />
    </>
  );
}
