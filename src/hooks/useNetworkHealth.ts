/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  sseManager,
  type SSEConnectionState,
  type SSEStatusEvent,
} from "@/lib/network/sse-manager";

export type NetworkQuality = "offline" | "poor" | "degraded" | "good";
export type { SSEConnectionState };
type NonOfflineNetworkQuality = Exclude<NetworkQuality, "offline">;

type ProbeResult = {
  ok: boolean;
  rttMs?: number;
};

type NetworkTelemetryEvent = {
  reason:
    | "probe_success"
    | "probe_failed"
    | "navigator_offline"
    | "offline_event";
  online: boolean;
  quality: NetworkQuality;
  effectiveType: string | null;
  downlink: number | null;
  rtt: number | null;
  probeRtt: number | null;
  probeOk: boolean;
  probeFailures: number;
};

const NETWORK_TELEMETRY_STORAGE_KEY = "edusentrix_network_telemetry";
const NETWORK_TELEMETRY_HEARTBEAT_MS = 60_000;
const DEFAULT_SSE_STATUS: SSEStatusEvent = {
  state: "disconnected",
  lastConnectedAt: null,
  lastDisconnectedAt: null,
  reconnectAttempts: 0,
};

/** Low-level ping: tries /api/healthz then falls back to /favicon.ico */
async function connectivityProbe(signal?: AbortSignal): Promise<ProbeResult> {
  const targets = ["/api/healthz", `/favicon.ico?t=${Date.now()}`];

  for (const url of targets) {
    const started = performance.now();
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

function toPositiveNumber(value?: number): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return value > 0 ? value : undefined;
}

function toNullableNumber(value?: number): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

function telemetrySignalSignature(event: NetworkTelemetryEvent): string {
  const downlink = event.downlink === null ? null : Number(event.downlink.toFixed(1));
  const rtt = event.rtt === null ? null : Math.round(event.rtt);
  const probeRtt =
    event.probeRtt === null ? null : Math.round(event.probeRtt);

  return JSON.stringify({
    online: event.online,
    quality: event.quality,
    effectiveType: event.effectiveType,
    downlink,
    rtt,
    probeRtt,
    probeOk: event.probeOk,
    probeFailures: event.probeFailures,
  });
}

function isNetworkTelemetryEnabled(): boolean {
  // Opt in via NEXT_PUBLIC_NETWORK_TELEMETRY=true or localStorage flag.
  if (process.env.NEXT_PUBLIC_NETWORK_TELEMETRY === "true") return true;
  if (typeof window === "undefined") return false;

  try {
    const value = window.localStorage.getItem(NETWORK_TELEMETRY_STORAGE_KEY);
    return value === "1" || value === "true" || value === "on";
  } catch {
    return false;
  }
}

export function classifyEffectiveType(
  effectiveType?: string
): NonOfflineNetworkQuality | null {
  if (!effectiveType) return null;
  if (effectiveType === "slow-2g" || effectiveType === "2g") return "poor";
  if (effectiveType === "3g") return "degraded";
  if (effectiveType === "4g") return "good";
  return null;
}

export function classifyDownlink(
  downlink?: number
): NonOfflineNetworkQuality | null {
  const value = toPositiveNumber(downlink);
  if (value === undefined) return null;
  if (value < 0.5) return "poor";
  if (value < 1.5) return "degraded";
  return "good";
}

export function classifyRtt(rtt?: number): NonOfflineNetworkQuality | null {
  const value = toPositiveNumber(rtt);
  if (value === undefined) return null;
  if (value > 2000) return "poor";
  if (value > 900) return "degraded";
  return "good";
}

export function classifyProbeRtt(
  probeRtt?: number
): NonOfflineNetworkQuality | null {
  const value = toPositiveNumber(probeRtt);
  if (value === undefined) return null;
  if (value > 2500) return "poor";
  if (value > 1200) return "degraded";
  return "good";
}

/** Map current connection metrics + rttMs to a quality band */
export function computeQuality(
  effectiveType?: string,
  downlink?: number,
  rtt?: number,
  probeRtt?: number
): NetworkQuality {
  const signals: NonOfflineNetworkQuality[] = [];

  const effectiveTypeSignal = classifyEffectiveType(effectiveType);
  if (effectiveTypeSignal) signals.push(effectiveTypeSignal);

  const downlinkSignal = classifyDownlink(downlink);
  if (downlinkSignal) signals.push(downlinkSignal);

  const rttSignal = classifyRtt(rtt);
  if (rttSignal) signals.push(rttSignal);

  const probeSignal = classifyProbeRtt(probeRtt);
  if (probeSignal) signals.push(probeSignal);

  if (signals.length === 0) return "good";
  if (signals.length === 1) return signals[0];

  const poorCount = signals.filter((signal) => signal === "poor").length;
  const degradedCount = signals.filter((signal) => signal === "degraded").length;
  const goodCount = signals.filter((signal) => signal === "good").length;

  // Require consistent poor evidence before showing "poor".
  if (poorCount >= 2) return "poor";
  if (poorCount === 1) {
    // Treat a single severe outlier as degraded unless it is the only signal.
    if (goodCount >= 2) return "good";
    return "degraded";
  }

  if (degradedCount >= 2) return "degraded";
  if (degradedCount === 1 && goodCount === 0) return "degraded";

  return "good";
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
  const probeFailureCountRef = useRef(0);
  const lastTelemetryAtRef = useRef(0);
  const lastTelemetrySignatureRef = useRef("");

  const connection =
    (typeof navigator !== "undefined" && (navigator as any).connection) || null;

  const emitTelemetry = (event: NetworkTelemetryEvent) => {
    if (!isNetworkTelemetryEnabled()) return;

    const now = Date.now();
    const signature = telemetrySignalSignature(event);
    const changed = signature !== lastTelemetrySignatureRef.current;
    const heartbeatDue =
      now - lastTelemetryAtRef.current >= NETWORK_TELEMETRY_HEARTBEAT_MS;
    const forceLog =
      event.reason === "probe_failed" || event.reason === "offline_event";

    if (!forceLog && !changed && !heartbeatDue) return;

    lastTelemetryAtRef.current = now;
    lastTelemetrySignatureRef.current = signature;

    console.info("[network-telemetry]", {
      ts: new Date(now).toISOString(),
      intervalMs,
      ...event,
    });
  };

  const refresh = async () => {
    // Online/offline quick check
    const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
    setOnline(isOnline);

    let probe: ProbeResult = { ok: isOnline };
    let effectiveType: string | undefined;
    let downlink: number | undefined;
    let rtt: number | undefined;

    if (!isOnline) {
      probeFailureCountRef.current = 0;
      setQuality("offline");
      emitTelemetry({
        reason: "navigator_offline",
        online: false,
        quality: "offline",
        effectiveType: null,
        downlink: null,
        rtt: null,
        probeRtt: null,
        probeOk: false,
        probeFailures: 0,
      });
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

    if (!probe.ok) {
      probeFailureCountRef.current += 1;
      const nextQuality: NetworkQuality =
        probeFailureCountRef.current >= 2 || quality === "offline"
          ? "offline"
          : "degraded";

      setMetrics({ effectiveType, downlink, rtt, probeRtt: undefined });
      setQuality(nextQuality);
      emitTelemetry({
        reason: "probe_failed",
        online: true,
        quality: nextQuality,
        effectiveType: effectiveType ?? null,
        downlink: toNullableNumber(downlink),
        rtt: toNullableNumber(rtt),
        probeRtt: null,
        probeOk: false,
        probeFailures: probeFailureCountRef.current,
      });
      return;
    }

    probeFailureCountRef.current = 0;
    const q = computeQuality(effectiveType, downlink, rtt, probe.rttMs);

    setMetrics({ effectiveType, downlink, rtt, probeRtt: probe.rttMs });
    setQuality(q);
    emitTelemetry({
      reason: "probe_success",
      online: true,
      quality: q,
      effectiveType: effectiveType ?? null,
      downlink: toNullableNumber(downlink),
      rtt: toNullableNumber(rtt),
      probeRtt: toNullableNumber(probe.rttMs),
      probeOk: true,
      probeFailures: 0,
    });
  };

  useEffect(() => {
    refresh(); // initial

    const onOnline = () => refresh();
    const onOffline = () => {
      probeFailureCountRef.current = 0;
      setOnline(false);
      setQuality("offline");
      emitTelemetry({
        reason: "offline_event",
        online: false,
        quality: "offline",
        effectiveType: null,
        downlink: null,
        rtt: null,
        probeRtt: null,
        probeOk: false,
        probeFailures: 0,
      });
    };

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

  // SSE status tracking
  const [sseStatus, setSseStatus] = useState<SSEStatusEvent>(DEFAULT_SSE_STATUS);

  useEffect(() => {
    if (!sseManager) return;

    const unsubscribe = sseManager.subscribe((status) => {
      setSseStatus(status);
    });

    return unsubscribe;
  }, []);

  const detail = useMemo(
    () => ({
      quality,
      online,
      effectiveType: metrics.effectiveType,
      downlink: metrics.downlink,
      rtt: metrics.rtt,
      probeRtt: metrics.probeRtt,
      sseState: sseStatus.state,
      sseLastConnectedAt: sseStatus.lastConnectedAt,
      sseLastDisconnectedAt: sseStatus.lastDisconnectedAt,
      sseReconnectAttempts: sseStatus.reconnectAttempts,
      sseError: sseStatus.error,
      isSSEConnected: sseStatus.state === "connected",
    }),
    [quality, online, metrics, sseStatus]
  );

  return detail;
}
