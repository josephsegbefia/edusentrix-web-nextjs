import { MeetingsInbox } from "@/components/meetings/meetings-inbox";

export default function ParentMeetingsPage() {
  return (
    <MeetingsInbox
      title="Parent Meetings"
      description="Track your school conversations, parent conferences, and fee consultations in one secure meeting queue."
      roomBasePath="/parent/meetings"
    />
  );
}
