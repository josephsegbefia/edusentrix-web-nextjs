"use client";

import * as React from "react";

export default function FeatureGate({
  enabled,
  fallback = null,
  children,
}: {
  enabled: boolean;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}) {
  return <>{enabled ? children : fallback}</>;
}
