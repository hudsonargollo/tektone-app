import { View, Text, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Vibrate } from "lucide-react-native";
import { useRealtimeContext } from "@/lib/realtime";
import { colors, fonts, radii } from "@/lib/theme";

export default function NudgeToastHost() {
  const { toasts, dismissToast } = useRealtimeContext();
  const router = useRouter();

  if (!toasts.length) return null;

  return (
    <View style={styles.host} pointerEvents="box-none">
      {toasts.map((t) => (
        <Pressable
          key={t.id}
          onPress={() => {
            dismissToast(t.id);
            router.push(`/card/${t.cardId}`);
          }}
          style={styles.toast}
        >
          <Vibrate size={16} color={colors.action} />
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{t.fromName} está te chamando</Text>
            <Text style={styles.sub} numberOfLines={1}>{t.cardTitle}</Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  host: { position: "absolute", left: 12, right: 12, bottom: 90, gap: 8 },
  toast: {
    flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.paper, borderRadius: radii.lg,
    borderWidth: 1, borderColor: "rgba(20,22,24,0.12)", padding: 12,
    shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  title: { fontFamily: fonts.sansSemiBold, fontSize: 13, color: colors.ink },
  sub: { fontFamily: fonts.mono, fontSize: 11, color: colors.stone500, marginTop: 2 },
});
