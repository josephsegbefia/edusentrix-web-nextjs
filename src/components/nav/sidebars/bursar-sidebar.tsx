"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import ActiveLink from "../active/ActiveLink";
import {
  LayoutDashboard,
  Landmark,
  ArrowLeftRight,
  DollarSign,
  Receipt,
  FileText,
  FileSearch,
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

const navSections: NavSection[] = [
  {
    title: "Overview",
    items: [
      {
        label: "Finance Dashboard",
        href: "/admin/finance",
        icon: LayoutDashboard,
        exact: true,
      },
    ],
  },
  {
    title: "Finance Operations",
    items: [
      {
        label: "Financial Center",
        href: "/admin/finance",
        icon: Landmark,
        exact: true,
      },
      {
        label: "Transactions",
        href: "/admin/finance/transactions",
        icon: ArrowLeftRight,
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
    ],
  },
  {
    title: "Reconciliation",
    items: [
      {
        label: "Queue",
        href: "/admin/finance/reconciliation",
        icon: FileSearch,
      },
      {
        label: "Transactions Ledger",
        href: "/admin/finance/transactions",
        icon: FileText,
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
                  key={`${section.title}-${href}`}
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
    const styleId = "bursar-sidebar-scrollbar-hide";
    if (document.getElementById(styleId)) return;
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      .bursar-sidebar-scroll::-webkit-scrollbar {
        display: none;
      }
      .bursar-sidebar-scroll {
        -ms-overflow-style: none;
        scrollbar-width: none;
      }
    `;
    document.head.appendChild(style);
  }, []);

  return (
    <aside className="bursar-sidebar-scroll hidden md:block fixed left-0 top-14 w-64 h-[calc(100vh-3.5rem)] shrink-0 border-r border-neutral-900 bg-card overflow-y-auto">
      <div className="border-b border-neutral-900 px-4 py-4">
        <SchoolBrand size="md" showName href="/admin/finance" />
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
          <SheetTitle className="sr-only">Bursar Navigation Menu</SheetTitle>
          <div className="flex items-center justify-between">
            <SchoolBrand size="md" showName href="/admin/finance" />
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

        <div className="bursar-sidebar-scroll overflow-y-auto p-4">
          <NavContent onItemClick={() => onOpenChange(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}

function MobileMenuButton({ onClick }: { onClick: () => void }) {
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

export default function BursarSidebar() {
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
