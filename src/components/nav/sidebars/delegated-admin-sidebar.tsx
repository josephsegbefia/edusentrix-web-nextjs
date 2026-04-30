"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  BarChart3,
  BookOpen,
  Calendar,
  CalendarDays,
  ClipboardCheck,
  GraduationCap,
  Heart,
  Layers,
  Library,
  LayoutGrid,
  Mail,
  Menu,
  Receipt,
  ShieldCheck,
  ShoppingBag,
  TrendingUp,
  UserPlus,
  Video,
  Vote,
  Wallet,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import ActiveLink from "../active/ActiveLink";
import { cn } from "@/lib/utils";
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
import type { DelegatedAdminNavItem } from "@/lib/delegations/delegate-admin-access";
import type { DelegationModule } from "@/lib/delegations/types";

const MODULE_ICON: Partial<Record<DelegationModule, LucideIcon>> = {
  meetings: Video,
  polls: Vote,
  fundraising: Heart,
  academic_calendar: CalendarDays,
  documents: LayoutGrid,
  library: Library,
  supplies: ShoppingBag,
  store: ShoppingBag,
  reports: BarChart3,
  staff_attendance: ClipboardCheck,
  invitations: UserPlus,
  email: Mail,
  fees: Wallet,
  expenses: Receipt,
  students: GraduationCap,
  grades: Layers,
  subjects: BookOpen,
  curriculum: BookOpen,
  timetable: Calendar,
  academic_periods: Calendar,
  promotions: TrendingUp,
};

function iconForModule(module: DelegationModule): LucideIcon {
  return MODULE_ICON[module] ?? LayoutGrid;
}

function SidebarNav({
  navItems,
  onItemClick,
}: {
  navItems: DelegatedAdminNavItem[];
  onItemClick?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav className="space-y-6">
      <div>
        <div className="mb-2.5 px-1">
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white/40">
            Your workspace
          </h3>
        </div>
        <div className="space-y-1">
          <ActiveLink
            href="/teacher"
            onClick={onItemClick}
            className={cn(premiumSideItem)}
            activeClassName="nav-active"
          >
            <ArrowLeft className="h-4 w-4 shrink-0 text-white/50" />
            <span className="truncate">Teacher app</span>
          </ActiveLink>
        </div>
        <Separator className="my-5 bg-white/4" />
        <div className="mb-2.5 px-1">
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white/40">
            Delegated modules
          </h3>
        </div>
        <div className="space-y-1">
          {navItems.map((item) => {
            const Icon = iconForModule(item.module);
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <ActiveLink
                key={`${item.module}-${item.href}`}
                href={item.href}
                onClick={onItemClick}
                className={cn(premiumSideItem, active && premiumSideItemActive)}
                activeClassName="nav-active"
              >
                <Icon
                  className={cn(
                    "h-4 w-4 shrink-0 text-white/50",
                    active && "text-violet-400"
                  )}
                />
                <span className="truncate">{item.label}</span>
              </ActiveLink>
            );
          })}
        </div>
      </div>
      <div className="rounded-xl border border-white/8 bg-white/3 p-4 text-sm text-white/65 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]">
        <div className="mb-2 flex items-center gap-2 text-white">
          <ShieldCheck className="h-4 w-4 text-violet-400" />
          <span className="font-medium">Delegated access</span>
        </div>
        <p className="leading-relaxed text-white/60">
          You only see modules your school admin assigned. Actions may be limited
          by your access level.
        </p>
      </div>
    </nav>
  );
}

function DesktopSidebar({
  navItems,
  homeHref,
}: {
  navItems: DelegatedAdminNavItem[];
  homeHref: string;
}) {
  return (
    <aside className="sidebar-scroll z-30 hidden h-[calc(100vh-3.5rem)] w-72 shrink-0 flex-col border-r border-white/6 bg-[linear-gradient(180deg,rgba(15,21,36,0.97)_0%,rgba(10,14,26,0.99)_100%)] backdrop-blur-2xl md:fixed md:left-0 md:top-14 md:flex">
      <div className="shrink-0 border-b border-white/5 px-5 py-4">
        <SidebarSchoolIdentity href={homeHref} role="teacher" className="min-w-0" />
      </div>
      <div className="sidebar-scroll flex-1 overflow-y-auto px-3 py-4">
        <SidebarNav navItems={navItems} />
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
  navItems,
  homeHref,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  navItems: DelegatedAdminNavItem[];
  homeHref: string;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="w-[300px] border-r border-white/6 bg-[linear-gradient(180deg,rgba(15,21,36,0.98)_0%,rgba(10,14,26,1)_100%)] p-0 sm:w-[320px]"
      >
        <SheetHeader className="border-b border-white/5 px-4 py-4">
          <SheetTitle className="sr-only">Delegated admin navigation</SheetTitle>
          <div className="flex items-center justify-between">
            <SidebarSchoolIdentity
              href={homeHref}
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

        <div className="overflow-y-auto p-4">
          <SidebarNav
            navItems={navItems}
            onItemClick={() => onOpenChange(false)}
          />
          <div className="mt-4 border-t border-white/5 pt-4">
            <SidebarFooterBranding />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default function DelegatedAdminSidebar({
  navItems,
  homeHref,
}: {
  navItems: DelegatedAdminNavItem[];
  homeHref: string;
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const pathname = usePathname();

  React.useEffect(() => {
    const styleId = "delegated-sidebar-scrollbar-hide";
    if (!document.getElementById(styleId)) {
      const style = document.createElement("style");
      style.id = styleId;
      style.textContent = `
        .sidebar-scroll::-webkit-scrollbar { display: none; }
        .sidebar-scroll { -ms-overflow-style: none; scrollbar-width: none; }
      `;
      document.head.appendChild(style);
    }
  }, []);

  React.useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  return (
    <>
      <div className="fixed left-4 top-[calc(3.5rem+0.75rem)] z-40 md:hidden">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setMobileMenuOpen(true)}
          className="md:hidden h-9 w-9 border border-white/10 bg-card/95 backdrop-blur-sm text-white hover:bg-white/10 hover:border-white/20"
        >
          <Menu className="h-5 w-5" />
          <span className="sr-only">Open menu</span>
        </Button>
      </div>
      <DesktopSidebar navItems={navItems} homeHref={homeHref} />
      <MobileSidebar
        open={mobileMenuOpen}
        onOpenChange={setMobileMenuOpen}
        navItems={navItems}
        homeHref={homeHref}
      />
    </>
  );
}
