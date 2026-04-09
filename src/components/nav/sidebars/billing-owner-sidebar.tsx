"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { ShieldCheck, Wallet, Menu, X } from "lucide-react";
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
import { SchoolBrand } from "@/components/brand/SchoolBrand";

function SidebarNav({ onItemClick }: { onItemClick?: () => void }) {
  const pathname = usePathname();
  const href = "/admin/settings/payment-setup";
  const active = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav className="space-y-6">
      <div>
        <div className="mb-2.5 px-3">
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white/40">
            Billing Control
          </h3>
        </div>
        <div className="space-y-1">
          <ActiveLink
            href={href}
            onClick={onItemClick}
            className={cn(premiumSideItem, active && premiumSideItemActive)}
            activeClassName="nav-active"
          >
            <Wallet className="h-4 w-4 shrink-0" />
            <span className="truncate">Payment Setup</span>
          </ActiveLink>
        </div>
        <Separator className="mt-6 bg-white/5" />
      </div>
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/65">
        <div className="mb-2 flex items-center gap-2 text-white">
          <ShieldCheck className="h-4 w-4 text-emerald-300" />
          <span className="font-medium">Restricted access</span>
        </div>
        This account can manage payout setup, but it does not have full school administration access.
      </div>
    </nav>
  );
}

function DesktopSidebar() {
  return (
    <aside className="hidden md:block fixed left-0 top-14 w-64 h-[calc(100vh-3.5rem)] shrink-0 border-r border-neutral-900 bg-card overflow-y-auto">
      <div className="border-b border-neutral-900 px-4 py-4">
        <SchoolBrand size="md" showName href="/admin/settings/payment-setup" />
      </div>
      <div className="p-4">
        <SidebarNav />
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
          <SheetTitle className="sr-only">Billing owner navigation</SheetTitle>
          <div className="flex items-center justify-between">
            <SchoolBrand size="md" showName href="/admin/settings/payment-setup" />
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
          <SidebarNav onItemClick={() => onOpenChange(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default function BillingOwnerSidebar() {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const pathname = usePathname();

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
      <DesktopSidebar />
      <MobileSidebar open={mobileMenuOpen} onOpenChange={setMobileMenuOpen} />
    </>
  );
}
