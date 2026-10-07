"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { BrandMark } from "@/components/brand/BrandMark";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

const DEMO_URL = "https://demo.tryedusentrix.app";

function DemoPlayIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

const linkClass =
  "m-muted transition-colors hover:text-(--m-fg)";

export function SiteNav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="m-header sticky top-0 z-50 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/" className="group inline-flex min-w-0 items-center">
          <BrandMark showTagline />
        </Link>
        <nav className="hidden items-center gap-8 text-sm font-medium lg:flex">
          <a href="#features" className={linkClass}>
            Features
          </a>
          <a href="#how" className={linkClass}>
            How it works
          </a>
          <a href="#faq" className={linkClass}>
            FAQ
          </a>
        </nav>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <Link
            href="/sign-in"
            className="m-muted hidden rounded-xl px-4 py-2.5 text-sm font-medium transition-all hover:bg-(--m-subtle) hover:text-(--m-fg) lg:inline-flex"
          >
            Sign in
          </Link>
          <a
            href={DEMO_URL}
            className="hidden items-center gap-1.5 rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-4 py-2.5 text-sm font-semibold text-cyan-700 backdrop-blur-sm transition-all hover:bg-cyan-500/15 dark:text-cyan-300 lg:inline-flex"
          >
            <DemoPlayIcon className="h-4 w-4" />
            Explore live demo
          </a>
          <Link
            href="/enroll"
            className="inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-xl bg-linear-to-r from-violet-500 to-purple-600 px-3 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 transition-all hover:scale-[1.02] hover:shadow-violet-500/40 sm:px-5"
          >
            <span className="sm:hidden">Enrol</span>
            <span className="hidden sm:inline">Enrol your school</span>
          </Link>
          <ThemeToggle className="hidden lg:inline-flex" />
          <button
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-(--m-border) bg-(--m-subtle) text-(--m-fg) transition-colors hover:bg-(--m-glass) lg:hidden"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>
      {open ? (
        <div className="m-menu lg:hidden">
          <nav className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-3 sm:px-6">
            <a href="#features" className="flex min-h-11 w-full items-center rounded-xl px-4 py-3 text-sm font-medium hover:bg-(--m-subtle)" onClick={() => setOpen(false)}>
              Features
            </a>
            <a href="#how" className="flex min-h-11 w-full items-center rounded-xl px-4 py-3 text-sm font-medium hover:bg-(--m-subtle)" onClick={() => setOpen(false)}>
              How it works
            </a>
            <a href="#faq" className="flex min-h-11 w-full items-center rounded-xl px-4 py-3 text-sm font-medium hover:bg-(--m-subtle)" onClick={() => setOpen(false)}>
              FAQ
            </a>
            <Link href="/sign-in" className="flex min-h-11 w-full items-center rounded-xl px-4 py-3 text-sm font-medium hover:bg-(--m-subtle)" onClick={() => setOpen(false)}>
              Sign in
            </Link>
            <a
              href={DEMO_URL}
              className="flex min-h-11 w-full items-center gap-2 rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-4 py-3 text-sm font-semibold text-cyan-700 dark:text-cyan-300"
              onClick={() => setOpen(false)}
            >
              <DemoPlayIcon className="h-4 w-4 shrink-0" />
              Explore live demo
            </a>
            <Link
              href="/enroll"
              className="flex min-h-11 w-full items-center justify-center rounded-xl bg-linear-to-r from-violet-500 to-purple-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-500/25"
              onClick={() => setOpen(false)}
            >
              Enrol your school
            </Link>
            <div className="px-2 py-2">
              <ThemeToggle />
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
