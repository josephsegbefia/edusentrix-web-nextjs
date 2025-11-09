"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";

type Match = "equals" | "startsWith";

type Props = Omit<React.ComponentProps<typeof Link>, "href"> & {
  href: string;
  /** startsWith (default) marks /platform and /platform/... as active*/
  match?: Match;
  /** extra classes to add when active */
  activeClassName?: string;
  /** exact = true is alias for match = "equals" */
  exact?: boolean;
};

function cx(...a: Array<string | false | null | undefined>) {
  return a.filter(Boolean).join(" ");
}

export default function ActiveLink({
  href,
  className,
  children,
  match = "startsWith",
  activeClassName = "nav-active",
  exact,
  ...rest
}: Props) {
  const pathname = usePathname();
  const _match: Match = exact ? "equals" : match;

  const isActive =
    _match === "equals"
      ? pathname === href
      : pathname === href || pathname.startsWith(href + "/");

  return (
    <Link
      {...rest}
      href={href}
      className={cx(className, isActive && activeClassName)}
    >
      {children}
    </Link>
  );
}
