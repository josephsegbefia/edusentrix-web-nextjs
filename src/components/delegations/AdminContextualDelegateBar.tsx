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
        "mb-4 flex flex-col gap-2.5 rounded-xl border border-(--ws-line) bg-(--ws-fill) px-3 py-2.5",
        "sm:flex-row sm:items-center sm:justify-between sm:gap-4"
      )}
      role="region"
      aria-label={`Delegate access for ${moduleLabel}`}
    >
      <p className="max-w-xl text-xs leading-relaxed text-(--ws-fg-50)">
        Give staff access to{" "}
        <span className="font-medium text-(--ws-fg-80)">{moduleLabel}</span> with
        permissions you control—they stay non-admins.
      </p>
      <Button
        variant="outline"
        size="sm"
        asChild
        className="h-8 shrink-0 gap-1.5 self-start border-(--ws-line) bg-(--ws-fill) text-(--ws-fg-80) shadow-none hover:bg-(--ws-fill-strong) hover:text-(--ws-fg) sm:self-center"
      >
        <Link href={`/admin/delegations?module=${module}&add=1`}>
          <Share2 className="h-3.5 w-3.5 opacity-90" aria-hidden />
          Delegate access
        </Link>
      </Button>
    </div>
  );
}
