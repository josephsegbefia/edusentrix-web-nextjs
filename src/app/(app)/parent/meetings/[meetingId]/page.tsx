import { MeetingRoomClient } from "@/components/meetings/meeting-room-client";

export default async function ParentMeetingRoomPage({
  params,
}: {
  params: Promise<{ meetingId: string }>;
}) {
  const { meetingId } = await params;

  return (
    <MeetingRoomClient
      meetingId={meetingId}
      backHref="/parent/meetings"
      backLabel="Back to parent meetings"
    />
  );
}
