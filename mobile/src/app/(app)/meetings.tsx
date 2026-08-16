import { useCallback, useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, StyleSheet, Switch } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Sparkles,
  Check,
  ArrowLeft,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Square,
  CheckSquare,
} from "lucide-react-native";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PRIORITY, hashColor, initials } from "@/lib/constants";
import { colors, fonts, radii } from "@/lib/theme";
import MeetingFetch from "@/components/MeetingFetch";

// Port of web's MeetingsPage.jsx + MeetingIntelligence.jsx — "analisar
// reunião" (paste or pick a Drive transcript, review Claude's extracted
// decisions/risks/action items, save to the board) as this screen's main
// flow, with an admin-only "importação em massa" tab delegating to
// MeetingFetch. Phase 3 of ~/.claude/plans/tektone-mobile-parity.md — pure
// UI work, api.ts already had every method this needs (confirmed
// wire-compatible with web's routes during the mobile audit).

type Meeting = { id: string; title: string; date: string; processed?: boolean };
type ActionItem = { title: string; priority: "low" | "medium" | "high"; assignees?: string[] };
type Analysis = {
  project: string;
  summary: string;
  decisions: string[];
  risks: { risk: string; mitigation?: string }[];
  actionItems: ActionItem[];
};

function fmtDate(d: string) {
  if (!d) return "";
  try {
    return new Date(`${d}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  } catch {
    return d;
  }
}

export default function MeetingsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const isAdmin = Boolean(user?.admin);

  const [tab, setTab] = useState<"analyze" | "bulk">("analyze");
  const [phase, setPhase] = useState<"input" | "review">("input");
  const [mode, setMode] = useState<"drive" | "paste">("drive");
  const [meetings, setMeetings] = useState<Meeting[] | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [transcript, setTranscript] = useState("");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [projectName, setProjectName] = useState("");
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [saveSummary, setSaveSummary] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const loadMeetings = useCallback(() => {
    api
      .listMeetings()
      .then(({ meetings, error }: any) => (error ? setError(error) : setMeetings(meetings || [])))
      .catch((e: any) => setError(e.body?.error || "Falha ao listar reuniões."));
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (tab === "analyze" && mode === "drive" && meetings === null) loadMeetings();
    }, [tab, mode, meetings, loadMeetings])
  );

  function switchMode(m: "drive" | "paste") {
    setMode(m);
    setError("");
    if (m === "drive" && meetings === null) loadMeetings();
  }

  async function pickMeeting(m: Meeting) {
    setLoadingId(m.id);
    setError("");
    try {
      const { text, title: t, error } = await api.meetingText(m.id);
      if (error) return setError(error);
      setTitle(t || m.title);
      setTranscript(text || "");
      setMode("paste");
    } catch (e: any) {
      setError(e.body?.error || "Falha ao carregar a transcrição.");
    } finally {
      setLoadingId(null);
    }
  }

  async function analyze() {
    setBusy(true);
    setError("");
    try {
      const { analysis } = await api.analyzeMeeting({ transcript, title });
      setAnalysis(analysis);
      setProjectName(analysis.project || "");
      setExcluded(new Set());
      setPhase("review");
    } catch (e: any) {
      setError(e.body?.error || "Falha ao analisar. Verifique a chave da Anthropic.");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!analysis) return;
    setBusy(true);
    setError("");
    try {
      const actionItems = analysis.actionItems.filter((_, i) => !excluded.has(i));
      await api.commitAnalysis({
        projectName,
        meetingTitle: title,
        summary: analysis.summary,
        decisions: analysis.decisions,
        risks: analysis.risks,
        actionItems,
        saveSummaryCard: saveSummary,
      });
      // Reset back to input for the next transcript, matching web's
      // onClose+onSaved combo (there's no separate "close" concept here —
      // this screen is a tab, not a modal).
      setPhase("input");
      setAnalysis(null);
      setTranscript("");
      setTitle("");
      if (mode === "drive") loadMeetings();
    } catch (e: any) {
      setError(e.body?.error || "Falha ao salvar.");
    } finally {
      setBusy(false);
    }
  }

  function toggleItem(i: number) {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  const keptCount = analysis ? analysis.actionItems.length - excluded.size : 0;

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={{ marginRight: 4 }}>
          <ArrowLeft size={18} color={colors.stone500} />
        </Pressable>
        <View style={styles.headerIcon}>
          <Sparkles size={14} color="#7A5A6E" />
        </View>
        <Text style={styles.headerTitle}>Reuniões</Text>
      </View>

      {isAdmin && (
        <View style={styles.tabRow}>
          <Pressable onPress={() => setTab("analyze")} style={[styles.tabBtn, tab === "analyze" && styles.tabBtnActive]}>
            <Text style={[styles.tabBtnText, tab === "analyze" && styles.tabBtnTextActive]}>analisar reunião</Text>
          </Pressable>
          <Pressable onPress={() => setTab("bulk")} style={[styles.tabBtn, tab === "bulk" && styles.tabBtnActive]}>
            <Text style={[styles.tabBtnText, tab === "bulk" && styles.tabBtnTextActive]}>importação em massa</Text>
          </Pressable>
        </View>
      )}

      {tab === "bulk" ? (
        <MeetingFetch onDone={() => {}} />
      ) : (
        <>
          {phase === "review" && (
            <Pressable onPress={() => setPhase("input")} style={styles.backToInput}>
              <ArrowLeft size={13} color={colors.stone500} />
              <Text style={styles.backToInputText}>voltar</Text>
            </Pressable>
          )}

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 14 }}>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            {phase === "input" && (
              <>
                <View style={styles.modeToggle}>
                  {(["drive", "paste"] as const).map((m) => (
                    <Pressable key={m} onPress={() => switchMode(m)} style={[styles.modeBtn, mode === m && styles.modeBtnActive]}>
                      <Text style={[styles.modeBtnText, mode === m && styles.modeBtnTextActive]}>
                        {m === "drive" ? "Buscar do Drive" : "Colar texto"}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                {mode === "drive" ? (
                  meetings === null ? (
                    <ActivityIndicator style={{ marginTop: 24 }} color={colors.action} />
                  ) : meetings.length === 0 ? (
                    <Text style={styles.empty}>nenhuma reunião encontrada</Text>
                  ) : (
                    <View style={{ gap: 6 }}>
                      {meetings.map((m) => (
                        <Pressable
                          key={m.id}
                          onPress={() => pickMeeting(m)}
                          disabled={!!loadingId}
                          style={[styles.meetingRow, loadingId && { opacity: 0.5 }]}
                        >
                          <Text style={styles.meetingTitle} numberOfLines={1}>{m.title}</Text>
                          {m.processed && <Text style={styles.processedTag}>importada</Text>}
                          {loadingId === m.id ? (
                            <ActivityIndicator size="small" color={colors.action} />
                          ) : (
                            <Text style={styles.meetingDate}>{fmtDate(m.date)}</Text>
                          )}
                        </Pressable>
                      ))}
                    </View>
                  )
                ) : (
                  <>
                    <View>
                      <Text style={styles.label}>Reunião (título)</Text>
                      <TextInput
                        value={title}
                        onChangeText={setTitle}
                        placeholder="Ex.: Reunião com advogada parceira"
                        placeholderTextColor={colors.stone400}
                        style={styles.input}
                      />
                    </View>
                    <View>
                      <Text style={styles.label}>Transcrição / anotações</Text>
                      <TextInput
                        value={transcript}
                        onChangeText={setTranscript}
                        placeholder="Cole aqui a transcrição ou as anotações da reunião…"
                        placeholderTextColor={colors.stone400}
                        multiline
                        numberOfLines={10}
                        style={[styles.input, styles.textarea]}
                      />
                      <Text style={styles.hint}>O Claude extrai resumo, decisões, riscos e tarefas — e sugere o projeto.</Text>
                    </View>
                  </>
                )}
              </>
            )}

            {phase === "review" && analysis && (
              <>
                <View>
                  <Text style={styles.label}>Projeto</Text>
                  <TextInput value={projectName} onChangeText={setProjectName} style={styles.input} />
                  <Text style={styles.hint}>{`Novo projeto "${projectName}" será criado, ou associado a um existente com esse nome.`}</Text>
                </View>

                {analysis.summary ? (
                  <View style={styles.summaryBox}>
                    <View style={styles.sectionHead}>
                      <FileText size={11} color={colors.stone500} />
                      <Text style={styles.sectionLabel}>Resumo executivo</Text>
                    </View>
                    <Text style={styles.summaryText}>{analysis.summary}</Text>
                  </View>
                ) : null}

                {analysis.decisions?.length > 0 && (
                  <View>
                    <View style={styles.sectionHead}>
                      <CheckCircle2 size={11} color={colors.success} />
                      <Text style={styles.sectionLabel}>Decisões</Text>
                    </View>
                    {analysis.decisions.map((d, i) => (
                      <Text key={i} style={styles.listItem}>• {d}</Text>
                    ))}
                  </View>
                )}

                {analysis.risks?.length > 0 && (
                  <View>
                    <View style={styles.sectionHead}>
                      <AlertTriangle size={11} color={colors.warning} />
                      <Text style={styles.sectionLabel}>Riscos</Text>
                    </View>
                    {analysis.risks.map((r, i) => (
                      <Text key={i} style={styles.listItem}>
                        • {r.risk}
                        {r.mitigation ? <Text style={{ color: colors.stone500 }}> → {r.mitigation}</Text> : null}
                      </Text>
                    ))}
                  </View>
                )}

                <View>
                  <Text style={styles.sectionLabel}>Tarefas ({keptCount}/{analysis.actionItems.length})</Text>
                  <View style={{ gap: 6, marginTop: 6 }}>
                    {analysis.actionItems.map((it, i) => {
                      const off = excluded.has(i);
                      const p = PRIORITY[it.priority] || PRIORITY.medium;
                      return (
                        <Pressable key={i} onPress={() => toggleItem(i)} style={[styles.taskRow, off && { opacity: 0.5 }]}>
                          {off ? <Square size={16} color={colors.stone400} /> : <CheckSquare size={16} color={colors.action} />}
                          <Text style={[styles.taskTitle, off && styles.taskTitleOff]} numberOfLines={1}>{it.title}</Text>
                          <View style={[styles.priorityDot, { backgroundColor: p.color }]} />
                          {it.assignees?.length ? (
                            <View style={styles.avatarStack}>
                              {it.assignees.slice(0, 3).map((n, ai) => (
                                <View key={n} style={[styles.avatar, { backgroundColor: hashColor(n), marginLeft: ai > 0 ? -8 : 0 }]}>
                                  <Text style={styles.avatarText}>{initials(n)}</Text>
                                </View>
                              ))}
                            </View>
                          ) : (
                            <Text style={styles.noAssignee}>—</Text>
                          )}
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                <View style={styles.switchRow}>
                  <Switch value={saveSummary} onValueChange={setSaveSummary} trackColor={{ true: colors.action }} />
                  <Text style={styles.switchLabel}>Salvar card de resumo (📝) no Backlog do projeto</Text>
                </View>
              </>
            )}
          </ScrollView>

          <View style={styles.footer}>
            <Text style={styles.footerNote}>{phase === "input" ? "Powered by Claude" : projectName || "—"}</Text>
            {phase === "input" ? (
              <Pressable
                onPress={analyze}
                disabled={busy || transcript.trim().length < 30}
                style={[styles.primaryBtn, (busy || transcript.trim().length < 30) && { opacity: 0.5 }]}
              >
                {busy ? <ActivityIndicator color={colors.clay} size="small" /> : <Sparkles size={14} color={colors.clay} />}
                <Text style={styles.primaryBtnText}>Analisar</Text>
              </Pressable>
            ) : (
              <Pressable onPress={save} disabled={busy || !projectName.trim()} style={[styles.primaryBtn, (busy || !projectName.trim()) && { opacity: 0.5 }]}>
                {busy ? <ActivityIndicator color={colors.clay} size="small" /> : <Check size={14} color={colors.clay} />}
                <Text style={styles.primaryBtnText}>Salvar no quadro</Text>
              </Pressable>
            )}
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.clay },
  header: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: "rgba(20,22,24,0.1)" },
  headerIcon: { width: 26, height: 26, borderRadius: radii.sm, backgroundColor: "rgba(122,90,110,0.15)", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.ink },
  tabRow: { flexDirection: "row", gap: 4, paddingHorizontal: 16, paddingVertical: 8 },
  tabBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radii.sm },
  tabBtnActive: { borderBottomWidth: 2, borderBottomColor: colors.action },
  tabBtnText: { fontFamily: fonts.mono, fontSize: 10, color: colors.stone500 },
  tabBtnTextActive: { color: colors.action },
  backToInput: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, paddingTop: 10 },
  backToInputText: { fontFamily: fonts.mono, fontSize: 11, color: colors.stone500 },
  errorText: { fontFamily: fonts.mono, fontSize: 11, color: colors.danger },
  modeToggle: { flexDirection: "row", gap: 4, borderWidth: 1, borderColor: "rgba(20,22,24,0.15)", backgroundColor: "rgba(20,22,24,0.03)", borderRadius: radii.md, padding: 3 },
  modeBtn: { flex: 1, paddingVertical: 7, borderRadius: radii.sm, alignItems: "center" },
  modeBtnActive: { backgroundColor: colors.action },
  modeBtnText: { fontFamily: fonts.monoMedium, fontSize: 11, color: colors.stone500 },
  modeBtnTextActive: { color: colors.clay },
  empty: { fontFamily: fonts.mono, fontSize: 11, color: colors.stone400, textAlign: "center", marginTop: 24 },
  meetingRow: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: "rgba(20,22,24,0.1)", borderRadius: radii.lg, paddingHorizontal: 12, paddingVertical: 10 },
  meetingTitle: { flex: 1, fontFamily: fonts.sans, fontSize: 13, color: colors.ink },
  processedTag: { fontFamily: fonts.mono, fontSize: 9, textTransform: "uppercase", color: colors.stone500, backgroundColor: "rgba(20,22,24,0.06)", paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 },
  meetingDate: { fontFamily: fonts.mono, fontSize: 10, color: colors.stone400 },
  label: { fontFamily: fonts.monoMedium, fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: colors.stone500, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: "rgba(20,22,24,0.15)", backgroundColor: "rgba(20,22,24,0.03)", borderRadius: radii.md, paddingHorizontal: 12, paddingVertical: 10, fontFamily: fonts.sans, fontSize: 14, color: colors.ink },
  textarea: { minHeight: 160, textAlignVertical: "top", fontFamily: fonts.mono, fontSize: 12 },
  hint: { marginTop: 6, fontFamily: fonts.sans, fontSize: 11, color: colors.stone400 },
  summaryBox: { borderWidth: 1, borderColor: "rgba(20,22,24,0.1)", backgroundColor: "rgba(20,22,24,0.02)", borderRadius: radii.md, padding: 12 },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  sectionLabel: { fontFamily: fonts.monoMedium, fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: colors.stone500 },
  summaryText: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 19, color: "rgba(20,22,24,0.8)" },
  listItem: { fontFamily: fonts.sans, fontSize: 13, color: "rgba(20,22,24,0.8)", marginBottom: 3 },
  taskRow: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: "rgba(20,22,24,0.1)", borderRadius: radii.md, paddingHorizontal: 10, paddingVertical: 9 },
  taskTitle: { flex: 1, fontFamily: fonts.sans, fontSize: 13, color: colors.ink },
  taskTitleOff: { textDecorationLine: "line-through" },
  priorityDot: { width: 7, height: 7, borderRadius: 4 },
  avatarStack: { flexDirection: "row" },
  avatar: { width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: colors.clay },
  avatarText: { fontFamily: fonts.sansBold, fontSize: 8, color: "#fff" },
  noAssignee: { fontFamily: fonts.mono, fontSize: 9, color: colors.stone400 },
  switchRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  switchLabel: { flex: 1, fontFamily: fonts.sans, fontSize: 13, color: "rgba(20,22,24,0.75)" },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: 1, borderTopColor: "rgba(20,22,24,0.1)" },
  footerNote: { fontFamily: fonts.mono, fontSize: 10, color: colors.stone400 },
  primaryBtn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.action, borderRadius: radii.md, paddingHorizontal: 18, paddingVertical: 10 },
  primaryBtnText: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.clay },
});
