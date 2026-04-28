import {
  DELEGATION_REGISTRY,
  DELEGATION_MODULE_IDS,
} from "@/lib/delegations/registry";
import type { DelegationModule } from "@/lib/delegations/types";

export type DelegatedAdminNavItem = {
  module: DelegationModule;
  label: string;
  href: string;
};

/** True if `perms` includes any permission granted by any preset of the module. */
export function hasDelegatedAccessToModule(
  perms: string[],
  module: DelegationModule
): boolean {
  const def = DELEGATION_REGISTRY[module];
  if (!def?.implemented) return false;
  const allowed = new Set<string>();
  for (const preset of Object.values(def.presets)) {
    for (const p of preset.permissions) allowed.add(p);
  }
  return perms.some((p) => allowed.has(p));
}

/**
 * Path prefixes for `/admin` delegate shell (excludes teacher-only delegateHref like admissions).
 */
export function delegatedAdminPathPrefixesForPermissions(
  perms: string[]
): string[] {
  const prefixes = new Set<string>();
  for (const module of DELEGATION_MODULE_IDS) {
    const def = DELEGATION_REGISTRY[module];
    if (!def.implemented || !def.delegateHref?.startsWith("/admin")) continue;
    if (!hasDelegatedAccessToModule(perms, module)) continue;
    prefixes.add(def.delegateHref.replace(/\/$/, ""));
  }
  return Array.from(prefixes).sort((a, b) => b.length - a.length);
}

export function delegatedAdminNavItemsForPermissions(
  perms: string[]
): DelegatedAdminNavItem[] {
  const items: DelegatedAdminNavItem[] = [];
  for (const module of DELEGATION_MODULE_IDS) {
    const def = DELEGATION_REGISTRY[module];
    if (!def.implemented || !def.delegateHref?.startsWith("/admin")) continue;
    if (!hasDelegatedAccessToModule(perms, module)) continue;
    items.push({
      module,
      label: def.label,
      href: def.delegateHref.replace(/\/$/, "") || def.delegateHref,
    });
  }
  return items.sort((a, b) => a.label.localeCompare(b.label));
}
