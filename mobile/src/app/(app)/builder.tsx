import { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LayoutTemplate } from "lucide-react-native";
import { colors, fonts, radii } from "@/lib/theme";
import DocumentBuilderView from "@/components/DocumentBuilderView";
import FunnelBuilderView from "@/components/FunnelBuilderView";

// Port of src/components/BlogPanel.jsx's tab shell, minus "Posts" (Phase
// 9's blog.tsx). Páginas/Formulários/Quizzes each reuse the same
// DocumentBuilderView parameterized by kind, exactly like web's
// DocumentBuilder.jsx does — Funis gets its own dedicated FunnelBuilderView
// (a funnel is a sequence of existing documents, not its own block list).
// Phase 11 of ~/.claude/plans/tektone-mobile-parity.md.

const CONTENT_TABS = [
  { key: "page", label: "Páginas" },
  { key: "form", label: "Formulários" },
  { key: "quiz", label: "Quizzes" },
  { key: "funnel", label: "Funis" },
] as const;

const COPY: Record<string, { placeholder: string; empty: string }> = {
  page: { placeholder: "Título da nova página…", empty: "Nenhuma página criada ainda." },
  form: { placeholder: "Título do novo formulário…", empty: "Nenhum formulário criado ainda." },
  quiz: { placeholder: "Título do novo quiz…", empty: "Nenhum quiz criado ainda." },
};

export default function BuilderScreen() {
  const [tab, setTab] = useState<(typeof CONTENT_TABS)[number]["key"]>("page");

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.header}>
        <LayoutTemplate size={16} color={colors.action} />
        <Text style={styles.title}>Builder</Text>
      </View>

      <View style={styles.tabRow}>
        {CONTENT_TABS.map((t) => (
          <Pressable key={t.key} onPress={() => setTab(t.key)} style={[styles.tabBtn, tab === t.key && styles.tabBtnActive]}>
            <Text style={[styles.tabBtnText, tab === t.key && styles.tabBtnTextActive]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={{ flex: 1, padding: 16 }}>
        {tab === "funnel" ? (
          <FunnelBuilderView />
        ) : (
          <DocumentBuilderView kind={tab} newPlaceholder={COPY[tab].placeholder} emptyText={COPY[tab].empty} />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.clay },
  header: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingTop: 8 },
  title: { fontFamily: fonts.sansSemiBold, fontSize: 16, color: colors.ink },
  tabRow: { flexDirection: "row", flexWrap: "wrap", gap: 4, paddingHorizontal: 16, paddingTop: 12 },
  tabBtn: { borderRadius: radii.md, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: "rgba(20,22,24,0.05)" },
  tabBtnActive: { backgroundColor: `${colors.action}18` },
  tabBtnText: { fontFamily: fonts.mono, fontSize: 10.5, color: colors.stone500 },
  tabBtnTextActive: { color: colors.action, fontFamily: fonts.monoMedium },
});
