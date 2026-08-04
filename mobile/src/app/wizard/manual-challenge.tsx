import { View, Text, TextInput, Pressable, ScrollView, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useWizard } from "@/lib/wizard-context";
import WizardProgress from "@/components/WizardProgress";
import WizardSummaryChips from "@/components/WizardSummaryChips";
import { colors, fonts, radii } from "@/lib/theme";

export default function WizardManualChallengeStep() {
  const router = useRouter();
  const { sections, setSections, clientId, clients, assignees, priority, dueDate } = useWizard();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
      <WizardProgress index={0} total={4} />
      <WizardSummaryChips clientId={clientId} clients={clients} assignees={assignees} priority={priority} dueDate={dueDate} />
      <Text style={styles.headline}>Qual é o desafio?</Text>
      <Text style={styles.hint}>Qual bug ou nova funcionalidade está sendo resolvido/construído.</Text>
      <TextInput
        autoFocus
        multiline
        value={sections.challenge}
        onChangeText={(v) => setSections({ ...sections, challenge: v })}
        placeholder="Descreva o desafio…"
        placeholderTextColor={colors.stone400}
        style={[styles.input, { minHeight: 160, textAlignVertical: "top" }]}
      />
      <Pressable onPress={() => router.push("/wizard/manual-method")} style={styles.button}>
        <Text style={styles.buttonText}>Continuar</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.clay },
  headline: { fontFamily: fonts.sansBold, fontSize: 18, color: colors.ink, marginBottom: 4 },
  hint: { fontFamily: fonts.mono, fontSize: 11, color: colors.stone500, marginBottom: 12, lineHeight: 16 },
  input: {
    borderWidth: 1, borderColor: "rgba(20,22,24,0.15)", backgroundColor: "rgba(20,22,24,0.03)",
    borderRadius: radii.md, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.ink, fontFamily: fonts.sans,
  },
  button: { marginTop: 24, backgroundColor: colors.action, borderRadius: radii.md, paddingVertical: 14, alignItems: "center" },
  buttonText: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.clay },
});
