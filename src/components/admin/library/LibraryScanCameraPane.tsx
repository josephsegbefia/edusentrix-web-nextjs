"use client";

import * as React from "react";
import { Camera, CameraOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type BarcodeDetectCtor = new (opts: { formats: string[] }) => {
  detect: (source: HTMLVideoElement) => Promise<{ rawValue?: string }[]>;
};

export function LibraryScanCameraPane({
  onDetected,
  disabled,
}: {
  onDetected: (value: string) => void;
  disabled?: boolean;
}) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const rafRef = React.useRef<number | null>(null);
  const [active, setActive] = React.useState(false);

  const stop = React.useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    const v = videoRef.current;
    if (v) v.srcObject = null;
    setActive(false);
  }, []);

  React.useEffect(() => () => stop(), [stop]);

  async function start() {
    if (disabled || typeof window === "undefined") return;
    const BD = (window as unknown as { BarcodeDetector?: BarcodeDetectCtor }).BarcodeDetector;
    if (!BD) {
      toast.message("Camera scan needs BarcodeDetector (Chrome or Edge, often on Android).");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error("Camera not available in this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      const v = videoRef.current;
      if (!v) {
        stop();
        return;
      }
      v.srcObject = stream;
      await v.play();
      setActive(true);
      const detector = new BD({
        formats: ["qr_code", "code_128", "ean_13", "ean_8", "code_39"],
      });

      const tick = async () => {
        const video = videoRef.current;
        if (!video || !streamRef.current) return;
        try {
          const codes = await detector.detect(video);
          const raw = codes.map((c) => c.rawValue?.trim()).find(Boolean);
          if (raw) {
            onDetected(raw);
            stop();
            return;
          }
        } catch {
          /* decoding not ready for this frame */
        }
        rafRef.current = requestAnimationFrame(() => void tick());
      };
      void tick();
    } catch {
      toast.error("Could not access the camera.");
      stop();
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {!active ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="border-white/20 text-white"
            onClick={() => void start()}
            disabled={disabled}
          >
            <Camera className="mr-2 h-4 w-4" />
            Use camera
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="bg-white/15 text-white"
            onClick={stop}
          >
            <CameraOff className="mr-2 h-4 w-4" />
            Stop camera
          </Button>
        )}
      </div>
      <video
        ref={videoRef}
        className="max-h-56 w-full rounded-lg border border-white/15 bg-black/40 object-contain"
        muted
        playsInline
      />
      <p className="text-[11px] text-white/45">
        Point at a barcode or QR code. If your browser does not support BarcodeDetector, use the field
        above or a USB wedge scanner.
      </p>
    </div>
  );
}
