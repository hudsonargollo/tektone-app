import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, FlatList, Pressable, ActivityIndicator, StyleSheet, useWindowDimensions } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Plus, ChevronDown, UserCheck } from "lucide-react-native";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { COLUMNS } from "@/lib/constants";
import { colors, fonts, radii } from "@/lib/theme";
import { useRealtimeContext } from "@/lib/realtime";
import CardTile, { type Card } from "@/components/CardTile";
import ReviewsQueueModal, { type ReviewBatch } from "@/components/ReviewsQueueModal";
import PickerModal from "@/components/CardDetail/PickerModal";

type Client = { id: string; name: string; color: string };

// Explicit manual order first (drag-to-reorder on web / move buttons here),
// falling back to creation order for any card that predates the field.
function sortByOrder(list: Card[]) {
  return [...list].sort((a, b) => {
    const oa = a.order ?? 0;
    const ob = b.order ?? 0;
    if (oa !== ob) return oa - ob;
    return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
  });
}

export default function BoardScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { notifSignal } = useRealtimeContext();
  const { width } = useWindowDimensions();
  const listRef = useRef<FlatList>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [reviews, setReviews] = useState<ReviewBatch[]>([]);
  const [clientFilter, setClientFilter] = useState<string | null>(null);
  const [clientPickerOpen, setClientPickerOpen] = useState(false);
  const [assignedToMeOnly, setAssignedToMeOnly] = useState(false);

  const load = useCallback(async () => {
    try {
      const [{ cards }, { clients }] = await Promise.all([api.listCards(), api.listClients()]);
      setCards(cards);
      setClients(clients);
    } catch {
      /* board falls back to whatever it last had */
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );
  // Realtime push (review/assignment/mention) also triggers an immediate
  // refetch — cheap enough at this team's scale to not bother with a
  // separate "cards changed" vs "notifications changed" signal.
  useEffect(() => {
    load();
  }, [notifSignal, load]);

  // Pending meeting-notes review batches — loaded once per session (not on
  // every tab focus, unlike cards above), matching web's App.jsx which
  // fetches this once when `authed` becomes true, not per-view.
  useEffect(() => {
    api.listReviews().then(({ reviews }) => setReviews(reviews || [])).catch(() => {});
  }, []);

  async function ackReviews(ids: string[]) {
    setReviews([]);
    try {
      await api.ackReviews(ids);
    } catch {
      /* if ack fails it simply reappears next login, same as web */
    }
  }

  async function ackOneReview(id: string) {
    setReviews((prev) => prev.filter((r) => r.id !== id));
    try {
      await api.ackReviews([id]);
    } catch {
      /* see ackReviews */
    }
  }

  async function dismissTask(cardId: string) {
    setCards((prev) => prev.filter((c) => c.id !== cardId));
    api.deleteCard(cardId).catch(() => {});
  }

  const clientById = Object.fromEntries(clients.map((c) => [c.id, c]));

  const isAssignedToMe = (c: Card) =>
    (c.assignees?.length ? c.assignees : c.assignee ? [c.assignee] : []).includes(user?.name || "");

  const filteredCards = cards.filter((c) => {
    if (clientFilter && c.clientId !== clientFilter) return false;
    if (assignedToMeOnly && !isAssignedToMe(c)) return false;
    return true;
  });
  const assignedToMeCount = cards.filter(isAssignedToMe).length;
  const activeClient = clientFilter ? clientById[clientFilter] : null;
  // Reorder (move up/down) is ambiguous against a filtered subset — a card's
  // position within the filtered list doesn't match its true position in
  // the full column, so hide the move buttons while any filter is active
  // rather than risk a confusing reorder.
  const isFiltering = Boolean(clientFilter) || assignedToMeOnly;

  // Swap a card with its neighbor in the manual order, then persist the
  // whole column's new order in one call (same endpoint web's drag uses).
  async function move(colId: string, cardId: string, dir: -1 | 1) {
    const ordered = sortByOrder(cards.filter((c) => c.columnId === colId));
    const i = ordered.findIndex((c) => c.id === cardId);
    const j = i + dir;
    if (i === -1 || j < 0 || j >= ordered.length) return;
    [ordered[i], ordered[j]] = [ordered[j], ordered[i]];
    const orderedIds = ordered.map((c) => c.id);
    const orderIndex = new Map(orderedIds.map((id, idx) => [id, idx]));
    setCards((p) => p.map((c) => (c.columnId === colId && orderIndex.has(c.id) ? { ...c, order: orderIndex.get(c.id) } : c)));
    try {
      await api.reorderCards(colId, orderedIds);
    } catch {
      /* keep optimistic state; next load reconciles */
    }
  }

  function jump(i: number) {
    setActiveIndex(i);
    listRef.current?.scrollToIndex({ index: i, animated: true });
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>WORKHUB</Text>
        <Pressable onPress={() => router.push("/wizard")} style={styles.newBtn}>
          <Plus size={14} color={colors.clay} />
          <Text style={styles.newBtnText}>Nova tarefa</Text>
        </Pressable>
      </View>

      <View style={styles.filterRow}>
        <Pressable onPress={() => setClientPickerOpen(true)} style={styles.projectBtn}>
          <View style={[styles.projectDot, activeClient && { backgroundColor: activeClient.color }]} />
          <Text style={styles.projectBtnText} numberOfLines={1}>{activeClient ? activeClient.name : "Todos os projetos"}</Text>
          <ChevronDown size={13} color={colors.stone500} />
        </Pressable>
        <Pressable
          onPress={() => setAssignedToMeOnly((v) => !v)}
          style={[styles.assignedBtn, assignedToMeOnly && styles.assignedBtnActive]}
        >
          <UserCheck size={13} color={assignedToMeOnly ? colors.action : colors.stone500} />
          {assignedToMeCount > 0 && (
            <Text style={[styles.assignedBtnCount, assignedToMeOnly && { color: colors.action }]}>{assignedToMeCount}</Text>
          )}
        </Pressable>
      </View>
      <PickerModal
        visible={clientPickerOpen}
        title="Projeto"
        options={[{ value: "", label: "Todos os projetos" }, ...clients.map((c) => ({ value: c.id, label: c.name, color: c.color }))]}
        selected={clientFilter ? [clientFilter] : [""]}
        onToggle={(v) => { setClientFilter(v || null); setClientPickerOpen(false); }}
        onClose={() => setClientPickerOpen(false)}
      />

      <View style={styles.tabRow}>
        <FlatList
          data={COLUMNS}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ paddingHorizontal: 12, gap: 8 }}
          renderItem={({ item, index }) => {
            const count = filteredCards.filter((c) => c.columnId === item.id).length;
            const active = index === activeIndex;
            return (
              <Pressable onPress={() => jump(index)} style={[styles.tab, active && { backgroundColor: item.color }]}>
                {!active && <View style={[styles.tabDot, { backgroundColor: item.color }]} />}
                <Text style={[styles.tabText, active && { color: colors.clay }]}>{item.title}</Text>
                <Text style={[styles.tabCount, active && { color: colors.clay }]}>{count}</Text>
              </Pressable>
            );
          }}
        />
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.action} />
      ) : (
        <FlatList
          ref={listRef}
          data={COLUMNS}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(c) => c.id}
          onMomentumScrollEnd={(e) => {
            const i = Math.round(e.nativeEvent.contentOffset.x / width);
            setActiveIndex(i);
          }}
          getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
          renderItem={({ item: col }) => {
            const colCards = sortByOrder(filteredCards.filter((c) => c.columnId === col.id));
            return (
              <View style={{ width }}>
                <FlatList
                  data={colCards}
                  keyExtractor={(c) => c.id}
                  contentContainerStyle={{ padding: 16 }}
                  refreshing={loading}
                  onRefresh={load}
                  ListEmptyComponent={<Text style={styles.empty}>Nenhuma tarefa aqui.</Text>}
                  renderItem={({ item, index }) => (
                    <CardTile
                      card={item}
                      client={clientById[item.clientId || ""]}
                      onPress={() => router.push(`/card/${item.id}`)}
                      onMoveUp={!isFiltering && index > 0 ? () => move(col.id, item.id, -1) : undefined}
                      onMoveDown={!isFiltering && index < colCards.length - 1 ? () => move(col.id, item.id, 1) : undefined}
                    />
                  )}
                />
              </View>
            );
          }}
        />
      )}

      <ReviewsQueueModal
        visible={reviews.length > 0}
        reviews={reviews}
        cards={cards}
        onClose={() => setReviews([])}
        onAckAll={ackReviews}
        onAckOne={ackOneReview}
        onDismissTask={dismissTask}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.clay },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  headerTitle: { fontFamily: fonts.sansSemiBold, fontSize: 20, color: colors.ink },
  newBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.action, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8 },
  newBtnText: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.clay },
  filterRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingTop: 8 },
  projectBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: "rgba(20,22,24,0.12)",
    backgroundColor: colors.paper, borderRadius: radii.md, paddingHorizontal: 10, paddingVertical: 8,
  },
  projectDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: colors.stone400 },
  projectBtnText: { flex: 1, fontFamily: fonts.mono, fontSize: 11, color: colors.ink },
  assignedBtn: {
    flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderColor: "rgba(20,22,24,0.12)",
    backgroundColor: colors.paper, borderRadius: radii.md, paddingHorizontal: 10, paddingVertical: 8,
  },
  assignedBtnActive: { borderColor: `${colors.action}66`, backgroundColor: `${colors.action}18` },
  assignedBtnCount: { fontFamily: fonts.monoMedium, fontSize: 11, color: colors.stone500 },
  tabRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "rgba(20,22,24,0.08)" },
  tab: {
    flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: "rgba(20,22,24,0.12)", backgroundColor: colors.paper,
  },
  tabDot: { width: 6, height: 6, borderRadius: 3 },
  tabText: { fontFamily: fonts.monoMedium, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, color: colors.ink },
  tabCount: { fontFamily: fonts.mono, fontSize: 10, color: colors.stone500 },
  empty: { fontFamily: fonts.mono, fontSize: 12, color: colors.stone500, textAlign: "center", marginTop: 40 },
});
