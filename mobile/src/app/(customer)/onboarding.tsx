import { useCallback, useState } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator, StyleSheet } from "react-native";
import { useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { CheckCircle2, Clock, Square, CheckSquare } from "lucide-react-native";
import { api, ApiError } from "@/lib/api";
import { useCustomerProject } from "@/lib/customerProject";
import { colors, fonts, radii, surfaces } from "@/lib/theme";
import CustomerProjectHeader from "@/components/CustomerProjectHeader";
import CustomerTopBar from "@/components/CustomerTopBar";

// Port of CustomerShell.jsx's "onboarding" tab — the adaptive-onboarding
// checklist built in an earlier session (worker/lib/onboardingService.js),
// grouped by category. owner: "customer" steps are checkbox-toggleable;
// owner: "tektone" steps are read-only status chips. Phase 7 of
// ~/.claude/plans/tektone-mobile-parity.md.

type Step = {
  id: string;
  title: string;
  description: string | null;
  owner: "tektone" | "customer";
  category: string | null;
  status: "pending" | "done";
};

const CATEGORY_LABEL: Record<string, string> = {
  kickoff: "Kickoff",
  access: "Acessos",
  content: "Conteúdo",
  technical: "Técnico",
  design: "Design",
  training: "Treinamento",
  launch: "Lançamento",
};

export default function CustomerOnboardingScreen() {
  const { activeProjectId } = useCustomerProject();
  const [onboarding, setOnboarding] = useState<{ plan: any; steps: Step[] } | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useFocusEffect(
    useCallback(() => {
      if (!activeProjectId) return;
      api.getOnboarding(activeProjectId).then(setOnboarding).catch(() => {});
    }, [activeProjectId])
  );

  async function toggleStep(step: Step) {
    if (step.owner !== "customer" || !activeProjectId) return;
    setTogglingId(step.id);
    setError("");
    const nextStatus = step.status === "done" ? "pending" : "done";
    try {
      const { step: updated } = await api.setOnboardingStepStatus(activeProjectId, step.id, nextStatus);
      setOnboarding((prev) => (prev ? { ...prev, steps: prev.steps.map((s) => (s.id === updated.id ? updated : s)) } : prev));
    } catch (e) {
      setError(e instanceof ApiError ? e.body?.error || "Falha ao atualizar a etapa." : "Falha ao atualizar a etapa.");
    } finally {
      setTogglingId(null);
    }
  }

  const grouped = onboarding?.steps.reduce((acc: Record<string, Step[]>, s) => {
    const key = s.category || "outros";
    (acc[key] ||= []).push(s);
    return acc;
  }, {});

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <CustomerTopBar />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <CustomerProjectHeader />
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {onboarding === null ? (
          <ActivityIndicator style={{ marginTop: 24 }} color={colors.action} />
        ) : !onboarding.plan || onboarding.steps.length === 0 ? (
          <Text style={styles.emptyText}>Nenhum checklist de onboarding ainda.</Text>
        ) : (
          <View style={{ gap: 12 }}>
            {Object.entries(grouped || {}).map(([category, steps]) => (
              <View key={category} style={styles.categoryCard}>
                <Text style={styles.categoryLabel}>{CATEGORY_LABEL[category] || "Outros"}</Text>
                <View style={{ gap: 8 }}>
                  {steps.map((s) => (
                    <View key={s.id} style={styles.stepRow}>
                      {s.owner === "customer" ? (
                        <Pressable onPress={() => toggleStep(s)} disabled={togglingId === s.id} style={{ marginTop: 1 }}>
                          {togglingId === s.id ? (
                            <ActivityIndicator size="small" color={colors.stone400} />
                          ) : s.status === "done" ? (
                            <CheckSquare size={16} color={colors.success} />
                          ) : (
                            <Square size={16} color={colors.stone400} />
                          )}
                        </Pressable>
                      ) : (
                        <View style={{ marginTop: 1 }}>
                          {s.status === "done" ? <CheckCircle2 size={16} color={colors.success} /> : <Clock size={16} color={colors.stone400} />}
                        </View>
                      )}
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={[styles.stepTitle, s.status === "done" && { color: colors.stone500, textDecorationLine: "line-through" }]}>
                          {s.title}
                        </Text>
                        {s.description ? <Text style={styles.stepDesc}>{s.description}</Text> : null}
                        {s.owner !== "customer" ? <Text style={styles.stepOwner}>responsável: tektone</Text> : null}
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.clay },
  error: { fontFamily: fonts.mono, fontSize: 11, color: colors.danger, marginBottom: 10 },
  emptyText: { fontFamily: fonts.sans, fontSize: 13, color: colors.stone500 },
  categoryCard: { ...surfaces[2], borderRadius: radii.xl, padding: 16 },
  categoryLabel: { fontFamily: fonts.mono, fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: colors.stone500, marginBottom: 10 },
  stepRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, ...surfaces[3], borderRadius: radii.md, paddingHorizontal: 12, paddingVertical: 10 },
  stepTitle: { fontFamily: fonts.sans, fontSize: 13.5, color: colors.ink },
  stepDesc: { fontFamily: fonts.sans, fontSize: 11.5, color: colors.stone500, marginTop: 2 },
  stepOwner: { fontFamily: fonts.mono, fontSize: 9, textTransform: "uppercase", letterSpacing: 0.6, color: colors.stone400, marginTop: 2 },
});
