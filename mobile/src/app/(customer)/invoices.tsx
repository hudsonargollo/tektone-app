import { useCallback, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator, StyleSheet } from "react-native";
import { useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Receipt } from "lucide-react-native";
import { api } from "@/lib/api";
import { useCustomerProject } from "@/lib/customerProject";
import { colors, fonts, radii, surfaces } from "@/lib/theme";
import CustomerProjectHeader from "@/components/CustomerProjectHeader";
import CustomerTopBar from "@/components/CustomerTopBar";

// Port of CustomerShell.jsx's "invoices" tab — list + status, read-only
// (payment itself happens outside the app for now — no third-party
// checkout wired up yet, same as web). Phase 7 of
// ~/.claude/plans/tektone-mobile-parity.md.

type Invoice = { id: string; description?: string; amount: number; currency?: string; due_date?: string; status: "UNPAID" | "PAID" | "OVERDUE" | "VOID" };

const STATUS: Record<string, { label: string; color: string }> = {
  UNPAID: { label: "em aberto", color: colors.warning },
  PAID: { label: "pago", color: colors.success },
  OVERDUE: { label: "vencido", color: colors.danger },
  VOID: { label: "anulado", color: colors.stone400 },
};

const brl = (n?: number | null, currency = "BRL") => Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency });

export default function CustomerInvoicesScreen() {
  const { activeProjectId } = useCustomerProject();
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!activeProjectId) return;
      api.listInvoices(activeProjectId).then(({ invoices }: any) => setInvoices(invoices)).catch(() => {});
    }, [activeProjectId])
  );

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <CustomerTopBar />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <CustomerProjectHeader />

        {invoices === null ? (
          <ActivityIndicator style={{ marginTop: 24 }} color={colors.action} />
        ) : invoices.length === 0 ? (
          <Text style={styles.emptyText}>Nenhuma fatura ainda.</Text>
        ) : (
          <View style={{ gap: 8 }}>
            {invoices.map((inv) => {
              const st = STATUS[inv.status] || STATUS.UNPAID;
              return (
                <View key={inv.id} style={styles.row}>
                  <Receipt size={14} color={colors.stone400} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.desc} numberOfLines={1}>{inv.description || "Fatura"}</Text>
                    {inv.due_date ? <Text style={styles.due}>vencimento {new Date(inv.due_date).toLocaleDateString("pt-BR")}</Text> : null}
                  </View>
                  <Text style={styles.amount}>{brl(inv.amount, inv.currency)}</Text>
                  <Text style={[styles.statusText, { color: st.color }]}>{st.label}</Text>
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
  emptyText: { fontFamily: fonts.sans, fontSize: 13, color: colors.stone500 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, ...surfaces[3], borderRadius: radii.md, paddingHorizontal: 14, paddingVertical: 12 },
  desc: { fontFamily: fonts.sans, fontSize: 13.5, color: colors.ink },
  due: { fontFamily: fonts.mono, fontSize: 10, color: colors.stone500, marginTop: 2 },
  amount: { fontFamily: fonts.sansSemiBold, fontSize: 13.5, color: colors.ink },
  statusText: { fontFamily: fonts.mono, fontSize: 9.5, textTransform: "uppercase", letterSpacing: 0.5 },
});
