import Image from "next/image";
import Link from "next/link";
import { EduSentrixWordmark } from "@/components/brand/EduSentrixWordmark";
import { EDUSENTRIX_LOGO_ALT, EDUSENTRIX_LOGO_PATH } from "@/lib/branding";

const CONTACT_EMAIL = "hello@tryedusentrix.app";

export function PublicMarketingFooter() {
  return (
    <footer className="border-t border-white/10 bg-neutral-950">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 text-sm sm:grid-cols-2 sm:px-6 md:grid-cols-4 lg:px-8">
        <div>
          <div className="inline-flex items-center gap-2.5">
            <Image
              src={EDUSENTRIX_LOGO_PATH}
              alt={EDUSENTRIX_LOGO_ALT}
              width={36}
              height={36}
              className="rounded-xl"
            />
            <EduSentrixWordmark className="text-lg font-semibold tracking-tight" />
          </div>
          <p className="mt-4 leading-relaxed text-white/50">
            Built by Appsentrix for schools in Ghana & Africa.
          </p>
        </div>

        <div>
          <div className="mb-4 font-semibold text-white">Product</div>
          <ul className="space-y-3 text-white/50">
            <li>
              <Link href="/#features" className="transition-colors hover:text-white">
                Features
              </Link>
            </li>
            <li>
              <Link href="/#faq" className="transition-colors hover:text-white">
                FAQ
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <div className="mb-4 font-semibold text-white">Company</div>
          <ul className="space-y-3 text-white/50">
            <li>
              <Link href="/about" className="transition-colors hover:text-white">
                About
              </Link>
            </li>
            <li>
              <Link href="/contact" className="transition-colors hover:text-white">
                Contact
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <div className="mb-4 font-semibold text-white">Legal</div>
          <ul className="space-y-3 text-white/50">
            <li>
              <Link href="/terms" className="transition-colors hover:text-white">
                Terms
              </Link>
            </li>
            <li>
              <Link href="/privacy" className="transition-colors hover:text-white">
                Privacy
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/5">
        <div className="mx-auto max-w-7xl px-4 py-6 text-center text-sm text-white/40 sm:px-6 lg:px-8">
          <p>
            Questions?{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-white/55 transition-colors hover:text-white"
            >
              {CONTACT_EMAIL}
            </a>
          </p>
          <p className="mt-2">© {new Date().getFullYear()} Appsentrix. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
