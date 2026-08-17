import { useCallback, useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, Alert, StyleSheet } from "react-native";
import { useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import DateTimePicker from "@react-native-community/datetimepicker";
import {
  Briefcase,
  Plus,
  UserPlus,
  CheckCircle2,
  Clock,
  ShoppingBag,
  Trash2,
  EyeOff,
  Eye,
  Award,
  Users,
  FileText,
  Receipt,
  ChevronDown,
  Calendar as CalendarIcon,
} from "lucide-react-native";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { colors, fonts, radii, surfaces } from "@/lib/theme";
import { initials } from "@/lib/constants";
import PickerModal from "@/components/CardDetail/PickerModal";

// Port of src/components/CommercialPanel.jsx — Phase 6 of
// ~/.claude/plans/tektone-mobile-parity.md. Staff-side project management:
// invite customers, draft contracts, create invoices, manage the (ADMIN-only)
// global add-ons catalog. Distinct from the customer's own Portal view
// (Phase 7) and from CRM (leads/sales).
//
// Scoped down from web per the plan's own note: PDF-import for contract
// drafting (client-side pdfjs-dist) and AI-generated banner upload are both
// small slices of a small slice — addon banners take a plain URL text field
// on mobile instead of an image picker/upload flow.

type Client = { id: string; name: string };
type Member = { user_email: string; role: string };
type Builder = { email: string; name: string; xp: number; level: number };
type Contract = { id: string; title: string; status: "SIGNED" | "PENDING" };
type Invoice = { id: string; description?: string; amount: number; currency?: string };
type Addon = { id: string; title: string; description?: string; price: number; special_price?: number | null; ai_banner_url?: string | null; is_active: boolean };

const brl = (n?: number | null, currency = "BRL") => Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency });

type Tab = "members" | "contracts" | "invoices" | "builders" | "addons";
const TAB_LABEL: Record<Tab, string> = { members: "clientes", contracts: "contratos", invoices: "faturas", builders: "construtores", addons: "add-ons" };

export default function CommercialScreen() {
  const { user } = useAuth();
  const isAdmin = Boolean(user?.admin);

  const [clients, setClients] = useState<Client[]>([]);
  const [projectId, setProjectId] = useState("");
  const [projectPickerOpen, setProjectPickerOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("members");
  const [error, setError] = useState("");

  useFocusEffect(
    useCallback(() => {
      api.listClients().then(({ clients }: any) => {
        setClients(clients);
        setProjectId((prev) => prev || clients?.[0]?.id || "");
      }).catch(() => {});
    }, [])
  );

  const tabs: Tab[] = ["members", "contracts", "invoices", "builders", ...(isAdmin ? (["addons"] as Tab[]) : [])];
  const selectedClient = clients.find((c) => c.id === projectId);

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.header}>
        <Briefcase size={16} color={colors.action} />
        <Text style={styles.title}>Comercial</Text>
      </View>

      <View style={{ paddingHorizontal: 16 }}>
        {clients.length > 0 && (
          <>
            <Pressable onPress={() => setProjectPickerOpen(true)} style={styles.selectBtn}>
              <Text style={styles.selectBtnText}>{selectedClient?.name || "Selecionar projeto"}</Text>
              <ChevronDown size={14} color={colors.stone500} />
            </Pressable>
            <PickerModal
              visible={projectPickerOpen}
              title="Projeto"
              options={clients.map((c) => ({ value: c.id, label: c.name }))}
              selected={projectId ? [projectId] : []}
              onToggle={(v) => { setProjectId(v); setProjectPickerOpen(false); }}
              onClose={() => setProjectPickerOpen(false)}
            />
          </>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.tabRow}>
          {tabs.map((t) => (
            <Pressable key={t} onPress={() => setTab(t)} style={[styles.tabBtn, tab === t && styles.tabBtnActive]}>
              <Text style={[styles.tabBtnText, tab === t && styles.tabBtnTextActive]}>{TAB_LABEL[t]}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 12, paddingBottom: 40 }}>
        {!projectId ? null : tab === "members" ? (
          <MembersTab projectId={projectId} onError={setError} />
        ) : tab === "builders" ? (
          <BuildersTab projectId={projectId} onError={setError} />
        ) : tab === "contracts" ? (
          <ContractsTab projectId={projectId} onError={setError} />
        ) : tab === "invoices" ? (
          <InvoicesTab projectId={projectId} onError={setError} />
        ) : (
          <AddonsTab onError={setError} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionIntro({ Icon, children }: { Icon: any; children: string }) {
  return (
    <View style={styles.intro}>
      <Icon size={14} color={colors.action} />
      <Text style={styles.introText}>{children}</Text>
    </View>
  );
}

function EmptyState({ Icon, children }: { Icon: any; children: string }) {
  return (
    <View style={styles.empty}>
      <Icon size={18} color={colors.stone400} />
      <Text style={styles.emptyText}>{children}</Text>
    </View>
  );
}

// ── clientes (members) ──────────────────────────────────────────────────
function MembersTab({ projectId, onError }: { projectId: string; onError: (e: string) => void }) {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api.listProjectUsers(projectId).then(({ users }: any) => setMembers(users)).catch(() => {});
  }, [projectId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function invite() {
    const target = email.trim().toLowerCase();
    if (!target) return;
    setBusy(true);
    onError("");
    try {
      await api.inviteProjectUser(projectId, target, "CUSTOMER");
      setEmail("");
      load();
    } catch (e) {
      onError(e instanceof ApiError ? e.body?.error || "Falha ao convidar." : "Falha ao convidar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View>
      <View style={styles.inviteRow}>
        <TextInput
          placeholder="email@cliente.com"
          placeholderTextColor={colors.stone400}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          style={[styles.input, { flex: 1, marginBottom: 0 }]}
        />
        <Pressable onPress={invite} disabled={busy || !email.trim()} style={[styles.primaryBtnSm, (busy || !email.trim()) && { opacity: 0.5 }]}>
          {busy ? <ActivityIndicator size="small" color={colors.clay} /> : <UserPlus size={13} color={colors.clay} />}
          <Text style={styles.primaryBtnSmText}>convidar</Text>
        </Pressable>
      </View>

      {members === null ? (
        <ActivityIndicator style={{ marginTop: 16 }} color={colors.action} />
      ) : members.length === 0 ? (
        <EmptyState Icon={Users}>Nenhum membro vinculado a este projeto ainda.</EmptyState>
      ) : (
        <View style={{ gap: 6 }}>
          {members.map((m) => (
            <View key={m.user_email} style={styles.listRow}>
              <View style={styles.avatarSm}><Text style={styles.avatarSmText}>{initials(m.user_email)}</Text></View>
              <Text style={styles.listRowText} numberOfLines={1}>{m.user_email}</Text>
              <View style={styles.roleTag}><Text style={styles.roleTagText}>{m.role}</Text></View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ── construtores ─────────────────────────────────────────────────────────
function BuildersTab({ projectId, onError }: { projectId: string; onError: (e: string) => void }) {
  const [builders, setBuilders] = useState<Builder[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      api.getProjectBuilders(projectId).then(({ builders }: any) => setBuilders(builders)).catch(() =>
        onError("Falha ao carregar construtores.")
      );
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [projectId])
  );

  return (
    <View>
      <SectionIntro Icon={Award}>
        Nível e XP de cada construtor, ganhos apenas com tarefas revisadas dentro deste projeto — um espelho do perfil
        “Jornada” de cada um, restrito ao que foi feito aqui.
      </SectionIntro>
      {builders === null ? (
        <ActivityIndicator style={{ marginTop: 16 }} color={colors.action} />
      ) : builders.length === 0 ? (
        <EmptyState Icon={Award}>Nenhuma tarefa revisada neste projeto ainda.</EmptyState>
      ) : (
        <View style={{ gap: 6 }}>
          {builders.map((b) => (
            <View key={b.email} style={styles.listRow}>
              <View style={styles.avatarSm}><Text style={styles.avatarSmText}>{initials(b.name)}</Text></View>
              <Text style={styles.listRowText} numberOfLines={1}>{b.name}</Text>
              <Text style={styles.xpText}>{b.xp} XP</Text>
              <View style={styles.levelTag}>
                <Award size={11} color={colors.action} />
                <Text style={styles.levelTagText}>nível {b.level}</Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ── contratos ────────────────────────────────────────────────────────────
function ContractsTab({ projectId, onError }: { projectId: string; onError: (e: string) => void }) {
  const [contracts, setContracts] = useState<Contract[] | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api.listContracts(projectId).then(({ contracts }: any) => setContracts(contracts)).catch(() => {});
  }, [projectId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function createContract() {
    if (!title.trim() || !content.trim()) return;
    setBusy(true);
    onError("");
    try {
      await api.createContract(projectId, { title, content });
      setTitle("");
      setContent("");
      load();
    } catch (e) {
      onError(e instanceof ApiError ? e.body?.error || "Falha ao criar contrato." : "Falha ao criar contrato.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View>
      <View style={styles.card}>
        <TextInput
          placeholder="Título do contrato"
          placeholderTextColor={colors.stone400}
          value={title}
          onChangeText={setTitle}
          style={styles.input}
        />
        <TextInput
          placeholder="Conteúdo do contrato"
          placeholderTextColor={colors.stone400}
          value={content}
          onChangeText={setContent}
          multiline
          numberOfLines={6}
          style={[styles.input, { minHeight: 120, textAlignVertical: "top" }]}
        />
        <Pressable
          onPress={createContract}
          disabled={busy || !title.trim() || !content.trim()}
          style={[styles.primaryBtn, (busy || !title.trim() || !content.trim()) && { opacity: 0.5 }]}
        >
          {busy ? <ActivityIndicator size="small" color={colors.clay} /> : <Plus size={13} color={colors.clay} />}
          <Text style={styles.primaryBtnText}>criar contrato</Text>
        </Pressable>
      </View>

      {contracts === null ? (
        <ActivityIndicator style={{ marginTop: 16 }} color={colors.action} />
      ) : contracts.length === 0 ? (
        <EmptyState Icon={FileText}>Nenhum contrato ainda.</EmptyState>
      ) : (
        <View style={{ gap: 6 }}>
          {contracts.map((c) => (
            <View key={c.id} style={styles.listRow}>
              <FileText size={14} color={colors.stone400} />
              <Text style={styles.listRowText} numberOfLines={1}>{c.title}</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                {c.status === "SIGNED" ? <CheckCircle2 size={11} color={colors.success} /> : <Clock size={11} color={colors.warning} />}
                <Text style={[styles.statusText, { color: c.status === "SIGNED" ? colors.success : colors.warning }]}>
                  {c.status === "SIGNED" ? "assinado" : "pendente"}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ── faturas ──────────────────────────────────────────────────────────────
function InvoicesTab({ projectId, onError }: { projectId: string; onError: (e: string) => void }) {
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [showDate, setShowDate] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api.listInvoices(projectId).then(({ invoices }: any) => setInvoices(invoices)).catch(() => {});
  }, [projectId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function createInvoice() {
    if (!(Number(amount) > 0)) return;
    setBusy(true);
    onError("");
    try {
      await api.createInvoice(projectId, { description, amount: Number(amount), dueDate });
      setDescription("");
      setAmount("");
      setDueDate("");
      load();
    } catch (e) {
      onError(e instanceof ApiError ? e.body?.error || "Falha ao criar fatura." : "Falha ao criar fatura.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View>
      <View style={styles.card}>
        <TextInput
          placeholder="Descrição"
          placeholderTextColor={colors.stone400}
          value={description}
          onChangeText={setDescription}
          style={styles.input}
        />
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
          <TextInput
            placeholder="Valor (R$)"
            placeholderTextColor={colors.stone400}
            value={amount}
            onChangeText={(v) => setAmount(v.replace(/[^0-9.]/g, ""))}
            keyboardType="decimal-pad"
            style={[styles.input, { flex: 1, marginBottom: 0 }]}
          />
          <Pressable onPress={() => setShowDate(true)} style={[styles.selectBtn, { flex: 1, marginBottom: 0 }]}>
            <CalendarIcon size={13} color={colors.stone500} />
            <Text style={styles.selectBtnText}>{dueDate || "Vencimento"}</Text>
          </Pressable>
        </View>
        {showDate && (
          <DateTimePicker
            value={dueDate ? new Date(`${dueDate}T12:00:00`) : new Date()}
            mode="date"
            onChange={(_, date) => {
              setShowDate(false);
              if (date) setDueDate(date.toISOString().slice(0, 10));
            }}
          />
        )}
        <Pressable
          onPress={createInvoice}
          disabled={busy || !(Number(amount) > 0)}
          style={[styles.primaryBtn, (busy || !(Number(amount) > 0)) && { opacity: 0.5 }]}
        >
          {busy ? <ActivityIndicator size="small" color={colors.clay} /> : <Plus size={13} color={colors.clay} />}
          <Text style={styles.primaryBtnText}>criar fatura</Text>
        </Pressable>
      </View>

      {invoices === null ? (
        <ActivityIndicator style={{ marginTop: 16 }} color={colors.action} />
      ) : invoices.length === 0 ? (
        <EmptyState Icon={Receipt}>Nenhuma fatura ainda.</EmptyState>
      ) : (
        <View style={{ gap: 6 }}>
          {invoices.map((inv) => (
            <View key={inv.id} style={styles.listRow}>
              <Receipt size={14} color={colors.stone400} />
              <Text style={styles.listRowText} numberOfLines={1}>{inv.description || "Fatura"}</Text>
              <Text style={styles.amountText}>{brl(inv.amount, inv.currency)}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ── add-ons (ADMIN only) ────────────────────────────────────────────────
function AddonsTab({ onError }: { onError: (e: string) => void }) {
  const [catalog, setCatalog] = useState<Addon[] | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [specialPrice, setSpecialPrice] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api.listAddonsCatalog().then(({ addons }: any) => setCatalog(addons)).catch(() => {});
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function createAddon() {
    if (!title.trim() || !(Number(price) > 0)) return;
    setBusy(true);
    onError("");
    try {
      await api.createAddon({
        title,
        description,
        price: Number(price),
        specialPrice: specialPrice ? Number(specialPrice) : null,
        aiBannerUrl: bannerUrl || null,
      });
      setTitle("");
      setDescription("");
      setPrice("");
      setSpecialPrice("");
      setBannerUrl("");
      load();
    } catch (e) {
      onError(e instanceof ApiError ? e.body?.error || "Falha ao criar add-on." : "Falha ao criar add-on.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(a: Addon) {
    setBusy(true);
    try {
      await api.updateAddon(a.id, { isActive: !a.is_active });
      load();
    } catch (e) {
      onError(e instanceof ApiError ? e.body?.error || "Falha ao atualizar." : "Falha ao atualizar.");
    } finally {
      setBusy(false);
    }
  }

  function confirmRemove(a: Addon) {
    Alert.alert("Remover add-on", `Remover "${a.title}" do catálogo?`, [
      { text: "Cancelar", style: "cancel" },
      { text: "Remover", style: "destructive", onPress: () => removeAddon(a) },
    ]);
  }

  async function removeAddon(a: Addon) {
    setBusy(true);
    try {
      await api.deleteAddon(a.id);
      load();
    } catch (e) {
      onError(e instanceof ApiError ? e.body?.error || "Falha ao remover." : "Falha ao remover.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View>
      <SectionIntro Icon={ShoppingBag}>Catálogo global — visível para todos os clientes no marketplace.</SectionIntro>

      <View style={styles.card}>
        <TextInput placeholder="Título" placeholderTextColor={colors.stone400} value={title} onChangeText={setTitle} style={styles.input} />
        <TextInput
          placeholder="Descrição"
          placeholderTextColor={colors.stone400}
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={2}
          style={[styles.input, { minHeight: 50, textAlignVertical: "top" }]}
        />
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
          <TextInput
            placeholder="Preço (R$)"
            placeholderTextColor={colors.stone400}
            value={price}
            onChangeText={(v) => setPrice(v.replace(/[^0-9.]/g, ""))}
            keyboardType="decimal-pad"
            style={[styles.input, { flex: 1, marginBottom: 0 }]}
          />
          <TextInput
            placeholder="Preço promo (opcional)"
            placeholderTextColor={colors.stone400}
            value={specialPrice}
            onChangeText={(v) => setSpecialPrice(v.replace(/[^0-9.]/g, ""))}
            keyboardType="decimal-pad"
            style={[styles.input, { flex: 1, marginBottom: 0 }]}
          />
        </View>
        <TextInput
          placeholder="URL do banner (opcional)"
          placeholderTextColor={colors.stone400}
          value={bannerUrl}
          onChangeText={setBannerUrl}
          autoCapitalize="none"
          style={styles.input}
        />
        <Pressable
          onPress={createAddon}
          disabled={busy || !title.trim() || !(Number(price) > 0)}
          style={[styles.primaryBtn, (busy || !title.trim() || !(Number(price) > 0)) && { opacity: 0.5 }]}
        >
          {busy ? <ActivityIndicator size="small" color={colors.clay} /> : <Plus size={13} color={colors.clay} />}
          <Text style={styles.primaryBtnText}>criar add-on</Text>
        </Pressable>
      </View>

      {catalog === null ? (
        <ActivityIndicator style={{ marginTop: 16 }} color={colors.action} />
      ) : catalog.length === 0 ? (
        <EmptyState Icon={ShoppingBag}>Nenhum add-on no catálogo ainda.</EmptyState>
      ) : (
        <View style={{ gap: 6 }}>
          {catalog.map((a) => (
            <View key={a.id} style={styles.listRow}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.listRowText, !a.is_active && { color: colors.stone400, textDecorationLine: "line-through" }]} numberOfLines={1}>
                  {a.title}
                </Text>
                <Text style={styles.priceText}>
                  {brl(a.special_price || a.price)}
                  {a.special_price ? `  ${brl(a.price)}` : ""}
                </Text>
              </View>
              <Pressable onPress={() => toggleActive(a)} disabled={busy} style={{ padding: 6 }}>
                {a.is_active ? <Eye size={14} color={colors.stone500} /> : <EyeOff size={14} color={colors.stone500} />}
              </Pressable>
              <Pressable onPress={() => confirmRemove(a)} disabled={busy} style={{ padding: 6 }}>
                <Trash2 size={14} color={colors.stone500} />
              </Pressable>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.clay },
  header: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingTop: 8 },
  title: { fontFamily: fonts.sansSemiBold, fontSize: 16, color: colors.ink },
  error: { fontFamily: fonts.mono, fontSize: 11, color: colors.danger, marginTop: 8 },

  selectBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6, borderWidth: 1, borderColor: "rgba(20,22,24,0.15)",
    backgroundColor: "rgba(20,22,24,0.03)", borderRadius: radii.md, paddingHorizontal: 12, paddingVertical: 10, marginTop: 10, marginBottom: 4,
  },
  selectBtnText: { fontFamily: fonts.sans, fontSize: 13, color: colors.ink, flexShrink: 1 },

  tabRow: { flexDirection: "row", flexWrap: "wrap", gap: 4, backgroundColor: colors.paper, borderRadius: radii.md, padding: 4, marginTop: 10 },
  tabBtn: { flexGrow: 1, borderRadius: radii.sm, paddingVertical: 7, alignItems: "center" },
  tabBtnActive: { backgroundColor: colors.clay },
  tabBtnText: { fontFamily: fonts.mono, fontSize: 10.5, color: colors.stone500 },
  tabBtnTextActive: { color: colors.ink, fontFamily: fonts.monoMedium },

  intro: { flexDirection: "row", alignItems: "flex-start", gap: 8, borderWidth: 1, borderColor: `${colors.action}33`, backgroundColor: `${colors.action}0d`, borderRadius: radii.md, padding: 12, marginBottom: 12 },
  introText: { flex: 1, fontFamily: fonts.sans, fontSize: 12, color: colors.ink, lineHeight: 17, opacity: 0.8 },
  empty: { alignItems: "center", gap: 8, borderWidth: 1, borderStyle: "dashed", borderColor: "rgba(20,22,24,0.12)", borderRadius: radii.md, paddingVertical: 32 },
  emptyText: { fontFamily: fonts.sans, fontSize: 12, color: colors.stone500 },

  card: { ...surfaces[3], borderRadius: radii.lg, padding: 12, marginBottom: 14 },
  input: {
    borderWidth: 1, borderColor: "rgba(20,22,24,0.15)", backgroundColor: colors.paper, borderRadius: radii.md,
    paddingHorizontal: 10, paddingVertical: 9, fontSize: 13, color: colors.ink, fontFamily: fonts.sans, marginBottom: 8,
  },
  inviteRow: { flexDirection: "row", gap: 8, ...surfaces[3], borderRadius: radii.lg, padding: 12, marginBottom: 14 },
  primaryBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.action, borderRadius: radii.md, paddingVertical: 12 },
  primaryBtnText: { fontFamily: fonts.sansBold, fontSize: 12.5, color: colors.clay },
  primaryBtnSm: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.action, borderRadius: radii.md, paddingHorizontal: 12, paddingVertical: 10 },
  primaryBtnSmText: { fontFamily: fonts.sansBold, fontSize: 11.5, color: colors.clay },

  listRow: { flexDirection: "row", alignItems: "center", gap: 10, ...surfaces[3], borderRadius: radii.md, paddingHorizontal: 12, paddingVertical: 10 },
  listRowText: { flex: 1, fontFamily: fonts.sans, fontSize: 13, color: colors.ink, minWidth: 0 },
  avatarSm: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.action, alignItems: "center", justifyContent: "center" },
  avatarSmText: { fontFamily: fonts.sansBold, fontSize: 10, color: colors.clay },
  roleTag: { backgroundColor: "rgba(20,22,24,0.06)", borderRadius: 5, paddingHorizontal: 8, paddingVertical: 2 },
  roleTagText: { fontFamily: fonts.mono, fontSize: 9.5, textTransform: "uppercase", letterSpacing: 0.5, color: colors.stone500 },
  xpText: { fontFamily: fonts.mono, fontSize: 10, color: colors.stone500 },
  levelTag: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: `${colors.action}18`, borderRadius: 5, paddingHorizontal: 7, paddingVertical: 3 },
  levelTagText: { fontFamily: fonts.monoMedium, fontSize: 10, color: colors.action },
  statusText: { fontFamily: fonts.mono, fontSize: 9.5, textTransform: "uppercase", letterSpacing: 0.5 },
  amountText: { fontFamily: fonts.sansSemiBold, fontSize: 13, color: colors.ink },
  priceText: { fontFamily: fonts.mono, fontSize: 10, color: colors.stone500, marginTop: 2 },
});
