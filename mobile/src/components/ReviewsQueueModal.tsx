import { useMemo, useState } from "react";
import { View, Text, Pressable, Modal, ScrollView, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Sparkles, Check, FolderPlus, Folder, X, Pencil, Trash2, ChevronLeft, ChevronRight } from "lucide-react-native";
import { hashColor, initials } from "@/lib/constants";
import { colors, fonts, radii } from "@/lib/theme";
import type { Card } from "@/components/CardTile";

// Port of web's ReviewPopup.jsx — the "Tarefas geradas de reuniões"
// validation popup, shown on the board when there are unacked meeting-notes
// batches. Simplified from web's coverflow drag carousel to single-slide +
// chevron nav (this codebase's own precedent for reordering/paging without
// react-native-reanimated — see (app)/_layout.tsx's ShakeWrapper comment
// and board.tsx's chevron-button reorder). Phase 3 of
// ~/.claude/plans/tektone-mobile-parity.md.

export type ReviewBatch = {
  id: string;
  project: string;
  projectCreated: boolean;
  meetingTitle?: string;
  date?: string;
  tasks: { id: string }[];
};

function dateParts(d?: string) {
  if (!d) return null;
  try {
    const dt = new Date(`${d}T12:00:00`);
    return {
      day: dt.toLocaleDateString("pt-BR", { day: "2-digit" }),
      month: dt.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
    };
  } catch {
    return null;
  }
}

export default function ReviewsQueueModal({
  visible,
  reviews,
  cards,
  onClose,
  onAckAll,
  onAckOne,
  onDismissTask,
}: {
  visible: boolean;
  reviews: ReviewBatch[];
  cards: Card[];
  onClose: () => void;
  onAckAll: (ids: string[]) => void;
  onAckOne: (id: string) => void;
  onDismissTask: (cardId: string) => void;
}) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);

  const cardById = useMemo(() => Object.fromEntries(cards.map((c) => [c.id, c])), [cards]);

  // Render from the LIVE board so dismissed cards drop out on their own —
  // same reasoning as web.
  const liveReviews = useMemo(
    () =>
      reviews
        .map((r) => ({ ...r, liveTasks: r.tasks.map((t) => cardById[t.id]).filter(Boolean) as Card[] }))
        .filter((r) => r.liveTasks.length > 0),
    [reviews, cardById]
  );

  const count = liveReviews.length;
  const clampedIndex = Math.min(index, Math.max(0, count - 1));
  const current = liveReviews[clampedIndex];
  const total = liveReviews.reduce((n, r) => n + r.liveTasks.length, 0);

  async function ackAll() {
    setBusy(true);
    try {
      await onAckAll(reviews.map((r) => r.id));
    } finally {
      setBusy(false);
    }
  }

  async function ackThis() {
    if (!current) return;
    if (count <= 1) return ackAll();
    setBusy(true);
    try {
      await onAckOne(current.id);
      setIndex((i) => Math.max(0, Math.min(i, count - 2)));
    } finally {
      setBusy(false);
    }
  }

  if (!visible || count === 0) return null;

  const accent = current ? hashColor(current.project) : colors.action;
  const dp = current ? dateParts(current.date) : null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.headerIcon}>
                <Sparkles size={16} color="#7A5A6E" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.headerTitle}>Tarefas geradas de reuniões</Text>
                <Text style={styles.headerSub}>
                  {count > 1
                    ? `${count} reuniões · ${total} tarefa${total === 1 ? "" : "s"}. Use as setas, toque para editar ou dispense.`
                    : `${total} tarefa${total === 1 ? "" : "s"} criada${total === 1 ? "" : "s"} a partir das anotações.`}
                </Text>
              </View>
            </View>
            <Pressable onPress={onClose} hitSlop={8}>
              <X size={18} color={colors.stone500} />
            </Pressable>
          </View>

          {count > 1 && (
            <View style={styles.navRow}>
              <Pressable onPress={() => setIndex((i) => Math.max(0, i - 1))} disabled={clampedIndex === 0} hitSlop={8}>
                <ChevronLeft size={20} color={clampedIndex === 0 ? "rgba(20,22,24,0.25)" : colors.stone500} />
              </Pressable>
              <View style={styles.dots}>
                {liveReviews.map((r, i) => (
                  <View
                    key={r.id}
                    style={i === clampedIndex ? [styles.dotActive, { backgroundColor: hashColor(r.project) }] : styles.dot}
                  />
                ))}
              </View>
              <Text style={styles.navCount}>{clampedIndex + 1}/{count}</Text>
              <Pressable onPress={() => setIndex((i) => Math.min(count - 1, i + 1))} disabled={clampedIndex === count - 1} hitSlop={8}>
                <ChevronRight size={20} color={clampedIndex === count - 1 ? "rgba(20,22,24,0.25)" : colors.stone500} />
              </Pressable>
            </View>
          )}

          {current && (
            <ScrollView style={styles.body} contentContainerStyle={{ padding: 16 }}>
              <View style={styles.slideHead}>
                {dp && (
                  <View style={[styles.dateBox, { borderColor: accent }]}>
                    <Text style={styles.dateDay}>{dp.day}</Text>
                    <Text style={styles.dateMonth}>{dp.month}</Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.projectName} numberOfLines={1}>{current.project}</Text>
                  <View style={styles.tagsRow}>
                    <View style={[styles.projectTag, { backgroundColor: `${accent}22` }]}>
                      {current.projectCreated ? <FolderPlus size={11} color={accent} /> : <Folder size={11} color={accent} />}
                      <Text style={[styles.projectTagText, { color: accent }]}>
                        {current.projectCreated ? "novo projeto" : "projeto"}
                      </Text>
                    </View>
                    {current.meetingTitle ? (
                      <Text style={styles.meetingTitle} numberOfLines={1}>{current.meetingTitle}</Text>
                    ) : null}
                  </View>
                </View>
              </View>

              <View style={{ gap: 6 }}>
                {current.liveTasks.map((card) => {
                  const assignees = card.assignees?.length ? card.assignees : card.assignee ? [card.assignee] : [];
                  return (
                    <View key={card.id} style={styles.taskRow}>
                      <Pressable
                        onPress={() => {
                          onClose();
                          router.push(`/card/${card.id}`);
                        }}
                        style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8 }}
                      >
                        <Pencil size={11} color={colors.stone400} />
                        <Text style={styles.taskTitle} numberOfLines={1}>{card.title}</Text>
                        {assignees.length > 0 ? (
                          <View style={styles.avatarStack}>
                            {assignees.slice(0, 3).map((n, i) => (
                              <View key={n} style={[styles.avatar, { backgroundColor: hashColor(n), marginLeft: i > 0 ? -8 : 0 }]}>
                                <Text style={styles.avatarText}>{initials(n)}</Text>
                              </View>
                            ))}
                          </View>
                        ) : (
                          <Text style={styles.noAssignee}>sem responsável</Text>
                        )}
                      </Pressable>
                      <Pressable onPress={() => onDismissTask(card.id)} hitSlop={8} style={{ padding: 4 }}>
                        <Trash2 size={14} color={colors.stone400} />
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          )}

          <View style={styles.footer}>
            <Pressable onPress={onClose}>
              <Text style={styles.laterText}>Depois</Text>
            </Pressable>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              {count > 1 && (
                <Pressable onPress={ackAll} disabled={busy}>
                  <Text style={styles.ackAllText}>Validar todas</Text>
                </Pressable>
              )}
              <Pressable onPress={ackThis} disabled={busy} style={[styles.primaryBtn, busy && { opacity: 0.6 }]}>
                {busy ? <ActivityIndicator color={colors.clay} size="small" /> : <Check size={14} color={colors.clay} />}
                <Text style={styles.primaryBtnText}>{count > 1 ? "Validar esta" : "Validar e dispensar"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(20,22,24,0.6)", alignItems: "center", justifyContent: "center", padding: 16 },
  sheet: { width: "100%", maxHeight: "88%", backgroundColor: colors.paper, borderRadius: radii.xl, overflow: "hidden" },
  header: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10, borderBottomWidth: 1, borderBottomColor: "rgba(20,22,24,0.15)", padding: 16 },
  headerLeft: { flexDirection: "row", alignItems: "flex-start", gap: 10, flex: 1 },
  headerIcon: { width: 32, height: 32, borderRadius: radii.md, backgroundColor: "rgba(122,90,110,0.15)", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.ink },
  headerSub: { fontFamily: fonts.sans, fontSize: 11, color: colors.stone500, marginTop: 2 },
  navRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, borderBottomWidth: 1, borderBottomColor: "rgba(20,22,24,0.1)", paddingHorizontal: 16, paddingVertical: 10 },
  dots: { flexDirection: "row", alignItems: "center", gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(20,22,24,0.2)" },
  dotActive: { width: 16, height: 6, borderRadius: 3 },
  navCount: { fontFamily: fonts.mono, fontSize: 10, color: colors.stone400 },
  body: { flexGrow: 0 },
  slideHead: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 14 },
  dateBox: { alignItems: "center", paddingBottom: 4, borderBottomWidth: 2 },
  dateDay: { fontFamily: fonts.serifItalic, fontSize: 26, color: colors.ink },
  dateMonth: { fontFamily: fonts.mono, fontSize: 9, textTransform: "uppercase", color: colors.stone500, marginTop: 2 },
  projectName: { fontFamily: fonts.sansBold, fontSize: 16, color: colors.ink },
  tagsRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6, flexWrap: "wrap" },
  projectTag: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: radii.sm, paddingHorizontal: 8, paddingVertical: 3 },
  projectTagText: { fontFamily: fonts.monoMedium, fontSize: 10 },
  meetingTitle: { fontFamily: fonts.mono, fontSize: 10, color: colors.stone400, flexShrink: 1 },
  taskRow: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.clay, borderRadius: radii.md, paddingVertical: 8, paddingLeft: 10, paddingRight: 6 },
  taskTitle: { flex: 1, fontFamily: fonts.sans, fontSize: 13, color: colors.ink },
  avatarStack: { flexDirection: "row" },
  avatar: { width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: colors.paper },
  avatarText: { fontFamily: fonts.sansBold, fontSize: 8, color: "#fff" },
  noAssignee: { fontFamily: fonts.mono, fontSize: 9, color: colors.stone400 },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, borderTopWidth: 1, borderTopColor: "rgba(20,22,24,0.15)", padding: 16 },
  laterText: { fontFamily: fonts.sansSemiBold, fontSize: 13, color: colors.stone500 },
  ackAllText: { fontFamily: fonts.sansSemiBold, fontSize: 13, color: colors.stone500 },
  primaryBtn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.action, borderRadius: radii.md, paddingHorizontal: 16, paddingVertical: 10 },
  primaryBtnText: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.clay },
});
