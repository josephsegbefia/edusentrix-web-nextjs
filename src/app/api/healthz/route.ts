import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";

export type ServiceHealth = {
  status: "healthy" | "degraded" | "unhealthy";
  latencyMs?: number;
  message?: string;
};

export type HealthCheckResponse = {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  services: {
    database: ServiceHealth;
    server: ServiceHealth;
  };
  version: string;
};

async function checkDatabaseHealth(): Promise<ServiceHealth> {
  const start = performance.now();
  try {
    // Check if mongoose is connected
    if (mongoose.connection.readyState !== 1) {
      return {
        status: "unhealthy",
        message: "Database not connected",
      };
    }

    // Try a simple operation to verify connection is working
    await mongoose.connection.db?.admin().ping();
    const latencyMs = Math.round(performance.now() - start);

    if (latencyMs > 1000) {
      return {
        status: "degraded",
        latencyMs,
        message: "Database responding slowly",
      };
    }

    return {
      status: "healthy",
      latencyMs,
    };
  } catch (error) {
    return {
      status: "unhealthy",
      latencyMs: Math.round(performance.now() - start),
      message: error instanceof Error ? error.message : "Database check failed",
    };
  }
}

// HEAD requests are used by NetworkHealthWatcher to probe connectivity
export async function HEAD(_req: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}

// GET requests return detailed health information
export async function GET(_req: NextRequest) {
  const start = performance.now();

  // Check database health (non-blocking if DB isn't connected yet)
  let dbHealth: ServiceHealth;
  try {
    dbHealth = await Promise.race([
      checkDatabaseHealth(),
      new Promise<ServiceHealth>((resolve) =>
        setTimeout(() => resolve({ status: "degraded", message: "Health check timeout" }), 3000)
      ),
    ]);
  } catch {
    dbHealth = { status: "unhealthy", message: "Health check failed" };
  }

  const serverLatency = Math.round(performance.now() - start);
  const serverHealth: ServiceHealth = {
    status: serverLatency > 500 ? "degraded" : "healthy",
    latencyMs: serverLatency,
  };

  // Overall status is the worst of all services
  const allStatuses = [dbHealth.status, serverHealth.status];
  let overallStatus: "healthy" | "degraded" | "unhealthy" = "healthy";
  if (allStatuses.includes("unhealthy")) {
    overallStatus = "unhealthy";
  } else if (allStatuses.includes("degraded")) {
    overallStatus = "degraded";
  }

  const response: HealthCheckResponse = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    services: {
      database: dbHealth,
      server: serverHealth,
    },
    version: process.env.npm_package_version || "1.0.0",
  };

  const httpStatus = overallStatus === "unhealthy" ? 503 : 200;

  return NextResponse.json(response, {
    status: httpStatus,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
