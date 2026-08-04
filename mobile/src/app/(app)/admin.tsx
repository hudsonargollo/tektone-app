import { useCallback, useState } from "react";
import { View, Text, Pressable, FlatList, ActivityIndicator, Alert, StyleSheet } from "react-native";
import { useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { ShieldCheck, RotateCcw, Check, Clock } from "lucide-react-native";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { colors, fonts, radii } from "@/lib/theme";

type AdminUser = { email: string; registered: boolean; name: string | null; admin: boolean };

export default function AdminScreen() {
  const { user } = useAuth();
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const { users } = await api.adminUsers();
      setUsers(users);
    } catch (e) {
      setError(e instanceof ApiError ? e.body?.error || "Falha ao carregar." : "Falha ao carregar.");
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  function confirmReset(u: AdminUser) {
    const self = u.email === user?.email;
    const msg = self
      ? "Resetar SUA conta? Você será desconectado e precisará criar uma nova senha."
      : `Resetar o acesso de ${u.email}? A pessoa precisará criar uma nova senha no próximo acesso.`;
    Alert.alert("Confirmar reset", msg, [
      { text: "Cancelar", style: "cancel" },
      { text: "Resetar", style: "destructive", onPress: () => reset(u.email, self) },
    ]);
  }

  async function reset(email: string, self: boolean) {
    setBusy(email);
    try {
      await api.adminReset(email);
      await load();
      // self-reset invalidates the current session — surface it, actual
      // sign-out happens next time an authenticated call 401s.
      if (self) Alert.alert("Conta resetada", "Faça login novamente para criar uma nova senha.");
    } catch (e) {
      setError(e instanceof ApiError ? e.body?.error || "Falha ao resetar." : "Falha ao resetar.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.header}>
        <ShieldCheck size={16} color={colors.action} />
        <Text style={styles.title}>Admin · acessos</Text>
      </View>
      <Text style={styles.hint}>
        Resetar remove a senha da pessoa. No próximo acesso ela cria uma nova senha em "primeiro acesso".
      </Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {!users ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.action} />
      ) : (
        <FlatList
          data={users}
          keyExtractor={(u) => u.email}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item: u }) => (
            <View style={styles.row}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={styles.email} numberOfLines={1}>{u.email}</Text>
                  {u.admin && (
                    <View style={styles.adminBadge}>
                      <Text style={styles.adminBadgeText}>admin</Text>
                    </View>
                  )}
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 }}>
                  {u.registered ? <Check size={11} color={colors.success} /> : <Clock size={11} color={colors.warning} />}
                  <Text style={styles.status}>{u.registered ? "registrado" : "pendente"}</Text>
                </View>
              </View>
              <Pressable
                onPress={() => confirmReset(u)}
                disabled={!u.registered || busy === u.email}
                style={[styles.resetBtn, (!u.registered || busy === u.email) && { opacity: 0.3 }]}
              >
                {busy === u.email ? <ActivityIndicator size="small" color={colors.stone500} /> : <RotateCcw size={12} color={colors.stone500} />}
                <Text style={styles.resetText}>resetar</Text>
              </Pressable>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.clay },
  header: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingTop: 8 },
  title: { fontFamily: fonts.sansSemiBold, fontSize: 16, color: colors.ink },
  hint: { fontFamily: fonts.sans, fontSize: 12, color: colors.stone500, lineHeight: 18, paddingHorizontal: 16, marginTop: 8 },
  error: { fontFamily: fonts.mono, fontSize: 11, color: colors.danger, paddingHorizontal: 16, marginTop: 8 },
  row: {
    flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.paper, borderRadius: radii.lg,
    borderWidth: 1, borderColor: "rgba(20,22,24,0.1)", padding: 12, marginBottom: 8,
  },
  email: { fontFamily: fonts.sansSemiBold, fontSize: 13, color: colors.ink, flexShrink: 1 },
  adminBadge: { backgroundColor: `${colors.action}22`, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  adminBadgeText: { fontFamily: fonts.monoMedium, fontSize: 9, color: colors.action, textTransform: "uppercase" },
  status: { fontFamily: fonts.mono, fontSize: 11, color: colors.stone500 },
  resetBtn: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderColor: "rgba(20,22,24,0.15)", borderRadius: radii.md, paddingHorizontal: 10, paddingVertical: 8 },
  resetText: { fontFamily: fonts.mono, fontSize: 11, color: colors.stone500 },
});
