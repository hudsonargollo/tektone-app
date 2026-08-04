import { View, Text, Pressable, StyleSheet } from "react-native";
import { CheckSquare, Calendar, MessageSquare, Package, ChevronUp, ChevronDown } from "lucide-react-native";
import { PRIORITY, fmtDate, today, hashColor, initials } from "@/lib/constants";
import { colors, fonts, radii } from "@/lib/theme";

export type Card = {
  id: string;
  title: string;
  description?: string;
  columnId: string;
  priority: "low" | "medium" | "high";
  clientId?: string;
  assignee?: string;
  assignees?: string[];
  dueDate?: string;
  order?: number;
  createdAt?: string;
  labelColor?: string | null;
  checklist?: { id: string; text: string; done: boolean }[];
  comments?: { kind: string; resolvedAt: string | null }[];
};

type Client = { id: string; name: string; color: string };

export default function CardTile({
  card,
  client,
  onPress,
  onMoveUp,
  onMoveDown,
}: {
  card: Card;
  client?: Client;
  onPress: () => void;
  // Manual reorder within the column — undefined at either end of the list,
  // which disables and hides (not removes) that chevron to keep row height stable.
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}) {
  const p = PRIORITY[card.priority] || PRIORITY.medium;
  const checklist = card.checklist ?? [];
  const checkDone = checklist.filter((c) => c.done).length;
  const comments = card.comments ?? [];
  const openRequests = comments.filter((c) => c.kind === "request" && !c.resolvedAt).length;
  const assignees = card.assignees?.length ? card.assignees : card.assignee ? [card.assignee] : [];
  const overdue = Boolean(card.dueDate) && card.dueDate! < today() && card.columnId !== "done";
  const accent = client?.color || p.color;

  return (
    <Pressable onPress={onPress} style={styles.card}>
      <View style={[styles.accent, { backgroundColor: accent }]} />
      <View style={{ flex: 1 }}>
        {card.labelColor ? <View style={[styles.labelSwatch, { backgroundColor: card.labelColor }]} /> : null}
        <Text style={styles.title} numberOfLines={2}>
          {card.title}
        </Text>
        {card.description ? (
          <Text style={styles.desc} numberOfLines={2}>
            {card.description}
          </Text>
        ) : null}
        {client ? (
          <View style={[styles.pill, { backgroundColor: `${client.color}22` }]}>
            <Text style={[styles.pillText, { color: client.color }]}>{client.name}</Text>
          </View>
        ) : null}

        <View style={styles.metaRow}>
          <View style={[styles.priorityDot, { backgroundColor: p.color }]} />
          <Text style={[styles.metaText, { color: p.color }]}>{p.label}</Text>
          {checklist.length > 0 && (
            <View style={styles.metaItem}>
              <CheckSquare size={11} color={checkDone === checklist.length ? colors.success : colors.stone500} />
              <Text style={styles.metaText}>
                {checkDone}/{checklist.length}
              </Text>
            </View>
          )}
          {comments.length > 0 && (
            <View style={styles.metaItem}>
              <MessageSquare size={11} color={colors.stone500} />
              <Text style={styles.metaText}>{comments.length}</Text>
            </View>
          )}
          {openRequests > 0 && (
            <View style={styles.metaItem}>
              <Package size={11} color={colors.warning} />
              <Text style={[styles.metaText, { color: colors.warning }]}>{openRequests}</Text>
            </View>
          )}
        </View>

        <View style={styles.bottomRow}>
          {card.dueDate ? (
            <View style={styles.metaItem}>
              <Calendar size={11} color={overdue ? colors.danger : colors.stone500} />
              <Text style={[styles.metaText, overdue && { color: colors.danger }]}>{fmtDate(card.dueDate)}</Text>
            </View>
          ) : (
            <View />
          )}
          {assignees.length > 0 && (
            <View style={styles.avatarStack}>
              {assignees.slice(0, 3).map((name, i) => (
                <View key={name} style={[styles.avatar, { backgroundColor: hashColor(name), marginLeft: i > 0 ? -8 : 0 }]}>
                  <Text style={styles.avatarText}>{initials(name)}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>
      {(onMoveUp || onMoveDown) && (
        <View style={styles.reorderCol}>
          <Pressable onPress={onMoveUp} disabled={!onMoveUp} hitSlop={8} style={styles.reorderBtn}>
            <ChevronUp size={14} color={onMoveUp ? colors.stone500 : "transparent"} />
          </Pressable>
          <Pressable onPress={onMoveDown} disabled={!onMoveDown} hitSlop={8} style={styles.reorderBtn}>
            <ChevronDown size={14} color={onMoveDown ? colors.stone500 : "transparent"} />
          </Pressable>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    backgroundColor: colors.paper,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "rgba(20,22,24,0.1)",
    marginBottom: 10,
    overflow: "hidden",
  },
  accent: { width: 4 },
  labelSwatch: { height: 3, width: 32, borderRadius: 2, marginTop: 10, marginLeft: 12 },
  title: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.ink, marginTop: 10, marginHorizontal: 12 },
  desc: { fontFamily: fonts.sans, fontSize: 12, color: colors.stone500, marginTop: 4, marginHorizontal: 12 },
  pill: { alignSelf: "flex-start", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, marginTop: 8, marginHorizontal: 12 },
  pillText: { fontFamily: fonts.monoMedium, fontSize: 10, fontWeight: "600" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8, marginHorizontal: 12 },
  priorityDot: { width: 6, height: 6, borderRadius: 3 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 3 },
  metaText: { fontFamily: fonts.mono, fontSize: 10, color: colors.stone500 },
  bottomRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8, marginHorizontal: 12, marginBottom: 10 },
  avatarStack: { flexDirection: "row" },
  avatar: { width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: colors.paper },
  avatarText: { fontFamily: fonts.sansBold, fontSize: 8, color: colors.clay },
  reorderCol: { justifyContent: "center", alignItems: "center", borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: "rgba(20,22,24,0.1)", paddingHorizontal: 6 },
  reorderBtn: { paddingVertical: 4 },
});
