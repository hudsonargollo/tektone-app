import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { Redirect, useRouter } from "expo-router";
import { useWizard } from "@/lib/wizard-context";
import { colors, fonts, radii } from "@/lib/theme";

export default function WizardTitleStep() {
  const router = useRouter();
  const { mode, title, setTitle } = useWizard();

  // Backfilling an existing card already has a title — skip straight to the
  // details step, same as web's TaskWizard (isBackfill ? "details" : "title").
  if (mode === "backfill") return <Redirect href="/wizard/details" />;

  return (
    <View style={styles.screen}>
      <Text style={styles.headline}>Qual é a tarefa?</Text>
      <Text style={styles.hint}>Um título curto — os detalhes vêm a seguir.</Text>
      <TextInput
        autoFocus
        value={title}
        onChangeText={setTitle}
        placeholder="Título da tarefa…"
        placeholderTextColor={colors.stone400}
        style={styles.input}
        onSubmitEditing={() => title.trim() && router.push("/wizard/details")}
        returnKeyType="next"
      />
      <Pressable
        onPress={() => router.push("/wizard/details")}
        disabled={!title.trim()}
        style={[styles.button, !title.trim() && styles.buttonDisabled]}
      >
        <Text style={styles.buttonText}>Continuar</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.clay, padding: 20 },
  headline: { fontFamily: fonts.sansBold, fontSize: 18, color: colors.ink, marginBottom: 4 },
  hint: { fontFamily: fonts.mono, fontSize: 11, color: colors.stone500, marginBottom: 16, lineHeight: 16 },
  input: {
    borderWidth: 1, borderColor: "rgba(20,22,24,0.15)", backgroundColor: "rgba(20,22,24,0.03)",
    borderRadius: radii.md, paddingHorizontal: 12, paddingVertical: 12, fontSize: 16, color: colors.ink, fontFamily: fonts.sans,
  },
  button: { marginTop: 16, backgroundColor: colors.action, borderRadius: radii.md, paddingVertical: 14, alignItems: "center" },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.clay },
});
