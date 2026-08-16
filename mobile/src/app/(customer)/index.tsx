import { View, Text, Pressable, StyleSheet, SafeAreaView } from "react-native";
import { LogOut, Sparkles } from "lucide-react-native";
import LogoMark from "@/components/LogoMark";
import { useAuth } from "@/lib/auth";
import { colors, fonts, radii } from "@/lib/theme";

// Placeholder landing for the customer shell — (app)/_layout.tsx and
// (auth)/_layout.tsx already redirect CUSTOMER-role accounts here (Phase 0),
// but the real onboarding checklist / contracts / invoices / marketplace
// tabs are Phase 7's job. This just proves the isolation works: a customer
// account lands somewhere real, sees no board/admin/CRM, and can sign out.
export default function CustomerHome() {
  const { user, signOut } = useAuth();

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.content}>
        <LogoMark width={64} height={74} />
        <Text style={styles.title}>TASKTONE</Text>
        <View style={styles.badge}>
          <Sparkles size={12} color={colors.action} />
          <Text style={styles.badgeText}>portal do cliente</Text>
        </View>
        <Text style={styles.lead}>
          Olá, {user?.name || user?.email}. O acompanhamento do seu projeto — onboarding,
          contratos, faturas e marketplace — chega em breve por aqui.
        </Text>

        <Pressable onPress={signOut} style={styles.logoutBtn}>
          <LogOut size={14} color={colors.danger} />
          <Text style={styles.logoutText}>Sair</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.clay },
  content: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28, gap: 4 },
  title: { fontFamily: fonts.sansSemiBold, fontSize: 17, letterSpacing: 4, color: colors.ink, marginTop: 10 },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.lg,
    backgroundColor: "rgba(46,74,67,0.08)",
  },
  badgeText: { fontFamily: fonts.mono, fontSize: 10, textTransform: "uppercase", letterSpacing: 1.2, color: colors.action },
  lead: {
    marginTop: 18,
    textAlign: "center",
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 21,
    color: colors.stone500,
    maxWidth: 320,
  },
  logoutBtn: {
    flexDirection: "row",
    gap: 8,
    marginTop: 28,
    borderWidth: 1,
    borderColor: "rgba(155,61,46,0.3)",
    borderRadius: radii.md,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  logoutText: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.danger },
});
