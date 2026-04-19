import { MeetingRoomClient } from "@/components/meetings/meeting-room-client";

export default async function BursarMeetingRoomPage({
  params,
}: {
  params: Promise<{ meetingId: string }>;
}) {
  const { meetingId } = await params;

  return (
    <MeetingRoomClient
      meetingId={meetingId}
      backHref="/admin/finance/meetings"
      backLabel="Back to finance meetings"
    />
  );
}
