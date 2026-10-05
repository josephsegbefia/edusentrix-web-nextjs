"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { EduSentrixWordmark } from "@/components/brand/EduSentrixWordmark";
import { EDUSENTRIX_LOGO_ALT, EDUSENTRIX_LOGO_PATH } from "@/lib/branding";

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

export function SiteNav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-white/5 bg-neutral-950/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/" className="group inline-flex min-w-0 items-center gap-2.5 sm:gap-4">
          <div className="relative flex h-11 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/3 shadow-lg shadow-black/30 ring-1 ring-white/5 transition-all duration-200 group-hover:scale-[1.03] group-hover:border-cyan-400/25 group-hover:shadow-cyan-500/15 sm:h-14 sm:w-[4.35rem]">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-linear-to-br from-white/10 via-transparent to-cyan-400/12"
            />
            <Image
              src={EDUSENTRIX_LOGO_PATH}
              alt={EDUSENTRIX_LOGO_ALT}
              fill
              sizes="(min-width: 640px) 70px, 56px"
              className="relative object-contain px-1.5 py-1"
              priority
            />
          </div>
          <div className="flex min-w-0 flex-col">
            <EduSentrixWordmark className="text-lg font-semibold tracking-tight sm:text-[1.35rem]" />
            <span className="hidden text-[11px] font-medium uppercase tracking-[0.24em] text-white/35 sm:block">
              School OS for Africa
            </span>
          </div>
        </Link>
        <nav className="hidden items-center gap-8 text-sm font-medium lg:flex">
          <a href="#features" className="text-white/60 transition-colors hover:text-white">
            Features
          </a>
          <a href="#how" className="text-white/60 transition-colors hover:text-white">
            How it works
          </a>
          <a href="#faq" className="text-white/60 transition-colors hover:text-white">
            FAQ
          </a>
        </nav>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <Link
            href="/sign-in"
            className="hidden rounded-xl px-4 py-2.5 text-sm font-medium text-white/70 transition-all hover:bg-white/5 hover:text-white lg:inline-flex"
          >
            Sign in
          </Link>
          <a
            href={DEMO_URL}
            className="hidden items-center gap-1.5 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-2.5 text-sm font-semibold text-cyan-300 backdrop-blur-sm transition-all hover:border-cyan-400/50 hover:bg-cyan-500/20 hover:text-cyan-200 lg:inline-flex"
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
          <button
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white transition-colors hover:bg-white/10 lg:hidden"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>
      {open ? (
        <div className="border-t border-white/10 bg-neutral-950/95 shadow-2xl shadow-black/40 backdrop-blur-xl lg:hidden">
          <nav className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-3 sm:px-6">
            <a
              href="#features"
              className="flex min-h-11 w-full items-center rounded-xl px-4 py-3 text-sm font-medium text-white/80 transition-colors hover:bg-white/5 hover:text-white"
              onClick={() => setOpen(false)}
            >
              Features
            </a>
            <a
              href="#how"
              className="flex min-h-11 w-full items-center rounded-xl px-4 py-3 text-sm font-medium text-white/80 transition-colors hover:bg-white/5 hover:text-white"
              onClick={() => setOpen(false)}
            >
              How it works
            </a>
            <a
              href="#faq"
              className="flex min-h-11 w-full items-center rounded-xl px-4 py-3 text-sm font-medium text-white/80 transition-colors hover:bg-white/5 hover:text-white"
              onClick={() => setOpen(false)}
            >
              FAQ
            </a>
            <Link
              href="/sign-in"
              className="flex min-h-11 w-full items-center rounded-xl px-4 py-3 text-sm font-medium text-white/80 transition-colors hover:bg-white/5 hover:text-white"
              onClick={() => setOpen(false)}
            >
              Sign in
            </Link>
            <a
              href={DEMO_URL}
              className="flex min-h-11 w-full items-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-sm font-semibold text-cyan-300 transition-colors hover:border-cyan-400/50 hover:bg-cyan-500/20 hover:text-cyan-200"
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
          </nav>
        </div>
      ) : null}
    </header>
  );
}
