import Link from "next/link";
import { BrandMark } from "@/components/brand/BrandMark";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { cn } from "@/lib/utils";

type PublicMarketingNavProps = {
  active?: "home" | "about" | "contact" | "terms";
};

const links = [
  { href: "/", label: "Home", key: "home" },
  { href: "/about", label: "About", key: "about" },
  { href: "/contact", label: "Contact", key: "contact" },
  { href: "/terms", label: "Terms", key: "terms" },
] as const;

export function PublicMarketingNav({ active }: PublicMarketingNavProps) {
  return (
    <header className="m-header sticky top-0 z-50 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/" className="group inline-flex items-center">
          <BrandMark />
        </Link>
        <nav className="hidden items-center gap-8 text-sm font-medium md:flex">
          {links.map((link) => (
            <Link
              key={link.key}
              href={link.href}
              className={cn(
                "transition-colors",
                active === link.key
                  ? "text-(--m-fg)"
                  : "m-muted hover:text-(--m-fg)",
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2 sm:gap-3">
          <ThemeToggle />
          <Link
            href="/sign-in"
            className="hidden rounded-xl px-3 py-2 text-sm font-medium m-muted transition-colors hover:bg-(--m-subtle) hover:text-(--m-fg) sm:inline-flex"
          >
            Sign in
          </Link>
          <Link
            href="/enroll"
            className="rounded-xl bg-linear-to-r from-violet-500 to-purple-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 transition-all hover:scale-[1.02] sm:px-5"
          >
            Enrol your school
          </Link>
        </div>
      </div>
    </header>
  );
}
