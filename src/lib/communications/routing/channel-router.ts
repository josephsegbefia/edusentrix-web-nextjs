import { Types } from "mongoose";
import { CommunicationPreference } from "@/models/CommunicationPreference";
import { CommunicationSuppression } from "@/models/CommunicationSuppression";
import type {
  CommunicationChannel,
  CommunicationType,
  ResolvedCommunicationRecipient,
} from "@/lib/communications/types";

export type RoutedCommunicationDelivery = {
  channel: CommunicationChannel;
  recipient: ResolvedCommunicationRecipient;
  destination?: string | null;
  status: "pending" | "skipped";
  skippedReason?: string | null;
};

type RouteInput = {
  schoolId: Types.ObjectId;
  type: CommunicationType;
  channels: CommunicationChannel[];
  recipients: ResolvedCommunicationRecipient[];
};

function normalizeDestination(channel: CommunicationChannel, recipient: ResolvedCommunicationRecipient) {
  if (channel === "in_app") return recipient.userId ? String(recipient.userId) : null;
  if (channel === "email") return recipient.email?.toLowerCase() ?? null;
  if (channel === "whatsapp") return recipient.whatsappPhone ?? null;
  return recipient.phone ?? null;
}

export async function routeCommunicationChannels(input: RouteInput) {
  const userIds = input.recipients
    .map((recipient) => recipient.userId)
    .filter((id): id is Types.ObjectId => Boolean(id));
  const preferences = await CommunicationPreference.find({
    schoolId: input.schoolId,
    userId: { $in: userIds },
  }).lean<Array<{
    userId: Types.ObjectId;
    allowedChannels: CommunicationChannel[];
    mutedTypes: CommunicationType[];
    whatsappConsent: boolean;
    smsConsent: boolean;
  }>>();
  const preferenceMap = new Map(preferences.map((preference) => [String(preference.userId), preference]));

  const destinations = input.recipients.flatMap((recipient) =>
    input.channels
      .map((channel) => ({ channel, destination: normalizeDestination(channel, recipient) }))
      .filter((item): item is { channel: CommunicationChannel; destination: string } => Boolean(item.destination)),
  );
  const suppressions = destinations.length
    ? await CommunicationSuppression.find({
        $or: [{ schoolId: input.schoolId }, { schoolId: null }],
        $and: [
          {
            $or: destinations.map((item) => ({
              channel: item.channel,
              destination: item.destination.toLowerCase(),
            })),
          },
        ],
      }).lean<Array<{ channel: CommunicationChannel; destination: string; reason: string }>>()
    : [];
  const suppressionMap = new Map(
    suppressions.map((suppression) => [
      `${suppression.channel}:${suppression.destination.toLowerCase()}`,
      suppression.reason,
    ]),
  );

  const routed: RoutedCommunicationDelivery[] = [];
  for (const recipient of input.recipients) {
    const preference = recipient.userId ? preferenceMap.get(String(recipient.userId)) : null;

    for (const channel of input.channels) {
      const destination = normalizeDestination(channel, recipient);
      let skippedReason: string | null = null;

      if (!destination) {
        skippedReason = channel === "in_app" ? "Recipient has no user account" : `Recipient has no ${channel} destination`;
      } else if (preference?.mutedTypes.includes(input.type)) {
        skippedReason = "Recipient muted this communication type";
      } else if (preference && !preference.allowedChannels.includes(channel)) {
        skippedReason = "Recipient disabled this channel";
      } else if (channel === "whatsapp" && !preference?.whatsappConsent) {
        skippedReason = "WhatsApp consent is not recorded";
      } else if (channel === "sms" && !preference?.smsConsent) {
        skippedReason = "SMS consent is not recorded";
      } else {
        const suppressionKey = `${channel}:${destination.toLowerCase()}`;
        if (suppressionMap.has(suppressionKey)) {
          skippedReason = suppressionMap.get(suppressionKey) ?? "Destination is suppressed";
        }
      }

      routed.push({
        channel,
        recipient,
        destination,
        status: skippedReason ? "skipped" : "pending",
        skippedReason,
      });
    }
  }

  return routed;
}
