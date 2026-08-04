import { View, Text, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Pencil, Sparkles } from "lucide-react-native";
import { useWizard } from "@/lib/wizard-context";
import { colors, fonts, radii } from "@/lib/theme";

export default function WizardChoiceStep() {
  const router = useRouter();
  const { startInterview } = useWizard();

  async function goAI() {
    router.push("/wizard/chat");
    await startInterview();
  }

  return (
    <View style={styles.screen}>
      <Pressable onPress={() => router.push("/wizard/manual-challenge")} style={styles.card}>
        <Pencil size={20} color={colors.stone500} />
        <Text style={styles.cardTitle}>Preencher manualmente</Text>
        <Text style={styles.cardSub}>Você escreve, no seu ritmo</Text>
      </Pressable>
      <Pressable onPress={goAI} style={styles.card}>
        <Sparkles size={20} color={colors.action} />
        <Text style={styles.cardTitle}>
          Sugerir Melhor<Text style={styles.iaHighlight}>IA</Text>s
        </Text>
        <Text style={styles.cardSub}>Entrevista guiada por IA</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.clay, padding: 20, gap: 12 },
  card: {
    backgroundColor: colors.paper, borderRadius: radii.xl, borderWidth: 1, borderColor: "rgba(20,22,24,0.15)",
    padding: 24, alignItems: "center", gap: 6,
  },
  cardTitle: { fontFamily: fonts.sansSemiBold, fontSize: 15, color: colors.ink },
  iaHighlight: { fontFamily: fonts.sansBold, color: colors.action },
  cardSub: { fontFamily: fonts.mono, fontSize: 11, color: colors.stone500 },
});
