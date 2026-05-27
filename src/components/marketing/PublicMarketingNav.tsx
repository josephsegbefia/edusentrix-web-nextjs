import Image from "next/image";
import Link from "next/link";
import { EduSentrixWordmark } from "@/components/brand/EduSentrixWordmark";
import { EDUSENTRIX_LOGO_ALT, EDUSENTRIX_LOGO_PATH } from "@/lib/branding";
import { cn } from "@/lib/utils";

type PublicMarketingNavProps = {
  active?: "home" | "about" | "contact" | "terms";
};

export function PublicMarketingNav({ active }: PublicMarketingNavProps) {
  return (
    <header className="sticky top-0 z-50 border-b border-white/5 bg-neutral-950/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/" className="group inline-flex items-center gap-3 sm:gap-4">
          <div className="relative flex h-11 w-14 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/3 shadow-lg shadow-black/30 sm:h-12 sm:w-[3.65rem]">
            <Image
              src={EDUSENTRIX_LOGO_PATH}
              alt={EDUSENTRIX_LOGO_ALT}
              fill
              sizes="58px"
              className="object-contain px-1.5 py-1"
              priority
            />
          </div>
          <EduSentrixWordmark className="text-lg font-semibold tracking-tight sm:text-xl" />
        </Link>
        <nav className="hidden items-center gap-8 text-sm font-medium md:flex">
          <Link
            href="/"
            className={cn(
              "transition-colors",
              active === "home" ? "text-white" : "text-white/60 hover:text-white",
            )}
          >
            Home
          </Link>
          <Link
            href="/about"
            className={cn(
              "transition-colors",
              active === "about" ? "text-white" : "text-white/60 hover:text-white",
            )}
          >
            About
          </Link>
          <Link
            href="/contact"
            className={cn(
              "transition-colors",
              active === "contact" ? "text-white" : "text-white/60 hover:text-white",
            )}
          >
            Contact
          </Link>
          <Link
            href="/terms"
            className={cn(
              "transition-colors",
              active === "terms" ? "text-white" : "text-white/60 hover:text-white",
            )}
          >
            Terms
          </Link>
        </nav>
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/sign-in"
            className="hidden rounded-xl px-3 py-2 text-sm font-medium text-white/70 transition-colors hover:bg-white/5 hover:text-white sm:inline-flex"
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
