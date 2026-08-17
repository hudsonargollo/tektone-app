import { useCallback, useRef, useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, Alert, StyleSheet } from "react-native";
import { useFocusEffect } from "expo-router";
import { Plus, Trash2, ChevronLeft, ChevronDown } from "lucide-react-native";
import { api, ApiError } from "@/lib/api";
import { colors, fonts, radii, surfaces } from "@/lib/theme";
import DraggableList from "@/components/DraggableList";
import PickerModal from "@/components/CardDetail/PickerModal";

// Port of src/builder/FunnelBuilder.jsx — a funnel is an ordered sequence
// of existing page/form/quiz documents (not its own block list), so this
// is a dedicated, smaller editor, not DocumentBuilderView in another mode.
// Step reorder uses DraggableList (real drag), matching the user's Phase 11
// scope choice for the block list too.

const STATUS_LABEL: Record<string, string> = { draft: "rascunho", published: "publicado", archived: "arquivado" };
const KIND_LABEL: Record<string, string> = { page: "página", form: "formulário", quiz: "quiz" };
const CANDIDATE_KINDS = [
  { kind: "page", label: "Páginas" },
  { kind: "form", label: "Formulários" },
  { kind: "quiz", label: "Quizzes" },
];

type BranchRule = { default: number | null; branches: { tier: string; goto: number }[] };
type Step = { documentId: string; nextRule: BranchRule | null; kind: string; slug: string; title: string; status: string };
type Funnel = { id: string; title: string; slug: string; status: string };
type CandidateGroup = { kind: string; label: string; documents: { id: string; kind: string; slug: string; title: string; status: string }[] };

export default function FunnelBuilderView() {
  const [funnels, setFunnels] = useState<Funnel[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [funnel, setFunnel] = useState<Funnel | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [candidates, setCandidates] = useState<CandidateGroup[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(() => {
    api.listBuilderDocuments("funnel").then(({ documents }: any) => setFunnels(documents)).catch((e: unknown) =>
      setError(e instanceof ApiError ? e.body?.error || "Falha ao carregar." : "Falha ao carregar.")
    );
  }, []);

  useFocusEffect(useCallback(() => { if (!activeId) load(); }, [load, activeId]));

  async function loadCandidates() {
    const results = await Promise.all(CANDIDATE_KINDS.map((c) => api.listBuilderDocuments(c.kind)));
    setCandidates(CANDIDATE_KINDS.map((c, i) => ({ kind: c.kind, label: c.label, documents: results[i].documents })));
  }

  async function openFunnel(id: string) {
    setError("");
    try {
      const [{ document }, { steps: rawSteps }] = await Promise.all([api.getBuilderDocument(id), api.listBuilderSteps(id)]);
      setFunnel(document);
      setSteps(
        rawSteps.map((s: any) => ({
          documentId: s.document_id,
          nextRule: s.next_rule,
          kind: s.kind,
          slug: s.slug,
          title: s.title,
          status: s.status,
        }))
      );
      setActiveId(id);
      loadCandidates();
    } catch (e) {
      setError(e instanceof ApiError ? e.body?.error || "Falha ao abrir." : "Falha ao abrir.");
    }
  }

  function closeFunnel() {
    setActiveId(null);
    setFunnel(null);
    setSteps([]);
    setCandidates(null);
    load();
  }

  async function createFunnel() {
    if (!newTitle.trim()) return;
    setCreating(true);
    setError("");
    try {
      const { document } = await api.createBuilderDocument({ kind: "funnel", title: newTitle.trim() });
      setNewTitle("");
      await openFunnel(document.id);
    } catch (e) {
      setError(e instanceof ApiError ? e.body?.error || "Falha ao criar." : "Falha ao criar.");
    } finally {
      setCreating(false);
    }
  }

  function confirmRemove(id: string) {
    Alert.alert("Excluir funil", "Excluir este funil?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Excluir", style: "destructive", onPress: () => remove(id) },
    ]);
  }

  async function remove(id: string) {
    try {
      await api.deleteBuilderDocument(id);
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.body?.error || "Falha ao excluir." : "Falha ao excluir.");
    }
  }

  function persistSteps(nextSteps: Step[]) {
    setSteps(nextSteps);
    setSaving(true);
    setError("");
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => flushSteps(nextSteps), 400);
  }

  async function flushSteps(nextSteps: Step[]) {
    saveTimerRef.current = null;
    if (!activeId) return;
    try {
      await api.setBuilderSteps(activeId, nextSteps.map((s) => ({ documentId: s.documentId, nextRule: s.nextRule })));
    } catch (e) {
      setError(e instanceof ApiError ? e.body?.error || "Falha ao salvar etapas." : "Falha ao salvar etapas.");
    } finally {
      setSaving(false);
    }
  }

  async function flushPendingSteps() {
    if (!saveTimerRef.current) return;
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = null;
    await flushSteps(steps);
  }

  function addStep(d: { id: string; kind: string; slug: string; title: string; status: string }) {
    persistSteps([...steps, { documentId: d.id, nextRule: null, kind: d.kind, slug: d.slug, title: d.title, status: d.status }]);
  }
  function removeStep(i: number) {
    persistSteps(steps.filter((_, j) => j !== i));
  }
  function reorderSteps(next: Step[]) {
    persistSteps(next);
  }
  function updateNextRule(i: number, nextRule: BranchRule) {
    persistSteps(steps.map((s, j) => (j === i ? { ...s, nextRule } : s)));
  }

  async function saveTitle(title: string) {
    if (!activeId) return;
    setFunnel((f) => (f ? { ...f, title } : f));
    try {
      await api.updateBuilderDocument(activeId, { title });
    } catch (e) {
      setError(e instanceof ApiError ? e.body?.error || "Falha ao salvar." : "Falha ao salvar.");
    }
  }

  async function publish() {
    if (!activeId) return;
    await flushPendingSteps();
    setSaving(true);
    try {
      await api.publishBuilderDocument(activeId);
      setFunnel((f) => (f ? { ...f, status: "published" } : f));
    } catch (e) {
      setError(e instanceof ApiError ? e.body?.error || "Falha ao publicar." : "Falha ao publicar.");
    } finally {
      setSaving(false);
    }
  }

  async function archive() {
    if (!activeId) return;
    setSaving(true);
    try {
      await api.archiveBuilderDocument(activeId);
      setFunnel((f) => (f ? { ...f, status: "archived" } : f));
    } catch (e) {
      setError(e instanceof ApiError ? e.body?.error || "Falha ao arquivar." : "Falha ao arquivar.");
    } finally {
      setSaving(false);
    }
  }

  // ── list view ────────────────────────────────────────────────────────
  if (!activeId || !funnel) {
    return (
      <View style={{ flex: 1 }}>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <View style={styles.newRow}>
          <TextInput
            value={newTitle}
            onChangeText={setNewTitle}
            placeholder="Título do novo funil…"
            placeholderTextColor={colors.stone400}
            style={[styles.input, { flex: 1, marginBottom: 0 }]}
          />
          <Pressable onPress={createFunnel} disabled={creating || !newTitle.trim()} style={[styles.primaryBtnSm, (creating || !newTitle.trim()) && { opacity: 0.5 }]}>
            {creating ? <ActivityIndicator size="small" color={colors.clay} /> : <Plus size={13} color={colors.clay} />}
            <Text style={styles.primaryBtnSmText}>novo</Text>
          </Pressable>
        </View>

        {funnels === null ? (
          <ActivityIndicator style={{ marginTop: 20 }} color={colors.action} />
        ) : funnels.length === 0 ? (
          <Text style={styles.emptyText}>Nenhum funil criado ainda.</Text>
        ) : (
          <View style={{ gap: 8 }}>
            {funnels.map((f) => (
              <View key={f.id} style={styles.docRow}>
                <Pressable onPress={() => openFunnel(f.id)} style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.docTitle} numberOfLines={1}>{f.title}</Text>
                  <Text style={styles.docMeta}>/{f.slug} · {STATUS_LABEL[f.status]}</Text>
                </Pressable>
                <Pressable onPress={() => confirmRemove(f.id)} style={{ padding: 8 }}>
                  <Trash2 size={14} color={colors.stone400} />
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  }

  // ── edit view ────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1 }}>
      <View style={styles.editHead}>
        <Pressable onPress={closeFunnel} style={{ padding: 4 }}>
          <ChevronLeft size={18} color={colors.stone500} />
        </Pressable>
        <TextInput
          value={funnel.title}
          onChangeText={(v) => setFunnel({ ...funnel, title: v })}
          onBlur={() => saveTitle(funnel.title)}
          style={styles.titleInput}
        />
        <Text style={styles.statusText}>{STATUS_LABEL[funnel.status]}{saving ? " · salvando…" : ""}</Text>
      </View>
      <View style={styles.publishRow}>
        {funnel.status !== "published" ? (
          <Pressable onPress={publish} style={styles.primaryBtnSm}>
            <Text style={styles.primaryBtnSmText}>publicar</Text>
          </Pressable>
        ) : (
          <Pressable onPress={archive} style={styles.outlineBtn}>
            <Text style={styles.outlineBtnText}>arquivar</Text>
          </Pressable>
        )}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <Text style={styles.sectionLabel}>Etapas</Text>
        {steps.length === 0 ? (
          <Text style={styles.emptyText}>Nenhuma etapa ainda — adicione uma abaixo.</Text>
        ) : (
          <DraggableList
            data={steps}
            keyExtractor={(s, i) => `${s.documentId}-${i}`}
            rowHeight={64}
            onReorder={reorderSteps}
            renderItem={(s, i) => (
              <View style={styles.stepCard}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.stepMeta}>etapa {i + 1} · {KIND_LABEL[s.kind]} · {STATUS_LABEL[s.status] || s.status}</Text>
                  <Text style={styles.docTitle} numberOfLines={1}>{s.title}</Text>
                </View>
                <Pressable onPress={() => removeStep(i)} style={{ padding: 6 }}>
                  <Trash2 size={13} color={colors.stone400} />
                </Pressable>
              </View>
            )}
          />
        )}

        {steps.map((s, i) =>
          i < steps.length - 1 ? (
            <BranchEditor key={`branch-${s.documentId}-${i}`} step={s} stepIndex={i} totalSteps={steps.length} onChange={(rule) => updateNextRule(i, rule)} />
          ) : null
        )}

        <Text style={styles.sectionLabel}>Adicionar etapa</Text>
        {!candidates ? (
          <ActivityIndicator color={colors.action} />
        ) : (
          <View style={{ gap: 12 }}>
            {candidates.map((group) => (
              <View key={group.kind}>
                <Text style={styles.groupLabel}>{group.label}</Text>
                {group.documents.length === 0 ? (
                  <Text style={styles.emptyTextSm}>nenhum documento ainda</Text>
                ) : (
                  <View style={styles.addGrid}>
                    {group.documents.map((d) => (
                      <Pressable key={d.id} onPress={() => addStep(d)} style={styles.addChip}>
                        <Plus size={11} color={colors.stone500} />
                        <Text style={styles.addChipText}>{d.title} ({STATUS_LABEL[d.status]})</Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// Only quiz steps branch (tier → different next step); every other step
// falls through to "default". Targets are step indexes into this same
// funnel's own steps array; no target = funnel ends here.
function BranchEditor({ step, stepIndex, totalSteps, onChange }: { step: Step; stepIndex: number; totalSteps: number; onChange: (rule: BranchRule) => void }) {
  const rule: BranchRule = step.nextRule || { default: stepIndex + 1, branches: [] };
  const [defaultPickerOpen, setDefaultPickerOpen] = useState(false);
  const [branchPickerIndex, setBranchPickerIndex] = useState<number | null>(null);

  function set(patch: Partial<BranchRule>) {
    onChange({ ...rule, ...patch });
  }
  function setBranch(i: number, patch: Partial<{ tier: string; goto: number }>) {
    set({ branches: rule.branches.map((b, j) => (j === i ? { ...b, ...patch } : b)) });
  }
  function addBranch() {
    set({ branches: [...(rule.branches || []), { tier: "", goto: stepIndex + 1 }] });
  }
  function removeBranch(i: number) {
    set({ branches: rule.branches.filter((_, j) => j !== i) });
  }

  const stepOptions = Array.from({ length: totalSteps }, (_, i) => i).filter((i) => i !== stepIndex);
  const stepPickerOptions = [
    { value: "", label: "fim do funil" },
    ...stepOptions.map((i2) => ({ value: String(i2), label: `etapa ${i2 + 1}` })),
  ];

  return (
    <View style={styles.branchBox}>
      {step.kind === "quiz" &&
        rule.branches.map((b, i) => (
          <View key={i} style={styles.branchRow}>
            <Text style={styles.branchText}>se tier =</Text>
            <TextInput
              value={b.tier}
              onChangeText={(v) => setBranch(i, { tier: v })}
              placeholder="hot"
              placeholderTextColor={colors.stone400}
              style={styles.branchInput}
            />
            <Text style={styles.branchText}>vai para</Text>
            <Pressable onPress={() => setBranchPickerIndex(i)} style={styles.branchSelect}>
              <Text style={styles.branchSelectText}>etapa {b.goto + 1}</Text>
              <ChevronDown size={11} color={colors.stone500} />
            </Pressable>
            <PickerModal
              visible={branchPickerIndex === i}
              title="Vai para"
              options={stepOptions.map((i2) => ({ value: String(i2), label: `etapa ${i2 + 1}` }))}
              selected={[String(b.goto)]}
              onToggle={(v) => { setBranch(i, { goto: Number(v) }); setBranchPickerIndex(null); }}
              onClose={() => setBranchPickerIndex(null)}
            />
            <Pressable onPress={() => removeBranch(i)} hitSlop={8}>
              <Trash2 size={12} color={colors.stone400} />
            </Pressable>
          </View>
        ))}
      {step.kind === "quiz" && (
        <Pressable onPress={addBranch} style={styles.addLink}>
          <Plus size={11} color={colors.action} />
          <Text style={styles.addLinkText}>regra de tier</Text>
        </Pressable>
      )}
      <View style={styles.branchRow}>
        <Text style={styles.branchText}>senão vai para</Text>
        <Pressable onPress={() => setDefaultPickerOpen(true)} style={styles.branchSelect}>
          <Text style={styles.branchSelectText}>{rule.default == null ? "fim do funil" : `etapa ${rule.default + 1}`}</Text>
          <ChevronDown size={11} color={colors.stone500} />
        </Pressable>
        <PickerModal
          visible={defaultPickerOpen}
          title="Senão vai para"
          options={stepPickerOptions}
          selected={[rule.default == null ? "" : String(rule.default)]}
          onToggle={(v) => { set({ default: v === "" ? null : Number(v) }); setDefaultPickerOpen(false); }}
          onClose={() => setDefaultPickerOpen(false)}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  error: { fontFamily: fonts.mono, fontSize: 11, color: colors.danger, marginBottom: 8 },
  emptyText: { fontFamily: fonts.sans, fontSize: 13, color: colors.stone500 },
  emptyTextSm: { fontFamily: fonts.sans, fontSize: 11.5, color: colors.stone400 },
  newRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
  input: {
    borderWidth: 1, borderColor: "rgba(20,22,24,0.15)", backgroundColor: colors.paper, borderRadius: radii.md,
    paddingHorizontal: 10, paddingVertical: 9, fontSize: 13, color: colors.ink, fontFamily: fonts.sans, marginBottom: 8,
  },
  primaryBtnSm: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.action, borderRadius: radii.md, paddingHorizontal: 12, paddingVertical: 9 },
  primaryBtnSmText: { fontFamily: fonts.sansBold, fontSize: 11.5, color: colors.clay },
  outlineBtn: { borderWidth: 1, borderColor: "rgba(20,22,24,0.15)", borderRadius: radii.md, paddingHorizontal: 12, paddingVertical: 9 },
  outlineBtnText: { fontFamily: fonts.mono, fontSize: 11, color: colors.stone500 },

  docRow: { flexDirection: "row", alignItems: "center", gap: 8, ...surfaces[3], borderRadius: radii.lg, paddingHorizontal: 14, paddingVertical: 12 },
  docTitle: { fontFamily: fonts.sansSemiBold, fontSize: 14, color: colors.ink },
  docMeta: { fontFamily: fonts.mono, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5, color: colors.stone400, marginTop: 2 },

  editHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  titleInput: { flex: 1, fontFamily: fonts.sansSemiBold, fontSize: 15, color: colors.ink, minWidth: 0 },
  statusText: { fontFamily: fonts.mono, fontSize: 9.5, textTransform: "uppercase", letterSpacing: 0.5, color: colors.stone400 },
  publishRow: { flexDirection: "row", marginBottom: 14 },

  sectionLabel: { fontFamily: fonts.mono, fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: colors.stone400, marginTop: 14, marginBottom: 8 },
  groupLabel: { fontFamily: fonts.mono, fontSize: 10, color: colors.stone400, marginBottom: 4 },
  stepCard: { flexDirection: "row", alignItems: "center", gap: 8, ...surfaces[3], borderRadius: radii.lg, paddingHorizontal: 14, paddingVertical: 12 },
  stepMeta: { fontFamily: fonts.mono, fontSize: 9.5, textTransform: "uppercase", letterSpacing: 0.5, color: colors.stone400, marginBottom: 2 },

  addGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  addChip: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderColor: "rgba(20,22,24,0.12)", borderRadius: radii.md, paddingHorizontal: 10, paddingVertical: 7 },
  addChipText: { fontFamily: fonts.mono, fontSize: 10.5, color: colors.stone500 },
  addLink: { flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start", marginTop: 4 },
  addLinkText: { fontFamily: fonts.monoMedium, fontSize: 11, color: colors.action },

  branchBox: { marginTop: -4, marginBottom: 10, paddingLeft: 14, gap: 8 },
  branchRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  branchText: { fontFamily: fonts.mono, fontSize: 10.5, color: colors.stone500 },
  branchInput: { width: 72, borderWidth: 1, borderColor: "rgba(20,22,24,0.15)", borderRadius: radii.sm, paddingHorizontal: 8, paddingVertical: 5, fontFamily: fonts.mono, fontSize: 10.5, color: colors.ink },
  branchSelect: { flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderColor: "rgba(20,22,24,0.15)", borderRadius: radii.sm, paddingHorizontal: 8, paddingVertical: 5 },
  branchSelectText: { fontFamily: fonts.mono, fontSize: 10.5, color: colors.ink },
});
