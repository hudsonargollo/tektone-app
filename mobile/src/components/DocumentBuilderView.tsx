import { useCallback, useRef, useState } from "react";
import { View, Text, TextInput, Pressable, Modal, ScrollView, ActivityIndicator, Alert, Share, StyleSheet } from "react-native";
import { useFocusEffect } from "expo-router";
import { Plus, Trash2, Copy, ClipboardPaste, X, ChevronLeft } from "lucide-react-native";
import { api, ApiError } from "@/lib/api";
import { colors, fonts, radii, surfaces } from "@/lib/theme";
import { BLOCK_LIST, BLOCK_REGISTRY, ALLOWED_BLOCKS_BY_KIND, createBlock, uid, type BlockModule } from "@/lib/blockRegistry";
import { buildAiPrompt, applyAiJson } from "@/lib/aiJson";
import DraggableList from "@/components/DraggableList";
import BlockPropertyPanel from "@/components/BlockPropertyPanel";
import RichtextEditor from "@/components/RichtextEditor";

// Port of src/builder/DocumentBuilder.jsx — generic list+detail editor for
// page/form/quiz documents, reused across all three kinds exactly like web
// does. Phase 11 of ~/.claude/plans/tektone-mobile-parity.md — the user
// explicitly chose the full drag-and-drop option over the plan's cheaper
// "manage & review, chevron-reorder-only" recommendation, so block
// reordering here uses DraggableList (real drag), not up/down buttons.

const STATUS_LABEL: Record<string, string> = { draft: "rascunho", published: "publicado", archived: "arquivado" };

type Block = { id: string; type: string; props: Record<string, any> };
type Doc = { id: string; kind: string; slug: string; title: string; status: string; blocks: Block[] };

export default function DocumentBuilderView({ kind, newPlaceholder, emptyText }: { kind: string; newPlaceholder: string; emptyText: string }) {
  const [docs, setDocs] = useState<Doc[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [doc, setDoc] = useState<Doc | null>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [aiModal, setAiModal] = useState<{ mode: "copy" | "paste" } | null>(null);
  const [aiText, setAiText] = useState("");
  const [aiError, setAiError] = useState("");
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPatchRef = useRef<Record<string, any>>({});

  const load = useCallback(() => {
    api.listBuilderDocuments(kind).then(({ documents }: any) => setDocs(documents)).catch((e: unknown) =>
      setError(e instanceof ApiError ? e.body?.error || "Falha ao carregar." : "Falha ao carregar.")
    );
  }, [kind]);

  useFocusEffect(useCallback(() => { if (!activeId) load(); }, [load, activeId]));

  async function openDoc(id: string) {
    setError("");
    try {
      const { document } = await api.getBuilderDocument(id);
      setDoc(document);
      setActiveId(id);
      setSelectedBlockId(document.blocks[0]?.id || null);
    } catch (e) {
      setError(e instanceof ApiError ? e.body?.error || "Falha ao abrir." : "Falha ao abrir.");
    }
  }

  async function closeDoc() {
    await flushPendingSave();
    setActiveId(null);
    setDoc(null);
    setSelectedBlockId(null);
    load();
  }

  async function createDoc() {
    if (!newTitle.trim()) return;
    setCreating(true);
    setError("");
    try {
      const { document } = await api.createBuilderDocument({ kind, title: newTitle.trim() });
      setNewTitle("");
      await openDoc(document.id);
    } catch (e) {
      setError(e instanceof ApiError ? e.body?.error || "Falha ao criar." : "Falha ao criar.");
    } finally {
      setCreating(false);
    }
  }

  // Debounced exactly like web — PropertyPanel/DraggableList fire a change
  // per interaction, and an undebounced PATCH-per-change lets responses
  // race and arrive out of order. Only the last change in a burst is ever
  // sent, carrying the fully merged patch since the previous flush.
  function saveDoc(patch: Partial<Doc>) {
    if (!doc) return;
    const next = { ...doc, ...patch } as Doc;
    setDoc(next);
    pendingPatchRef.current = { ...pendingPatchRef.current, ...patch };
    setSaving(true);
    setError("");
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => flushSave(next), 500);
  }

  async function flushSave(next: Doc | null) {
    saveTimerRef.current = null;
    const patch = pendingPatchRef.current;
    pendingPatchRef.current = {};
    if (!next || !Object.keys(patch).length) {
      setSaving(false);
      return;
    }
    try {
      const body: Record<string, any> = {};
      if ("title" in patch) body.title = next.title;
      if ("slug" in patch) body.slug = next.slug;
      if ("blocks" in patch) body.blocks = next.blocks;
      await api.updateBuilderDocument(next.id, body);
    } catch (e) {
      setError(e instanceof ApiError ? e.body?.error || "Falha ao salvar." : "Falha ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function flushPendingSave() {
    if (!saveTimerRef.current) return;
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = null;
    await flushSave(doc);
  }

  async function publish() {
    if (!doc) return;
    await flushPendingSave();
    setSaving(true);
    try {
      await api.publishBuilderDocument(doc.id);
      setDoc((d) => (d ? { ...d, status: "published" } : d));
    } catch (e) {
      setError(e instanceof ApiError ? e.body?.error || "Falha ao publicar." : "Falha ao publicar.");
    } finally {
      setSaving(false);
    }
  }

  async function archive() {
    if (!doc) return;
    setSaving(true);
    try {
      await api.archiveBuilderDocument(doc.id);
      setDoc((d) => (d ? { ...d, status: "archived" } : d));
    } catch (e) {
      setError(e instanceof ApiError ? e.body?.error || "Falha ao arquivar." : "Falha ao arquivar.");
    } finally {
      setSaving(false);
    }
  }

  function confirmRemove(id: string) {
    Alert.alert("Excluir documento", "Excluir este documento?", [
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

  function addBlock(type: string) {
    if (!doc) return;
    const block = createBlock(type);
    setSelectedBlockId(block.id);
    saveDoc({ blocks: [...doc.blocks, block] });
  }

  function updateBlockProps(blockId: string, props: Record<string, any>) {
    if (!doc) return;
    saveDoc({ blocks: doc.blocks.map((b) => (b.id === blockId ? { ...b, props } : b)) });
  }

  function reorderBlocks(next: Block[]) {
    saveDoc({ blocks: next });
  }

  function confirmRemoveBlock(blockId: string) {
    Alert.alert("Remover bloco", "Remover este bloco?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Remover", style: "destructive", onPress: () => removeBlock(blockId) },
    ]);
  }

  function removeBlock(blockId: string) {
    if (!doc) return;
    const blocks = doc.blocks.filter((b) => b.id !== blockId);
    if (selectedBlockId === blockId) setSelectedBlockId(blocks[0]?.id || null);
    saveDoc({ blocks });
  }

  function duplicateBlock(blockId: string) {
    if (!doc) return;
    const i = doc.blocks.findIndex((b) => b.id === blockId);
    if (i < 0) return;
    const copy = { ...doc.blocks[i], id: uid(), props: JSON.parse(JSON.stringify(doc.blocks[i].props)) };
    setSelectedBlockId(copy.id);
    saveDoc({ blocks: [...doc.blocks.slice(0, i + 1), copy, ...doc.blocks.slice(i + 1)] });
  }

  function openAiModal(mode: "copy" | "paste", mod: BlockModule) {
    setAiError("");
    setAiText(mode === "copy" ? buildAiPrompt(mod) : "");
    setAiModal({ mode });
  }

  async function copyPrompt() {
    try {
      await Share.share({ message: aiText });
    } catch {
      /* user dismissed the share sheet — not an error */
    }
  }

  function applyAi(selectedBlock: Block, selectedMod: BlockModule) {
    try {
      const patch = applyAiJson(selectedMod, aiText);
      updateBlockProps(selectedBlock.id, { ...selectedBlock.props, ...patch });
      setAiModal(null);
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "JSON inválido.");
    }
  }

  // ── list view ────────────────────────────────────────────────────────
  if (!activeId || !doc) {
    return (
      <View style={{ flex: 1 }}>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <View style={styles.newRow}>
          <TextInput
            value={newTitle}
            onChangeText={setNewTitle}
            placeholder={newPlaceholder}
            placeholderTextColor={colors.stone400}
            style={[styles.input, { flex: 1, marginBottom: 0 }]}
          />
          <Pressable onPress={createDoc} disabled={creating || !newTitle.trim()} style={[styles.primaryBtnSm, (creating || !newTitle.trim()) && { opacity: 0.5 }]}>
            {creating ? <ActivityIndicator size="small" color={colors.clay} /> : <Plus size={13} color={colors.clay} />}
            <Text style={styles.primaryBtnSmText}>novo</Text>
          </Pressable>
        </View>

        {docs === null ? (
          <ActivityIndicator style={{ marginTop: 20 }} color={colors.action} />
        ) : docs.length === 0 ? (
          <Text style={styles.emptyText}>{emptyText}</Text>
        ) : (
          <View style={{ gap: 8 }}>
            {docs.map((d) => (
              <View key={d.id} style={styles.docRow}>
                <Pressable onPress={() => openDoc(d.id)} style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.docTitle} numberOfLines={1}>{d.title}</Text>
                  <Text style={styles.docMeta}>/{d.slug} · {STATUS_LABEL[d.status]}</Text>
                </Pressable>
                <Pressable onPress={() => confirmRemove(d.id)} style={{ padding: 8 }}>
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
  const selectedBlock = doc.blocks.find((b) => b.id === selectedBlockId) || null;
  const selectedMod = selectedBlock ? BLOCK_REGISTRY[selectedBlock.type] : null;
  const allowed = BLOCK_LIST.filter((b) => !ALLOWED_BLOCKS_BY_KIND[kind] || ALLOWED_BLOCKS_BY_KIND[kind].includes(b.key));

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.editHead}>
        <Pressable onPress={closeDoc} style={{ padding: 4 }}>
          <ChevronLeft size={18} color={colors.stone500} />
        </Pressable>
        <TextInput
          value={doc.title}
          onChangeText={(v) => setDoc({ ...doc, title: v })}
          onBlur={() => saveDoc({ title: doc.title })}
          style={styles.titleInput}
        />
        <Text style={styles.statusText}>{STATUS_LABEL[doc.status]}{saving ? " · salvando…" : ""}</Text>
      </View>
      <View style={styles.publishRow}>
        {doc.status !== "published" ? (
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
        <Text style={styles.sectionLabel}>Blocos</Text>
        {doc.blocks.length === 0 ? (
          <Text style={styles.emptyText}>Adicione um bloco para começar.</Text>
        ) : (
          <DraggableList
            data={doc.blocks}
            keyExtractor={(b) => b.id}
            rowHeight={52}
            onReorder={reorderBlocks}
            renderItem={(b) => {
              const mod = BLOCK_REGISTRY[b.type];
              return (
                <Pressable onPress={() => setSelectedBlockId(b.id)} style={[styles.blockRow, b.id === selectedBlockId && styles.blockRowActive]}>
                  <Text style={[styles.blockRowText, b.id === selectedBlockId && styles.blockRowTextActive]} numberOfLines={1}>
                    {mod?.label || b.type}
                  </Text>
                  <Pressable onPress={() => duplicateBlock(b.id)} hitSlop={8} style={{ padding: 4 }}>
                    <Copy size={13} color={colors.stone400} />
                  </Pressable>
                  <Pressable onPress={() => confirmRemoveBlock(b.id)} hitSlop={8} style={{ padding: 4 }}>
                    <Trash2 size={13} color={colors.stone400} />
                  </Pressable>
                </Pressable>
              );
            }}
          />
        )}

        <Text style={styles.sectionLabel}>Adicionar bloco</Text>
        <View style={styles.addGrid}>
          {allowed.map((b) => (
            <Pressable key={b.key} onPress={() => addBlock(b.key)} style={styles.addChip}>
              <Plus size={11} color={colors.stone500} />
              <Text style={styles.addChipText}>{b.label}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <Modal visible={!!selectedBlock} animationType="slide" onRequestClose={() => setSelectedBlockId(null)}>
        {selectedBlock && selectedMod ? (
          <View style={styles.blockModal}>
            <View style={styles.blockModalHead}>
              <Pressable onPress={() => setSelectedBlockId(null)} style={{ padding: 4 }}>
                <X size={18} color={colors.stone500} />
              </Pressable>
              <Text style={styles.blockModalTitle}>{selectedMod.label}</Text>
              {selectedBlock.type !== "richtext" ? (
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Pressable onPress={() => openAiModal("copy", selectedMod)} hitSlop={8}>
                    <Copy size={15} color={colors.stone400} />
                  </Pressable>
                  <Pressable onPress={() => openAiModal("paste", selectedMod)} hitSlop={8}>
                    <ClipboardPaste size={15} color={colors.stone400} />
                  </Pressable>
                </View>
              ) : (
                <View style={{ width: 15 }} />
              )}
            </View>
            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
              {selectedBlock.type === "richtext" ? (
                <RichtextEditor
                  value={selectedBlock.props.markdown}
                  onChange={(markdown) => updateBlockProps(selectedBlock.id, { markdown })}
                />
              ) : (
                <BlockPropertyPanel
                  schema={selectedMod.schema}
                  values={selectedBlock.props}
                  onChange={(props) => updateBlockProps(selectedBlock.id, props)}
                />
              )}
            </ScrollView>
          </View>
        ) : null}
      </Modal>

      <Modal visible={!!aiModal} transparent animationType="fade" onRequestClose={() => setAiModal(null)}>
        <View style={styles.aiBackdrop}>
          <View style={styles.aiSheet}>
            <Text style={styles.aiTitle}>{aiModal?.mode === "copy" ? "Copiar prompt para a IA" : "Colar resposta da IA"}</Text>
            <TextInput
              value={aiText}
              onChangeText={setAiText}
              multiline
              numberOfLines={10}
              placeholder={aiModal?.mode === "paste" ? "Cole aqui o JSON retornado pela IA…" : undefined}
              placeholderTextColor={colors.stone400}
              style={[styles.input, { minHeight: 180, textAlignVertical: "top", fontFamily: fonts.mono, fontSize: 11 }]}
            />
            {aiError ? <Text style={styles.error}>{aiError}</Text> : null}
            <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
              <Pressable onPress={() => setAiModal(null)} style={styles.outlineBtn}>
                <Text style={styles.outlineBtnText}>fechar</Text>
              </Pressable>
              {aiModal?.mode === "copy" ? (
                <Pressable onPress={copyPrompt} style={styles.primaryBtnSm}>
                  <Text style={styles.primaryBtnSmText}>compartilhar</Text>
                </Pressable>
              ) : (
                <Pressable onPress={() => selectedBlock && selectedMod && applyAi(selectedBlock, selectedMod)} style={styles.primaryBtnSm}>
                  <Text style={styles.primaryBtnSmText}>aplicar</Text>
                </Pressable>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  error: { fontFamily: fonts.mono, fontSize: 11, color: colors.danger, marginBottom: 8 },
  emptyText: { fontFamily: fonts.sans, fontSize: 13, color: colors.stone500 },
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
  blockRow: { flexDirection: "row", alignItems: "center", gap: 8, ...surfaces[3], borderRadius: radii.md, paddingHorizontal: 12, paddingVertical: 12 },
  blockRowActive: { backgroundColor: `${colors.action}12`, borderColor: `${colors.action}55` },
  blockRowText: { flex: 1, fontFamily: fonts.sans, fontSize: 13, color: colors.ink, minWidth: 0 },
  blockRowTextActive: { color: colors.action, fontFamily: fonts.sansSemiBold },

  addGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  addChip: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderColor: "rgba(20,22,24,0.12)", borderRadius: radii.md, paddingHorizontal: 10, paddingVertical: 7 },
  addChipText: { fontFamily: fonts.mono, fontSize: 10.5, color: colors.stone500 },

  blockModal: { flex: 1, backgroundColor: colors.clay },
  blockModalHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 52, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "rgba(20,22,24,0.1)" },
  blockModalTitle: { fontFamily: fonts.mono, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.8, color: colors.stone500 },

  aiBackdrop: { flex: 1, backgroundColor: "rgba(20,22,24,0.5)", justifyContent: "center", padding: 20 },
  aiSheet: { backgroundColor: colors.paper, borderRadius: radii.xl, padding: 16 },
  aiTitle: { fontFamily: fonts.sansSemiBold, fontSize: 14, color: colors.ink, marginBottom: 10 },
});
