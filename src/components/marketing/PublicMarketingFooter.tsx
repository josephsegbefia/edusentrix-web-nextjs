import Link from "next/link";
import { BrandMark } from "@/components/brand/BrandMark";

const CONTACT_EMAIL = "hello@tryedusentrix.app";

export function PublicMarketingFooter() {
  return (
    <footer className="border-t border-(--m-border)">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 text-sm sm:grid-cols-2 sm:px-6 md:grid-cols-4 lg:px-8">
        <div>
          <BrandMark size="sm" />
          <p className="mt-4 leading-relaxed m-muted">
            Built by Appsentrix for schools in Ghana & Africa.
          </p>
        </div>

        <div>
          <div className="mb-4 font-semibold text-(--m-fg)">Product</div>
          <ul className="space-y-3 m-muted">
            <li>
              <Link href="/#features" className="transition-colors hover:text-(--m-fg)">
                Features
              </Link>
            </li>
            <li>
              <Link href="/#faq" className="transition-colors hover:text-(--m-fg)">
                FAQ
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <div className="mb-4 font-semibold text-(--m-fg)">Company</div>
          <ul className="space-y-3 m-muted">
            <li>
              <Link href="/about" className="transition-colors hover:text-(--m-fg)">
                About
              </Link>
            </li>
            <li>
              <Link href="/contact" className="transition-colors hover:text-(--m-fg)">
                Contact
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <div className="mb-4 font-semibold text-(--m-fg)">Legal</div>
          <ul className="space-y-3 m-muted">
            <li>
              <Link href="/terms" className="transition-colors hover:text-(--m-fg)">
                Terms
              </Link>
            </li>
            <li>
              <Link href="/privacy" className="transition-colors hover:text-(--m-fg)">
                Privacy
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-(--m-border)">
        <div className="mx-auto max-w-7xl px-4 py-6 text-center text-sm m-faint sm:px-6 lg:px-8">
          <p>
            Questions?{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="m-muted transition-colors hover:text-(--m-fg)"
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
