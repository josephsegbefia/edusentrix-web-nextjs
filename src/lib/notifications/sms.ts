export type SmsProviderMode = "stub" | "stub_blocked_in_production" | "unsupported_provider";

export type SmsProviderState = {
  mode: SmsProviderMode;
  canSend: boolean;
  message: string;
  provider: string;
};

export type SendSmsMessageResult = {
  success: boolean;
  error?: string;
  mode: SmsProviderMode;
  providerMessageId?: string;
};

function resolveProviderState(): SmsProviderState {
  const configuredProvider = (process.env.SMS_PROVIDER || "stub").trim().toLowerCase();
  const allowStubInProduction = process.env.SMS_ALLOW_STUB_IN_PRODUCTION === "true";
  const isProduction = process.env.NODE_ENV === "production";

  if (configuredProvider === "stub") {
    if (isProduction && !allowStubInProduction) {
      return {
        mode: "stub_blocked_in_production",
        canSend: false,
        message: "SMS provider is not configured for production. Set SMS_PROVIDER and a real provider integration.",
        provider: configuredProvider,
      };
    }

    return {
      mode: "stub",
      canSend: true,
      message: "Using local SMS stub transport.",
      provider: configuredProvider,
    };
  }

  return {
    mode: "unsupported_provider",
    canSend: false,
    message: `SMS provider "${configuredProvider}" is configured but not implemented in this build.`,
    provider: configuredProvider,
  };
}

export function getSmsProviderState(): SmsProviderState {
  return resolveProviderState();
}

export async function sendSmsMessage(phone: string, body: string): Promise<SendSmsMessageResult> {
  const { enforceDemoPolicy } = await import("@/lib/demo/action-policy");
  const sim = enforceDemoPolicy<SendSmsMessageResult>("sms", "sendMessage");
  if (sim) return sim;

  if (!phone) {
    return {
      success: false,
      error: "Missing recipient phone number.",
      mode: resolveProviderState().mode,
    };
  }

  const providerState = resolveProviderState();
  if (!providerState.canSend) {
    console.error("SMS send blocked by provider configuration", {
      mode: providerState.mode,
      provider: providerState.provider,
    });
    return {
      success: false,
      error: providerState.message,
      mode: providerState.mode,
    };
  }

  console.info("SMS stub", { phone, body });

  return {
    success: true,
    mode: providerState.mode,
    providerMessageId: `sms_stub_${Date.now()}`,
  };
}
