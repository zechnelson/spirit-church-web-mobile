import { SermonHeader } from "@/components/notes/SermonHeader";
import { NotesClient } from "@/components/notes/NotesClient";

// TODO: Replace with Webflow CMS fetch → Google Docs export when API is connected.
const sermon = {
  title: "Walking in Freedom",
  speaker: "Pastor Mike Johnson",
  date: "Sunday, May 18, 2026",
  scripture: "Galatians 5:1",
  // Lines are rendered as-is — mirrors what the Google Docs plain-text export returns.
  outline: [
    "MAIN IDEA:",
    "Freedom is not the absence of boundaries — it's the presence of purpose.",
    "",
    "“It is for freedom that Christ has set us free. Stand firm, then, and do not let yourselves be burdened again by a yoke of slavery.” — Galatians 5:1",
    "",
    "THREE THINGS THAT KEEP US FROM WALKING IN FREEDOM:",
    "",
    "1. Living under the law instead of grace",
    "• The law shows us our need; grace meets it.",
    "• You cannot earn what has already been given.",
    "",
    "2. Carrying guilt we’ve already been forgiven for",
    "• Conviction leads to repentance. Condemnation leads nowhere.",
    "“There is now no condemnation for those in Christ Jesus.” — Romans 8:1",
    "",
    "3. Allowing others to define our identity",
    "• What God says about you is the final word.",
    "• Identity is received, not achieved.",
    "",
    "HOW TO WALK IN FREEDOM DAILY:",
    "",
    "• Renew your mind with truth (Romans 12:2)",
    "• Speak identity statements over yourself",
    "• Stay rooted in community",
  ],
};

export default function NotesPage() {
  return (
    <div className="pb-8">
      <SermonHeader
        title={sermon.title}
        speaker={sermon.speaker}
        date={sermon.date}
        scripture={sermon.scripture}
      />
      <NotesClient
        sermonTitle={sermon.title}
        speaker={sermon.speaker}
        outlineLines={sermon.outline}
      />
    </div>
  );
}
