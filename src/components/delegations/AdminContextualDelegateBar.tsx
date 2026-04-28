"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getModuleDefinition,
  resolveDelegationModuleFromAdminPath,
} from "@/lib/delegations/registry";
import type { DelegationModule } from "@/lib/delegations/types";
import { cn } from "@/lib/utils";

type Props = {
  /** Only school admins may grant delegations (spec §20). */
  canManageDelegations: boolean;
};

export function AdminContextualDelegateBar({ canManageDelegations }: Props) {
  const pathname = usePathname() || "/";
  const [module, setModule] = React.useState<DelegationModule | null>(null);

  React.useEffect(() => {
    setModule(resolveDelegationModuleFromAdminPath(pathname));
  }, [pathname]);

  if (!canManageDelegations || !module) return null;

  const def = getModuleDefinition(module);
  const moduleLabel = def?.label ?? "this module";

  return (
    <div
      className={cn(
        "mb-4 flex flex-col gap-2.5 rounded-xl border border-white/10 bg-white/3 px-3 py-2.5",
        "sm:flex-row sm:items-center sm:justify-between sm:gap-4"
      )}
      role="region"
      aria-label={`Delegate access for ${moduleLabel}`}
    >
      <p className="max-w-xl text-xs leading-relaxed text-white/50">
        Give staff access to{" "}
        <span className="font-medium text-white/75">{moduleLabel}</span> with
        permissions you control—they stay non-admins.
      </p>
      <Button
        variant="outline"
        size="sm"
        asChild
        className="h-8 shrink-0 gap-1.5 self-start border-white/15 bg-white/5 text-white/90 shadow-none hover:bg-white/10 hover:text-white sm:self-center"
      >
        <Link href={`/admin/delegations?module=${module}&add=1`}>
          <Share2 className="h-3.5 w-3.5 opacity-90" aria-hidden />
          Delegate access
        </Link>
      </Button>
    </div>
  );
}
