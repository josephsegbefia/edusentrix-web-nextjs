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
  Send,
  Menu,
  X,
  ShieldCheck,
  ShoppingBag,
  ClipboardList,
  Video,
  LayoutGrid,
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
import { useSchoolPaymentSetup } from "@/hooks/admin/useSchoolPaymentSetup";
import type { DelegatedAdminNavItem } from "@/lib/delegations/delegate-admin-access";

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
        feature: "fees",
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
        feature: "fees",
      },
      {
        label: "School store",
        href: "/admin/store",
        icon: ShoppingBag,
        feature: "fees",
      },
      {
        label: "Supply programs",
        href: "/admin/supplies",
        icon: ClipboardList,
        feature: "fees",
      },
      {
        label: "Meetings",
        href: "/admin/finance/meetings",
        icon: Video,
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
        feature: "disbursements",
      },
    ],
  },
  {
    title: "Reconciliation",
    items: [
      {
        label: "Reconciliation",
        href: "/admin/finance/reconciliation/sessions",
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

function NavContent({
  onItemClick,
  delegatedNavItems = [],
}: {
  onItemClick?: () => void;
  delegatedNavItems?: DelegatedAdminNavItem[];
}) {
  const pathname = usePathname();
  const { data: subscription } = useSubscription();
  const { data: paymentSetup } = useSchoolPaymentSetup({ allowForbidden: true });
  const enabledFeatures = React.useMemo(
    () => (Array.isArray(subscription?.features) ? subscription.features : []),
    [subscription]
  );
  const paymentSetupItems = React.useMemo(() => {
    if (!paymentSetup || paymentSetup.accessMode !== "finance_delegate") {
      return [] as NavSection["items"];
    }

    return [
      {
        label: "Payment Setup",
        href: "/admin/settings/payment-setup",
        icon: ShieldCheck,
        exact: false,
      },
    ] as NavSection["items"];
  }, [paymentSetup]);

  return (
    <nav className="space-y-6">
      {delegatedNavItems.length > 0 ? (
        <div>
          <div className="mb-2.5 px-3">
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white/40">
              Delegated modules
            </h3>
          </div>
          <div className="space-y-1">
            {delegatedNavItems.map((item) => {
              const active =
                pathname === item.href ||
                pathname.startsWith(`${item.href}/`);
              return (
                <ActiveLink
                  key={`delegated-${item.module}-${item.href}`}
                  href={item.href}
                  onClick={onItemClick}
                  className={cn(
                    premiumSideItem,
                    active && premiumSideItemActive
                  )}
                  activeClassName="nav-active"
                >
                  <LayoutGrid className="h-4 w-4 shrink-0 text-emerald-300/90" />
                  <span className="truncate">{item.label}</span>
                </ActiveLink>
              );
            })}
          </div>
          <Separator className="mt-6 bg-white/5" />
        </div>
      ) : null}
      {navSections.map((section, sectionIdx) => {
        const mergedItems =
          section.title === "Finance Operations"
            ? [...section.items, ...paymentSetupItems]
            : section.items;
        const items = mergedItems.filter(
          (item) => !item.feature || hasTierFeature(enabledFeatures, item.feature)
        );
        if (items.length === 0) return null;

        return (
        <div key={section.title}>
          <div className="mb-2.5 px-3">
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white/40">
              {section.title}
            </h3>
          </div>

          <div className="space-y-1">
            {items.map(({ label, href, icon: Icon, exact }) => {
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
      );
      })}
    </nav>
  );
}

function DesktopSidebar({
  delegatedNavItems,
}: {
  delegatedNavItems?: DelegatedAdminNavItem[];
}) {
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
    <aside className="bursar-sidebar-scroll hidden md:flex fixed left-0 top-14 w-72 h-[calc(100vh-3.5rem)] shrink-0 flex-col border-r border-white/6 bg-[linear-gradient(180deg,rgba(15,21,36,0.97)_0%,rgba(10,14,26,0.99)_100%)] backdrop-blur-2xl">
      <div className="border-b border-white/5 p-3">
        <SidebarSchoolIdentity href="/admin/finance" role="bursar" />
      </div>
      <div className="bursar-sidebar-scroll flex-1 overflow-y-auto p-4">
        <NavContent delegatedNavItems={delegatedNavItems} />
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
  delegatedNavItems,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  delegatedNavItems?: DelegatedAdminNavItem[];
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="w-[300px] border-r border-white/6 bg-[linear-gradient(180deg,rgba(15,21,36,0.98)_0%,rgba(10,14,26,1)_100%)] p-0 sm:w-[320px]"
      >
        <SheetHeader className="border-b border-white/5 px-4 py-4">
          <SheetTitle className="sr-only">Bursar Navigation Menu</SheetTitle>
          <div className="flex items-center justify-between">
            <SidebarSchoolIdentity
              href="/admin/finance"
              role="bursar"
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

        <div className="bursar-sidebar-scroll overflow-y-auto p-4">
          <NavContent
            onItemClick={() => onOpenChange(false)}
            delegatedNavItems={delegatedNavItems}
          />
          <div className="mt-4 border-t border-white/5 pt-4">
            <SidebarFooterBranding />
          </div>
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

export default function BursarSidebar({
  delegatedNavItems,
}: {
  delegatedNavItems?: DelegatedAdminNavItem[];
} = {}) {
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
      <DesktopSidebar delegatedNavItems={delegatedNavItems} />
      <MobileSidebar
        open={mobileMenuOpen}
        onOpenChange={setMobileMenuOpen}
        delegatedNavItems={delegatedNavItems}
      />
    </>
  );
}
