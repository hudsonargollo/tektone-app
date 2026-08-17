import { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Modal,
  Linking,
  StyleSheet,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  LayoutGrid,
  Users,
  DollarSign,
  TrendingUp,
  Phone,
  Tag,
  UserCheck,
  Search,
  MessageCircle,
  Inbox,
  Plus,
  X,
  Flame,
  ChevronDown,
  Pencil,
  Check,
} from "lucide-react-native";
import { crmApi, CrmApiError } from "@/lib/crmApi";
import { useAuth } from "@/lib/auth";
import { LEAD_STATUSES, TIER_COLOR, TIER_LABEL, CATEGORY_PALETTE, brl, waLink, timeAgo } from "@/lib/crmStatus";
import { colors, fonts, radii, surfaces } from "@/lib/theme";
import CrmDonut from "@/components/CrmDonut";
import PickerModal from "@/components/CardDetail/PickerModal";

// Port of src/crm/CrmPanel.jsx + CrmDashboard.jsx + CrmLeads.jsx +
// CrmSales.jsx — Phase 8 of ~/.claude/plans/tektone-mobile-parity.md.
// Gated by crmRole (closer/admin) via more.tsx's nav visibility, same as
// web's own menu-level gate; the backend 401s regardless (requireCrm in
// worker/crm-entry.js).
//
// Scoped down from web's pipeline board: this codebase's established
// mobile precedent is no drag-and-drop anywhere (chevron-button reorder
// instead, see board.tsx) — web's lane-based Kanban with native HTML5 DnD
// has no mobile equivalent here, so Pipeline is a status-filtered list
// instead of lanes; moving a lead between stages happens on its detail
// screen (crm-lead/[id].tsx), which already has the stage-button row.
// Also scoped down: the filter panel's date-range (created-at) filter is
// dropped for v1 — tier + source + search cover the common case; a small
// slice of a small slice, same reasoning as Phase 6's addon-banner scoping.

type Tab = "dashboard" | "leads" | "sales";
const TABS: { key: Tab; label: string; Icon: any }[] = [
  { key: "dashboard", label: "Dashboard", Icon: LayoutGrid },
  { key: "leads", label: "Pipeline", Icon: Users },
  { key: "sales", label: "Vendas", Icon: DollarSign },
];

export default function CrmScreen() {
  const [tab, setTab] = useState<Tab>("dashboard");

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.header}>
        <TrendingUp size={16} color={colors.action} />
        <Text style={styles.title}>CRM</Text>
      </View>

      <View style={styles.tabRow}>
        {TABS.map((t) => (
          <Pressable key={t.key} onPress={() => setTab(t.key)} style={[styles.tabBtn, tab === t.key && styles.tabBtnActive]}>
            <t.Icon size={13} color={tab === t.key ? colors.clay : colors.stone500} />
            <Text style={[styles.tabBtnText, tab === t.key && styles.tabBtnTextActive]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      {tab === "dashboard" ? <DashboardTab /> : tab === "leads" ? <PipelineTab /> : <SalesTab />}
    </SafeAreaView>
  );
}

// ── Dashboard ────────────────────────────────────────────────────────────
type DashboardData = {
  kpi: { totalLeads: number; won: number; lost: number; conversionPct: number; winRatePct: number | null; leadsLast30d: number; pendingCommissions: number };
  revenue: { thisMonth: number; goal: number };
  leadsByStatus: Record<string, number>;
  leadsByTier: Record<string, number>;
  bySource: { source: string; count: number }[];
  byCloser: { closer: string; leads: number; won: number; revenue: number }[];
  leads: { id: string; name: string | null; phone: string | null; tier: string | null; status: string }[];
};

function DashboardTab() {
  const { user } = useAuth();
  const isAdmin = user?.crmRole === "admin";
  const [data, setData] = useState<DashboardData | null>(null);
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalDraft, setGoalDraft] = useState("");
  const [savingGoal, setSavingGoal] = useState(false);
  const [openTier, setOpenTier] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      crmApi.dashboard().then((d: any) => setData(d)).catch(() => {});
    }, [])
  );

  async function saveGoal() {
    setSavingGoal(true);
    try {
      const { revenueGoal } = await crmApi.setRevenueGoal(Number(goalDraft) || 0);
      setData((d) => (d ? { ...d, revenue: { ...d.revenue, goal: revenueGoal } } : d));
      setEditingGoal(false);
    } finally {
      setSavingGoal(false);
    }
  }

  if (!data) return <ActivityIndicator style={{ marginTop: 40 }} color={colors.action} />;

  const { kpi, revenue } = data;
  const pct = revenue.goal > 0 ? Math.min(100, Math.round((revenue.thisMonth / revenue.goal) * 100)) : null;
  const sourceData = (data.bySource || []).map((s, i) => ({ value: s.count, color: CATEGORY_PALETTE[i % CATEGORY_PALETTE.length] }));
  const maxStatus = Math.max(...LEAD_STATUSES.map((s) => data.leadsByStatus[s.key] || 0), 1);

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 14 }}>
      <View style={styles.card}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
          <View>
            <Text style={styles.cardLabel}>Faturamento do mês</Text>
            <Text style={styles.revenueValue}>{brl(revenue.thisMonth)}</Text>
          </View>
          {isAdmin && !editingGoal && (
            <Pressable onPress={() => { setGoalDraft(String(revenue.goal || "")); setEditingGoal(true); }} style={styles.goalBtn}>
              <Pencil size={11} color={colors.stone500} />
              <Text style={styles.goalBtnText}>meta</Text>
            </Pressable>
          )}
        </View>
        {editingGoal ? (
          <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
            <TextInput
              value={goalDraft}
              onChangeText={(v) => setGoalDraft(v.replace(/[^0-9.]/g, ""))}
              keyboardType="decimal-pad"
              placeholder="Meta mensal (R$)"
              placeholderTextColor={colors.stone400}
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
            />
            <Pressable onPress={saveGoal} disabled={savingGoal} style={styles.iconBtnFilled}>
              {savingGoal ? <ActivityIndicator size="small" color={colors.clay} /> : <Check size={14} color={colors.clay} />}
            </Pressable>
            <Pressable onPress={() => setEditingGoal(false)} style={styles.iconBtn}>
              <X size={14} color={colors.stone500} />
            </Pressable>
          </View>
        ) : revenue.goal > 0 ? (
          <>
            <View style={styles.track}><View style={[styles.fill, { width: `${pct ?? 0}%` }]} /></View>
            <Text style={styles.progressMeta}>{pct}% de {brl(revenue.goal)}</Text>
          </>
        ) : isAdmin ? (
          <Text style={styles.hintText}>Nenhuma meta definida — toque em “meta” para acompanhar o progresso.</Text>
        ) : null}
      </View>

      <View style={styles.kpiGrid}>
        <KpiTile label="Leads no funil" value={String(kpi.totalLeads)} />
        <KpiTile label="Conversão" value={`${kpi.conversionPct}%`} sub={`${kpi.won} fechados`} />
        <KpiTile label="Taxa de vitória" value={kpi.winRatePct == null ? "—" : `${kpi.winRatePct}%`} sub={`${kpi.won} × ${kpi.lost} perdidos`} />
        <KpiTile label="Leads · 30d" value={String(kpi.leadsLast30d)} />
        <KpiTile label="Comissões pend." value={brl(kpi.pendingCommissions)} />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>Funil por estágio</Text>
        <View style={{ gap: 8 }}>
          {LEAD_STATUSES.map((s) => {
            const count = data.leadsByStatus[s.key] || 0;
            return (
              <View key={s.key}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={styles.funnelLabel}>{s.label}</Text>
                  <Text style={styles.funnelCount}>{count}</Text>
                </View>
                <View style={styles.funnelTrack}>
                  <View style={[styles.funnelFill, { width: `${(count / maxStatus) * 100}%`, backgroundColor: s.color }]} />
                </View>
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.card}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 }}>
          <Tag size={11} color={colors.stone500} />
          <Text style={styles.sectionLabel}>Leads por origem</Text>
        </View>
        {sourceData.length ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
            <CrmDonut data={sourceData} />
            <View style={{ flex: 1, gap: 6 }}>
              {(data.bySource || []).map((s, i) => {
                const total = sourceData.reduce((sum, d) => sum + d.value, 0);
                return (
                  <View key={s.source} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: CATEGORY_PALETTE[i % CATEGORY_PALETTE.length] }} />
                    <Text style={styles.legendLabel} numberOfLines={1}>{s.source}</Text>
                    <Text style={styles.legendValue}>{s.count}</Text>
                    <Text style={styles.legendPct}>{total ? Math.round((s.count / total) * 100) : 0}%</Text>
                  </View>
                );
              })}
            </View>
          </View>
        ) : (
          <Text style={styles.hintText}>Sem dados ainda.</Text>
        )}
      </View>

      <View style={styles.card}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 }}>
          <UserCheck size={11} color={colors.stone500} />
          <Text style={styles.sectionLabel}>Por closer</Text>
        </View>
        {data.byCloser?.length ? (
          <View style={{ gap: 6 }}>
            {data.byCloser.map((cl) => (
              <View key={cl.closer} style={styles.closerRow}>
                <Text style={styles.closerName} numberOfLines={1}>{cl.closer}</Text>
                <Text style={styles.closerMeta}>{cl.leads} leads · {cl.won} ganhos</Text>
                <Text style={styles.closerRevenue}>{brl(cl.revenue)}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.hintText}>Sem dados ainda.</Text>
        )}
      </View>

      {(["hot", "warm", "cold"] as const).some((t) => (data.leadsByTier[t] || 0) > 0) && (
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Qualificação, por temperatura</Text>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
            {(["hot", "warm", "cold"] as const).map((t) => {
              const count = data.leadsByTier[t] || 0;
              const active = openTier === t;
              return (
                <Pressable
                  key={t}
                  onPress={() => count && setOpenTier(active ? null : t)}
                  style={[styles.tierTile, { backgroundColor: `${TIER_COLOR[t]}${active ? "29" : "14"}`, borderColor: `${TIER_COLOR[t]}${active ? "73" : "3a"}` }]}
                >
                  <Text style={[styles.tierTileLabel, { color: TIER_COLOR[t] }]}>{TIER_LABEL[t]}</Text>
                  <Text style={styles.tierTileValue}>{count}</Text>
                </Pressable>
              );
            })}
          </View>
          {openTier && (
            <View style={{ marginTop: 10, gap: 6, borderTopWidth: 1, borderTopColor: "rgba(20,22,24,0.1)", paddingTop: 10 }}>
              {data.leads.filter((l) => l.tier === openTier).map((l) => (
                <View key={l.id} style={styles.tierLeadRow}>
                  <Text style={styles.tierLeadName} numberOfLines={1}>{l.name || "Sem nome"}</Text>
                  <Text style={styles.tierLeadStatus}>{LEAD_STATUSES.find((s) => s.key === l.status)?.label || l.status}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
}

function KpiTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <View style={styles.kpiTile}>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={styles.kpiValue}>{value}</Text>
      {sub ? <Text style={styles.kpiSub}>{sub}</Text> : null}
    </View>
  );
}

// ── Pipeline ─────────────────────────────────────────────────────────────
type Lead = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  utm_source: string | null;
  tier: string | null;
  score: number | null;
  closer_name: string | null;
  updated_at: string;
  created_at: string;
};

const TIER_OPTIONS = [
  { value: "", label: "Todas" },
  { value: "hot", label: "Quente" },
  { value: "warm", label: "Morno" },
  { value: "cold", label: "Frio" },
];

function PipelineTab() {
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [error, setError] = useState("");
  const [term, setTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [tierFilter, setTierFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [tierPickerOpen, setTierPickerOpen] = useState(false);
  const [sourcePickerOpen, setSourcePickerOpen] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  const load = useCallback(() => {
    crmApi.listLeads().then(({ leads }: any) => setLeads(leads)).catch((e: any) =>
      setError(e instanceof CrmApiError ? e.body?.error || "Falha ao carregar leads." : "Falha ao carregar leads.")
    );
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const sourceOptions = useMemo(() => {
    const set = new Set<string>();
    for (const l of leads || []) set.add(l.utm_source || "orgânico");
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [leads]);

  const filtered = useMemo(() => {
    const q = term.trim().toLowerCase();
    return (leads || []).filter((l) => {
      if (l.status === "incomplete") return false;
      if (statusFilter && l.status !== statusFilter) return false;
      if (q) {
        const hay = [l.name, l.email, l.phone].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (tierFilter && l.tier !== tierFilter) return false;
      if (sourceFilter && (l.utm_source || "orgânico") !== sourceFilter) return false;
      return true;
    });
  }, [leads, term, statusFilter, tierFilter, sourceFilter]);

  const countFor = (key: string) => (leads || []).filter((l) => l.status !== "incomplete" && l.status === key).length;
  const totalCount = (leads || []).filter((l) => l.status !== "incomplete").length;

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <Text style={styles.leadsCount}>{filtered.length} leads</Text>
          <Pressable onPress={() => setShowAdd(true)} style={styles.addLeadBtn}>
            <Plus size={12} color={colors.clay} />
            <Text style={styles.addLeadBtnText}>Novo lead</Text>
          </Pressable>
        </View>

        <View style={styles.searchRow}>
          <Search size={13} color={colors.stone500} />
          <TextInput
            value={term}
            onChangeText={setTerm}
            placeholder="Buscar por nome, e-mail ou WhatsApp…"
            placeholderTextColor={colors.stone400}
            style={styles.searchInput}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }} contentContainerStyle={{ gap: 6 }}>
          <StatusChip label={`Todas (${totalCount})`} active={!statusFilter} onPress={() => setStatusFilter("")} />
          {LEAD_STATUSES.map((s) => (
            <StatusChip key={s.key} label={`${s.label} (${countFor(s.key)})`} color={s.color} active={statusFilter === s.key} onPress={() => setStatusFilter(s.key)} />
          ))}
        </ScrollView>

        <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
          <Pressable onPress={() => setTierPickerOpen(true)} style={[styles.selectBtn, { flex: 1 }]}>
            <Flame size={12} color={colors.stone500} />
            <Text style={styles.selectBtnText}>{TIER_OPTIONS.find((t) => t.value === tierFilter)?.label}</Text>
            <ChevronDown size={13} color={colors.stone500} />
          </Pressable>
          <Pressable onPress={() => setSourcePickerOpen(true)} style={[styles.selectBtn, { flex: 1 }]}>
            <Tag size={12} color={colors.stone500} />
            <Text style={styles.selectBtnText} numberOfLines={1}>{sourceFilter || "Todas as origens"}</Text>
            <ChevronDown size={13} color={colors.stone500} />
          </Pressable>
        </View>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {leads === null ? (
        <ActivityIndicator style={{ marginTop: 24 }} color={colors.action} />
      ) : filtered.length === 0 ? (
        <View style={styles.emptyLeads}>
          <Inbox size={20} color={colors.stone400} />
          <Text style={styles.hintText}>Nenhum lead encontrado.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 12, gap: 8 }}>
          {filtered.map((l) => (
            <LeadCard key={l.id} lead={l} onPress={() => router.push(`/crm-lead/${l.id}`)} />
          ))}
        </ScrollView>
      )}

      <PickerModal
        visible={tierPickerOpen}
        title="Temperatura"
        options={TIER_OPTIONS}
        selected={[tierFilter]}
        onToggle={(v) => { setTierFilter(v); setTierPickerOpen(false); }}
        onClose={() => setTierPickerOpen(false)}
      />
      <PickerModal
        visible={sourcePickerOpen}
        title="Origem"
        options={[{ value: "", label: "Todas" }, ...sourceOptions.map((s) => ({ value: s, label: s }))]}
        selected={[sourceFilter]}
        onToggle={(v) => { setSourceFilter(v); setSourcePickerOpen(false); }}
        onClose={() => setSourcePickerOpen(false)}
      />
      <AddLeadModal
        visible={showAdd}
        onClose={() => setShowAdd(false)}
        onCreated={(lead) => {
          setShowAdd(false);
          load();
          router.push(`/crm-lead/${lead.id}`);
        }}
      />
    </View>
  );
}

function StatusChip({ label, color, active, onPress }: { label: string; color?: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.statusChip, active && { backgroundColor: color || colors.action, borderColor: color || colors.action }]}>
      <Text style={[styles.statusChipText, active && { color: colors.clay }]}>{label}</Text>
    </Pressable>
  );
}

function LeadCard({ lead, onPress }: { lead: Lead; onPress: () => void }) {
  const link = waLink(lead.phone);
  const status = LEAD_STATUSES.find((s) => s.key === lead.status);
  return (
    <Pressable onPress={onPress} style={styles.leadCard}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={styles.leadName} numberOfLines={1}>{lead.name || "Sem nome"}</Text>
        {status ? (
          <View style={[styles.leadStatusPill, { backgroundColor: `${status.color}1a`, borderColor: `${status.color}40` }]}>
            <Text style={[styles.leadStatusPillText, { color: status.color }]}>{status.label}</Text>
          </View>
        ) : null}
      </View>
      {lead.phone ? (
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <Phone size={11} color={colors.stone500} />
            <Text style={styles.leadPhone}>{lead.phone}</Text>
          </View>
          {link ? (
            <Pressable onPress={() => Linking.openURL(link)} style={styles.waBtn}>
              <MessageCircle size={12} color={colors.success} />
            </Pressable>
          ) : null}
        </View>
      ) : null}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
        <View style={styles.tagPill}>
          <Tag size={9} color={colors.stone500} />
          <Text style={styles.tagPillText}>{lead.utm_source || "orgânico"}</Text>
        </View>
        {lead.tier ? (
          <View style={[styles.tagPill, { borderColor: `${TIER_COLOR[lead.tier]}55` }]}>
            <Flame size={9} color={TIER_COLOR[lead.tier]} />
            <Text style={[styles.tagPillText, { color: TIER_COLOR[lead.tier] }]}>{TIER_LABEL[lead.tier] || lead.tier}</Text>
          </View>
        ) : null}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <UserCheck size={10} color={colors.stone500} />
          <Text style={styles.leadMeta}>{lead.closer_name || "—"}</Text>
        </View>
        <Text style={styles.leadMeta}>{timeAgo(lead.updated_at)}</Text>
      </View>
    </Pressable>
  );
}

function AddLeadModal({ visible, onClose, onCreated }: { visible: boolean; onClose: () => void; onCreated: (lead: any) => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit() {
    if (!name.trim() && !phone.trim() && !email.trim()) {
      setErr("Informe ao menos nome, e-mail ou WhatsApp.");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const { lead } = await crmApi.createLead({ name: name.trim() || null, phone: phone.trim() || null, email: email.trim() || null });
      setName("");
      setPhone("");
      setEmail("");
      onCreated(lead);
    } catch (e) {
      setErr(e instanceof CrmApiError ? e.body?.error || "Não foi possível criar o lead." : "Não foi possível criar o lead.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <Text style={styles.sheetTitle}>Novo lead</Text>
            <Pressable onPress={onClose}><X size={18} color={colors.stone500} /></Pressable>
          </View>
          <TextInput placeholder="Nome" placeholderTextColor={colors.stone400} value={name} onChangeText={setName} style={styles.input} />
          <TextInput placeholder="WhatsApp" placeholderTextColor={colors.stone400} value={phone} onChangeText={setPhone} keyboardType="phone-pad" style={styles.input} />
          <TextInput placeholder="E-mail (opcional)" placeholderTextColor={colors.stone400} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" style={styles.input} />
          {err ? <Text style={styles.error}>{err}</Text> : null}
          <Pressable onPress={submit} disabled={busy} style={[styles.primaryBtn, busy && { opacity: 0.6 }]}>
            {busy ? <ActivityIndicator size="small" color={colors.clay} /> : null}
            <Text style={styles.primaryBtnText}>Adicionar lead</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Vendas ───────────────────────────────────────────────────────────────
type Sale = { id: string; status: string; amount: number; commissions?: { beneficiary_email: string; amount: number }[] };

function SalesTab() {
  const [sales, setSales] = useState<Sale[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      crmApi.listSales().then(({ sales }: any) => setSales(sales)).catch(() => setSales([]));
    }, [])
  );

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      {sales === null ? (
        <ActivityIndicator style={{ marginTop: 24 }} color={colors.action} />
      ) : sales.length === 0 ? (
        <Text style={styles.hintText}>Nenhuma venda registrada ainda.</Text>
      ) : (
        <View style={{ gap: 8 }}>
          {sales.map((s) => (
            <View key={s.id} style={styles.card}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={styles.saleStatus}>{s.status}</Text>
                <Text style={styles.saleAmount}>{brl(s.amount)}</Text>
              </View>
              {s.commissions && s.commissions.length > 0 ? (
                <Text style={styles.commissionText}>
                  comissão: {s.commissions.map((c) => `${c.beneficiary_email} ${brl(c.amount)}`).join(", ")}
                </Text>
              ) : null}
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.clay },
  header: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingTop: 8 },
  title: { fontFamily: fonts.sansSemiBold, fontSize: 16, color: colors.ink },
  tabRow: { flexDirection: "row", gap: 6, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  tabBtn: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: radii.md, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "rgba(20,22,24,0.05)" },
  tabBtnActive: { backgroundColor: colors.action },
  tabBtnText: { fontFamily: fonts.mono, fontSize: 10.5, color: colors.stone500 },
  tabBtnTextActive: { color: colors.clay, fontFamily: fonts.monoMedium },
  error: { fontFamily: fonts.mono, fontSize: 11, color: colors.danger, paddingHorizontal: 16, marginTop: 8 },
  hintText: { fontFamily: fonts.sans, fontSize: 12, color: colors.stone500 },

  card: { ...surfaces[2], borderRadius: radii.xl, padding: 16 },
  cardLabel: { fontFamily: fonts.mono, fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: colors.stone500 },
  revenueValue: { fontFamily: fonts.sansBold, fontSize: 26, color: colors.ink, marginTop: 4 },
  goalBtn: { flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderColor: "rgba(20,22,24,0.15)", borderRadius: radii.md, paddingHorizontal: 9, paddingVertical: 7 },
  goalBtnText: { fontFamily: fonts.mono, fontSize: 10.5, color: colors.stone500 },
  track: { height: 8, borderRadius: 4, backgroundColor: "rgba(20,22,24,0.08)", overflow: "hidden", marginTop: 12 },
  fill: { height: "100%", borderRadius: 4, backgroundColor: colors.action },
  progressMeta: { fontFamily: fonts.mono, fontSize: 11, color: colors.stone500, marginTop: 6 },

  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  kpiTile: { ...surfaces[2], borderRadius: radii.lg, padding: 12, width: "31%" },
  kpiLabel: { fontFamily: fonts.mono, fontSize: 8.5, textTransform: "uppercase", letterSpacing: 0.4, color: colors.stone500 },
  kpiValue: { fontFamily: fonts.sansBold, fontSize: 17, color: colors.ink, marginTop: 4 },
  kpiSub: { fontFamily: fonts.mono, fontSize: 9, color: colors.stone500, marginTop: 2 },

  sectionLabel: { fontFamily: fonts.mono, fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: colors.stone500 },
  funnelLabel: { fontFamily: fonts.sans, fontSize: 12, color: colors.ink },
  funnelCount: { fontFamily: fonts.mono, fontSize: 11, color: colors.stone500 },
  funnelTrack: { height: 6, borderRadius: 3, backgroundColor: "rgba(20,22,24,0.06)", overflow: "hidden", marginTop: 4 },
  funnelFill: { height: "100%", borderRadius: 3 },

  legendLabel: { flex: 1, fontFamily: fonts.sans, fontSize: 12, color: colors.ink },
  legendValue: { fontFamily: fonts.mono, fontSize: 11, color: colors.stone500 },
  legendPct: { fontFamily: fonts.mono, fontSize: 10, color: colors.stone500, width: 32, textAlign: "right" },

  closerRow: { flexDirection: "row", alignItems: "center", gap: 8, ...surfaces[3], borderRadius: radii.md, paddingHorizontal: 12, paddingVertical: 9 },
  closerName: { flex: 1, fontFamily: fonts.sans, fontSize: 12.5, color: colors.ink, minWidth: 0 },
  closerMeta: { fontFamily: fonts.mono, fontSize: 10.5, color: colors.stone500 },
  closerRevenue: { fontFamily: fonts.sansSemiBold, fontSize: 12.5, color: colors.ink },

  tierTile: { flex: 1, borderRadius: radii.md, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 10 },
  tierTileLabel: { fontFamily: fonts.mono, fontSize: 9.5, textTransform: "uppercase", letterSpacing: 0.4 },
  tierTileValue: { fontFamily: fonts.sansBold, fontSize: 16, color: colors.ink, marginTop: 3 },
  tierLeadRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", ...surfaces[3], borderRadius: radii.md, paddingHorizontal: 10, paddingVertical: 8 },
  tierLeadName: { flex: 1, fontFamily: fonts.sans, fontSize: 12.5, color: colors.ink },
  tierLeadStatus: { fontFamily: fonts.mono, fontSize: 10, color: colors.stone500 },

  leadsCount: { fontFamily: fonts.mono, fontSize: 11, color: colors.stone500 },
  addLeadBtn: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: colors.action, borderRadius: radii.md, paddingHorizontal: 10, paddingVertical: 8 },
  addLeadBtnText: { fontFamily: fonts.sansBold, fontSize: 11, color: colors.clay },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: "rgba(20,22,24,0.15)", backgroundColor: colors.paper, borderRadius: radii.md, paddingHorizontal: 12, paddingVertical: 9 },
  searchInput: { flex: 1, fontFamily: fonts.sans, fontSize: 13, color: colors.ink },
  statusChip: { borderWidth: 1, borderColor: "rgba(20,22,24,0.15)", borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7 },
  statusChipText: { fontFamily: fonts.mono, fontSize: 10.5, color: colors.stone500 },
  selectBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: "rgba(20,22,24,0.15)", backgroundColor: colors.paper, borderRadius: radii.md, paddingHorizontal: 10, paddingVertical: 9 },
  selectBtnText: { flex: 1, fontFamily: fonts.sans, fontSize: 12, color: colors.ink },

  emptyLeads: { alignItems: "center", gap: 8, paddingTop: 48 },

  leadCard: { ...surfaces[3], borderRadius: radii.lg, padding: 12 },
  leadName: { flex: 1, fontFamily: fonts.sansSemiBold, fontSize: 13.5, color: colors.ink },
  leadStatusPill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  leadStatusPillText: { fontFamily: fonts.mono, fontSize: 9, textTransform: "uppercase", letterSpacing: 0.4 },
  leadPhone: { fontFamily: fonts.mono, fontSize: 11, color: colors.stone500 },
  waBtn: { width: 24, height: 24, borderRadius: 6, backgroundColor: "rgba(62,107,78,0.15)", alignItems: "center", justifyContent: "center" },
  tagPill: { flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderColor: "rgba(20,22,24,0.1)", backgroundColor: "rgba(20,22,24,0.04)", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  tagPillText: { fontFamily: fonts.mono, fontSize: 9.5, color: colors.stone500 },
  leadMeta: { fontFamily: fonts.mono, fontSize: 10, color: colors.stone500 },

  backdrop: { flex: 1, backgroundColor: "rgba(20,22,24,0.5)", justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.paper, borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl, padding: 16, paddingBottom: 32 },
  sheetTitle: { fontFamily: fonts.sansSemiBold, fontSize: 16, color: colors.ink },
  input: {
    borderWidth: 1, borderColor: "rgba(20,22,24,0.15)", backgroundColor: colors.clay, borderRadius: radii.md,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: colors.ink, fontFamily: fonts.sans, marginBottom: 10,
  },
  primaryBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.action, borderRadius: radii.md, paddingVertical: 12, marginTop: 4 },
  primaryBtnText: { fontFamily: fonts.sansBold, fontSize: 12.5, color: colors.clay },
  iconBtn: { borderWidth: 1, borderColor: "rgba(20,22,24,0.15)", borderRadius: radii.md, padding: 9, alignItems: "center", justifyContent: "center" },
  iconBtnFilled: { backgroundColor: colors.action, borderRadius: radii.md, padding: 9, alignItems: "center", justifyContent: "center" },

  saleStatus: { fontFamily: fonts.mono, fontSize: 10.5, textTransform: "uppercase", letterSpacing: 0.5, color: colors.stone500 },
  saleAmount: { fontFamily: fonts.sansSemiBold, fontSize: 13.5, color: colors.ink },
  commissionText: { fontFamily: fonts.mono, fontSize: 10, color: colors.stone400, marginTop: 6 },
});
