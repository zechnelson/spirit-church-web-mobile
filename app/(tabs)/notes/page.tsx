import { SermonHeader } from "@/components/notes/SermonHeader";
import { NotesClient } from "@/components/notes/NotesClient";
import { NotesTabs } from "@/components/notes/NotesTabs";
import { getLatestMessage } from "@/lib/webflow";

export default async function NotesPage() {
  const message = await getLatestMessage().catch(() => null);

  if (!message) {
    return (
      <div className="flex flex-col items-center justify-center px-8 py-24 text-center">
        <p className="text-[15px] font-semibold text-ink-900">No message available</p>
        <p className="mt-2 text-[13px] text-ink-600">Check back after Sunday&apos;s service.</p>
      </div>
    );
  }

  return (
    <div className="pb-8">
      <NotesTabs />
      <SermonHeader
        title={message.title}
        speaker={message.speaker}
        date={message.date}
      />
      <NotesClient
        messageId={message.id}
        sermonTitle={message.title}
        speaker={message.speaker}
        date={message.date}
        outlineLines={message.outlineLines}
      />
    </div>
  );
}
