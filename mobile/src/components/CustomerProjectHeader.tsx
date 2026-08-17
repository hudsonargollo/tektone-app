import { View, Text, Pressable, StyleSheet } from "react-native";
import { ChevronDown } from "lucide-react-native";
import { useState } from "react";
import { useCustomerProject } from "@/lib/customerProject";
import { colors, fonts, radii, surfaces } from "@/lib/theme";
import PickerModal from "@/components/CardDetail/PickerModal";

// Shared above-the-tabs header for the (customer)/ screens — project
// picker (only when there's more than one) + the progress bar, the one
// operational signal a customer sees (no task titles, no assignees, no
// staff workload detail — PRD §4). Mirrors CustomerShell.jsx's header.
export default function CustomerProjectHeader() {
  const { projects, activeProjectId, activeProject, setActiveProjectId } = useCustomerProject();
  const [pickerOpen, setPickerOpen] = useState(false);

  if (!projects) return null;

  return (
    <View style={{ marginBottom: 14 }}>
      {projects.length > 1 && (
        <>
          <Pressable onPress={() => setPickerOpen(true)} style={styles.selectBtn}>
            <Text style={styles.selectBtnText}>{activeProject?.name || "Selecionar projeto"}</Text>
            <ChevronDown size={14} color={colors.stone500} />
          </Pressable>
          <PickerModal
            visible={pickerOpen}
            title="Projeto"
            options={projects.map((p) => ({ value: p.id, label: p.name }))}
            selected={activeProjectId ? [activeProjectId] : []}
            onToggle={(v) => { setActiveProjectId(v); setPickerOpen(false); }}
            onClose={() => setPickerOpen(false)}
          />
        </>
      )}

      {activeProject && (
        <View style={styles.progressCard}>
          <Text style={styles.projectName}>{activeProject.name}</Text>
          <View style={styles.progressHead}>
            <Text style={styles.pct}>{activeProject.progress?.pct ?? 0}%</Text>
            <Text style={styles.progressMeta}>
              {activeProject.progress?.done ?? 0} de {activeProject.progress?.total ?? 0} concluídas
            </Text>
          </View>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${activeProject.progress?.pct ?? 0}%` }]} />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  selectBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1, borderColor: "rgba(20,22,24,0.15)",
    backgroundColor: colors.paper, borderRadius: radii.md, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10,
  },
  selectBtnText: { fontFamily: fonts.sans, fontSize: 13, color: colors.ink },
  progressCard: { ...surfaces[2], borderRadius: radii.xl, padding: 18 },
  projectName: { fontFamily: fonts.mono, fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: colors.stone500, marginBottom: 8 },
  progressHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 },
  pct: { fontFamily: fonts.sansBold, fontSize: 24, color: colors.ink },
  progressMeta: { fontFamily: fonts.mono, fontSize: 10.5, color: colors.stone500 },
  track: { height: 8, borderRadius: 4, backgroundColor: "rgba(20,22,24,0.1)", overflow: "hidden" },
  fill: { height: "100%", borderRadius: 4, backgroundColor: colors.action },
});
