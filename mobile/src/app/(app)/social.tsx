import { useCallback, useMemo, useState } from "react";
import { View, Text, TextInput, Pressable, Image, ScrollView, ActivityIndicator, Alert, StyleSheet } from "react-native";
import { useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { File, Paths } from "expo-file-system";
import * as MediaLibrary from "expo-media-library";
import {
  Camera,
  Sparkles,
  Plus,
  X,
  RefreshCw,
  Check,
  Download,
  Trash2,
  ChevronDown,
} from "lucide-react-native";
import { api, ApiError, API_BASE } from "@/lib/api";
import { colors, fonts, radii, surfaces } from "@/lib/theme";
import PickerModal, { type PickerOption } from "@/components/CardDetail/PickerModal";

// Port of src/components/SocialPostGenerator.jsx — Phase 10 of
// ~/.claude/plans/tektone-mobile-parity.md. Compositing (caption band +
// Tektone watermark) moved server-side (worker/lib/socialCompositor.js,
// see that module's docstring for the visual-fidelity caveats vs. web's
// old canvas rendering) specifically so mobile doesn't need a heavy
// react-native-skia dependency — this screen just displays/downloads the
// finished PNG the server already composited, identically to web.
// "Export" here means save to the camera roll (expo-media-library)
// instead of web's browser download.

type SocialPost = {
  id: string;
  aspectRatio?: string;
  aspect_ratio?: string;
  post_format?: string;
  masterPrompt?: string;
  caption?: string | null;
  group_id?: string | null;
  slide_index?: number | null;
  status?: "draft" | "exported";
};

const OBJECTIVES: PickerOption[] = [
  { value: "autoridade", label: "Autoridade" },
  { value: "conversao", label: "Conversão" },
  { value: "bastidores", label: "Bastidores" },
];

// Enforced list (PRD §5) — same as web, not freeform, so tone stays inside
// the Mineral palette.
const VISUAL_TONES: PickerOption[] = [
  { value: "Mineral Black + Ivory Clay, alto contraste", label: "Mineral Black + Ivory Clay, alto contraste" },
  { value: "Mineral Green como cor primária", label: "Mineral Green como cor primária" },
  { value: "Sand & Ivory, tom quieto e claro", label: "Sand & Ivory, tom quieto e claro" },
  { value: "Invertido sobre Mineral Green", label: "Invertido sobre Mineral Green" },
  { value: "Invertido sobre Mineral Black", label: "Invertido sobre Mineral Black" },
];

const FORMATS: { value: "feed" | "carousel" | "story"; label: string }[] = [
  { value: "feed", label: "Feed" },
  { value: "carousel", label: "Carrossel" },
  { value: "story", label: "Story" },
];

const ASPECT_RATIOS: PickerOption[] = [
  { value: "1080x1080", label: "1080 × 1080 (quadrado)" },
  { value: "1080x1350", label: "1080 × 1350 (retrato)" },
];

const MIN_CAROUSEL_SLIDES = 2;
const MAX_CAROUSEL_SLIDES = 8;

function imageUrl(id: string, v?: number) {
  return `${API_BASE}/api/social/${id}/image${v ? `?v=${v}` : ""}`;
}

export default function SocialScreen() {
  const [postFormat, setPostFormat] = useState<"feed" | "carousel" | "story">("feed");
  const [objective, setObjective] = useState("autoridade");
  const [objectivePickerOpen, setObjectivePickerOpen] = useState(false);
  const [visualTone, setVisualTone] = useState(VISUAL_TONES[0].value);
  const [tonePickerOpen, setTonePickerOpen] = useState(false);
  const [aspectRatio, setAspectRatio] = useState("1080x1080");
  const [aspectPickerOpen, setAspectPickerOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [slides, setSlides] = useState(["", ""]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<SocialPost[]>([]);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [captions, setCaptions] = useState<Record<string, string>>({});
  const [captionVersion, setCaptionVersion] = useState<Record<string, number>>({});
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);

  const [gallery, setGallery] = useState<SocialPost[] | null>(null);
  const [galleryError, setGalleryError] = useState("");

  const loadGallery = useCallback(() => {
    api.listSocialPosts().then(({ posts }: any) => setGallery(posts)).catch(() =>
      setGalleryError("Não foi possível carregar a galeria.")
    );
  }, []);

  useFocusEffect(useCallback(() => { loadGallery(); }, [loadGallery]));

  function updateSlide(index: number, value: string) {
    setSlides((prev) => prev.map((s, i) => (i === index ? value : s)));
  }
  function addSlide() {
    setSlides((prev) => (prev.length >= MAX_CAROUSEL_SLIDES ? prev : [...prev, ""]));
  }
  function removeSlide(index: number) {
    setSlides((prev) => (prev.length <= MIN_CAROUSEL_SLIDES ? prev : prev.filter((_, i) => i !== index)));
  }

  const canSubmit = postFormat === "carousel" ? slides.every((s) => s.trim()) : subject.trim().length > 0;

  async function handleGenerate() {
    if (!canSubmit) return;
    const body: any = { objective, visualTone, postFormat };
    if (postFormat === "carousel") {
      body.subjects = slides.map((s) => s.trim());
      body.aspectRatio = aspectRatio;
    } else {
      body.subject = subject.trim();
      if (postFormat === "feed") body.aspectRatio = aspectRatio;
    }

    setGenerating(true);
    setError("");
    setResults([]);
    setGroupId(null);
    try {
      const { groupId: newGroupId, slides: newPosts } = await api.generateSocialPost(body);
      setResults(newPosts);
      setGroupId(newGroupId);
      setCaptions(Object.fromEntries(newPosts.map((p: SocialPost) => [p.id, p.caption || ""])));
      setCaptionVersion(Object.fromEntries(newPosts.map((p: SocialPost) => [p.id, 0])));
      loadGallery();
    } catch (e) {
      setError(e instanceof ApiError ? e.body?.error || "Falha ao gerar a imagem." : "Falha ao gerar a imagem.");
    } finally {
      setGenerating(false);
    }
  }

  function bumpVersion(id: string) {
    setCaptionVersion((prev) => ({ ...prev, [id]: (prev[id] || 0) + 1 }));
  }

  async function handleReroll(id: string) {
    setRegeneratingId(id);
    try {
      const { caption } = await api.regenerateSocialCaption(id);
      setCaptions((prev) => ({ ...prev, [id]: caption || "" }));
      bumpVersion(id);
    } catch {
      /* keep existing caption on failure */
    } finally {
      setRegeneratingId(null);
    }
  }

  async function handleSaveCaption(id: string) {
    setSavingId(id);
    try {
      await api.updateSocialCaption(id, captions[id] || "");
      bumpVersion(id);
    } catch {
      setError("Não foi possível salvar a legenda.");
    } finally {
      setSavingId(null);
    }
  }

  async function exportToCameraRoll(post: SocialPost, index: number) {
    setExportingId(post.id);
    setError("");
    try {
      const perm = await MediaLibrary.requestPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Permissão necessária", "Autorize o acesso à galeria para salvar o post.");
        return;
      }
      const filename = results.length > 1 ? `tektone-post-${post.id}-slide${index + 1}.png` : `tektone-post-${post.id}.png`;
      const dest = new File(Paths.cache, filename);
      const downloaded = await File.downloadFileAsync(imageUrl(post.id, captionVersion[post.id]), dest, { idempotent: true });
      await MediaLibrary.Asset.create(downloaded.uri);
    } catch {
      setError("Não foi possível salvar na galeria.");
    } finally {
      setExportingId(null);
    }
  }

  async function handleExportAll() {
    for (let i = 0; i < results.length; i++) {
      await exportToCameraRoll(results[i], i);
    }
    try {
      if (groupId) await api.exportSocialPostGroup(groupId);
      else if (results[0]) await api.exportSocialPost(results[0].id);
      loadGallery();
    } catch {
      /* export still succeeded locally even if the status flag fails */
    }
  }

  const galleryItems = useMemo(() => {
    if (!gallery) return null;
    const items: ({ kind: "carousel"; groupId: string; slides: SocialPost[] } | { kind: "single"; post: SocialPost })[] = [];
    const seenGroups = new Set<string>();
    for (const p of gallery) {
      if (p.post_format === "carousel" && p.group_id) {
        if (seenGroups.has(p.group_id)) continue;
        seenGroups.add(p.group_id);
        const groupSlides = gallery
          .filter((g) => g.group_id === p.group_id)
          .sort((a, b) => (a.slide_index ?? 0) - (b.slide_index ?? 0));
        items.push({ kind: "carousel", groupId: p.group_id, slides: groupSlides });
      } else {
        items.push({ kind: "single", post: p });
      }
    }
    return items;
  }, [gallery]);

  function confirmDelete(item: NonNullable<typeof galleryItems>[number]) {
    Alert.alert("Remover", "Remover este post do catálogo?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Remover", style: "destructive", onPress: () => deleteItem(item) },
    ]);
  }

  async function deleteItem(item: NonNullable<typeof galleryItems>[number]) {
    try {
      if (item.kind === "carousel") {
        await api.deleteSocialPostGroup(item.groupId);
        if (groupId === item.groupId) { setResults([]); setGroupId(null); }
      } else {
        await api.deleteSocialPost(item.post.id);
        if (results.some((r) => r.id === item.post.id)) { setResults([]); setGroupId(null); }
      }
      loadGallery();
    } catch {
      setGalleryError("Não foi possível remover.");
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <View style={styles.header}>
          <Camera size={16} color={colors.action} />
          <Text style={styles.title}>Posts</Text>
        </View>

        {/* ── Novo post ─────────────────────────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Novo post</Text>

          <Text style={styles.fieldLabel}>Formato</Text>
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
            {FORMATS.map((f) => (
              <Pressable
                key={f.value}
                onPress={() => setPostFormat(f.value)}
                style={[styles.formatBtn, postFormat === f.value && styles.formatBtnActive]}
              >
                <Text style={[styles.formatBtnText, postFormat === f.value && styles.formatBtnTextActive]}>{f.label}</Text>
              </Pressable>
            ))}
          </View>

          <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Objetivo</Text>
              <Pressable onPress={() => setObjectivePickerOpen(true)} style={styles.selectBtn}>
                <Text style={styles.selectBtnText} numberOfLines={1}>{OBJECTIVES.find((o) => o.value === objective)?.label}</Text>
                <ChevronDown size={13} color={colors.stone500} />
              </Pressable>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Tom visual</Text>
              <Pressable onPress={() => setTonePickerOpen(true)} style={styles.selectBtn}>
                <Text style={styles.selectBtnText} numberOfLines={1}>{visualTone}</Text>
                <ChevronDown size={13} color={colors.stone500} />
              </Pressable>
            </View>
          </View>

          {postFormat !== "carousel" && (
            <View style={{ marginBottom: 12 }}>
              <Text style={styles.fieldLabel}>Assunto / contexto</Text>
              <TextInput
                value={subject}
                onChangeText={setSubject}
                multiline
                numberOfLines={2}
                placeholder="ex: fundador em call de diagnóstico com cliente"
                placeholderTextColor={colors.stone400}
                style={[styles.input, { minHeight: 60, textAlignVertical: "top" }]}
              />
            </View>
          )}

          {postFormat === "story" ? (
            <View style={{ marginBottom: 12 }}>
              <Text style={styles.fieldLabel}>Proporção</Text>
              <Text style={styles.fixedRatio}>1080 × 1920 (fixo para story)</Text>
            </View>
          ) : (
            <View style={{ marginBottom: 12 }}>
              <Text style={styles.fieldLabel}>Proporção{postFormat === "carousel" ? " (todos os slides)" : ""}</Text>
              <Pressable onPress={() => setAspectPickerOpen(true)} style={styles.selectBtn}>
                <Text style={styles.selectBtnText}>{ASPECT_RATIOS.find((a) => a.value === aspectRatio)?.label}</Text>
                <ChevronDown size={13} color={colors.stone500} />
              </Pressable>
            </View>
          )}

          {postFormat === "carousel" && (
            <View style={{ marginBottom: 12 }}>
              <Text style={styles.fieldLabel}>Slides ({slides.length}/{MAX_CAROUSEL_SLIDES})</Text>
              {slides.map((s, i) => (
                <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 }}>
                  <Text style={styles.slideIndex}>{i + 1}.</Text>
                  <TextInput
                    value={s}
                    onChangeText={(v) => updateSlide(i, v)}
                    placeholder={`assunto/contexto do slide ${i + 1}`}
                    placeholderTextColor={colors.stone400}
                    style={[styles.input, { flex: 1, marginBottom: 0 }]}
                  />
                  <Pressable onPress={() => removeSlide(i)} disabled={slides.length <= MIN_CAROUSEL_SLIDES} hitSlop={8}>
                    <X size={16} color={slides.length <= MIN_CAROUSEL_SLIDES ? colors.stone400 : colors.danger} />
                  </Pressable>
                </View>
              ))}
              <Pressable onPress={addSlide} disabled={slides.length >= MAX_CAROUSEL_SLIDES} style={[styles.outlineBtn, slides.length >= MAX_CAROUSEL_SLIDES && { opacity: 0.4 }]}>
                <Plus size={12} color={colors.stone500} />
                <Text style={styles.outlineBtnText}>adicionar slide</Text>
              </Pressable>
            </View>
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable onPress={handleGenerate} disabled={generating || !canSubmit} style={[styles.primaryBtn, (generating || !canSubmit) && { opacity: 0.5 }]}>
            {generating ? <ActivityIndicator size="small" color={colors.clay} /> : <Sparkles size={14} color={colors.clay} />}
            <Text style={styles.primaryBtnText}>
              {generating ? (postFormat === "carousel" ? "gerando carrossel…" : "gerando… (até 30s)") : postFormat === "carousel" ? "gerar carrossel" : "gerar imagem"}
            </Text>
          </Pressable>
        </View>

        {/* ── Resultado ─────────────────────────────────────────────── */}
        {results.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>Resultado{results.length > 1 ? ` (${results.length} slides)` : ""}</Text>
            <View style={{ gap: 16 }}>
              {results.map((post, index) => (
                <View key={post.id}>
                  <Image
                    source={{ uri: imageUrl(post.id, captionVersion[post.id]) }}
                    style={[styles.resultImage, { aspectRatio: aspectRatioNum(post.aspectRatio) }]}
                    resizeMode="cover"
                  />
                  <View style={{ marginTop: 8 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <Text style={styles.fieldLabel}>Legenda</Text>
                      <Pressable onPress={() => handleReroll(post.id)} disabled={regeneratingId === post.id} hitSlop={6}>
                        <RefreshCw size={13} color={colors.stone400} />
                      </Pressable>
                    </View>
                    <View style={{ flexDirection: "row", gap: 6 }}>
                      <TextInput
                        value={captions[post.id] || ""}
                        onChangeText={(v) => setCaptions((prev) => ({ ...prev, [post.id]: v }))}
                        placeholder="sem legenda"
                        placeholderTextColor={colors.stone400}
                        maxLength={90}
                        style={[styles.input, { flex: 1, marginBottom: 0 }]}
                      />
                      <Pressable onPress={() => handleSaveCaption(post.id)} disabled={savingId === post.id} style={styles.outlineBtn}>
                        {savingId === post.id ? <ActivityIndicator size="small" color={colors.stone500} /> : <Check size={13} color={colors.stone500} />}
                        <Text style={styles.outlineBtnText}>salvar</Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              ))}
            </View>
            <Pressable
              onPress={handleExportAll}
              disabled={exportingId !== null}
              style={[styles.outlineBtn, { marginTop: 14, alignSelf: "flex-start" }, exportingId !== null && { opacity: 0.5 }]}
            >
              {exportingId !== null ? <ActivityIndicator size="small" color={colors.stone500} /> : <Download size={13} color={colors.stone500} />}
              <Text style={styles.outlineBtnText}>{results.length > 1 ? "exportar todos" : "exportar"}</Text>
            </Pressable>
          </View>
        )}

        {/* ── Galeria ───────────────────────────────────────────────── */}
        <Text style={[styles.sectionLabel, { marginTop: 4 }]}>Galeria</Text>
        {galleryError ? <Text style={styles.error}>{galleryError}</Text> : null}
        {galleryItems === null ? (
          <ActivityIndicator style={{ marginTop: 16 }} color={colors.action} />
        ) : galleryItems.length === 0 ? (
          <Text style={styles.emptyText}>Nenhum post gerado ainda.</Text>
        ) : (
          <View style={styles.galleryGrid}>
            {galleryItems.map((item) => {
              const cover = item.kind === "carousel" ? item.slides[0] : item.post;
              const status = item.kind === "carousel" ? (item.slides.every((s) => s.status === "exported") ? "exported" : "draft") : item.post.status;
              return (
                <View key={item.kind === "carousel" ? item.groupId : item.post.id} style={styles.galleryTile}>
                  <Image source={{ uri: imageUrl(cover.id) }} style={[StyleSheet.absoluteFill]} resizeMode="cover" />
                  {item.kind === "carousel" ? (
                    <View style={styles.galleryBadge}><Text style={styles.galleryBadgeText}>Carrossel · {item.slides.length}</Text></View>
                  ) : item.post.post_format === "story" ? (
                    <View style={styles.galleryBadge}><Text style={styles.galleryBadgeText}>Story</Text></View>
                  ) : null}
                  <View style={styles.galleryFooter}>
                    <Text style={styles.galleryStatus}>{status === "exported" ? "exportado" : "rascunho"}</Text>
                    <Pressable onPress={() => confirmDelete(item)} hitSlop={6}>
                      <Trash2 size={12} color={colors.clay} />
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      <PickerModal
        visible={objectivePickerOpen}
        title="Objetivo"
        options={OBJECTIVES}
        selected={[objective]}
        onToggle={(v) => { setObjective(v); setObjectivePickerOpen(false); }}
        onClose={() => setObjectivePickerOpen(false)}
      />
      <PickerModal
        visible={tonePickerOpen}
        title="Tom visual"
        options={VISUAL_TONES}
        selected={[visualTone]}
        onToggle={(v) => { setVisualTone(v); setTonePickerOpen(false); }}
        onClose={() => setTonePickerOpen(false)}
      />
      <PickerModal
        visible={aspectPickerOpen}
        title="Proporção"
        options={ASPECT_RATIOS}
        selected={[aspectRatio]}
        onToggle={(v) => { setAspectRatio(v); setAspectPickerOpen(false); }}
        onClose={() => setAspectPickerOpen(false)}
      />
    </SafeAreaView>
  );
}

function aspectRatioNum(ar?: string) {
  if (!ar) return 1;
  const [w, h] = ar.split("x").map(Number);
  return w && h ? w / h : 1;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.clay },
  header: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  title: { fontFamily: fonts.sansSemiBold, fontSize: 16, color: colors.ink },
  sectionLabel: { fontFamily: fonts.mono, fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: colors.stone500, marginBottom: 10 },
  fieldLabel: { fontFamily: fonts.mono, fontSize: 9.5, textTransform: "uppercase", letterSpacing: 0.6, color: colors.stone500, marginBottom: 5 },
  error: { fontFamily: fonts.mono, fontSize: 11, color: colors.danger, marginBottom: 10 },
  emptyText: { fontFamily: fonts.sans, fontSize: 13, color: colors.stone500 },

  card: { ...surfaces[3], borderRadius: radii.lg, padding: 14, marginBottom: 16 },
  formatBtn: { borderWidth: 1, borderColor: "rgba(20,22,24,0.15)", borderRadius: radii.md, paddingHorizontal: 14, paddingVertical: 8 },
  formatBtnActive: { backgroundColor: colors.action, borderColor: colors.action },
  formatBtnText: { fontFamily: fonts.sansSemiBold, fontSize: 13, color: colors.ink },
  formatBtnTextActive: { color: colors.clay },

  input: {
    borderWidth: 1, borderColor: "rgba(20,22,24,0.15)", backgroundColor: colors.paper, borderRadius: radii.md,
    paddingHorizontal: 10, paddingVertical: 9, fontSize: 13, color: colors.ink, fontFamily: fonts.sans, marginBottom: 8,
  },
  selectBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6, borderWidth: 1, borderColor: "rgba(20,22,24,0.15)",
    backgroundColor: colors.paper, borderRadius: radii.md, paddingHorizontal: 10, paddingVertical: 10,
  },
  selectBtnText: { fontFamily: fonts.sans, fontSize: 12.5, color: colors.ink, flexShrink: 1 },
  fixedRatio: { borderWidth: 1, borderColor: "rgba(20,22,24,0.15)", backgroundColor: colors.paper, borderRadius: radii.md, paddingHorizontal: 10, paddingVertical: 10, fontFamily: fonts.sans, fontSize: 12.5, color: colors.stone500 },
  slideIndex: { fontFamily: fonts.mono, fontSize: 12, color: colors.stone400, width: 16 },

  primaryBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.action, borderRadius: radii.md, paddingVertical: 12 },
  primaryBtnText: { fontFamily: fonts.sansBold, fontSize: 12.5, color: colors.clay },
  outlineBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: "rgba(20,22,24,0.15)", borderRadius: radii.md, paddingHorizontal: 10, paddingVertical: 9 },
  outlineBtnText: { fontFamily: fonts.mono, fontSize: 10.5, color: colors.stone500 },

  resultImage: { width: "100%", borderRadius: radii.lg, backgroundColor: "rgba(20,22,24,0.06)" },

  galleryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  galleryTile: { width: "31%", aspectRatio: 1, borderRadius: radii.md, overflow: "hidden", backgroundColor: "rgba(20,22,24,0.06)" },
  galleryBadge: { position: "absolute", top: 5, right: 5, backgroundColor: "rgba(20,22,24,0.7)", borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 },
  galleryBadgeText: { fontFamily: fonts.mono, fontSize: 8, color: colors.clay },
  galleryFooter: { position: "absolute", bottom: 0, left: 0, right: 0, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "rgba(20,22,24,0.7)", paddingHorizontal: 6, paddingVertical: 4 },
  galleryStatus: { fontFamily: fonts.mono, fontSize: 8, textTransform: "uppercase", color: colors.clay },
});
