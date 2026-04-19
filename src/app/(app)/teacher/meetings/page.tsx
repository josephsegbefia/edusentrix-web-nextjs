import { MeetingsInbox } from "@/components/meetings/meetings-inbox";

export default function TeacherMeetingsPage() {
  return (
    <MeetingsInbox
      title="Teacher Meetings"
      description="Join invite-only conferences with parents, admins, and bursars without leaving the teacher workspace."
      roomBasePath="/teacher/meetings"
    />
  );
}
