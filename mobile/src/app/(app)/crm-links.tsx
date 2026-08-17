import { useCallback, useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, Alert, Share, StyleSheet } from "react-native";
import { useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Link2, Share2, Pencil, Trash2, Plus, X, Tag, MessageCircle, ExternalLink, Check } from "lucide-react-native";
import { crmApi, CrmApiError } from "@/lib/crmApi";
import { timeAgo } from "@/lib/crmStatus";
import { colors, fonts, radii, surfaces } from "@/lib/theme";

// Port of src/crm/CrmWaLinks.jsx — Phase 8 of
// ~/.claude/plans/tektone-mobile-parity.md. Top-level nav item (not nested
// under crm.tsx), matching web's separate top-level placement. Uses RN's
// Share API for "copy" instead of web's clipboard button, per the plan.

const LINK_BASE = "https://go.tektone.com.br";

type WaLink = { slug: string; title?: string; type: "whatsapp" | "url"; phone?: string; message?: string; url?: string; clicks: number; created_at: string; created_by?: string };
type WaNumber = { id: string; label: string; phone: string };

export default function CrmLinksScreen() {
  const [links, setLinks] = useState<WaLink[] | null>(null);
  const [numbers, setNumbers] = useState<WaNumber[] | null>(null);
  const [error, setError] = useState("");

  const [title, setTitle] = useState("");
  const [type, setType] = useState<"whatsapp" | "url">("whatsapp");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [url, setUrl] = useState("");
  const [slug, setSlug] = useState("");
  const [busy, setBusy] = useState(false);
  const [justCreated, setJustCreated] = useState<string | null>(null);
  const [savingLabel, setSavingLabel] = useState(false);
  const [numberLabel, setNumberLabel] = useState("");
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<any>(null);

  const load = useCallback(() => {
    Promise.all([crmApi.listWaLinks(), crmApi.listWaNumbers()])
      .then(([l, n]: any[]) => { setLinks(l.links); setNumbers(n.numbers); })
      .catch((e) => setError(e instanceof CrmApiError ? e.body?.error || "Falha ao carregar." : "Falha ao carregar."));
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function share(l: WaLink) {
    const shareUrl = `${LINK_BASE}/${l.slug}`;
    try {
      await Share.share({ message: l.title ? `${l.title}: ${shareUrl}` : shareUrl });
    } catch {
      /* user cancelled */
    }
  }

  async function create() {
    setBusy(true);
    setError("");
    try {
      const body =
        type === "url"
          ? { title, type: "url", slug, url }
          : { title, type: "whatsapp", slug, phone, message };
      const { link } = await crmApi.createWaLink(body);
      setTitle("");
      setPhone("");
      setMessage("");
      setUrl("");
      setSlug("");
      setJustCreated(link.slug);
      load();
    } catch (e) {
      setError(e instanceof CrmApiError ? e.body?.error || (e as any).message : "Falha ao criar link.");
    } finally {
      setBusy(false);
    }
  }

  function startEdit(l: WaLink) {
    setEditingSlug(l.slug);
    setEditDraft({ newSlug: l.slug, title: l.title || "", type: l.type, phone: l.phone || "", message: l.message || "", url: l.url || "" });
  }

  async function saveEdit() {
    if (!editingSlug || !editDraft) return;
    setBusy(true);
    setError("");
    try {
      const body: any =
        editDraft.type === "url"
          ? { title: editDraft.title, type: "url", url: editDraft.url }
          : { title: editDraft.title, type: "whatsapp", phone: editDraft.phone, message: editDraft.message };
      if (editDraft.newSlug !== editingSlug) body.newSlug = editDraft.newSlug;
      await crmApi.updateWaLink(editingSlug, body);
      setEditingSlug(null);
      setEditDraft(null);
      load();
    } catch (e) {
      setError(e instanceof CrmApiError ? e.body?.error || (e as any).message : "Falha ao salvar.");
    } finally {
      setBusy(false);
    }
  }

  function confirmRemove(l: WaLink) {
    Alert.alert("Excluir link", `Excluir o link "${LINK_BASE}/${l.slug}"? O rastreamento de cliques será perdido.`, [
      { text: "Cancelar", style: "cancel" },
      { text: "Excluir", style: "destructive", onPress: () => removeLink(l) },
    ]);
  }

  async function removeLink(l: WaLink) {
    setBusy(true);
    try {
      await crmApi.deleteWaLink(l.slug);
      load();
    } catch (e) {
      setError(e instanceof CrmApiError ? e.body?.error || (e as any).message : "Falha ao remover.");
    } finally {
      setBusy(false);
    }
  }

  async function saveNumber() {
    if (!phone.trim() || !numberLabel.trim()) return;
    setBusy(true);
    try {
      await crmApi.createWaNumber({ label: numberLabel.trim(), phone: phone.trim() });
      setNumberLabel("");
      setSavingLabel(false);
      load();
    } catch (e) {
      setError(e instanceof CrmApiError ? e.body?.error || (e as any).message : "Falha ao salvar número.");
    } finally {
      setBusy(false);
    }
  }

  function confirmRemoveNumber(n: WaNumber) {
    Alert.alert("Remover número", `Remover o número salvo "${n.label}"?`, [
      { text: "Cancelar", style: "cancel" },
      { text: "Remover", style: "destructive", onPress: () => removeNumber(n) },
    ]);
  }

  async function removeNumber(n: WaNumber) {
    setBusy(true);
    try {
      await crmApi.deleteWaNumber(n.id);
      load();
    } catch (e) {
      setError(e instanceof CrmApiError ? e.body?.error || (e as any).message : "Falha ao remover número.");
    } finally {
      setBusy(false);
    }
  }

  const unsavedNumber = phone.trim() && !(numbers || []).some((n) => n.phone === phone.trim());

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.header}>
        <Link2 size={16} color={colors.action} />
        <Text style={styles.title}>Links</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 14 }}>
        <Text style={styles.hint}>Crie um link curto para um chat de WhatsApp ou para qualquer outra URL, e acompanhe os cliques de cada um.</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Novo link</Text>
          <TextInput placeholder="Título (ex: Instagram — Bio)" placeholderTextColor={colors.stone400} value={title} onChangeText={setTitle} style={styles.input} />

          <View style={styles.typeToggle}>
            <Pressable onPress={() => setType("whatsapp")} style={[styles.typeBtn, type === "whatsapp" && styles.typeBtnActive]}>
              <MessageCircle size={12} color={type === "whatsapp" ? colors.clay : colors.stone500} />
              <Text style={[styles.typeBtnText, type === "whatsapp" && styles.typeBtnTextActive]}>WhatsApp</Text>
            </Pressable>
            <Pressable onPress={() => setType("url")} style={[styles.typeBtn, type === "url" && styles.typeBtnActive]}>
              <ExternalLink size={12} color={type === "url" ? colors.clay : colors.stone500} />
              <Text style={[styles.typeBtnText, type === "url" && styles.typeBtnTextActive]}>URL</Text>
            </Pressable>
          </View>

          {type === "whatsapp" ? (
            <>
              <TextInput placeholder="55479..." placeholderTextColor={colors.stone400} value={phone} onChangeText={setPhone} keyboardType="phone-pad" style={styles.input} />
              {(numbers || []).length > 0 ? (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                  {(numbers || []).map((n) => (
                    <View key={n.id} style={[styles.chip, phone === n.phone && styles.chipActive]}>
                      <Pressable onPress={() => setPhone(n.phone)}>
                        <Text style={[styles.chipText, phone === n.phone && styles.chipTextActive]}>{n.label}</Text>
                      </Pressable>
                      <Pressable onPress={() => confirmRemoveNumber(n)} style={{ paddingLeft: 6 }}>
                        <X size={10} color={phone === n.phone ? colors.clay : colors.danger} />
                      </Pressable>
                    </View>
                  ))}
                </View>
              ) : null}
              {unsavedNumber ? (
                savingLabel ? (
                  <View style={{ flexDirection: "row", gap: 6, marginBottom: 8 }}>
                    <TextInput
                      placeholder="Nome (ex: Hudson, Pedro)"
                      placeholderTextColor={colors.stone400}
                      value={numberLabel}
                      onChangeText={setNumberLabel}
                      style={[styles.input, { flex: 1, marginBottom: 0 }]}
                    />
                    <Pressable onPress={saveNumber} disabled={busy || !numberLabel.trim()} style={styles.iconBtn}>
                      <Check size={14} color={colors.action} />
                    </Pressable>
                    <Pressable onPress={() => { setSavingLabel(false); setNumberLabel(""); }} style={styles.iconBtn}>
                      <X size={14} color={colors.stone500} />
                    </Pressable>
                  </View>
                ) : (
                  <Pressable onPress={() => setSavingLabel(true)} style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
                    <Tag size={11} color={colors.stone500} />
                    <Text style={styles.linkText}>Salvar este número com um nome</Text>
                  </Pressable>
                )
              ) : null}
              <TextInput
                placeholder="Mensagem (opcional) — Olá! Vim pelo link…"
                placeholderTextColor={colors.stone400}
                value={message}
                onChangeText={setMessage}
                multiline
                numberOfLines={3}
                style={[styles.input, { minHeight: 60, textAlignVertical: "top" }]}
              />
            </>
          ) : (
            <TextInput placeholder="https://..." placeholderTextColor={colors.stone400} value={url} onChangeText={setUrl} autoCapitalize="none" style={styles.input} />
          )}

          <TextInput
            placeholder="Identificador (opcional — gerado automaticamente se vazio)"
            placeholderTextColor={colors.stone400}
            value={slug}
            onChangeText={setSlug}
            autoCapitalize="none"
            style={styles.input}
          />
          <Text style={styles.slugPreview}>{LINK_BASE}/{slug.trim() || "••••••"}</Text>

          <Pressable
            onPress={create}
            disabled={busy || (type === "whatsapp" ? !phone.trim() : !url.trim())}
            style={[styles.primaryBtn, (busy || (type === "whatsapp" ? !phone.trim() : !url.trim())) && { opacity: 0.5 }]}
          >
            {busy ? <ActivityIndicator size="small" color={colors.clay} /> : <Plus size={13} color={colors.clay} />}
            <Text style={styles.primaryBtnText}>Criar link</Text>
          </Pressable>

          {justCreated ? (
            <View style={styles.createdBox}>
              <Text style={styles.createdText} numberOfLines={1}>{LINK_BASE}/{justCreated}</Text>
              <Pressable onPress={() => share(links?.find((l) => l.slug === justCreated) || { slug: justCreated } as WaLink)}>
                <Share2 size={13} color={colors.success} />
              </Pressable>
            </View>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Todos os links</Text>
          {links === null ? (
            <ActivityIndicator style={{ marginTop: 12 }} color={colors.action} />
          ) : links.length === 0 ? (
            <Text style={styles.hint}>Nenhum link ainda.</Text>
          ) : (
            <View style={{ gap: 8, marginTop: 10 }}>
              {links.map((l) => (
                <View key={l.slug} style={styles.linkRow}>
                  {editingSlug === l.slug && editDraft ? (
                    <View style={{ gap: 8 }}>
                      <TextInput value={editDraft.title} onChangeText={(v) => setEditDraft((s: any) => ({ ...s, title: v }))} placeholder="Título" placeholderTextColor={colors.stone400} style={[styles.input, { marginBottom: 0 }]} />
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Text style={styles.linkBase}>{LINK_BASE}/</Text>
                        <TextInput value={editDraft.newSlug} onChangeText={(v) => setEditDraft((s: any) => ({ ...s, newSlug: v }))} autoCapitalize="none" style={[styles.input, { flex: 1, marginBottom: 0 }]} />
                      </View>
                      {editDraft.type === "whatsapp" ? (
                        <>
                          <TextInput value={editDraft.phone} onChangeText={(v) => setEditDraft((s: any) => ({ ...s, phone: v }))} placeholder="WhatsApp" placeholderTextColor={colors.stone400} keyboardType="phone-pad" style={[styles.input, { marginBottom: 0 }]} />
                          <TextInput value={editDraft.message} onChangeText={(v) => setEditDraft((s: any) => ({ ...s, message: v }))} placeholder="Mensagem" placeholderTextColor={colors.stone400} multiline style={[styles.input, { marginBottom: 0 }]} />
                        </>
                      ) : (
                        <TextInput value={editDraft.url} onChangeText={(v) => setEditDraft((s: any) => ({ ...s, url: v }))} placeholder="https://..." placeholderTextColor={colors.stone400} autoCapitalize="none" style={[styles.input, { marginBottom: 0 }]} />
                      )}
                      <View style={{ flexDirection: "row", gap: 8 }}>
                        <Pressable onPress={saveEdit} disabled={busy || !editDraft.newSlug.trim()} style={[styles.primaryBtnSm, (busy || !editDraft.newSlug.trim()) && { opacity: 0.5 }]}>
                          <Text style={styles.primaryBtnSmText}>salvar</Text>
                        </Pressable>
                        <Pressable onPress={() => { setEditingSlug(null); setEditDraft(null); }} style={styles.outlineBtn}>
                          <Text style={styles.outlineBtnText}>cancelar</Text>
                        </Pressable>
                      </View>
                    </View>
                  ) : (
                    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        {l.title ? <Text style={styles.linkTitle} numberOfLines={1}>{l.title}</Text> : null}
                        <Text style={styles.linkSlug} numberOfLines={1}>{LINK_BASE}/{l.slug}</Text>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 3 }}>
                          {l.type === "url" ? <ExternalLink size={11} color={colors.stone500} /> : <MessageCircle size={11} color={colors.stone500} />}
                          <Text style={styles.linkDest} numberOfLines={1}>{l.type === "url" ? l.url : l.phone}</Text>
                        </View>
                        <Text style={styles.linkMeta}>
                          {l.clicks} {l.clicks === 1 ? "clique" : "cliques"} · criado {timeAgo(l.created_at)}{l.created_by ? ` por ${l.created_by}` : ""}
                        </Text>
                      </View>
                      <View style={{ flexDirection: "row", gap: 10 }}>
                        <Pressable onPress={() => share(l)}><Share2 size={14} color={colors.stone500} /></Pressable>
                        <Pressable onPress={() => startEdit(l)}><Pencil size={13} color={colors.stone500} /></Pressable>
                        <Pressable onPress={() => confirmRemove(l)}><Trash2 size={13} color={colors.danger} /></Pressable>
                      </View>
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Números salvos</Text>
          {(numbers || []).length === 0 ? (
            <Text style={styles.hint}>Nenhum número salvo ainda — use “Salvar este número com um nome” ao criar um link.</Text>
          ) : (
            <View style={{ gap: 6, marginTop: 10 }}>
              {(numbers || []).map((n) => (
                <View key={n.id} style={styles.numberRow}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.numberLabel} numberOfLines={1}>{n.label}</Text>
                    <Text style={styles.numberPhone}>{n.phone}</Text>
                  </View>
                  <Pressable onPress={() => confirmRemoveNumber(n)}><Trash2 size={13} color={colors.danger} /></Pressable>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.clay },
  header: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingTop: 8 },
  title: { fontFamily: fonts.sansSemiBold, fontSize: 16, color: colors.ink },
  hint: { fontFamily: fonts.sans, fontSize: 12, color: colors.stone500, lineHeight: 17 },
  error: { fontFamily: fonts.mono, fontSize: 11, color: colors.danger },
  card: { ...surfaces[2], borderRadius: radii.xl, padding: 16 },
  cardTitle: { fontFamily: fonts.sansSemiBold, fontSize: 13.5, color: colors.ink, marginBottom: 10 },
  input: {
    borderWidth: 1, borderColor: "rgba(20,22,24,0.15)", backgroundColor: colors.paper, borderRadius: radii.md,
    paddingHorizontal: 10, paddingVertical: 9, fontSize: 13, color: colors.ink, fontFamily: fonts.sans, marginBottom: 8,
  },
  typeToggle: { flexDirection: "row", borderRadius: radii.md, overflow: "hidden", borderWidth: 1, borderColor: "rgba(20,22,24,0.15)", marginBottom: 8 },
  typeBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 9 },
  typeBtnActive: { backgroundColor: colors.action },
  typeBtnText: { fontFamily: fonts.mono, fontSize: 10.5, color: colors.stone500, textTransform: "uppercase" },
  typeBtnTextActive: { color: colors.clay },
  chip: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "rgba(20,22,24,0.15)", borderRadius: radii.sm, paddingHorizontal: 9, paddingVertical: 6 },
  chipActive: { backgroundColor: colors.action, borderColor: colors.action },
  chipText: { fontFamily: fonts.mono, fontSize: 10.5, color: colors.ink, textTransform: "uppercase" },
  chipTextActive: { color: colors.clay },
  linkText: { fontFamily: fonts.mono, fontSize: 11, color: colors.stone500 },
  slugPreview: { fontFamily: fonts.mono, fontSize: 10.5, color: colors.stone500, marginBottom: 10 },
  primaryBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.action, borderRadius: radii.md, paddingVertical: 12 },
  primaryBtnText: { fontFamily: fonts.sansBold, fontSize: 12.5, color: colors.clay },
  primaryBtnSm: { backgroundColor: colors.action, borderRadius: radii.md, paddingHorizontal: 14, paddingVertical: 9 },
  primaryBtnSmText: { fontFamily: fonts.sansBold, fontSize: 11, color: colors.clay },
  outlineBtn: { borderWidth: 1, borderColor: "rgba(20,22,24,0.15)", borderRadius: radii.md, paddingHorizontal: 14, paddingVertical: 9 },
  outlineBtnText: { fontFamily: fonts.mono, fontSize: 11, color: colors.stone500 },
  iconBtn: { borderWidth: 1, borderColor: "rgba(20,22,24,0.15)", borderRadius: radii.md, paddingHorizontal: 10, alignItems: "center", justifyContent: "center" },
  createdBox: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, borderWidth: 1, borderColor: `${colors.success}4d`, backgroundColor: `${colors.success}1a`, borderRadius: radii.md, paddingHorizontal: 10, paddingVertical: 9, marginTop: 10 },
  createdText: { flex: 1, fontFamily: fonts.mono, fontSize: 11, color: colors.success },

  linkRow: { ...surfaces[3], borderRadius: radii.md, padding: 12 },
  linkTitle: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.ink },
  linkSlug: { fontFamily: fonts.monoMedium, fontSize: 11.5, color: colors.action, marginTop: 1 },
  linkDest: { flex: 1, fontFamily: fonts.sans, fontSize: 11.5, color: colors.ink },
  linkMeta: { fontFamily: fonts.mono, fontSize: 9.5, color: colors.stone500, marginTop: 5 },
  linkBase: { fontFamily: fonts.mono, fontSize: 11, color: colors.stone500 },

  numberRow: { flexDirection: "row", alignItems: "center", gap: 10, ...surfaces[3], borderRadius: radii.md, paddingHorizontal: 12, paddingVertical: 10 },
  numberLabel: { fontFamily: fonts.sansSemiBold, fontSize: 13, color: colors.ink },
  numberPhone: { fontFamily: fonts.mono, fontSize: 11, color: colors.stone500, marginTop: 1 },
});
