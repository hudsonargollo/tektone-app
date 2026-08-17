import { useCallback, useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, StyleSheet } from "react-native";
import { useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import DateTimePicker from "@react-native-community/datetimepicker";
import {
  Wallet,
  Lock,
  TrendingUp,
  TrendingDown,
  Plus,
  Archive,
  ArchiveRestore,
  Pencil,
  FolderPlus,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  CreditCard,
  Clock,
  Calendar as CalendarIcon,
} from "lucide-react-native";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { colors, fonts, radii, surfaces } from "@/lib/theme";
import PickerModal, { type PickerOption } from "@/components/CardDetail/PickerModal";

// Port of src/components/FinancePanel.jsx — Phase 5 of
// ~/.claude/plans/tektone-mobile-parity.md. Internal financial tracking,
// STAFF/ADMIN only (this screen itself is only reachable from more.tsx when
// user.financeAccess is true). Only ADMIN can edit budget target / add /
// archive costs — finance-authorized STAFF sees everything read-only, same
// split as web.

type Client = { id: string; name: string };
type Finances = {
  totalInternalBudget?: number;
  notes?: string;
  income?: { paid?: number; pending?: number };
  costs?: { total?: number; recurring?: number };
  profitMargin?: number | null;
};
type CostCategory = { id: string; name: string; color?: string };
type Cost = {
  id: string;
  name: string;
  amount: number;
  recurrence: "once" | "monthly" | "annual";
  cost_date: string;
  status: "active" | "archived";
  category_name?: string;
  category_color?: string;
  payment_method?: string;
  card_alias?: string;
};

const RECURRENCE_LABELS: Record<string, string> = { once: "única", monthly: "mensal", annual: "anual" };
const PAYMENT_METHODS: PickerOption[] = [
  { value: "pix", label: "Pix" },
  { value: "boleto", label: "Boleto" },
  { value: "cartao", label: "Cartão de crédito" },
  { value: "transferencia", label: "Transferência" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "outro", label: "Outro" },
];
const PAYMENT_LABEL: Record<string, string> = Object.fromEntries(PAYMENT_METHODS.map((p) => [p.value, p.label]));
const RECURRENCE_OPTIONS: PickerOption[] = [
  { value: "once", label: "Única (ex: freelancer)" },
  { value: "monthly", label: "Mensal" },
  { value: "annual", label: "Anual" },
];

const brl = (n?: number | null) => Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (iso?: string) => (iso ? new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR") : "—");
const todayISO = () => new Date().toISOString().slice(0, 10);
const currentMonth = () => new Date().toISOString().slice(0, 7);
const defaultCostDate = (month: string) => (month === currentMonth() ? todayISO() : `${month}-01`);
const monthLabel = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
};
const shiftMonth = (month: string, delta: number) => {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

function emptyDraft(month: string) {
  return {
    name: "",
    categoryId: "",
    amount: "",
    recurrence: "once" as "once" | "monthly" | "annual",
    costDate: defaultCostDate(month),
    paymentMethod: "",
    cardAlias: "",
  };
}

export default function FinanceScreen() {
  const { user } = useAuth();
  const isAdmin = Boolean(user?.admin);

  const [clients, setClients] = useState<Client[]>([]);
  const [projectId, setProjectId] = useState("");
  const [projectPickerOpen, setProjectPickerOpen] = useState(false);
  const [month, setMonth] = useState(currentMonth());
  const [finances, setFinances] = useState<Finances | null>(null);
  const [costs, setCosts] = useState<Cost[] | null>(null);
  const [categories, setCategories] = useState<CostCategory[] | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const [budgetDraft, setBudgetDraft] = useState({ totalInternalBudget: "", notes: "" });
  const [editingBudget, setEditingBudget] = useState(false);

  const [showAddCost, setShowAddCost] = useState(false);
  const [costDraft, setCostDraft] = useState(() => emptyDraft(currentMonth()));
  const [newCategoryName, setNewCategoryName] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [paymentPickerOpen, setPaymentPickerOpen] = useState(false);
  const [recurrencePickerOpen, setRecurrencePickerOpen] = useState(false);

  useFocusEffect(
    useCallback(() => {
      api.listClients().then(({ clients }: any) => {
        setClients(clients);
        setProjectId((prev) => prev || clients?.[0]?.id || "");
      }).catch(() => {});
      api.listCostCategories().then(({ categories }: any) => setCategories(categories)).catch(() => {});
    }, [])
  );

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError("");
    try {
      const [f, c] = await Promise.all([
        api.getFinances(projectId, month),
        api.listCosts(projectId, { all: showArchived, month }),
      ]);
      setFinances(f.finances);
      setCosts(c.costs);
      setBudgetDraft({
        totalInternalBudget: f.finances.totalInternalBudget ? String(f.finances.totalInternalBudget) : "",
        notes: f.finances.notes || "",
      });
    } catch (e) {
      setError(e instanceof ApiError ? e.body?.error || "Falha ao carregar." : "Falha ao carregar.");
    } finally {
      setLoading(false);
    }
  }, [projectId, month, showArchived]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function saveBudget() {
    setSaving(true);
    setError("");
    try {
      await api.updateFinances(projectId, {
        totalInternalBudget: Number(budgetDraft.totalInternalBudget) || 0,
        notes: budgetDraft.notes,
      });
      setEditingBudget(false);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.body?.error || "Falha ao salvar." : "Falha ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function addCost() {
    if (!costDraft.name.trim() || !(Number(costDraft.amount) > 0)) return;
    setBusy("new");
    setError("");
    try {
      await api.createCost(projectId, {
        name: costDraft.name,
        categoryId: costDraft.categoryId || null,
        amount: Number(costDraft.amount),
        recurrence: costDraft.recurrence,
        costDate: costDraft.costDate,
        paymentMethod: costDraft.paymentMethod || null,
        cardAlias: costDraft.paymentMethod === "cartao" ? costDraft.cardAlias : "",
      });
      setCostDraft(emptyDraft(month));
      setShowAddCost(false);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.body?.error || "Falha ao adicionar custo." : "Falha ao adicionar custo.");
    } finally {
      setBusy(null);
    }
  }

  async function toggleArchive(cost: Cost) {
    setBusy(cost.id);
    setError("");
    try {
      await api.toggleCostArchive(projectId, cost.id);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.body?.error || "Falha ao atualizar." : "Falha ao atualizar.");
    } finally {
      setBusy(null);
    }
  }

  async function addCategory() {
    if (!newCategoryName.trim()) return;
    setAddingCategory(true);
    try {
      const { category } = await api.createCostCategory({ name: newCategoryName.trim() });
      setCategories((prev) => [...(prev || []), category].sort((a, b) => a.name.localeCompare(b.name)));
      setCostDraft((d) => ({ ...d, categoryId: category.id }));
      setNewCategoryName("");
    } catch (e) {
      setError(e instanceof ApiError ? e.body?.error || "Falha ao criar categoria." : "Falha ao criar categoria.");
    } finally {
      setAddingCategory(false);
    }
  }

  const margin = finances?.profitMargin;
  const marginColor = margin == null ? colors.stone500 : margin >= 0 ? colors.success : colors.danger;
  const isCurrentMonth = month === currentMonth();
  const selectedClient = clients.find((c) => c.id === projectId);
  const selectedCategory = categories?.find((c) => c.id === costDraft.categoryId);

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.header}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Wallet size={16} color={colors.action} />
          <Text style={styles.title}>Financeiro</Text>
          <Lock size={11} color={colors.stone400} />
        </View>
        <View style={styles.monthNav}>
          <Pressable onPress={() => setMonth((m) => shiftMonth(m, -1))} style={styles.monthBtn}>
            <ChevronLeft size={15} color={colors.stone500} />
          </Pressable>
          <Text style={styles.monthLabel}>{monthLabel(month)}</Text>
          <Pressable onPress={() => setMonth((m) => shiftMonth(m, 1))} style={styles.monthBtn}>
            <ChevronRight size={15} color={colors.stone500} />
          </Pressable>
        </View>
      </View>
      {!isCurrentMonth && (
        <Pressable onPress={() => setMonth(currentMonth())} style={{ alignSelf: "flex-end", paddingHorizontal: 16 }}>
          <Text style={styles.todayLink}>hoje</Text>
        </Pressable>
      )}

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
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

        {loading ? (
          <ActivityIndicator style={{ marginTop: 24 }} color={colors.action} />
        ) : (
          <>
            <View style={styles.tilesGrid}>
              <Tile label="Receita paga" value={brl(finances?.income?.paid)} valueColor={colors.success} />
              <Tile label="Receita pendente" value={brl(finances?.income?.pending)} valueColor={colors.warning} icon={Clock} />
              <Tile label="Custo do mês" value={brl(finances?.costs?.total)} />
              <Tile label="Recorrente" value={brl(finances?.costs?.recurring)} />
              <Tile
                label="Margem"
                value={margin == null ? "—" : `${margin}%`}
                valueColor={marginColor}
                icon={margin != null ? (margin >= 0 ? TrendingUp : TrendingDown) : undefined}
              />
            </View>

            <View style={styles.card}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <Text style={styles.fieldLabel}>Meta de orçamento</Text>
                {isAdmin && !editingBudget && (
                  <Pressable onPress={() => setEditingBudget(true)} hitSlop={8}>
                    <Pencil size={12} color={colors.stone400} />
                  </Pressable>
                )}
              </View>
              {editingBudget ? (
                <View>
                  <TextInput
                    placeholder="Orçamento (R$)"
                    placeholderTextColor={colors.stone400}
                    value={budgetDraft.totalInternalBudget}
                    onChangeText={(v) => setBudgetDraft((d) => ({ ...d, totalInternalBudget: v.replace(/[^0-9.]/g, "") }))}
                    keyboardType="decimal-pad"
                    style={styles.input}
                  />
                  <TextInput
                    placeholder="Notas"
                    placeholderTextColor={colors.stone400}
                    value={budgetDraft.notes}
                    onChangeText={(v) => setBudgetDraft((d) => ({ ...d, notes: v }))}
                    multiline
                    numberOfLines={2}
                    style={[styles.input, { minHeight: 60, textAlignVertical: "top" }]}
                  />
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <Pressable onPress={saveBudget} disabled={saving} style={[styles.primaryBtnSm, saving && { opacity: 0.5 }]}>
                      {saving ? <ActivityIndicator size="small" color={colors.clay} /> : null}
                      <Text style={styles.primaryBtnSmText}>salvar</Text>
                    </Pressable>
                    <Pressable onPress={() => setEditingBudget(false)} style={styles.outlineBtn}>
                      <Text style={styles.outlineBtnText}>cancelar</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <>
                  <Text style={styles.budgetValue}>{brl(finances?.totalInternalBudget)}</Text>
                  {finances?.notes ? <Text style={styles.budgetNotes}>{finances.notes}</Text> : null}
                </>
              )}
            </View>

            <View style={styles.ledgerHead}>
              <View style={styles.segRow}>
                <Pressable onPress={() => setShowArchived(false)} style={[styles.segBtn, !showArchived && styles.segBtnActive]}>
                  <Text style={[styles.segBtnText, !showArchived && styles.segBtnTextActive]}>ativos</Text>
                </Pressable>
                <Pressable onPress={() => setShowArchived(true)} style={[styles.segBtn, showArchived && styles.segBtnActive]}>
                  <Text style={[styles.segBtnText, showArchived && styles.segBtnTextActive]}>todos</Text>
                </Pressable>
              </View>
              {isAdmin && (
                <Pressable onPress={() => setShowAddCost((v) => !v)} style={styles.addCostBtn}>
                  <Plus size={13} color={colors.clay} />
                  <Text style={styles.primaryBtnSmText}>custo</Text>
                </Pressable>
              )}
            </View>

            {showAddCost && (
              <View style={styles.card}>
                <TextInput
                  placeholder="Nome (ex: Google Workspace, freelancer motion video)"
                  placeholderTextColor={colors.stone400}
                  value={costDraft.name}
                  onChangeText={(v) => setCostDraft((d) => ({ ...d, name: v }))}
                  style={styles.input}
                />
                <TextInput
                  placeholder="Valor (R$)"
                  placeholderTextColor={colors.stone400}
                  value={costDraft.amount}
                  onChangeText={(v) => setCostDraft((d) => ({ ...d, amount: v.replace(/[^0-9.]/g, "") }))}
                  keyboardType="decimal-pad"
                  style={styles.input}
                />
                <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
                  <Pressable onPress={() => setRecurrencePickerOpen(true)} style={[styles.selectBtn, { flex: 1, marginBottom: 0 }]}>
                    <Text style={styles.selectBtnText}>{RECURRENCE_OPTIONS.find((o) => o.value === costDraft.recurrence)?.label}</Text>
                    <ChevronDown size={13} color={colors.stone500} />
                  </Pressable>
                  <Pressable onPress={() => setShowDatePicker(true)} style={[styles.selectBtn, { flex: 1, marginBottom: 0 }]}>
                    <CalendarIcon size={13} color={colors.stone500} />
                    <Text style={styles.selectBtnText}>{fmtDate(costDraft.costDate)}</Text>
                  </Pressable>
                </View>
                {showDatePicker && (
                  <DateTimePicker
                    value={new Date(`${costDraft.costDate}T12:00:00`)}
                    mode="date"
                    onChange={(_, date) => {
                      setShowDatePicker(false);
                      if (date) setCostDraft((d) => ({ ...d, costDate: date.toISOString().slice(0, 10) }));
                    }}
                  />
                )}
                <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
                  <Pressable onPress={() => setCategoryPickerOpen(true)} style={[styles.selectBtn, { flex: 1, marginBottom: 0 }]}>
                    <Text style={styles.selectBtnText} numberOfLines={1}>{selectedCategory?.name || "Sem categoria"}</Text>
                    <ChevronDown size={13} color={colors.stone500} />
                  </Pressable>
                  <Pressable onPress={() => setPaymentPickerOpen(true)} style={[styles.selectBtn, { flex: 1, marginBottom: 0 }]}>
                    <Text style={styles.selectBtnText} numberOfLines={1}>
                      {PAYMENT_LABEL[costDraft.paymentMethod] || "Forma de pagamento"}
                    </Text>
                    <ChevronDown size={13} color={colors.stone500} />
                  </Pressable>
                </View>
                {costDraft.paymentMethod === "cartao" && (
                  <TextInput
                    placeholder="Apelido do cartão (ex: Nubank PJ) — nunca o número"
                    placeholderTextColor={colors.stone400}
                    value={costDraft.cardAlias}
                    onChangeText={(v) => setCostDraft((d) => ({ ...d, cardAlias: v }))}
                    style={styles.input}
                  />
                )}
                <View style={styles.newCategoryRow}>
                  <TextInput
                    placeholder="nova categoria"
                    placeholderTextColor={colors.stone400}
                    value={newCategoryName}
                    onChangeText={setNewCategoryName}
                    style={[styles.input, { flex: 1, marginBottom: 0 }]}
                  />
                  <Pressable onPress={addCategory} disabled={addingCategory || !newCategoryName.trim()} style={styles.outlineBtn}>
                    {addingCategory ? <ActivityIndicator size="small" color={colors.stone500} /> : <FolderPlus size={11} color={colors.stone500} />}
                    <Text style={styles.outlineBtnText}>categoria</Text>
                  </Pressable>
                </View>
                <Pressable
                  onPress={addCost}
                  disabled={busy === "new" || !costDraft.name.trim() || !(Number(costDraft.amount) > 0)}
                  style={[styles.primaryBtn, (busy === "new" || !costDraft.name.trim() || !(Number(costDraft.amount) > 0)) && { opacity: 0.5 }]}
                >
                  {busy === "new" ? <ActivityIndicator size="small" color={colors.clay} /> : null}
                  <Text style={styles.primaryBtnText}>adicionar custo</Text>
                </Pressable>

                <PickerModal
                  visible={recurrencePickerOpen}
                  title="Recorrência"
                  options={RECURRENCE_OPTIONS}
                  selected={[costDraft.recurrence]}
                  onToggle={(v) => { setCostDraft((d) => ({ ...d, recurrence: v as any })); setRecurrencePickerOpen(false); }}
                  onClose={() => setRecurrencePickerOpen(false)}
                />
                <PickerModal
                  visible={categoryPickerOpen}
                  title="Categoria"
                  options={[{ value: "", label: "Sem categoria" }, ...((categories || []).map((c) => ({ value: c.id, label: c.name })))]}
                  selected={[costDraft.categoryId]}
                  onToggle={(v) => { setCostDraft((d) => ({ ...d, categoryId: v })); setCategoryPickerOpen(false); }}
                  onClose={() => setCategoryPickerOpen(false)}
                />
                <PickerModal
                  visible={paymentPickerOpen}
                  title="Forma de pagamento"
                  options={[{ value: "", label: "Sem forma de pagamento" }, ...PAYMENT_METHODS]}
                  selected={[costDraft.paymentMethod]}
                  onToggle={(v) => { setCostDraft((d) => ({ ...d, paymentMethod: v })); setPaymentPickerOpen(false); }}
                  onClose={() => setPaymentPickerOpen(false)}
                />
              </View>
            )}

            {costs === null ? (
              <ActivityIndicator style={{ marginTop: 16 }} color={colors.action} />
            ) : costs.length === 0 ? (
              <Text style={styles.emptyText}>Nenhum custo neste mês.</Text>
            ) : (
              <View style={{ gap: 6, marginTop: 4 }}>
                {costs.map((c) => (
                  <View key={c.id} style={[styles.costRow, c.status === "archived" && { opacity: 0.5 }]}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 5 }}>
                        <Text style={styles.costName} numberOfLines={1}>{c.name}</Text>
                        {c.category_name ? (
                          <View style={[styles.tag, { backgroundColor: `${c.category_color || colors.stone400}22` }]}>
                            <Text style={[styles.tagText, { color: c.category_color || colors.stone500 }]}>{c.category_name}</Text>
                          </View>
                        ) : null}
                        {c.payment_method ? (
                          <View style={styles.tag}>
                            {c.payment_method === "cartao" ? <CreditCard size={9} color={colors.stone500} /> : null}
                            <Text style={styles.tagText}>
                              {PAYMENT_LABEL[c.payment_method] || c.payment_method}
                              {c.card_alias ? ` · ${c.card_alias}` : ""}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={styles.costMeta}>{fmtDate(c.cost_date)} · {RECURRENCE_LABELS[c.recurrence] || c.recurrence}</Text>
                    </View>
                    <Text style={styles.costAmount}>{brl(c.amount)}</Text>
                    {isAdmin && (
                      <Pressable onPress={() => toggleArchive(c)} disabled={busy === c.id} style={{ padding: 4 }}>
                        {busy === c.id ? (
                          <ActivityIndicator size="small" color={colors.stone400} />
                        ) : c.status === "active" ? (
                          <Archive size={14} color={colors.stone400} />
                        ) : (
                          <ArchiveRestore size={14} color={colors.stone400} />
                        )}
                      </Pressable>
                    )}
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Tile({ label, value, valueColor, icon: Icon }: { label: string; value: string; valueColor?: string; icon?: any }) {
  return (
    <View style={styles.tile}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
        {Icon ? <Icon size={9} color={colors.stone500} /> : null}
        <Text style={styles.tileLabel}>{label}</Text>
      </View>
      <Text style={[styles.tileValue, valueColor ? { color: valueColor } : null]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.clay },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 8, flexWrap: "wrap", gap: 8 },
  title: { fontFamily: fonts.sansSemiBold, fontSize: 16, color: colors.ink },
  monthNav: { flexDirection: "row", alignItems: "center", gap: 2, backgroundColor: colors.paper, borderRadius: radii.md, padding: 3 },
  monthBtn: { padding: 4 },
  monthLabel: { fontFamily: fonts.monoMedium, fontSize: 10.5, textTransform: "uppercase", color: colors.ink, minWidth: 92, textAlign: "center" },
  todayLink: { fontFamily: fonts.monoMedium, fontSize: 10, color: colors.action },
  error: { fontFamily: fonts.mono, fontSize: 11, color: colors.danger, marginBottom: 8 },
  emptyText: { fontFamily: fonts.sans, fontSize: 12, color: colors.stone500, marginTop: 8 },

  selectBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6, borderWidth: 1, borderColor: "rgba(20,22,24,0.15)",
    backgroundColor: "rgba(20,22,24,0.03)", borderRadius: radii.md, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12,
  },
  selectBtnText: { fontFamily: fonts.sans, fontSize: 13, color: colors.ink, flexShrink: 1 },

  tilesGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  tile: { ...surfaces[3], borderRadius: radii.md, padding: 10, width: "31%" },
  tileLabel: { fontFamily: fonts.mono, fontSize: 8.5, textTransform: "uppercase", letterSpacing: 0.5, color: colors.stone500 },
  tileValue: { fontFamily: fonts.sansSemiBold, fontSize: 13, color: colors.ink, marginTop: 3 },

  card: { ...surfaces[3], borderRadius: radii.lg, padding: 12, marginBottom: 14 },
  fieldLabel: { fontFamily: fonts.mono, fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: colors.stone500 },
  budgetValue: { fontFamily: fonts.sansSemiBold, fontSize: 14, color: colors.ink },
  budgetNotes: { fontFamily: fonts.sans, fontSize: 12, color: colors.stone500, marginTop: 4 },
  input: {
    borderWidth: 1, borderColor: "rgba(20,22,24,0.15)", backgroundColor: colors.paper, borderRadius: radii.md,
    paddingHorizontal: 10, paddingVertical: 9, fontSize: 13, color: colors.ink, fontFamily: fonts.sans, marginBottom: 8,
  },
  primaryBtnSm: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: colors.action, borderRadius: radii.md, paddingHorizontal: 12, paddingVertical: 9 },
  primaryBtnSmText: { fontFamily: fonts.sansBold, fontSize: 11.5, color: colors.clay },
  outlineBtn: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderColor: "rgba(20,22,24,0.15)", borderRadius: radii.md, paddingHorizontal: 10, paddingVertical: 9 },
  outlineBtnText: { fontFamily: fonts.mono, fontSize: 10.5, color: colors.stone500 },
  primaryBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.action, borderRadius: radii.md, paddingVertical: 12, marginTop: 4 },
  primaryBtnText: { fontFamily: fonts.sansBold, fontSize: 12.5, color: colors.clay },
  addCostBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.action, borderRadius: radii.md, paddingHorizontal: 12, paddingVertical: 9 },

  ledgerHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10, flexWrap: "wrap", gap: 8 },
  segRow: { flexDirection: "row", gap: 2, backgroundColor: colors.paper, borderRadius: radii.md, padding: 3 },
  segBtn: { borderRadius: radii.sm, paddingHorizontal: 10, paddingVertical: 6 },
  segBtnActive: { backgroundColor: colors.clay },
  segBtnText: { fontFamily: fonts.mono, fontSize: 10.5, color: colors.stone500 },
  segBtnTextActive: { color: colors.ink, fontFamily: fonts.monoMedium },

  newCategoryRow: { flexDirection: "row", gap: 8, borderTopWidth: 1, borderTopColor: "rgba(20,22,24,0.1)", paddingTop: 8, marginBottom: 4 },

  costRow: { flexDirection: "row", alignItems: "center", gap: 8, ...surfaces[3], borderRadius: radii.md, paddingHorizontal: 12, paddingVertical: 10 },
  costName: { fontFamily: fonts.sansSemiBold, fontSize: 13, color: colors.ink, flexShrink: 1 },
  costMeta: { fontFamily: fonts.mono, fontSize: 10, color: colors.stone500, marginTop: 2 },
  costAmount: { fontFamily: fonts.monoMedium, fontSize: 13, color: colors.ink },
  tag: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "rgba(20,22,24,0.05)", borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  tagText: { fontFamily: fonts.mono, fontSize: 9, textTransform: "uppercase", letterSpacing: 0.4, color: colors.stone500 },
});
