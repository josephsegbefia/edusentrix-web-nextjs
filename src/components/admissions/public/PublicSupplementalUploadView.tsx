"use client";

import * as React from "react";
import { CheckCircle2, FileText, Loader2, Shield } from "lucide-react";
import { PublicDocumentUploader } from "@/components/admissions/public/PublicDocumentUploader";
import type { AdmissionDocumentRequirement } from "@/lib/admissions/types";
import type { UploadedDocument } from "@/components/admissions/public/PublicDocumentUploader";

type SupplementalMeta = {
  referenceCode: string;
  schoolName: string;
  schoolLogoUrl: string | null;
  cycleName: string;
  documentLabel: string;
  message: string | null;
};

export function PublicSupplementalUploadView({ token }: { token: string }) {
  const [meta, setMeta] = React.useState<SupplementalMeta | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [doc, setDoc] = React.useState<UploadedDocument | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/public/admissions/supplemental/${token}`, {
          cache: "no-store",
        });
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok || !json.success) {
          throw new Error(json?.error || "Could not load this page");
        }
        setMeta(json.data as SupplementalMeta);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const requirement: AdmissionDocumentRequirement = React.useMemo(
    () => ({
      id: "supplemental",
      label: meta?.documentLabel ?? "Document",
      helpText: meta?.message ?? undefined,
      required: true,
      maxSizeMb: 16,
      mimeTypes: [
        "application/pdf",
        "image/jpeg",
        "image/png",
        "image/webp",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ],
    }),
    [meta?.documentLabel, meta?.message]
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#080b12] px-4 text-white">
        <div className="flex flex-col items-center gap-2 text-sm text-white/55">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading secure upload…
        </div>
      </div>
    );
  }

  if (error || !meta) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#080b12] px-4 text-center text-white">
        <Shield className="h-10 w-10 text-rose-400/80" />
        <p className="mt-4 max-w-md text-sm text-white/70">
          {error ?? "This link is not valid."}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080b12] px-4 py-10 text-white">
      <div className="mx-auto max-w-lg space-y-6">
        <header className="overflow-hidden rounded-3xl border border-white/10 bg-linear-to-br from-indigo-950/50 via-[#0e1420] to-[#080b12] p-6 shadow-xl">
          <div className="flex items-start gap-4">
            {meta.schoolLogoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- school logos may be any origin
              <img
                src={meta.schoolLogoUrl}
                alt=""
                className="h-12 w-12 rounded-2xl border border-white/10 object-cover"
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-lg font-semibold text-white/80">
                {meta.schoolName.charAt(0)}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-indigo-200/80">
                {meta.schoolName}
              </p>
              <h1 className="mt-1 text-xl font-semibold tracking-tight">
                Upload requested document
              </h1>
              <p className="mt-1 text-xs text-white/50">
                {meta.cycleName} · Ref{" "}
                <span className="font-mono text-white/80">
                  {meta.referenceCode}
                </span>
              </p>
            </div>
          </div>
        </header>

        {doc ? (
          <div className="flex items-start gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
            <div>
              <p className="font-medium text-emerald-100">Upload received</p>
              <p className="mt-1 text-xs text-white/60">
                Thank you. The admissions team will review your file. You can
                close this page.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-white/60">
              <FileText className="h-4 w-4 shrink-0 text-indigo-300" />
              <span>
                This page is private to your family. Do not forward this link.
              </span>
            </div>
            <PublicDocumentUploader
              requirement={requirement}
              supplementalRequestToken={token}
              value={doc}
              onChange={setDoc}
            />
          </>
        )}

        <div className="flex items-center justify-center gap-2 text-[11px] text-white/35">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo/edusentrix-logo-transparent.png"
            alt=""
            className="h-4 w-4 object-contain opacity-70"
          />
          Secure admissions upload
        </div>
      </div>
    </div>
  );
}
