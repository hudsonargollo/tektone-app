// Port of web's CardModal.jsx `Comments` component: message list with
// @mention autocomplete + highlighting, a request/comment kind toggle, a
// per-comment nudge picker (candidates validated again server-side), and a
// tap-to-reveal read-receipt (eye) on your own comments — hover doesn't
// exist on touch, so web's hover-reveal becomes tap-to-reveal here.
import { useState } from "react";
import { View, Text, TextInput, Pressable, FlatList, Modal, StyleSheet } from "react-native";
import { Send, Package, X, Vibrate, Eye, Trash2 } from "lucide-react-native";
import { api, ApiError } from "@/lib/api";
import { colors, fonts, radii } from "@/lib/theme";
import { initials } from "@/lib/constants";

type Member = { id: string; name: string; email: string };
type SeenEntry = { email: string; seenAt: string };
export type Comment = {
  id: string;
  text: string;
  kind: "comment" | "request" | "reviewed";
  author: string;
  authorName: string;
  createdAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
  reopened?: boolean;
  seenBy?: SeenEntry[];
};

const norm = (s?: string | null) => String(s || "").trim().toLowerCase();

function relTime(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "agora";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

function highlightMentions(text: string, firstNames: Set<string>) {
  const parts = text.split(/(@\w+)/g);
  return (
    <Text style={styles.commentText}>
      {parts.map((part, i) =>
        part.startsWith("@") && firstNames.has(part.slice(1).toLowerCase()) ? (
          <Text key={i} style={styles.mention}>{part}</Text>
        ) : (
          <Text key={i}>{part}</Text>
        )
      )}
    </Text>
  );
}

export default function Comments({
  cardId,
  comments,
  members,
  assignees,
  currentUserEmail,
  isAdmin,
  onUpdate,
}: {
  cardId: string;
  comments: Comment[];
  members: Member[];
  assignees: string[];
  currentUserEmail: string;
  isAdmin: boolean;
  onUpdate: (comments: Comment[]) => void;
}) {
  const [text, setText] = useState("");
  const [kind, setKind] = useState<"comment" | "request">("comment");
  const [busy, setBusy] = useState(false);
  const [mentionList, setMentionList] = useState<Member[]>([]);
  const [seenModal, setSeenModal] = useState<SeenEntry[] | null>(null);
  const [nudgeFor, setNudgeFor] = useState<Comment | null>(null);
  const [nudgeStatus, setNudgeStatus] = useState<{ id: string; ok: boolean; msg?: string } | null>(null);

  const firstNames = new Set(members.map((m) => m.name.split(/\s+/)[0].toLowerCase()));

  function onText(val: string) {
    setText(val);
    const m = val.match(/@(\w*)$/);
    if (m) {
      const q = m[1].toLowerCase();
      setMentionList(
        members.filter((mm) => mm.name.toLowerCase().includes(q) || mm.name.split(/\s+/)[0].toLowerCase().startsWith(q)).slice(0, 5)
      );
    } else {
      setMentionList([]);
    }
  }
  function pickMention(mm: Member) {
    const first = mm.name.split(/\s+/)[0];
    setText((t) => t.replace(/@(\w*)$/, `@${first} `));
    setMentionList([]);
  }

  async function submit() {
    const t = text.trim();
    if (!t || busy) return;
    setBusy(true);
    try {
      const { card } = await api.addComment(cardId, t, kind);
      onUpdate(card.comments || []);
      setText("");
      setKind("comment");
      setMentionList([]);
    } finally {
      setBusy(false);
    }
  }
  async function resolve(id: string) {
    const { card } = await api.resolveComment(cardId, id);
    onUpdate(card.comments || []);
  }
  async function remove(id: string) {
    const { card } = await api.deleteComment(cardId, id);
    onUpdate(card.comments || []);
  }

  function nudgeCandidates(comment: Comment): Member[] {
    const byEmail = new Map<string, Member>();
    for (const name of assignees) {
      const m = members.find((mm) => norm(mm.name) === norm(name));
      if (m) byEmail.set(norm(m.email), m);
    }
    const author = members.find((mm) => norm(mm.email) === norm(comment.author));
    if (author) byEmail.set(norm(author.email), author);
    byEmail.delete(norm(currentUserEmail));
    return [...byEmail.values()];
  }

  async function sendNudge(comment: Comment, to: Member) {
    setNudgeFor(null);
    try {
      await api.nudgeComment(cardId, comment.id, to.email);
      setNudgeStatus({ id: comment.id, ok: true });
    } catch (e) {
      setNudgeStatus({ id: comment.id, ok: false, msg: e instanceof ApiError ? e.body?.error : "Falha ao chamar." });
    }
    setTimeout(() => setNudgeStatus(null), 2000);
  }

  return (
    <View>
      <Text style={styles.label}>Comentários & solicitações</Text>

      {comments.map((c) => {
        const isReq = c.kind === "request";
        const isReviewed = c.kind === "reviewed" && !c.reopened;
        const isReopened = c.kind === "reviewed" && c.reopened;
        const done = Boolean(c.resolvedAt);
        const mine = c.author === currentUserEmail;
        const candidates = nudgeCandidates(c);
        const status = nudgeStatus?.id === c.id ? nudgeStatus : null;

        return (
          <View
            key={c.id}
            style={[
              styles.comment,
              isReviewed || (isReq && done) ? styles.commentSuccess : isReopened || (isReq && !done) ? styles.commentWarning : styles.commentPlain,
            ]}
          >
            <View style={styles.commentHead}>
              <Text style={styles.authorName}>{c.authorName}</Text>
              {isReq && (
                <View style={[styles.badge, { backgroundColor: done ? `${colors.success}22` : `${colors.warning}22` }]}>
                  <Package size={9} color={done ? colors.success : colors.warning} />
                  <Text style={[styles.badgeText, { color: done ? colors.success : colors.warning }]}>{done ? "atendida" : "solicitação"}</Text>
                </View>
              )}
              <Text style={styles.time}>{relTime(c.createdAt)}</Text>

              {mine && c.seenBy && c.seenBy.length > 0 && (
                <Pressable onPress={() => setSeenModal(c.seenBy || [])} style={styles.iconBtn}>
                  <Eye size={13} color={colors.stone500} />
                </Pressable>
              )}

              {candidates.length > 0 && (
                <Pressable onPress={() => setNudgeFor(c)} style={styles.iconBtn}>
                  <Vibrate size={13} color={status ? (status.ok ? colors.success : colors.danger) : colors.stone500} />
                </Pressable>
              )}

              {(mine || isAdmin) && (
                <Pressable onPress={() => remove(c.id)} style={styles.iconBtn}>
                  <Trash2 size={12} color={colors.danger} />
                </Pressable>
              )}
            </View>

            {highlightMentions(c.text, firstNames)}

            {status?.ok === false && <Text style={styles.nudgeError}>{status.msg}</Text>}

            {isReq && (
              <Pressable onPress={() => resolve(c.id)} style={styles.resolveBtn}>
                <Text style={[styles.resolveText, done && { color: colors.stone500 }]}>{done ? "Reabrir" : "Marcar como atendida"}</Text>
              </Pressable>
            )}
          </View>
        );
      })}

      <View style={styles.composer}>
        {mentionList.length > 0 && (
          <View style={styles.mentionBox}>
            {mentionList.map((mm) => (
              <Pressable key={mm.id} onPress={() => pickMention(mm)} style={styles.mentionRow}>
                <Text style={styles.mentionRowText}>{mm.name}</Text>
              </Pressable>
            ))}
          </View>
        )}
        <TextInput
          value={text}
          onChangeText={onText}
          placeholder={kind === "request" ? "Descreva sua solicitação…  Use @ para marcar alguém" : "Escreva um comentário…  (@ para marcar)"}
          placeholderTextColor={colors.stone400}
          multiline
          style={styles.input}
        />
        <View style={styles.composerRow}>
          <Pressable onPress={() => setKind((k) => (k === "request" ? "comment" : "request"))} style={[styles.kindToggle, kind === "request" && styles.kindToggleActive]}>
            <Package size={12} color={kind === "request" ? colors.warning : colors.stone500} />
            <Text style={[styles.kindToggleText, kind === "request" && { color: colors.warning }]}>
              {kind === "request" ? "Solicitação" : "Fazer solicitação"}
            </Text>
          </Pressable>
          <Pressable onPress={submit} disabled={busy || !text.trim()} style={[styles.sendBtn, (busy || !text.trim()) && { opacity: 0.4 }]}>
            <Send size={12} color={colors.clay} />
            <Text style={styles.sendText}>Enviar</Text>
          </Pressable>
        </View>
      </View>

      {/* Read-receipt modal */}
      <Modal visible={Boolean(seenModal)} transparent animationType="fade" onRequestClose={() => setSeenModal(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setSeenModal(null)}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Visto por</Text>
            {(seenModal || []).map((s) => {
              const m = members.find((mm) => norm(mm.email) === norm(s.email));
              return (
                <View key={s.email} style={styles.seenRow}>
                  <View style={styles.avatarSmall}>
                    <Text style={styles.avatarSmallText}>{initials(m?.name || s.email)}</Text>
                  </View>
                  <Text style={styles.seenName}>{m?.name || s.email}</Text>
                </View>
              );
            })}
          </View>
        </Pressable>
      </Modal>

      {/* Nudge picker modal */}
      <Modal visible={Boolean(nudgeFor)} transparent animationType="fade" onRequestClose={() => setNudgeFor(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setNudgeFor(null)}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Chamar a atenção de</Text>
            {nudgeFor &&
              nudgeCandidates(nudgeFor).map((m) => (
                <Pressable key={m.email} onPress={() => sendNudge(nudgeFor, m)} style={styles.seenRow}>
                  <View style={styles.avatarSmall}>
                    <Text style={styles.avatarSmallText}>{initials(m.name)}</Text>
                  </View>
                  <Text style={styles.seenName}>{m.name}</Text>
                </Pressable>
              ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontFamily: fonts.mono, fontSize: 11, textTransform: "uppercase", letterSpacing: 1.5, color: colors.stone500, marginBottom: 8 },
  comment: { borderRadius: radii.md, borderWidth: 1, padding: 10, marginBottom: 8 },
  commentPlain: { borderColor: "rgba(20,22,24,0.1)", backgroundColor: "rgba(20,22,24,0.02)" },
  commentSuccess: { borderColor: `${colors.success}4d`, backgroundColor: `${colors.success}0d` },
  commentWarning: { borderColor: `${colors.warning}66`, backgroundColor: `${colors.warning}0f` },
  commentHead: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  authorName: { fontFamily: fonts.sansSemiBold, fontSize: 12, color: colors.ink },
  badge: { flexDirection: "row", alignItems: "center", gap: 3, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 },
  badgeText: { fontFamily: fonts.monoMedium, fontSize: 9, textTransform: "uppercase" },
  time: { marginLeft: "auto", fontFamily: fonts.mono, fontSize: 10, color: colors.stone400 },
  iconBtn: { padding: 3 },
  commentText: { fontFamily: fonts.sans, fontSize: 13, color: colors.ink, lineHeight: 19 },
  mention: { fontFamily: fonts.sansSemiBold, color: colors.action },
  nudgeError: { fontFamily: fonts.mono, fontSize: 10, color: colors.danger, marginTop: 4 },
  resolveBtn: { marginTop: 6, alignSelf: "flex-start" },
  resolveText: { fontFamily: fonts.sansSemiBold, fontSize: 11, color: colors.success },
  composer: { borderWidth: 1, borderColor: "rgba(20,22,24,0.15)", backgroundColor: "rgba(20,22,24,0.02)", borderRadius: radii.md, padding: 8 },
  mentionBox: { backgroundColor: colors.paper, borderRadius: radii.md, borderWidth: 1, borderColor: "rgba(20,22,24,0.1)", marginBottom: 6, overflow: "hidden" },
  mentionRow: { paddingHorizontal: 10, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(20,22,24,0.08)" },
  mentionRowText: { fontFamily: fonts.sans, fontSize: 13, color: colors.ink },
  input: { fontFamily: fonts.sans, fontSize: 14, color: colors.ink, minHeight: 44 },
  composerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 6 },
  kindToggle: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderColor: "rgba(20,22,24,0.15)", borderRadius: radii.md, paddingHorizontal: 8, paddingVertical: 6 },
  kindToggleActive: { borderColor: `${colors.warning}66`, backgroundColor: `${colors.warning}1a` },
  kindToggleText: { fontFamily: fonts.sansSemiBold, fontSize: 11, color: colors.stone500 },
  sendBtn: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: colors.action, borderRadius: radii.md, paddingHorizontal: 10, paddingVertical: 7 },
  sendText: { fontFamily: fonts.sansBold, fontSize: 11, color: colors.clay },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(20,22,24,0.5)", alignItems: "center", justifyContent: "center", padding: 24 },
  modalCard: { width: "100%", maxWidth: 320, backgroundColor: colors.paper, borderRadius: radii.lg, padding: 16 },
  modalTitle: { fontFamily: fonts.mono, fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: colors.stone500, marginBottom: 10 },
  seenRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8 },
  avatarSmall: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.action, alignItems: "center", justifyContent: "center" },
  avatarSmallText: { fontFamily: fonts.sansBold, fontSize: 9, color: colors.clay },
  seenName: { fontFamily: fonts.sans, fontSize: 13, color: colors.ink },
});
