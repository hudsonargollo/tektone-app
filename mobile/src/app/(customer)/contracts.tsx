import { useCallback, useState } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator, StyleSheet } from "react-native";
import { useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { CheckCircle2, Clock, ShieldCheck } from "lucide-react-native";
import { api, ApiError } from "@/lib/api";
import { useCustomerProject } from "@/lib/customerProject";
import { colors, fonts, radii, surfaces } from "@/lib/theme";
import CustomerProjectHeader from "@/components/CustomerProjectHeader";
import CustomerTopBar from "@/components/CustomerTopBar";

// Port of CustomerShell.jsx's "contracts" tab — list + click-to-sign, same
// self-built signature flow web uses (hash + IP + user-agent + timestamp
// server-side, no third-party e-sign service — see the contracts route in
// functions/api/projects/[[path]].js). Phase 7 of
// ~/.claude/plans/tektone-mobile-parity.md.

type Contract = {
  id: string;
  title: string;
  content: string;
  status: "DRAFT" | "PENDING_SIGNATURE" | "SIGNED" | "VOID";
  signed_at?: string;
  signed_by?: string;
};

const STATUS: Record<string, { label: string; color: string }> = {
  DRAFT: { label: "rascunho", color: colors.stone500 },
  PENDING_SIGNATURE: { label: "aguardando assinatura", color: colors.warning },
  SIGNED: { label: "assinado", color: colors.success },
  VOID: { label: "anulado", color: colors.danger },
};

export default function CustomerContractsScreen() {
  const { activeProjectId } = useCustomerProject();
  const [contracts, setContracts] = useState<Contract[] | null>(null);
  const [signingId, setSigningId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    if (!activeProjectId) return;
    api.listContracts(activeProjectId).then(({ contracts }: any) => setContracts(contracts)).catch(() => {});
  }, [activeProjectId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function sign(contractId: string) {
    if (!activeProjectId) return;
    setSigningId(contractId);
    setError("");
    try {
      const { contract } = await api.signContract(activeProjectId, contractId);
      setContracts((prev) => (prev ? prev.map((c) => (c.id === contract.id ? contract : c)) : prev));
    } catch (e) {
      setError(e instanceof ApiError ? e.body?.error || "Falha ao assinar." : "Falha ao assinar.");
    } finally {
      setSigningId(null);
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <CustomerTopBar />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <CustomerProjectHeader />
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {contracts === null ? (
          <ActivityIndicator style={{ marginTop: 24 }} color={colors.action} />
        ) : contracts.length === 0 ? (
          <Text style={styles.emptyText}>Nenhum contrato ainda.</Text>
        ) : (
          <View style={{ gap: 12 }}>
            {contracts.map((c) => {
              const st = STATUS[c.status] || STATUS.DRAFT;
              return (
                <View key={c.id} style={styles.card}>
                  <View style={styles.cardHead}>
                    <Text style={styles.cardTitle}>{c.title}</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      {c.status === "SIGNED" ? <CheckCircle2 size={12} color={st.color} /> : <Clock size={12} color={st.color} />}
                      <Text style={[styles.statusText, { color: st.color }]}>{st.label}</Text>
                    </View>
                  </View>
                  <Text style={styles.contractContent}>{c.content}</Text>
                  {c.status === "SIGNED" ? (
                    <View style={styles.signedRow}>
                      <ShieldCheck size={12} color={colors.stone400} />
                      <Text style={styles.signedText}>
                        assinado em {c.signed_at ? new Date(c.signed_at).toLocaleString("pt-BR") : "—"} por {c.signed_by}
                      </Text>
                    </View>
                  ) : c.status === "PENDING_SIGNATURE" ? (
                    <Pressable onPress={() => sign(c.id)} disabled={signingId === c.id} style={[styles.signBtn, signingId === c.id && { opacity: 0.6 }]}>
                      {signingId === c.id ? <ActivityIndicator size="small" color={colors.clay} /> : null}
                      <Text style={styles.signBtnText}>assinar contrato</Text>
                    </Pressable>
                  ) : null}
                </View>
              );
            })}
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
  card: { ...surfaces[2], borderRadius: radii.xl, padding: 18 },
  cardHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8, gap: 8 },
  cardTitle: { fontFamily: fonts.sansSemiBold, fontSize: 14, color: colors.ink, flex: 1 },
  statusText: { fontFamily: fonts.mono, fontSize: 9.5, textTransform: "uppercase", letterSpacing: 0.5 },
  contractContent: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 19, color: colors.stone500, marginBottom: 12 },
  signedRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  signedText: { fontFamily: fonts.mono, fontSize: 10, color: colors.stone400 },
  signBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.action, borderRadius: radii.md, paddingVertical: 11, alignSelf: "flex-start", paddingHorizontal: 18 },
  signBtnText: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.clay },
});
