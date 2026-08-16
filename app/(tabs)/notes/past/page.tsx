import { NotesTabs } from "@/components/notes/NotesTabs";
import { PastMessagesList } from "@/components/notes/PastMessagesList";
import { getLatestMessage } from "@/lib/webflow";

export default async function PastMessagesPage() {
  const message = await getLatestMessage().catch(() => null);

  return (
    <div className="pb-8">
      <NotesTabs />
      <PastMessagesList currentMessageId={message?.id} />
    </div>
  );
}
