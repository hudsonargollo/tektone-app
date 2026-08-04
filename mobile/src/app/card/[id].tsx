import { useCallback, useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, Alert, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect, Redirect } from "expo-router";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Sparkles, Trash2, CheckCircle2, Calendar as CalendarIcon, X } from "lucide-react-native";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { COLUMNS, PRIORITY, LABEL_COLORS, fmtDate } from "@/lib/constants";
import { colors, fonts, radii } from "@/lib/theme";
import ChecklistEditor, { type ChecklistItem } from "@/components/CardDetail/ChecklistEditor";
import LinksEditor, { type LinkItem } from "@/components/CardDetail/LinksEditor";
import PickerModal from "@/components/CardDetail/PickerModal";
import Comments, { type Comment } from "@/components/CardDetail/Comments";

type Member = { id: string; name: string; email: string };
type Client = { id: string; name: string; color: string };

type CardDraft = {
  id: string;
  title: string;
  description: string;
  columnId: string;
  priority: "low" | "medium" | "high";
  clientId: string;
  assignees: string[];
  dueDate: string;
  labelColor: string | null;
  checklist: ChecklistItem[];
  links: LinkItem[];
  comments: Comment[];
  reviewed?: boolean;
};

export default function CardDetailScreen() {
  const { user, loading: authLoading } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [d, setD] = useState<CardDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<Member[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [saving, setSaving] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [showAssignees, setShowAssignees] = useState(false);
  const [showClient, setShowClient] = useState(false);
  const [showDate, setShowDate] = useState(false);

  const set = <K extends keyof CardDraft>(k: K, v: CardDraft[K]) => setD((p) => (p ? { ...p, [k]: v } : p));

  const load = useCallback(async () => {
    try {
      const [{ cards }, { members }, { clients }] = await Promise.all([api.listCards(), api.listMembers(), api.listClients()]);
      const found = cards.find((c: any) => c.id === id);
      setMembers(members);
      setClients(clients);
      if (found) {
        setD({
          id: found.id,
          title: found.title || "",
          description: found.description || "",
          columnId: found.columnId,
          priority: found.priority || "medium",
          clientId: found.clientId || "",
          assignees: found.assignees?.length ? found.assignees : found.assignee ? [found.assignee] : [],
          dueDate: found.dueDate || "",
          labelColor: found.labelColor || null,
          checklist: found.checklist || [],
          links: found.links || [],
          comments: found.comments || [],
          reviewed: found.reviewed,
        });
        await api.markCardSeen(found.id).catch(() => {});
      } else {
        setD(null);
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!authLoading && !user) return <Redirect href="/(auth)" />;

  async function saveChecklist(next: ChecklistItem[]) {
    if (!d) return;
    set("checklist", next);
    try {
      const { card } = await api.updateCard(d.id, { checklist: next });
      set("comments", card.comments || []);
    } catch {
      /* keep optimistic state, global Salvar will retry */
    }
  }

  async function saveLinks(next: LinkItem[]) {
    if (!d) return;
    set("links", next);
    try {
      await api.updateCard(d.id, { links: next });
    } catch {
      /* keep optimistic state */
    }
  }

  async function saveFields() {
    if (!d) return;
    setSaving(true);
    try {
      const { card } = await api.updateCard(d.id, {
        title: d.title,
        description: d.description,
        priority: d.priority,
        columnId: d.columnId,
        clientId: d.clientId,
        assignees: d.assignees,
        dueDate: d.dueDate,
        labelColor: d.labelColor,
      });
      setD((p) => (p ? { ...p, ...card } : p));
    } finally {
      setSaving(false);
    }
  }

  async function reviewCard() {
    if (!d || reviewing) return;
    setReviewing(true);
    try {
      await api.reviewCard(d.id);
      router.back();
    } catch {
      setReviewing(false);
    }
  }

  function confirmDelete() {
    if (!d) return;
    Alert.alert("Excluir tarefa?", "Esta ação não pode ser desfeita.", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: async () => {
          await api.deleteCard(d.id);
          router.back();
        },
      },
    ]);
  }

  if (loading) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator color={colors.action} />
      </View>
    );
  }
  if (!d) {
    return (
      <View style={[styles.screen, styles.center]}>
        <Text style={styles.emptyText}>Tarefa não encontrada.</Text>
      </View>
    );
  }

  const client = clients.find((c) => c.id === d.clientId);
  const clientOpts = clients.map((c) => ({ value: c.id, label: c.name, color: c.color }));
  const memberOpts = members.map((m) => ({ value: m.name, label: m.name }));
  const columnOpts = COLUMNS.map((c) => ({ value: c.id, label: c.title, color: c.color }));

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
      <TextInput
        value={d.title}
        onChangeText={(v) => set("title", v)}
        placeholder="Título da tarefa…"
        placeholderTextColor={colors.stone400}
        style={styles.titleInput}
        multiline
      />

      <Pressable onPress={() => setShowClient(true)} style={styles.metaRow}>
        <Text style={styles.metaLabel}>Projeto</Text>
        <Text style={styles.metaValue}>{client?.name || "— Nenhum —"}</Text>
      </Pressable>

      <Pressable onPress={() => setShowAssignees(true)} style={styles.metaRow}>
        <Text style={styles.metaLabel}>Responsáveis</Text>
        <Text style={styles.metaValue}>{d.assignees.length ? d.assignees.join(", ") : "— Ninguém —"}</Text>
      </Pressable>

      <View style={styles.section}>
        <View style={styles.sectionHead}>
          <Text style={styles.sectionLabel}>Descrição</Text>
          <Pressable
            onPress={() =>
              router.push({
                pathname: "/wizard",
                params: {
                  cardId: d.id,
                  title: d.title,
                  clientId: d.clientId || "",
                  assignees: JSON.stringify(d.assignees || []),
                  priority: d.priority || "medium",
                  dueDate: d.dueDate || "",
                },
              })
            }
            style={styles.wizardBtn}
          >
            <Sparkles size={11} color={colors.action} />
            <Text style={styles.wizardBtnText}>Preencher com assistente</Text>
          </Pressable>
        </View>
        <TextInput
          value={d.description}
          onChangeText={(v) => set("description", v)}
          placeholder="Detalhes da tarefa…"
          placeholderTextColor={colors.stone400}
          multiline
          style={[styles.input, { minHeight: 90, textAlignVertical: "top" }]}
        />
      </View>

      <View style={styles.section}>
        <ChecklistEditor items={d.checklist} onChange={saveChecklist} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Status</Text>
        <View style={styles.pillRow}>
          {columnOpts.map((c) => (
            <Pressable key={c.value} onPress={() => set("columnId", c.value)} style={[styles.pill, d.columnId === c.value && { backgroundColor: c.color, borderColor: c.color }]}>
              <Text style={[styles.pillText, d.columnId === c.value && { color: colors.clay }]}>{c.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Prioridade</Text>
        <View style={styles.pillRow}>
          {(Object.keys(PRIORITY) as (keyof typeof PRIORITY)[]).map((k) => (
            <Pressable key={k} onPress={() => set("priority", k)} style={[styles.pill, d.priority === k && { backgroundColor: PRIORITY[k].color, borderColor: PRIORITY[k].color }]}>
              <Text style={[styles.pillText, d.priority === k && { color: colors.clay }]}>{PRIORITY[k].label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Prazo</Text>
        <Pressable onPress={() => setShowDate(true)} style={styles.dateRow}>
          <CalendarIcon size={14} color={colors.stone500} />
          <Text style={styles.metaValue}>{d.dueDate ? fmtDate(d.dueDate) : "Sem prazo"}</Text>
          {d.dueDate ? (
            <Pressable onPress={() => set("dueDate", "")} hitSlop={8}>
              <X size={13} color={colors.stone400} />
            </Pressable>
          ) : null}
        </Pressable>
        {showDate && (
          <DateTimePicker
            value={d.dueDate ? new Date(d.dueDate + "T12:00:00") : new Date()}
            mode="date"
            onChange={(_, date) => {
              setShowDate(false);
              if (date) set("dueDate", date.toISOString().slice(0, 10));
            }}
          />
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Cor de destaque</Text>
        <View style={styles.pillRow}>
          <Pressable onPress={() => set("labelColor", null)} style={[styles.swatch, !d.labelColor && styles.swatchActive]}>
            <X size={10} color={colors.stone500} />
          </Pressable>
          {LABEL_COLORS.map((c) => (
            <Pressable key={c} onPress={() => set("labelColor", c)} style={[styles.swatch, { backgroundColor: c }, d.labelColor === c && styles.swatchActive]} />
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <LinksEditor items={d.links} onChange={saveLinks} />
      </View>

      {user && (
        <View style={styles.section}>
          <Comments
            cardId={d.id}
            comments={d.comments}
            members={members}
            assignees={d.assignees}
            currentUserEmail={user.email}
            isAdmin={user.admin}
            onUpdate={(comments) => set("comments", comments)}
          />
        </View>
      )}

      <View style={styles.actions}>
        {d.columnId !== "done" && (
          <Pressable onPress={reviewCard} disabled={reviewing} style={styles.reviewBtn}>
            {reviewing ? <ActivityIndicator color={colors.success} /> : <CheckCircle2 size={14} color={colors.success} />}
            <Text style={styles.reviewBtnText}>Marcar como revisado</Text>
          </Pressable>
        )}
        <Pressable onPress={confirmDelete} style={styles.deleteBtn}>
          <Trash2 size={14} color={colors.danger} />
        </Pressable>
        <Pressable onPress={saveFields} disabled={saving} style={styles.saveBtn}>
          {saving ? <ActivityIndicator color={colors.clay} /> : <Text style={styles.saveBtnText}>Salvar</Text>}
        </Pressable>
      </View>

      <PickerModal
        visible={showClient}
        title="Projeto"
        options={clientOpts}
        selected={d.clientId ? [d.clientId] : []}
        onToggle={(v) => { set("clientId", v); setShowClient(false); }}
        onClose={() => setShowClient(false)}
      />
      <PickerModal
        visible={showAssignees}
        title="Responsáveis"
        options={memberOpts}
        selected={d.assignees}
        onToggle={(v) => set("assignees", d.assignees.includes(v) ? d.assignees.filter((n) => n !== v) : [...d.assignees, v])}
        onClose={() => setShowAssignees(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.clay },
  center: { justifyContent: "center", alignItems: "center" },
  emptyText: { fontFamily: fonts.mono, fontSize: 12, color: colors.stone500 },
  titleInput: { fontFamily: fonts.sansBold, fontSize: 20, color: colors.ink },
  metaRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(20,22,24,0.1)" },
  metaLabel: { fontFamily: fonts.mono, fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: colors.stone500 },
  metaValue: { fontFamily: fonts.sans, fontSize: 13, color: colors.ink, flexShrink: 1, textAlign: "right" },
  section: { marginTop: 20 },
  sectionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  sectionLabel: { fontFamily: fonts.mono, fontSize: 11, textTransform: "uppercase", letterSpacing: 1.5, color: colors.stone500 },
  wizardBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  wizardBtnText: { fontFamily: fonts.sansSemiBold, fontSize: 11, color: colors.action },
  input: {
    borderWidth: 1, borderColor: "rgba(20,22,24,0.15)", backgroundColor: "rgba(20,22,24,0.03)",
    borderRadius: radii.md, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.ink, fontFamily: fonts.sans,
  },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: { borderWidth: 1, borderColor: "rgba(20,22,24,0.15)", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7 },
  pillText: { fontFamily: fonts.sansSemiBold, fontSize: 12, color: colors.ink },
  dateRow: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: "rgba(20,22,24,0.15)", borderRadius: radii.md, paddingHorizontal: 12, paddingVertical: 10 },
  swatch: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: "transparent", alignItems: "center", justifyContent: "center" },
  swatchActive: { borderColor: colors.ink },
  actions: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 28 },
  reviewBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1, borderColor: `${colors.success}66`, backgroundColor: `${colors.success}1a`, borderRadius: radii.md, paddingVertical: 12 },
  reviewBtnText: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.success },
  deleteBtn: { padding: 12, borderRadius: radii.md, borderWidth: 1, borderColor: `${colors.danger}4d` },
  saveBtn: { flex: 1, backgroundColor: colors.action, borderRadius: radii.md, paddingVertical: 12, alignItems: "center" },
  saveBtnText: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.clay },
});
