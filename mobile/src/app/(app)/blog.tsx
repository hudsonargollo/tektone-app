import { useCallback, useState } from "react";
import { View, Text, TextInput, Pressable, Image, ScrollView, ActivityIndicator, Alert, StyleSheet } from "react-native";
import { useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Markdown from "react-native-markdown-display";
import { Newspaper, Check, Ban, Sparkles, Pencil, ImagePlus, X } from "lucide-react-native";
import { api, ApiError, API_BASE } from "@/lib/api";
import { colors, fonts, radii, surfaces } from "@/lib/theme";

// Port of src/components/BlogPanel.jsx's "Posts" tab only — review/curate
// workflow (status-tab list, inline edit, AI image insertion, approve/
// reject). Page/Form/Quiz/Funnel authoring (BlogPanel.jsx's other content
// tabs, backed by DocumentBuilder/FunnelBuilder) stays web-only, deferred
// to Phase 11's own scope decision on the Builder. Phase 9 of
// ~/.claude/plans/tektone-mobile-parity.md.
//
// Markdown is edited as plain text (matches web's own MarkdownTextarea —
// no rich editor) via a multiline TextInput, with an edit/preview toggle
// rendering through react-native-markdown-display (new dependency — no RN
// markdown renderer existed in this project yet). AI image insertion
// appends the generated image's markdown at the end of the content rather
// than at the text cursor — RN TextInput's selection API is unreliable
// enough across platforms that mid-text insertion isn't worth the risk;
// appending is a one-line edit for the reviewer either way.

type Post = {
  id: string;
  title: string;
  excerpt: string | null;
  content: string;
  pillar_name?: string;
  cover_illustration?: string | null;
};

const STATUS_TABS: { key: string; label: string }[] = [
  { key: "pending_review", label: "aguardando revisão" },
  { key: "published", label: "publicado" },
  { key: "rejected", label: "rejeitado" },
];

function mediaUrl(key: string) {
  return `${API_BASE}/api/blog/media/${key}`;
}

export default function BlogScreen() {
  const [tab, setTab] = useState("pending_review");
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ title: "", excerpt: "", content: "" });
  const [editorTab, setEditorTab] = useState<"editar" | "preview">("editar");
  const [imgPrompt, setImgPrompt] = useState("");
  const [imgBusy, setImgBusy] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [generating, setGenerating] = useState(false);

  const load = useCallback(() => {
    api.listBlogPosts(tab).then(({ posts }: any) => setPosts(posts)).catch((e: unknown) =>
      setError(e instanceof ApiError ? e.body?.error || "Falha ao carregar." : "Falha ao carregar.")
    );
  }, [tab]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  function startEdit(post: Post) {
    setEditingId(post.id);
    setDraft({ title: post.title, excerpt: post.excerpt || "", content: post.content });
    setEditorTab("editar");
    setImgPrompt("");
  }

  async function insertGeneratedImage(postId: string) {
    const prompt = imgPrompt.trim();
    if (!prompt) return;
    setImgBusy(true);
    setError("");
    try {
      const { key } = await api.generateBlogImage(postId, prompt);
      setDraft((d) => ({ ...d, content: `${d.content}\n\n![](${mediaUrl(key)})\n` }));
      setImgPrompt("");
    } catch (e) {
      setError(e instanceof ApiError ? e.body?.error || "Falha ao gerar imagem." : "Falha ao gerar imagem.");
    } finally {
      setImgBusy(false);
    }
  }

  async function saveEdit(id: string) {
    setBusy(id);
    setError("");
    try {
      await api.updateBlogPost(id, draft);
      setEditingId(null);
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.body?.error || "Falha ao salvar." : "Falha ao salvar.");
    } finally {
      setBusy(null);
    }
  }

  async function approve(id: string) {
    setBusy(id);
    setError("");
    try {
      await api.approveBlogPost(id);
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.body?.error || "Falha ao publicar." : "Falha ao publicar.");
    } finally {
      setBusy(null);
    }
  }

  function confirmReject(id: string) {
    if (!Alert.prompt) {
      reject(id, "");
      return;
    }
    Alert.prompt(
      "Rejeitar artigo",
      "Motivo da rejeição (opcional):",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Rejeitar", style: "destructive", onPress: (reason?: string) => reject(id, reason || "") },
      ],
      "plain-text"
    );
  }

  async function reject(id: string, reason: string) {
    setBusy(id);
    setError("");
    try {
      await api.rejectBlogPost(id, reason);
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.body?.error || "Falha ao rejeitar." : "Falha ao rejeitar.");
    } finally {
      setBusy(null);
    }
  }

  async function generateNow() {
    setGenerating(true);
    setError("");
    try {
      await api.generateBlogDrafts();
      if (tab === "pending_review") load();
      else setTab("pending_review");
    } catch (e) {
      setError(e instanceof ApiError ? e.body?.error || "Falha ao gerar rascunhos." : "Falha ao gerar rascunhos.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.header}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Newspaper size={16} color={colors.action} />
          <Text style={styles.title}>Blog</Text>
        </View>
        {tab === "pending_review" && (
          <Pressable onPress={generateNow} disabled={generating} style={[styles.genBtn, generating && { opacity: 0.5 }]}>
            {generating ? <ActivityIndicator size="small" color={colors.stone500} /> : <Sparkles size={12} color={colors.stone500} />}
            <Text style={styles.genBtnText}>gerar agora</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.tabRow}>
        {STATUS_TABS.map((t) => (
          <Pressable key={t.key} onPress={() => setTab(t.key)} style={[styles.tabBtn, tab === t.key && styles.tabBtnActive]}>
            <Text style={[styles.tabBtnText, tab === t.key && styles.tabBtnTextActive]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {posts === null ? (
          <ActivityIndicator style={{ marginTop: 24 }} color={colors.action} />
        ) : posts.length === 0 ? (
          <Text style={styles.emptyText}>Nenhum artigo aqui.</Text>
        ) : (
          <View style={{ gap: 10 }}>
            {posts.map((p) => (
              <View key={p.id} style={styles.card}>
                {editingId === p.id ? (
                  <View>
                    <TextInput
                      value={draft.title}
                      onChangeText={(v) => setDraft((d) => ({ ...d, title: v }))}
                      style={[styles.input, { fontFamily: fonts.sansSemiBold }]}
                    />
                    <TextInput
                      value={draft.excerpt}
                      onChangeText={(v) => setDraft((d) => ({ ...d, excerpt: v }))}
                      placeholder="Resumo"
                      placeholderTextColor={colors.stone400}
                      style={styles.input}
                    />

                    <View style={styles.miniTabRow}>
                      {(["editar", "preview"] as const).map((k) => (
                        <Pressable key={k} onPress={() => setEditorTab(k)} style={[styles.miniTab, editorTab === k && styles.miniTabActive]}>
                          <Text style={[styles.miniTabText, editorTab === k && styles.miniTabTextActive]}>{k}</Text>
                        </Pressable>
                      ))}
                    </View>

                    {editorTab === "editar" ? (
                      <View>
                        <TextInput
                          value={draft.content}
                          onChangeText={(v) => setDraft((d) => ({ ...d, content: v }))}
                          multiline
                          numberOfLines={12}
                          style={[styles.input, { minHeight: 220, textAlignVertical: "top", fontFamily: fonts.mono, fontSize: 12 }]}
                        />
                        <View style={styles.imgRow}>
                          <TextInput
                            value={imgPrompt}
                            onChangeText={setImgPrompt}
                            placeholder="descreva a imagem para gerar…"
                            placeholderTextColor={colors.stone400}
                            style={[styles.input, { flex: 1, marginBottom: 0 }]}
                          />
                          <Pressable
                            onPress={() => insertGeneratedImage(p.id)}
                            disabled={imgBusy || !imgPrompt.trim()}
                            style={[styles.outlineBtn, (imgBusy || !imgPrompt.trim()) && { opacity: 0.4 }]}
                          >
                            {imgBusy ? <ActivityIndicator size="small" color={colors.stone500} /> : <ImagePlus size={12} color={colors.stone500} />}
                            <Text style={styles.outlineBtnText}>gerar imagem</Text>
                          </Pressable>
                        </View>
                      </View>
                    ) : (
                      <View style={styles.previewBox}>
                        {p.pillar_name ? <Text style={styles.pillarLabel}>{p.pillar_name}</Text> : null}
                        <Text style={styles.previewTitle}>{draft.title || "(sem título)"}</Text>
                        {draft.excerpt ? <Text style={styles.previewExcerpt}>{draft.excerpt}</Text> : null}
                        {p.cover_illustration ? (
                          <Image source={{ uri: mediaUrl(p.cover_illustration) }} style={styles.coverPreview} resizeMode="cover" />
                        ) : null}
                        <View style={{ marginTop: 12 }}>
                          <Markdown style={markdownStyles}>{draft.content || ""}</Markdown>
                        </View>
                      </View>
                    )}

                    <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                      <Pressable onPress={() => saveEdit(p.id)} disabled={busy === p.id} style={[styles.primaryBtnSm, busy === p.id && { opacity: 0.5 }]}>
                        {busy === p.id ? <ActivityIndicator size="small" color={colors.clay} /> : null}
                        <Text style={styles.primaryBtnSmText}>salvar</Text>
                      </Pressable>
                      <Pressable onPress={() => setEditingId(null)} style={styles.outlineBtn}>
                        <X size={12} color={colors.stone500} />
                        <Text style={styles.outlineBtnText}>cancelar</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <View>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        {p.pillar_name ? <Text style={styles.pillarLabel}>{p.pillar_name}</Text> : null}
                        <Text style={styles.cardTitle} numberOfLines={2}>{p.title}</Text>
                      </View>
                      {p.cover_illustration ? (
                        <Image source={{ uri: mediaUrl(p.cover_illustration) }} style={styles.thumb} resizeMode="cover" />
                      ) : null}
                    </View>
                    {p.excerpt ? <Text style={styles.excerpt}>{p.excerpt}</Text> : null}
                    {tab === "pending_review" && (
                      <View style={{ flexDirection: "row", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
                        <Pressable onPress={() => approve(p.id)} disabled={busy === p.id} style={[styles.primaryBtnSm, busy === p.id && { opacity: 0.5 }]}>
                          {busy === p.id ? <ActivityIndicator size="small" color={colors.clay} /> : <Check size={12} color={colors.clay} />}
                          <Text style={styles.primaryBtnSmText}>publicar</Text>
                        </Pressable>
                        <Pressable onPress={() => startEdit(p)} style={styles.outlineBtn}>
                          <Pencil size={12} color={colors.stone500} />
                          <Text style={styles.outlineBtnText}>editar</Text>
                        </Pressable>
                        <Pressable onPress={() => confirmReject(p.id)} disabled={busy === p.id} style={[styles.outlineBtn, { borderColor: "rgba(155,61,46,0.3)" }]}>
                          <Ban size={12} color={colors.danger} />
                          <Text style={[styles.outlineBtnText, { color: colors.danger }]}>rejeitar</Text>
                        </Pressable>
                      </View>
                    )}
                  </View>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const markdownStyles = {
  body: { fontFamily: fonts.sans, fontSize: 13, color: colors.ink, lineHeight: 20 },
  heading1: { fontFamily: fonts.sansBold, fontSize: 20, color: colors.ink, marginTop: 10, marginBottom: 6 },
  heading2: { fontFamily: fonts.sansBold, fontSize: 17, color: colors.ink, marginTop: 10, marginBottom: 6 },
  heading3: { fontFamily: fonts.sansSemiBold, fontSize: 15, color: colors.ink, marginTop: 8, marginBottom: 4 },
  strong: { fontFamily: fonts.sansBold },
  em: { fontFamily: fonts.sans, fontStyle: "italic" as const },
  link: { color: colors.action },
  image: { borderRadius: radii.md, marginVertical: 8 },
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.clay },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 8, gap: 8 },
  title: { fontFamily: fonts.sansSemiBold, fontSize: 16, color: colors.ink },
  genBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: "rgba(20,22,24,0.15)", borderRadius: radii.md, paddingHorizontal: 10, paddingVertical: 7 },
  genBtnText: { fontFamily: fonts.mono, fontSize: 10.5, color: colors.stone500 },

  tabRow: { flexDirection: "row", flexWrap: "wrap", gap: 4, paddingHorizontal: 16, paddingTop: 12 },
  tabBtn: { borderRadius: radii.md, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: "rgba(20,22,24,0.05)" },
  tabBtnActive: { backgroundColor: `${colors.action}18` },
  tabBtnText: { fontFamily: fonts.mono, fontSize: 10.5, color: colors.stone500 },
  tabBtnTextActive: { color: colors.action, fontFamily: fonts.monoMedium },

  error: { fontFamily: fonts.mono, fontSize: 11, color: colors.danger, marginBottom: 10 },
  emptyText: { fontFamily: fonts.sans, fontSize: 13, color: colors.stone500 },

  card: { ...surfaces[3], borderRadius: radii.lg, padding: 14 },
  pillarLabel: { fontFamily: fonts.mono, fontSize: 9.5, textTransform: "uppercase", letterSpacing: 0.8, color: colors.stone400, marginBottom: 3 },
  cardTitle: { fontFamily: fonts.sansSemiBold, fontSize: 14, color: colors.ink },
  excerpt: { fontFamily: fonts.sans, fontSize: 12.5, color: colors.stone500, marginBottom: 10, lineHeight: 18 },
  thumb: { width: 54, height: 54, borderRadius: radii.md },

  input: {
    borderWidth: 1, borderColor: "rgba(20,22,24,0.15)", backgroundColor: colors.paper, borderRadius: radii.md,
    paddingHorizontal: 10, paddingVertical: 9, fontSize: 13, color: colors.ink, fontFamily: fonts.sans, marginBottom: 8,
  },
  miniTabRow: { flexDirection: "row", gap: 4, marginBottom: 8 },
  miniTab: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radii.sm, backgroundColor: "rgba(20,22,24,0.05)" },
  miniTabActive: { backgroundColor: `${colors.action}18` },
  miniTabText: { fontFamily: fonts.mono, fontSize: 10.5, color: colors.stone500 },
  miniTabTextActive: { color: colors.action, fontFamily: fonts.monoMedium },
  imgRow: { flexDirection: "row", gap: 8 },
  previewBox: { borderWidth: 1, borderColor: "rgba(20,22,24,0.12)", borderRadius: radii.md, padding: 14, maxHeight: 420 },
  previewTitle: { fontFamily: fonts.sansBold, fontSize: 17, color: colors.ink, marginTop: 2 },
  previewExcerpt: { fontFamily: fonts.sans, fontSize: 13, color: colors.stone500, marginTop: 6 },
  coverPreview: { width: "100%", aspectRatio: 4 / 3, borderRadius: radii.lg, marginTop: 10 },

  primaryBtnSm: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.action, borderRadius: radii.md, paddingHorizontal: 12, paddingVertical: 9 },
  primaryBtnSmText: { fontFamily: fonts.sansBold, fontSize: 11.5, color: colors.clay },
  outlineBtn: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderColor: "rgba(20,22,24,0.15)", borderRadius: radii.md, paddingHorizontal: 10, paddingVertical: 9 },
  outlineBtnText: { fontFamily: fonts.mono, fontSize: 10.5, color: colors.stone500 },
});
