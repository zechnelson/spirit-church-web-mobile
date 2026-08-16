"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, ChevronRight } from "lucide-react";
import { listSavedMessages, deleteNotes, type SavedMessageSummary } from "@/lib/notesStorage";

interface PastMessagesListProps {
  currentMessageId?: string;
}

export function PastMessagesList({ currentMessageId }: PastMessagesListProps) {
  const router = useRouter();
  const [messages, setMessages] = useState<SavedMessageSummary[] | null>(null);

  useEffect(() => {
    setMessages(listSavedMessages(currentMessageId));
  }, [currentMessageId]);

  const handleDelete = (e: React.MouseEvent, messageId: string) => {
    e.stopPropagation();
    deleteNotes(messageId);
    setMessages((prev) => (prev ?? []).filter((m) => m.messageId !== messageId));
  };

  if (messages === null) return null;

  if (messages.length === 0) {
    return (
      <div className="px-8 py-24 text-center">
        <p className="text-[15px] font-semibold text-ink-900">No past notes yet</p>
        <p className="mt-2 text-[13px] text-ink-600">
          Notes you take will show up here after the message ends.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-4 space-y-2">
      {messages.map((m) => (
        <div
          key={m.messageId}
          role="button"
          tabIndex={0}
          onClick={() => router.push(`/notes/past/${m.messageId}`)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              router.push(`/notes/past/${m.messageId}`);
            }
          }}
          className="flex cursor-pointer items-center justify-between rounded-2xl bg-white px-4 py-4"
        >
          <div>
            <p className="text-[15px] font-semibold text-ink-900">{m.title}</p>
            <p className="mt-1 text-[13px] text-ink-600">
              {m.speaker}
              {m.speaker && m.date && " · "}
              {m.date}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={(e) => handleDelete(e, m.messageId)}
              aria-label={`Delete notes for ${m.title}`}
              className="rounded-full p-2 text-ink-400 hover:bg-ink-50 hover:text-red-500"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <ChevronRight className="h-4 w-4 text-ink-300" />
          </div>
        </div>
      ))}
    </div>
  );
}
