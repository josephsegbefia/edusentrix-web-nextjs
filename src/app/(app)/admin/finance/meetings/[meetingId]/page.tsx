import { MeetingRoomClient } from "@/components/meetings/meeting-room-client";
import { WorkspaceScope } from "@/components/theme/workspace-scope";

export default async function BursarMeetingRoomPage({
  params,
}: {
  params: Promise<{ meetingId: string }>;
}) {
  const { meetingId } = await params;

  return (
    <WorkspaceScope>
      <MeetingRoomClient
        meetingId={meetingId}
        backHref="/admin/finance/meetings"
        backLabel="Back to finance meetings"
      />
    </WorkspaceScope>
  );
}
