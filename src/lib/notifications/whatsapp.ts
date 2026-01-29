export async function sendWhatsAppMessage(
  phone: string,
  templateId: string,
  params: Record<string, string>
): Promise<{ success: boolean }> {
  // Placeholder for WhatsApp integration. Replace with provider call when ready.
  if (!phone) {
    return { success: false };
  }

  console.info("WhatsApp stub", {
    phone,
    templateId,
    params,
  });

  return { success: true };
}
