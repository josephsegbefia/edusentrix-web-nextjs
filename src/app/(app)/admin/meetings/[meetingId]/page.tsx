import { MeetingRoomClient } from "@/components/meetings/meeting-room-client";

export default async function AdminMeetingRoomPage({
  params,
}: {
  params: Promise<{ meetingId: string }>;
}) {
  const { meetingId } = await params;

  return (
    <MeetingRoomClient
      meetingId={meetingId}
      backHref="/admin/meetings"
      backLabel="Back to meetings"
    />
  );
}
