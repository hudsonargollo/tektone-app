import { useState } from "react";
import MeetingIntelligence from "@/components/MeetingIntelligence";
import MeetingFetch from "@/components/MeetingFetch";

// Full-screen "Reuniões" view — combines the single-meeting analyze flow
// (MeetingIntelligence: paste or pick one transcript, review the AI's
// extracted decisions/risks/action items, save to the board) and the
// admin-only bulk-import flow (MeetingFetch: select many Drive meetings,
// process them all at once) as tabs, since the owner considers them part
// of the same feature. Non-admins never see the bulk tab — same gating
// MeetingFetch's old standalone "buscar" button had.
export default function MeetingsPage({ clients, members, avatarByName, isAdmin, onSaved, onClose }) {
  const [tab, setTab] = useState("analyze");

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      {isAdmin && (
        <div className="flex gap-1 border-b border-ink/15 px-6 pt-3">
          <button
            onClick={() => setTab("analyze")}
            className={`rounded-t-lg px-3 py-2 font-mono text-[11px] transition-colors ${
              tab === "analyze" ? "border-b-2 border-action text-action" : "text-stone-500"
            }`}
          >
            analisar reunião
          </button>
          <button
            onClick={() => setTab("bulk")}
            className={`rounded-t-lg px-3 py-2 font-mono text-[11px] transition-colors ${
              tab === "bulk" ? "border-b-2 border-action text-action" : "text-stone-500"
            }`}
          >
            importação em massa
          </button>
        </div>
      )}

      <div className="min-h-0 flex-1">
        {tab === "analyze" ? (
          <MeetingIntelligence
            clients={clients}
            members={members}
            avatarByName={avatarByName}
            isAdmin={isAdmin}
            onClose={onClose}
            onSaved={onSaved}
          />
        ) : (
          <MeetingFetch onDone={onSaved} />
        )}
      </div>
    </div>
  );
}
