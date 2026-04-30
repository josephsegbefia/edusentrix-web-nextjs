"use client";

import * as React from "react";
import QRCode from "qrcode";
import { Loader2, QrCode } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type CopyCodes = {
  id: string;
  copyCode: string;
  barcode?: string;
  qrCode?: string;
};

type GenerateMutation = {
  mutateAsync: (args: { copyId: string; bookId: string }) => Promise<unknown>;
  isPending: boolean;
};

export function LibraryCopyLabelButton({
  bookId,
  copy,
  canManage,
  generateCopyCodes,
}: {
  bookId: string;
  copy: CopyCodes;
  canManage: boolean;
  generateCopyCodes: GenerateMutation;
}) {
  const [open, setOpen] = React.useState(false);
  const [dataUrl, setDataUrl] = React.useState<string | null>(null);

  const encodePayload = copy.qrCode || (copy.barcode ? `EDU:${copy.barcode}` : copy.copyCode);

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setDataUrl(null);
    void QRCode.toDataURL(encodePayload, {
      width: 220,
      margin: 1,
      color: { dark: "#0f172a", light: "#ffffff" },
    })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) toast.error("Could not render QR");
      });
    return () => {
      cancelled = true;
    };
  }, [open, encodePayload]);

  async function generate() {
    try {
      await generateCopyCodes.mutateAsync({ copyId: copy.id, bookId });
      toast.success("Saved scannable codes for this copy");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Generate failed");
    }
  }

  const needsGenerate = !copy.barcode && !copy.qrCode;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-white/70 hover:text-white"
          title="QR & barcode"
        >
          <QrCode className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="border-white/10 bg-slate-900 text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Copy labels · {copy.copyCode}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          {needsGenerate && canManage ? (
            <p className="text-white/60">
              Generate a barcode token and QR payload. Librarians can also find this copy by pasting
              either value in circulation lookup.
            </p>
          ) : null}
          {canManage && needsGenerate ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="bg-white/15 text-white"
              disabled={generateCopyCodes.isPending}
              onClick={() => void generate()}
            >
              {generateCopyCodes.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Generate codes
            </Button>
          ) : null}
          <dl className="grid gap-2 text-xs">
            <div>
              <dt className="text-white/45">Barcode / keyboard wedge</dt>
              <dd className="font-mono text-white/90">{copy.barcode || "—"}</dd>
            </div>
            <div>
              <dt className="text-white/45">QR payload</dt>
              <dd className="break-all font-mono text-white/90">{copy.qrCode || encodePayload}</dd>
            </div>
          </dl>
          <div className="flex justify-center rounded-lg bg-white p-3">
            {dataUrl ? (
              <img src={dataUrl} alt="" width={220} height={220} className="h-[220px] w-[220px]" />
            ) : (
              <Loader2 className="h-10 w-10 animate-spin text-slate-400" />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
