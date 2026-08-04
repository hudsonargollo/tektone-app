import { View, Text, StyleSheet } from "react-native";
import { colors, fonts } from "@/lib/theme";
import { PRIORITY } from "@/lib/constants";

type Client = { id: string; name: string; color: string };

export default function WizardSummaryChips({
  clientId,
  clients,
  assignees,
  priority,
  dueDate,
}: {
  clientId: string;
  clients: Client[];
  assignees: string[];
  priority: string;
  dueDate: string;
}) {
  const client = clients.find((c) => c.id === clientId);
  const p = (PRIORITY as any)[priority];

  const chips: { key: string; label: string; color?: string }[] = [];
  if (client) chips.push({ key: "client", label: client.name, color: client.color });
  if (assignees.length)
    chips.push({ key: "assignees", label: assignees.length === 1 ? assignees[0].split(" ")[0] : `${assignees.length} pessoas` });
  if (p) chips.push({ key: "priority", label: p.label, color: p.color });
  if (dueDate)
    chips.push({ key: "due", label: new Date(`${dueDate}T00:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) });

  if (!chips.length) return null;

  return (
    <View style={styles.row}>
      {chips.map((c) => (
        <View key={c.key} style={styles.chip}>
          {c.color && <View style={[styles.dot, { backgroundColor: c.color }]} />}
          <Text style={styles.chipText}>{c.label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 16 },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderColor: "rgba(20,22,24,0.1)",
    backgroundColor: "rgba(20,22,24,0.03)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  chipText: { fontFamily: fonts.mono, fontSize: 10, color: colors.stone500 },
});
