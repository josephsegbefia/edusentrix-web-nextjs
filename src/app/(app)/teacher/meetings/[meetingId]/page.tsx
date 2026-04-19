import { MeetingRoomClient } from "@/components/meetings/meeting-room-client";

export default async function TeacherMeetingRoomPage({
  params,
}: {
  params: Promise<{ meetingId: string }>;
}) {
  const { meetingId } = await params;

  return (
    <MeetingRoomClient
      meetingId={meetingId}
      backHref="/teacher/meetings"
      backLabel="Back to teacher meetings"
    />
  );
}
