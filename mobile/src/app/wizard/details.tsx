import { useEffect, useState } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Calendar as CalendarIcon, X } from "lucide-react-native";
import { api } from "@/lib/api";
import { useWizard } from "@/lib/wizard-context";
import { PRIORITY, fmtDate } from "@/lib/constants";
import PickerModal from "@/components/CardDetail/PickerModal";
import { colors, fonts, radii } from "@/lib/theme";

export default function WizardDetailsStep() {
  const router = useRouter();
  const {
    clientId, setClientId, assignees, setAssignees, priority, setPriority, dueDate, setDueDate,
    members, setMembers, clients, setClients,
  } = useWizard();

  const [loading, setLoading] = useState(true);
  const [showAssignees, setShowAssignees] = useState(false);
  const [showClient, setShowClient] = useState(false);
  const [showDate, setShowDate] = useState(false);

  useEffect(() => {
    Promise.all([api.listMembers(), api.listClients()])
      .then(([m, c]) => {
        setMembers(m.members);
        setClients(c.clients);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const client = clients.find((c) => c.id === clientId);
  const clientOpts = clients.map((c) => ({ value: c.id, label: c.name, color: c.color }));
  const memberOpts = members.map((m) => ({ value: m.name, label: m.name }));

  if (loading) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator color={colors.action} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
      <Text style={styles.headline}>Quem, onde e até quando?</Text>
      <Text style={styles.hint}>Opcional agora, mas ajuda o time a encontrar essa tarefa depois.</Text>

      <Pressable onPress={() => setShowClient(true)} style={styles.metaRow}>
        <Text style={styles.metaLabel}>Projeto</Text>
        <Text style={styles.metaValue}>{client?.name || "— Nenhum —"}</Text>
      </Pressable>

      <Pressable onPress={() => setShowAssignees(true)} style={styles.metaRow}>
        <Text style={styles.metaLabel}>Responsáveis</Text>
        <Text style={styles.metaValue}>{assignees.length ? assignees.join(", ") : "— Ninguém —"}</Text>
      </Pressable>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Prioridade</Text>
        <View style={styles.pillRow}>
          {(Object.keys(PRIORITY) as (keyof typeof PRIORITY)[]).map((k) => (
            <Pressable
              key={k}
              onPress={() => setPriority(k)}
              style={[styles.pill, priority === k && { backgroundColor: PRIORITY[k].color, borderColor: PRIORITY[k].color }]}
            >
              <Text style={[styles.pillText, priority === k && { color: colors.clay }]}>{PRIORITY[k].label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Prazo</Text>
        <Pressable onPress={() => setShowDate(true)} style={styles.dateRow}>
          <CalendarIcon size={14} color={colors.stone500} />
          <Text style={styles.metaValue}>{dueDate ? fmtDate(dueDate) : "Sem prazo"}</Text>
          {dueDate ? (
            <Pressable onPress={() => setDueDate("")} hitSlop={8}>
              <X size={13} color={colors.stone400} />
            </Pressable>
          ) : null}
        </Pressable>
        {showDate && (
          <DateTimePicker
            value={dueDate ? new Date(dueDate + "T12:00:00") : new Date()}
            mode="date"
            onChange={(_, date) => {
              setShowDate(false);
              if (date) setDueDate(date.toISOString().slice(0, 10));
            }}
          />
        )}
      </View>

      <Pressable onPress={() => router.push("/wizard/choice")} style={styles.button}>
        <Text style={styles.buttonText}>Continuar</Text>
      </Pressable>

      <PickerModal
        visible={showClient}
        title="Projeto"
        options={clientOpts}
        selected={clientId ? [clientId] : []}
        onToggle={(v) => {
          setClientId(v);
          setShowClient(false);
        }}
        onClose={() => setShowClient(false)}
      />
      <PickerModal
        visible={showAssignees}
        title="Responsáveis"
        options={memberOpts}
        selected={assignees}
        onToggle={(v) => setAssignees(assignees.includes(v) ? assignees.filter((n) => n !== v) : [...assignees, v])}
        onClose={() => setShowAssignees(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.clay },
  center: { justifyContent: "center", alignItems: "center" },
  headline: { fontFamily: fonts.sansBold, fontSize: 18, color: colors.ink, marginBottom: 4 },
  hint: { fontFamily: fonts.mono, fontSize: 11, color: colors.stone500, marginBottom: 12, lineHeight: 16 },
  metaRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(20,22,24,0.1)",
  },
  metaLabel: { fontFamily: fonts.mono, fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: colors.stone500 },
  metaValue: { fontFamily: fonts.sans, fontSize: 13, color: colors.ink, flexShrink: 1, textAlign: "right" },
  section: { marginTop: 20 },
  sectionLabel: { fontFamily: fonts.mono, fontSize: 11, textTransform: "uppercase", letterSpacing: 1.5, color: colors.stone500, marginBottom: 8 },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: { borderWidth: 1, borderColor: "rgba(20,22,24,0.15)", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7 },
  pillText: { fontFamily: fonts.sansSemiBold, fontSize: 12, color: colors.ink },
  dateRow: {
    flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: "rgba(20,22,24,0.15)",
    borderRadius: radii.md, paddingHorizontal: 12, paddingVertical: 10,
  },
  button: { marginTop: 28, backgroundColor: colors.action, borderRadius: radii.md, paddingVertical: 14, alignItems: "center" },
  buttonText: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.clay },
});
