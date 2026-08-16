"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { SermonHeader } from "@/components/notes/SermonHeader";
import { NotesClient } from "@/components/notes/NotesClient";
import { getNotes, type SavedNotesRecord } from "@/lib/notesStorage";

export default function PastMessagePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [record, setRecord] = useState<SavedNotesRecord | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const messageId = Array.isArray(params.id) ? params.id[0] : params.id;
    if (!messageId) return;
    const found = getNotes(messageId);
    if (!found) {
      setNotFound(true);
      router.replace("/notes/past");
      return;
    }
    setRecord(found);
  }, [params.id, router]);

  if (notFound || !record) return null;

  return (
    <div className="pb-8">
      <Link
        href="/notes/past"
        className="mx-4 mt-4 inline-block text-[13px] font-semibold text-brand-500"
      >
        ← Past Messages
      </Link>
      <SermonHeader
        title={record.title}
        speaker={record.speaker}
        date={record.date}
        eyebrow="Past Message"
      />
      <NotesClient
        messageId={record.messageId}
        sermonTitle={record.title}
        speaker={record.speaker}
        date={record.date}
        outlineLines={record.outlineLines}
      />
    </div>
  );
}
