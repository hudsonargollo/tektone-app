import { View, Text, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Award, Sparkles, ShieldCheck, Wallet, Briefcase, TrendingUp, Link2, Newspaper, Camera, ChevronRight, LogOut } from "lucide-react-native";
import { useAuth, hasCrmAccess } from "@/lib/auth";
import { colors, fonts, radii } from "@/lib/theme";

// Overflow menu for anything not frequent enough to earn a bottom-bar slot
// (see (app)/_layout.tsx's comment) — plays the same role web's AppSidebar
// scrollable rail does. Grows as later mobile-parity phases land (CRM,
// Finance, Commercial, Blog, Builder, Social all land here, role-gated the
// same way Admin already is).
export default function MoreScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();

  const rows = [
    { key: "journey", label: "Jornada", sub: "nível, sequência e cartas de sabedoria", Icon: Award, href: "/journey" as const },
    { key: "meetings", label: "Reuniões", sub: "analisar transcrições e gerar tarefas", Icon: Sparkles, href: "/meetings" as const },
    { key: "commercial", label: "Comercial", sub: "clientes, contratos, faturas e construtores", Icon: Briefcase, href: "/commercial" as const },
    { key: "social", label: "Posts", sub: "gerar posts de Instagram com IA", Icon: Camera, href: "/social" as const },
    ...(hasCrmAccess(user)
      ? [
          { key: "crm", label: "CRM", sub: "dashboard, pipeline de leads e vendas", Icon: TrendingUp, href: "/crm" as const },
          { key: "crm-links", label: "Links", sub: "links curtos de WhatsApp/URL com rastreio de cliques", Icon: Link2, href: "/crm-links" as const },
        ]
      : []),
    ...(user?.financeAccess
      ? [{ key: "finance", label: "Financeiro", sub: "balanço, orçamento e custos por projeto", Icon: Wallet, href: "/finance" as const }]
      : []),
    ...(user?.admin
      ? [
          { key: "blog", label: "Blog", sub: "curadoria: revisar, editar e publicar artigos", Icon: Newspaper, href: "/blog" as const },
          { key: "admin", label: "Admin", sub: "acessos e templates de workflow", Icon: ShieldCheck, href: "/admin" as const },
        ]
      : []),
  ];

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <Text style={styles.title}>Mais</Text>
      <View style={{ padding: 16, gap: 8 }}>
        {rows.map((r) => (
          <Pressable key={r.key} onPress={() => router.push(r.href)} style={styles.row}>
            <View style={styles.rowIcon}>
              <r.Icon size={16} color={colors.action} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>{r.label}</Text>
              <Text style={styles.rowSub}>{r.sub}</Text>
            </View>
            <ChevronRight size={16} color={colors.stone400} />
          </Pressable>
        ))}

        <Pressable onPress={signOut} style={[styles.row, { marginTop: 16 }]}>
          <View style={[styles.rowIcon, { backgroundColor: "rgba(155,61,46,0.1)" }]}>
            <LogOut size={16} color={colors.danger} />
          </View>
          <Text style={[styles.rowLabel, { color: colors.danger }]}>Sair</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.clay },
  title: { fontFamily: fonts.sansSemiBold, fontSize: 20, color: colors.ink, paddingHorizontal: 16, paddingTop: 8 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.paper,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "rgba(20,22,24,0.1)",
    padding: 14,
  },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: radii.md,
    backgroundColor: "rgba(46,74,67,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  rowLabel: { fontFamily: fonts.sansSemiBold, fontSize: 14, color: colors.ink },
  rowSub: { fontFamily: fonts.mono, fontSize: 10, color: colors.stone500, marginTop: 2 },
});
