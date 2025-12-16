// src/app/(app)/admin/fees/invoices/new/page.tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function CreateInvoicePage() {
  const router = useRouter();

  // Redirect to invoices list page - creation is now done via modal
  useEffect(() => {
    router.replace("/admin/fees/invoices");
  }, [router]);

  return null;
}
