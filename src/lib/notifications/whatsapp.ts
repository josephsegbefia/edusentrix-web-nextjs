export type WhatsAppProviderMode = "stub" | "stub_blocked_in_production" | "unsupported_provider";

export type WhatsAppProviderState = {
  mode: WhatsAppProviderMode;
  canSend: boolean;
  message: string;
  provider: string;
};

export type SendWhatsAppMessageResult = {
  success: boolean;
  error?: string;
  mode: WhatsAppProviderMode;
};

function resolveProviderState(): WhatsAppProviderState {
  const configuredProvider = (process.env.WHATSAPP_PROVIDER || "stub")
    .trim()
    .toLowerCase();
  const allowStubInProduction = process.env.WHATSAPP_ALLOW_STUB_IN_PRODUCTION === "true";
  const isProduction = process.env.NODE_ENV === "production";

  if (configuredProvider === "stub") {
    if (isProduction && !allowStubInProduction) {
      return {
        mode: "stub_blocked_in_production",
        canSend: false,
        message:
          "WhatsApp provider is not configured for production. Set WHATSAPP_PROVIDER and a real provider integration.",
        provider: configuredProvider,
      };
    }

    return {
      mode: "stub",
      canSend: true,
      message: "Using local WhatsApp stub transport.",
      provider: configuredProvider,
    };
  }

  return {
    mode: "unsupported_provider",
    canSend: false,
    message: `WhatsApp provider "${configuredProvider}" is configured but not implemented in this build.`,
    provider: configuredProvider,
  };
}

export function getWhatsAppProviderState(): WhatsAppProviderState {
  return resolveProviderState();
}

export async function sendWhatsAppMessage(
  phone: string,
  templateId: string,
  params: Record<string, string>
): Promise<SendWhatsAppMessageResult> {
  const { enforceDemoPolicy } = await import("@/lib/demo/action-policy");
  const sim = enforceDemoPolicy<SendWhatsAppMessageResult>("whatsapp", "sendMessage");
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
    console.error("WhatsApp send blocked by provider configuration", {
      mode: providerState.mode,
      provider: providerState.provider,
      templateId,
    });
    return {
      success: false,
      error: providerState.message,
      mode: providerState.mode,
    };
  }

  // Stub transport for development and explicit staging use.
  console.info("WhatsApp stub", {
    phone,
    templateId,
    params,
  });

  return {
    success: true,
    mode: providerState.mode,
  };
}
