import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { Plus, X, Square, CheckSquare } from "lucide-react-native";
import { colors, fonts } from "@/lib/theme";

export type ChecklistItem = { id: string; text: string; done: boolean };

const genId = () => Math.random().toString(36).slice(2, 10);

export default function ChecklistEditor({ items, onChange, label = "Checklist" }: { items: ChecklistItem[]; onChange: (v: ChecklistItem[]) => void; label?: string }) {
  const [text, setText] = useState("");
  const add = () => {
    const t = text.trim();
    if (!t) return;
    onChange([...items, { id: genId(), text: t, done: false }]);
    setText("");
  };
  const toggle = (id: string) => onChange(items.map((i) => (i.id === id ? { ...i, done: !i.done } : i)));
  const remove = (id: string) => onChange(items.filter((i) => i.id !== id));

  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      {items.map((i) => (
        <View key={i.id} style={styles.row}>
          <Pressable onPress={() => toggle(i.id)}>
            {i.done ? <CheckSquare size={16} color={colors.success} /> : <Square size={16} color={colors.stone500} />}
          </Pressable>
          <Text style={[styles.text, i.done && styles.done]}>{i.text}</Text>
          <Pressable onPress={() => remove(i.id)}>
            <X size={13} color={colors.stone400} />
          </Pressable>
        </View>
      ))}
      <View style={styles.addRow}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Adicionar item…"
          placeholderTextColor={colors.stone400}
          onSubmitEditing={add}
          style={styles.addInput}
        />
        <Pressable onPress={add}>
          <Plus size={16} color={colors.stone500} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontFamily: fonts.mono, fontSize: 11, textTransform: "uppercase", letterSpacing: 1.5, color: colors.stone500, marginBottom: 6 },
  row: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  text: { flex: 1, fontFamily: fonts.sans, fontSize: 14, color: colors.ink },
  done: { color: colors.stone500, textDecorationLine: "line-through" },
  addRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  addInput: { flex: 1, fontFamily: fonts.sans, fontSize: 14, color: colors.ink, borderBottomWidth: 1, borderBottomColor: "rgba(20,22,24,0.1)", paddingVertical: 6 },
});
