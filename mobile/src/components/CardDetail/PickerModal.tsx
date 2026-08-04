// Generic bottom-sheet-style picker — single or multi select — replacing
// web's custom <Select>/<MultiAssignee> dropdowns (no native <select>
// equivalent on mobile).
import { View, Text, Pressable, Modal, FlatList, StyleSheet } from "react-native";
import { Check } from "lucide-react-native";
import { colors, fonts, radii } from "@/lib/theme";

export type PickerOption = { value: string; label: string; color?: string };

export default function PickerModal({
  visible,
  title,
  options,
  selected,
  onToggle,
  onClose,
}: {
  visible: boolean;
  title: string;
  options: PickerOption[];
  selected: string[];
  onToggle: (value: string) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>{title}</Text>
          <FlatList
            data={options}
            keyExtractor={(o) => o.value}
            style={{ maxHeight: 360 }}
            renderItem={({ item }) => {
              const active = selected.includes(item.value);
              return (
                <Pressable onPress={() => onToggle(item.value)} style={styles.row}>
                  {item.color && <View style={[styles.dot, { backgroundColor: item.color }]} />}
                  <Text style={[styles.rowText, active && styles.rowTextActive]}>{item.label}</Text>
                  {active && <Check size={15} color={colors.action} />}
                </Pressable>
              );
            }}
          />
          <Pressable onPress={onClose} style={styles.doneBtn}>
            <Text style={styles.doneBtnText}>Fechar</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(20,22,24,0.5)", justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.paper, borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl, padding: 16, paddingBottom: 32 },
  title: { fontFamily: fonts.mono, fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: colors.stone500, marginBottom: 10 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(20,22,24,0.08)" },
  dot: { width: 8, height: 8, borderRadius: 4 },
  rowText: { flex: 1, fontFamily: fonts.sans, fontSize: 14, color: colors.stone500 },
  rowTextActive: { color: colors.ink, fontFamily: fonts.sansSemiBold },
  doneBtn: { marginTop: 12, backgroundColor: colors.action, borderRadius: radii.md, paddingVertical: 12, alignItems: "center" },
  doneBtnText: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.clay },
});
