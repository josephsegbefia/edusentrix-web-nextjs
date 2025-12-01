/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type NetworkQuality = "offline" | "poor" | "degraded" | "good";

type ProbeResult = {
  ok: boolean;
  rttMs?: number;
};

const QUALITY_ORDER: NetworkQuality[] = ["offline", "poor", "degraded", "good"];
const QUALITY_RANK = (q: NetworkQuality) => QUALITY_ORDER.indexOf(q);

/** Low-level ping: tries /api/healthz then falls back to /favicon.ico */
async function connectivityProbe(signal?: AbortSignal): Promise<ProbeResult> {
  const targets = ["/api/healthz", `/favicon.ico?t=${Date.now()}`];
  const started = performance.now();

  for (const url of targets) {
    try {
      const res = await fetch(url, {
        method: "HEAD",
        cache: "no-store",
        signal,
      });
      if (res.ok) {
        const rttMs = performance.now() - started;
        return { ok: true, rttMs };
      }
    } catch {
      /* try next */
    }
  }
  return { ok: false };
}

/** Map current connection metrics + rttMs to a quality band */
function computeQuality(
  effectiveType?: string,
  downlink?: number,
  rtt?: number,
  probeRtt?: number
): NetworkQuality {
  // Heuristics (favor the "worst" signal among sources)
  let fromConn: NetworkQuality | null = null;

  if (effectiveType) {
    // slow-2g/2g => poor, 3g => degraded, 4g+ => good
    if (effectiveType === "slow-2g" || effectiveType === "2g")
      fromConn = "poor";
    else if (effectiveType === "3g") fromConn = "degraded";
    else fromConn = "good";
  }
  if (typeof downlink === "number") {
    // <1 Mbps poor, <3 Mbps degraded, else good
    const byDown = downlink < 1 ? "poor" : downlink < 3 ? "degraded" : "good";
    fromConn = minQuality(fromConn, byDown as NetworkQuality);
  }
  if (typeof rtt === "number") {
    // >800ms poor, >300ms degraded
    const byRtt = rtt > 800 ? "poor" : rtt > 300 ? "degraded" : "good";
    fromConn = minQuality(fromConn, byRtt as NetworkQuality);
  }
  if (typeof probeRtt === "number") {
    const byProbe =
      probeRtt > 1200 ? "poor" : probeRtt > 400 ? "degraded" : "good";
    fromConn = minQuality(fromConn, byProbe as NetworkQuality);
  }

  return fromConn ?? "good";
}

function minQuality(
  a: NetworkQuality | null,
  b: NetworkQuality
): NetworkQuality {
  if (!a) return b;
  return QUALITY_RANK(a) < QUALITY_RANK(b) ? a : b;
}

export function useNetworkHealth(intervalMs = 20000) {
  const [quality, setQuality] = useState<NetworkQuality>("good");
  const [online, setOnline] = useState<boolean>(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [metrics, setMetrics] = useState<{
    effectiveType?: string;
    downlink?: number;
    rtt?: number;
    probeRtt?: number;
  }>({});
  const abortRef = useRef<AbortController | null>(null);

  const connection =
    (typeof navigator !== "undefined" && (navigator as any).connection) || null;

  const refresh = async () => {
    // Online/offline quick check
    const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
    setOnline(isOnline);

    let probe: ProbeResult = { ok: isOnline };
    let effectiveType: string | undefined;
    let downlink: number | undefined;
    let rtt: number | undefined;

    if (!isOnline) {
      setQuality("offline");
      return;
    }

    // Grab connection metrics if available
    if (connection) {
      effectiveType = connection.effectiveType;
      downlink = connection.downlink;
      rtt = connection.rtt;
    }

    // Active probe
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    try {
      probe = await connectivityProbe(abortRef.current.signal);
    } catch {
      /* ignore */
    }

    const q = probe.ok
      ? computeQuality(effectiveType, downlink, rtt, probe.rttMs)
      : "offline";

    setMetrics({ effectiveType, downlink, rtt, probeRtt: probe.rttMs });
    setQuality(q);
  };

  useEffect(() => {
    refresh(); // initial

    const onOnline = () => refresh();
    const onOffline = () => setQuality("offline");

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    // React to connection changes when supported
    const onConnChange = () => refresh();
    connection?.addEventListener?.("change", onConnChange);

    // Interval polling
    const id = window.setInterval(refresh, intervalMs);

    // Refresh on tab return
    const onVis = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVis);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      document.removeEventListener("visibilitychange", onVis);
      connection?.removeEventListener?.("change", onConnChange);
      window.clearInterval(id);
      abortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const detail = useMemo(
    () => ({
      quality,
      online,
      effectiveType: metrics.effectiveType,
      downlink: metrics.downlink,
      rtt: metrics.rtt,
      probeRtt: metrics.probeRtt,
    }),
    [quality, online, metrics]
  );

  return detail;
}
