import { useCallback, useState } from "react";
import { View, Text, Pressable, FlatList, ActivityIndicator, StyleSheet } from "react-native";
import { useFocusEffect } from "expo-router";
import { Download, RefreshCw, CheckCircle2, AlertTriangle, Square, CheckSquare } from "lucide-react-native";
import { api } from "@/lib/api";
import { colors, fonts, radii } from "@/lib/theme";

// Port of web's MeetingFetch.jsx — admin-only bulk import: select many Drive
// meetings, process them all in one call. Reached from meetings.tsx's
// "importação em massa" tab (admin-only, same gate as web).

type Meeting = { id: string; title: string; date: string; processed?: boolean };
type Result = {
  id: string;
  title: string;
  ok: boolean;
  status?: number;
  error?: string;
  result?: { created?: string[]; alreadyProcessed?: boolean; project?: string; error?: string };
};

function fmtDate(d: string) {
  if (!d) return "";
  try {
    return new Date(`${d}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  } catch {
    return d;
  }
}

export default function MeetingFetch({ onDone }: { onDone?: () => void }) {
  const [meetings, setMeetings] = useState<Meeting[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<Result[] | null>(null);

  const load = useCallback(() => {
    setMeetings(null);
    setError("");
    api
      .listMeetings()
      .then(({ meetings, error }: any) => {
        if (error) return setError(error);
        setMeetings(meetings || []);
        setSelected(new Set((meetings || []).filter((m: Meeting) => !m.processed).map((m: Meeting) => m.id)));
      })
      .catch((e: any) => setError(e.body?.error || "Falha ao listar reuniões."));
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function run() {
    if (!selected.size) return;
    setBusy(true);
    setError("");
    try {
      const { results, error } = await api.processMeetings([...selected]);
      if (error) return setError(error);
      setResults(results || []);
      onDone?.();
    } catch (e: any) {
      setError(e.body?.error || "Falha ao buscar reuniões.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Download size={15} color={colors.action} />
          <Text style={styles.headerTitle}>Buscar reuniões</Text>
        </View>
        {meetings && !results && (
          <Pressable onPress={load} hitSlop={8}>
            <RefreshCw size={15} color={colors.stone500} />
          </Pressable>
        )}
      </View>

      <View style={{ flex: 1, paddingHorizontal: 16 }}>
        {error ? (
          <View style={styles.errorRow}>
            <AlertTriangle size={13} color={colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {results ? (
          <FlatList
            data={results}
            keyExtractor={(r) => r.id || r.title}
            contentContainerStyle={{ paddingVertical: 12, gap: 8 }}
            ListHeaderComponent={<Text style={styles.resultsIntro}>Importação concluída:</Text>}
            renderItem={({ item: r }) => {
              const created = r.result?.created?.length || 0;
              const already = r.result?.alreadyProcessed;
              const reason = r.error || r.result?.error || (r.status ? `HTTP ${r.status}` : "erro");
              return (
                <View style={styles.resultRow}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
                    <Text style={styles.resultTitle} numberOfLines={1}>{r.title || r.id}</Text>
                    {!r.ok ? (
                      <Text style={[styles.resultStatus, { color: colors.danger }]}>falhou</Text>
                    ) : already ? (
                      <Text style={[styles.resultStatus, { color: colors.stone400 }]}>já importada</Text>
                    ) : (
                      <Text style={[styles.resultStatus, { color: colors.success }]}>
                        {r.result?.project} · {created} tarefa(s)
                      </Text>
                    )}
                  </View>
                  {!r.ok && <Text style={styles.resultReason}>{reason}</Text>}
                </View>
              );
            }}
          />
        ) : !meetings ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={colors.action} />
        ) : meetings.length === 0 ? (
          <Text style={styles.empty}>nenhuma reunião encontrada</Text>
        ) : (
          <FlatList
            data={meetings}
            keyExtractor={(m) => m.id}
            contentContainerStyle={{ paddingVertical: 12, gap: 6 }}
            renderItem={({ item: m }) => {
              const on = selected.has(m.id);
              return (
                <Pressable onPress={() => toggle(m.id)} style={[styles.meetingRow, on && styles.meetingRowActive]}>
                  {on ? <CheckSquare size={16} color={colors.action} /> : <Square size={16} color={colors.stone400} />}
                  <Text style={styles.meetingTitle} numberOfLines={1}>{m.title}</Text>
                  {m.processed && <Text style={styles.processedTag}>já importada</Text>}
                  <Text style={styles.meetingDate}>{fmtDate(m.date)}</Text>
                </Pressable>
              );
            }}
          />
        )}
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerCount}>{results ? "" : `${selected.size} selecionada(s)`}</Text>
        {results ? (
          <Pressable onPress={() => { setResults(null); load(); }} style={styles.primaryBtn}>
            <CheckCircle2 size={14} color={colors.clay} />
            <Text style={styles.primaryBtnText}>Concluir</Text>
          </Pressable>
        ) : (
          <Pressable onPress={run} disabled={busy || !selected.size} style={[styles.primaryBtn, (busy || !selected.size) && { opacity: 0.5 }]}>
            {busy ? <ActivityIndicator color={colors.clay} size="small" /> : <Download size={14} color={colors.clay} />}
            <Text style={styles.primaryBtnText}>Buscar selecionadas</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "rgba(20,22,24,0.1)" },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerTitle: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.ink },
  errorRow: { flexDirection: "row", alignItems: "flex-start", gap: 6, marginTop: 12 },
  errorText: { flex: 1, fontFamily: fonts.mono, fontSize: 11, color: colors.danger },
  resultsIntro: { fontFamily: fonts.sans, fontSize: 13, color: colors.stone500, marginBottom: 4 },
  resultRow: { backgroundColor: colors.paper, borderRadius: radii.md, borderWidth: 1, borderColor: "rgba(20,22,24,0.1)", padding: 10 },
  resultTitle: { flex: 1, fontFamily: fonts.sans, fontSize: 13, color: colors.ink },
  resultStatus: { fontFamily: fonts.mono, fontSize: 11 },
  resultReason: { marginTop: 4, fontFamily: fonts.mono, fontSize: 10, color: "rgba(155,61,46,0.8)" },
  empty: { fontFamily: fonts.mono, fontSize: 11, color: colors.stone400, textAlign: "center", marginTop: 40 },
  meetingRow: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: "rgba(20,22,24,0.1)", borderRadius: radii.lg, paddingHorizontal: 12, paddingVertical: 10 },
  meetingRowActive: { borderColor: "rgba(46,74,67,0.4)", backgroundColor: "rgba(46,74,67,0.05)" },
  meetingTitle: { flex: 1, fontFamily: fonts.sans, fontSize: 13, color: colors.ink },
  processedTag: { fontFamily: fonts.mono, fontSize: 9, textTransform: "uppercase", color: colors.stone500, backgroundColor: "rgba(20,22,24,0.06)", paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 },
  meetingDate: { fontFamily: fonts.mono, fontSize: 10, color: colors.stone400 },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: 1, borderTopColor: "rgba(20,22,24,0.1)" },
  footerCount: { fontFamily: fonts.mono, fontSize: 10, color: colors.stone400 },
  primaryBtn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.action, borderRadius: radii.md, paddingHorizontal: 18, paddingVertical: 10 },
  primaryBtnText: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.clay },
});
