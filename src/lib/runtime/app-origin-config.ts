export type AppOriginEnvironment = {
  APP_RUNTIME_MODE?: string;
  APP_URL?: string;
  NEXT_PUBLIC_APP_URL?: string;
};

type ParsedOrigin = {
  name: "APP_URL" | "NEXT_PUBLIC_APP_URL";
  origin: string;
  protocol: string;
  hostname: string;
};

const PRODUCTION_HOST = "tryedusentrix.app";

function parseConfiguredOrigin(
  name: ParsedOrigin["name"],
  value: string | undefined,
  errors: string[]
): ParsedOrigin | null {
  const configured = value?.trim();
  if (!configured) return null;

  try {
    const parsed = new URL(configured);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      errors.push(`${name} must use http:// or https://.`);
      return null;
    }
    if (
      parsed.pathname !== "/" ||
      parsed.search ||
      parsed.hash ||
      parsed.username ||
      parsed.password
    ) {
      errors.push(`${name} must contain an application origin only, without credentials, a path, query, or fragment.`);
    }
    return {
      name,
      origin: parsed.origin,
      protocol: parsed.protocol,
      hostname: parsed.hostname.toLowerCase(),
    };
  } catch {
    errors.push(`${name} must be a valid absolute URL.`);
    return null;
  }
}

function isLocalHostname(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function isEduSentrixProductionHostname(hostname: string) {
  return hostname === PRODUCTION_HOST || hostname.endsWith(`.${PRODUCTION_HOST}`);
}

export function validateAppOriginConfiguration(
  environment: AppOriginEnvironment
): string[] {
  const errors: string[] = [];
  const runtimeMode = environment.APP_RUNTIME_MODE?.trim().toLowerCase();
  const appUrl = parseConfiguredOrigin("APP_URL", environment.APP_URL, errors);
  const publicAppUrl = parseConfiguredOrigin(
    "NEXT_PUBLIC_APP_URL",
    environment.NEXT_PUBLIC_APP_URL,
    errors
  );

  if (
    appUrl &&
    publicAppUrl &&
    appUrl.origin !== publicAppUrl.origin &&
    (runtimeMode === "development" || runtimeMode === "production")
  ) {
    errors.push(
      `APP_URL and NEXT_PUBLIC_APP_URL must use the same origin when APP_RUNTIME_MODE=${runtimeMode}.`
    );
  }

  if (runtimeMode === "development") {
    for (const configured of [appUrl, publicAppUrl]) {
      if (configured && isEduSentrixProductionHostname(configured.hostname)) {
        errors.push(
          `${configured.name} cannot use the production EduSentrix domain when APP_RUNTIME_MODE=development. Set it to http://localhost:3000.`
        );
      }
    }
  }

  if (runtimeMode === "production") {
    for (const configured of [appUrl, publicAppUrl]) {
      if (!configured) continue;
      if (isLocalHostname(configured.hostname)) {
        errors.push(`${configured.name} cannot use localhost when APP_RUNTIME_MODE=production.`);
      }
      if (configured.protocol !== "https:") {
        errors.push(`${configured.name} must use https:// when APP_RUNTIME_MODE=production.`);
      }
    }
  }

  return errors;
}

export function assertAppOriginConfiguration(
  environment: AppOriginEnvironment = {
    APP_RUNTIME_MODE: process.env.APP_RUNTIME_MODE,
    APP_URL: process.env.APP_URL,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  }
) {
  const errors = validateAppOriginConfiguration(environment);
  if (errors.length) {
    throw new Error(`Invalid application URL configuration:\n- ${errors.join("\n- ")}`);
  }
}
