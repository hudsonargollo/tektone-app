import { View, Text, StyleSheet } from "react-native";
import { colors, fonts } from "@/lib/theme";

export default function WizardProgress({ index, total }: { index: number; total: number }) {
  return (
    <View style={styles.row}>
      <View style={styles.track}>
        {Array.from({ length: total }, (_, i) => (
          <View key={i} style={[styles.bar, i <= index && styles.barActive]} />
        ))}
      </View>
      <Text style={styles.label}>
        Passo {index + 1} de {total}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 },
  track: { flex: 1, flexDirection: "row", gap: 4 },
  bar: { flex: 1, height: 3, borderRadius: 2, backgroundColor: "rgba(20,22,24,0.1)" },
  barActive: { backgroundColor: colors.action },
  label: { fontFamily: fonts.mono, fontSize: 10, color: colors.stone500 },
});
