import { useCallback, useEffect, useState } from "react";
import { View, Text, FlatList, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { MessageSquare, Package, PartyPopper, Undo2, Vibrate, UserPlus } from "lucide-react-native";
import { api } from "@/lib/api";
import { useRealtimeContext } from "@/lib/realtime";
import { colors, fonts } from "@/lib/theme";

type Notif = {
  id: string;
  type: "mention" | "request" | "assigned" | "nudge" | "reviewed" | "reopened";
  fromName: string;
  cardId: string;
  cardTitle: string;
  text: string;
  createdAt: string;
  readAt: string | null;
};

const TYPE_META: Record<Notif["type"], { Icon: any; color: string }> = {
  mention: { Icon: MessageSquare, color: colors.stone500 },
  request: { Icon: Package, color: colors.warning },
  assigned: { Icon: UserPlus, color: colors.action },
  nudge: { Icon: Vibrate, color: colors.action },
  reviewed: { Icon: PartyPopper, color: colors.success },
  reopened: { Icon: Undo2, color: colors.warning },
};

function relTime(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "agora";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

export default function NotificationsScreen() {
  const router = useRouter();
  const { notifSignal } = useRealtimeContext();
  const [items, setItems] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { items } = await api.getNotifications();
      setItems(items || []);
    } catch {
      /* leave whatever was already showing */
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  // Realtime push (mention/assignment/nudge/reopen) also triggers an
  // immediate refetch, instead of waiting for the tab to regain focus.
  useEffect(() => { load(); }, [notifSignal, load]);

  async function openItem(n: Notif) {
    if (!n.readAt) {
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)));
      api.ackNotifications([n.id]).catch(() => {});
    }
    router.push(`/card/${n.cardId}`);
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <Text style={styles.title}>Avisos</Text>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.action} />
      ) : items.length === 0 ? (
        <Text style={styles.empty}>Nenhuma novidade.</Text>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(n) => n.id}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item: n }) => {
            const meta = TYPE_META[n.type] || TYPE_META.mention;
            const Icon = meta.Icon;
            const unread = !n.readAt;
            return (
              <Pressable onPress={() => openItem(n)} style={[styles.row, !unread && styles.rowRead]}>
                {unread && <View style={styles.dot} />}
                <Icon size={14} color={meta.color} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle} numberOfLines={1}>{n.cardTitle}</Text>
                  <Text style={styles.preview} numberOfLines={1}>
                    {n.type === "nudge" ? `${n.fromName} chamou você: ${n.text}` : `${n.fromName}: ${n.text}`}
                  </Text>
                </View>
                <Text style={styles.time}>{relTime(n.createdAt)}</Text>
              </Pressable>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.clay },
  title: { fontFamily: fonts.sansSemiBold, fontSize: 20, color: colors.ink, paddingHorizontal: 16, paddingTop: 8 },
  empty: { fontFamily: fonts.mono, fontSize: 12, color: colors.stone500, textAlign: "center", marginTop: 40 },
  row: {
    flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.paper, borderRadius: 12,
    borderWidth: 1, borderColor: "rgba(20,22,24,0.1)", padding: 12, marginBottom: 8,
  },
  rowRead: { opacity: 0.55 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.action },
  cardTitle: { fontFamily: fonts.sansSemiBold, fontSize: 13, color: colors.ink },
  preview: { fontFamily: fonts.sans, fontSize: 12, color: colors.stone500, marginTop: 2 },
  time: { fontFamily: fonts.mono, fontSize: 10, color: colors.stone500 },
});
