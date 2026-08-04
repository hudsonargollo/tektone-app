import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Check } from "lucide-react-native";
import { useWizard } from "@/lib/wizard-context";
import ChecklistEditor from "@/components/CardDetail/ChecklistEditor";
import WizardSummaryChips from "@/components/WizardSummaryChips";
import { colors, fonts, radii } from "@/lib/theme";

export default function WizardReviewStep() {
  const router = useRouter();
  const { description, setDescription, checklist, setChecklist, submit, busy, error, mode, clientId, clients, assignees, priority, dueDate } =
    useWizard();

  async function create() {
    const card = await submit();
    if (card) router.replace(`/card/${card.id}`);
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
      <WizardSummaryChips clientId={clientId} clients={clients} assignees={assignees} priority={priority} dueDate={dueDate} />
      <Text style={styles.label}>Descrição</Text>
      <TextInput
        multiline
        value={description}
        onChangeText={setDescription}
        style={[styles.input, { minHeight: 180, textAlignVertical: "top" }]}
      />

      <View style={{ marginTop: 20 }}>
        <ChecklistEditor items={checklist} onChange={setChecklist} />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable onPress={create} disabled={busy || !description.trim()} style={[styles.button, (busy || !description.trim()) && styles.buttonDisabled]}>
        {busy ? (
          <ActivityIndicator color={colors.clay} />
        ) : (
          <>
            <Check size={14} color={colors.clay} />
            <Text style={styles.buttonText}>{mode === "backfill" ? "Salvar" : "Criar tarefa"}</Text>
          </>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.clay },
  label: { fontFamily: fonts.mono, fontSize: 11, textTransform: "uppercase", letterSpacing: 1.5, color: colors.stone500, marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: "rgba(20,22,24,0.15)", backgroundColor: "rgba(20,22,24,0.03)",
    borderRadius: radii.md, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.ink, fontFamily: fonts.sans,
  },
  error: { fontFamily: fonts.mono, fontSize: 11, color: colors.danger, marginTop: 12 },
  button: {
    flexDirection: "row", gap: 8, marginTop: 24, backgroundColor: colors.action, borderRadius: radii.md,
    paddingVertical: 14, alignItems: "center", justifyContent: "center",
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.clay },
});
