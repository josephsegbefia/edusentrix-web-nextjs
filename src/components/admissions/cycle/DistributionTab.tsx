"use client";

import * as React from "react";
import {
  CheckCircle2,
  Code2,
  Copy,
  Download,
  ExternalLink,
  Link2,
  Loader2,
  Mail,
  MessageCircle,
  Plus,
  QrCode,
  Send,
  Trash2,
} from "lucide-react";
import QRCode from "qrcode";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import type { AdmissionCycleDTO } from "@/hooks/admissions/useAdmissionCycles";
import { cn } from "@/lib/utils";

type DistributionTabProps = {
  cycle: AdmissionCycleDTO;
};

function originUrl(): string {
  if (typeof window === "undefined") return "";
  return window.location.origin;
}

export function DistributionTab({ cycle }: DistributionTabProps) {
  const baseUrl = originUrl();
  const applyUrl = `${baseUrl}/apply/${cycle.schoolId}/${cycle.slug}`;

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <PublicLinkCard applyUrl={applyUrl} cycle={cycle} />
      <EmbedCard applyUrl={applyUrl} cycle={cycle} />
      <QrCard applyUrl={applyUrl} />
      <WhatsAppCard applyUrl={applyUrl} cycle={cycle} />
      <DirectInviteCard cycle={cycle} />
    </div>
  );
}

function CardShell({
  title,
  icon,
  description,
  children,
  className,
}: {
  title: string;
  icon: React.ReactNode;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-white/10 bg-slate-950/60 p-5",
        className
      )}
    >
      <div className="mb-3 flex items-start gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/80">
          {icon}
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          {description ? (
            <p className="text-xs text-white/55">{description}</p>
          ) : null}
        </div>
      </div>
      {children}
    </section>
  );
}

function PublicLinkCard({
  applyUrl,
  cycle,
}: {
  applyUrl: string;
  cycle: AdmissionCycleDTO;
}) {
  const ineligible = cycle.status !== "published";
  return (
    <CardShell
      title="Public application link"
      icon={<Link2 className="h-4 w-4" />}
      description="Anyone with this link can open the application."
    >
      {ineligible ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-100">
          Publish the cycle to activate the link. Drafts are not reachable.
        </div>
      ) : null}
      <div className="mt-3 flex items-center gap-2">
        <Input
          value={applyUrl}
          readOnly
          className="h-9 font-mono text-xs"
          onFocus={(e) => e.currentTarget.select()}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            void navigator.clipboard.writeText(applyUrl).then(
              () => toast.success("Link copied"),
              () => toast.error("Could not copy")
            );
          }}
        >
          <Copy className="mr-1.5 h-3.5 w-3.5" />
          Copy
        </Button>
        <Button
          variant="ghost"
          size="sm"
          asChild
          className="text-white/55"
          disabled={ineligible}
        >
          <a href={applyUrl} target="_blank" rel="noreferrer">
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </Button>
      </div>
    </CardShell>
  );
}

function EmbedCard({
  applyUrl,
  cycle,
}: {
  applyUrl: string;
  cycle: AdmissionCycleDTO;
}) {
  const baseUrl = originUrl();
  const embedUrl = `${applyUrl}?via=embed`;
  const [mode, setMode] = React.useState<"smart" | "iframe">("smart");

  const smartSnippet = `<div
  data-edusentrix-admissions
  data-school-id="${cycle.schoolId}"
  data-cycle-slug="${cycle.slug}"
></div>
<script src="${baseUrl}/api/public/admissions/embed.js" async></script>`;

  const iframeSnippet = `<iframe
  src="${embedUrl}"
  width="100%"
  height="900"
  frameborder="0"
  style="border:0;border-radius:16px;background:#fff"
  title="Apply to ${cycle.name}"
></iframe>`;

  const snippet = mode === "smart" ? smartSnippet : iframeSnippet;

  return (
    <CardShell
      title="Embed on your website"
      icon={<Code2 className="h-4 w-4" />}
      description="Drop this snippet on any HTML page."
    >
      <div className="mb-2 inline-flex rounded-lg border border-white/10 bg-black/30 p-0.5">
        <button
          type="button"
          onClick={() => setMode("smart")}
          className={cn(
            "rounded-md px-2.5 py-1 text-[11px] font-semibold transition",
            mode === "smart"
              ? "bg-cyan-500/20 text-cyan-100"
              : "text-white/55 hover:text-white"
          )}
        >
          Smart embed (auto-resize)
        </button>
        <button
          type="button"
          onClick={() => setMode("iframe")}
          className={cn(
            "rounded-md px-2.5 py-1 text-[11px] font-semibold transition",
            mode === "iframe"
              ? "bg-cyan-500/20 text-cyan-100"
              : "text-white/55 hover:text-white"
          )}
        >
          Plain iframe
        </button>
      </div>
      <Textarea
        value={snippet}
        readOnly
        rows={6}
        className="font-mono text-xs"
        onFocus={(e) => e.currentTarget.select()}
      />
      <p className="mt-2 text-[11px] text-white/45">
        {mode === "smart"
          ? "Recommended. The widget loads our hosted script and resizes itself as the form changes."
          : "Use when your CMS strips <script> tags. You may need to adjust the height manually."}
      </p>
      <div className="mt-2 flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            void navigator.clipboard.writeText(snippet).then(
              () => toast.success("Embed code copied"),
              () => toast.error("Could not copy")
            );
          }}
        >
          <Copy className="mr-1.5 h-3.5 w-3.5" />
          Copy embed
        </Button>
      </div>
    </CardShell>
  );
}

function QrCard({ applyUrl }: { applyUrl: string }) {
  const qrUrl = `${applyUrl}?via=qr`;
  const [dataUrl, setDataUrl] = React.useState<string>("");

  React.useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(qrUrl, {
      errorCorrectionLevel: "M",
      width: 320,
      margin: 1,
      color: { dark: "#0a4ad9", light: "#ffffff" },
    })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setDataUrl("");
      });
    return () => {
      cancelled = true;
    };
  }, [qrUrl]);

  function downloadPng() {
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = "admissions-qr.png";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  return (
    <CardShell
      title="QR code"
      icon={<QrCode className="h-4 w-4" />}
      description="Print on flyers, enrollment posters, or info packs."
    >
      <div className="flex items-center gap-3">
        <div className="flex h-32 w-32 items-center justify-center rounded-xl border border-white/10 bg-white p-2">
          {dataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={dataUrl} alt="Application QR code" className="h-full w-full" />
          ) : (
            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
          )}
        </div>
        <div className="flex-1 space-y-2">
          <p className="text-xs text-white/55">Decoded URL</p>
          <p className="rounded-md border border-white/10 bg-black/30 p-2 font-mono text-[10px] break-all text-white/70">
            {qrUrl}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={downloadPng}
            disabled={!dataUrl}
            className="w-full"
          >
            <Download className="mr-2 h-3.5 w-3.5" />
            Download PNG
          </Button>
        </div>
      </div>
    </CardShell>
  );
}

function WhatsAppCard({
  applyUrl,
  cycle,
}: {
  applyUrl: string;
  cycle: AdmissionCycleDTO;
}) {
  const link = `${applyUrl}?via=whatsapp`;
  const message = `Apply to ${cycle.name}: ${link}`;
  const wa = `https://wa.me/?text=${encodeURIComponent(message)}`;
  return (
    <CardShell
      title="WhatsApp share"
      icon={<MessageCircle className="h-4 w-4" />}
      description="Compose a pre-filled message in WhatsApp."
    >
      <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 p-3">
        <p className="line-clamp-2 text-xs text-white/70">{message}</p>
        <Button asChild size="sm" className="bg-emerald-500 hover:bg-emerald-600">
          <a href={wa} target="_blank" rel="noreferrer">
            <Send className="mr-1.5 h-3.5 w-3.5" />
            Open WhatsApp
          </a>
        </Button>
      </div>
    </CardShell>
  );
}

function DirectInviteCard({ cycle }: { cycle: AdmissionCycleDTO }) {
  const [recipients, setRecipients] = React.useState<
    Array<{ email: string; name: string }>
  >([{ email: "", name: "" }]);
  const [message, setMessage] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [last, setLast] = React.useState<{ sent: number; failed: number } | null>(
    null
  );

  function addRow() {
    setRecipients((prev) => [...prev, { email: "", name: "" }]);
  }

  function removeRow(idx: number) {
    setRecipients((prev) => prev.filter((_, i) => i !== idx));
  }

  async function send() {
    const valid = recipients.filter(
      (r) => r.email.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email.trim())
    );
    if (valid.length === 0) {
      toast.error("Add at least one valid email address.");
      return;
    }
    setSending(true);
    try {
      const res = await fetch(
        `/api/admin/admissions/cycles/${cycle.id}/invites`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recipients: valid.map((r) => ({
              email: r.email.trim(),
              name: r.name.trim() || undefined,
            })),
            message: message || undefined,
          }),
        }
      );
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json?.error || "Failed to send invites");
      }
      setLast({ sent: json.data.sent, failed: json.data.failed });
      toast.success(
        json.data.failed > 0
          ? `Sent ${json.data.sent}, ${json.data.failed} failed`
          : `Sent ${json.data.sent} invite${json.data.sent === 1 ? "" : "s"}`
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to send invites");
    } finally {
      setSending(false);
    }
  }

  const ineligible = cycle.status !== "published";

  return (
    <CardShell
      title="Direct invite"
      icon={<Mail className="h-4 w-4" />}
      description="Email applicants the link directly with an optional note."
      className="lg:col-span-2"
    >
      {ineligible ? (
        <div className="mb-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-100">
          Publish the cycle to send invites.
        </div>
      ) : null}
      <div className="space-y-2">
        {recipients.map((r, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <Input
              placeholder="Email"
              value={r.email}
              onChange={(e) =>
                setRecipients((prev) =>
                  prev.map((row, idx) =>
                    idx === i ? { ...row, email: e.target.value } : row
                  )
                )
              }
              className="h-9 max-w-xs flex-1"
            />
            <Input
              placeholder="Name (optional)"
              value={r.name}
              onChange={(e) =>
                setRecipients((prev) =>
                  prev.map((row, idx) =>
                    idx === i ? { ...row, name: e.target.value } : row
                  )
                )
              }
              className="h-9 max-w-xs flex-1"
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => removeRow(i)}
              disabled={recipients.length <= 1}
              className="h-9 w-9 p-0 text-rose-400 hover:text-rose-300"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
        <Button variant="ghost" size="sm" onClick={addRow}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          Add recipient
        </Button>
      </div>

      <Textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={3}
        placeholder="Optional personal note appended to the email"
        className="mt-3"
      />

      <div className="mt-3 flex items-center justify-between gap-3">
        <div>
          {last ? (
            <Badge
              variant="outline"
              className="border-white/10 bg-white/5 text-xs text-white/70"
            >
              <CheckCircle2 className="mr-1 h-3 w-3 text-emerald-400" />
              Sent {last.sent}
              {last.failed > 0 ? ` · ${last.failed} failed` : ""}
            </Badge>
          ) : null}
        </div>
        <Button onClick={send} disabled={sending || ineligible}>
          {sending ? (
            <>
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              Sending…
            </>
          ) : (
            <>
              <Send className="mr-2 h-3.5 w-3.5" />
              Send invites
            </>
          )}
        </Button>
      </div>
    </CardShell>
  );
}
