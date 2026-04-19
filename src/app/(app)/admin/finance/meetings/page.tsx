import { MeetingsInbox } from "@/components/meetings/meetings-inbox";

export default function BursarMeetingsPage() {
  return (
    <MeetingsInbox
      title="Finance Meetings"
      description="Keep fee consultations and payment-related calls inside the bursar workflow, with the same invite-only controls used across the school."
      roomBasePath="/admin/finance/meetings"
    />
  );
}
