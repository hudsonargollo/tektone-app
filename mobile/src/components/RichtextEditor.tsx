import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import Markdown from "react-native-markdown-display";
import { colors, fonts, radii } from "@/lib/theme";

// Port of src/builder/RichtextEditor.jsx — editar/preview tabs for the
// `richtext` block's markdown content. Reuses the same
// react-native-markdown-display dependency and style tokens introduced in
// Phase 9's blog.tsx preview toggle.
export default function RichtextEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [tab, setTab] = useState<"editar" | "preview">("editar");
  return (
    <View>
      <View style={styles.tabRow}>
        {(["editar", "preview"] as const).map((k) => (
          <Pressable key={k} onPress={() => setTab(k)} style={[styles.tab, tab === k && styles.tabActive]}>
            <Text style={[styles.tabText, tab === k && styles.tabTextActive]}>{k}</Text>
          </Pressable>
        ))}
      </View>
      {tab === "editar" ? (
        <TextInput
          value={value}
          onChangeText={onChange}
          multiline
          numberOfLines={10}
          style={styles.input}
        />
      ) : (
        <View style={styles.previewBox}>
          <Markdown style={markdownStyles}>{value || ""}</Markdown>
        </View>
      )}
    </View>
  );
}

const markdownStyles = {
  body: { fontFamily: fonts.sans, fontSize: 13, color: colors.ink, lineHeight: 20 },
  heading1: { fontFamily: fonts.sansBold, fontSize: 20, color: colors.ink, marginTop: 10, marginBottom: 6 },
  heading2: { fontFamily: fonts.sansBold, fontSize: 17, color: colors.ink, marginTop: 10, marginBottom: 6 },
  heading3: { fontFamily: fonts.sansSemiBold, fontSize: 15, color: colors.ink, marginTop: 8, marginBottom: 4 },
  strong: { fontFamily: fonts.sansBold },
  em: { fontFamily: fonts.sans, fontStyle: "italic" as const },
  link: { color: colors.action },
};

const styles = StyleSheet.create({
  tabRow: { flexDirection: "row", gap: 4, marginBottom: 8 },
  tab: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radii.sm, backgroundColor: "rgba(20,22,24,0.05)" },
  tabActive: { backgroundColor: `${colors.action}18` },
  tabText: { fontFamily: fonts.mono, fontSize: 10.5, color: colors.stone500 },
  tabTextActive: { color: colors.action, fontFamily: fonts.monoMedium },
  input: {
    borderWidth: 1, borderColor: "rgba(20,22,24,0.15)", backgroundColor: colors.paper, borderRadius: radii.md,
    paddingHorizontal: 10, paddingVertical: 9, fontSize: 13, color: colors.ink, fontFamily: fonts.mono,
    minHeight: 180, textAlignVertical: "top",
  },
  previewBox: { borderWidth: 1, borderColor: "rgba(20,22,24,0.12)", borderRadius: radii.md, padding: 14, maxHeight: 420 },
});
