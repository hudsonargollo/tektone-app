import { useCallback, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  ScrollView,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ShieldCheck,
  RotateCcw,
  Check,
  Clock,
  Layers,
  Plus,
  Trash2,
  PlayCircle,
  Sparkles,
  ChevronDown,
  ChevronUp,
  CheckCheck,
} from "lucide-react-native";
import { api, ApiError } from "@/lib/api";
import { crmApi, CrmApiError } from "@/lib/crmApi";
import { useAuth } from "@/lib/auth";
import { colors, fonts, radii, surfaces } from "@/lib/theme";
import PickerModal, { type PickerOption } from "@/components/CardDetail/PickerModal";

// Port of src/components/AdminPanel.jsx's "templates" and "onboarding"
// tabs onto the mobile-only "acessos" screen that already existed — Phase 4
// of ~/.claude/plans/tektone-mobile-parity.md. Same three tabs as web.

type AdminUser = { email: string; registered: boolean; name: string | null; admin: boolean };
type WorkflowTemplate = { id: string; name: string; description?: string; tasks: { title: string }[] };
type Client = { id: string; name: string };
type OnboardingPlan = { id: string; project_name?: string; project_type?: string; brief?: string; status: string };
type OnboardingStep = {
  id: string;
  title: string;
  description: string | null;
  owner: "tektone" | "customer";
  category: string | null;
  due_offset_days: number | null;
};

const ONBOARDING_CATEGORY_OPTIONS: PickerOption[] = [
  { value: "kickoff", label: "kickoff" },
  { value: "access", label: "access" },
  { value: "content", label: "content" },
  { value: "technical", label: "technical" },
  { value: "design", label: "design" },
  { value: "training", label: "training" },
  { value: "launch", label: "launch" },
];
const ONBOARDING_OWNER_OPTIONS: PickerOption[] = [
  { value: "tektone", label: "Tektone" },
  { value: "customer", label: "Cliente" },
];

type Tab = "access" | "templates" | "onboarding";

export default function AdminScreen() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("access");
  const [error, setError] = useState("");

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.header}>
        <ShieldCheck size={16} color={colors.action} />
        <Text style={styles.title}>Admin</Text>
      </View>

      <View style={styles.tabRow}>
        <TabButton label="acessos" active={tab === "access"} onPress={() => setTab("access")} />
        <TabButton label="templates" active={tab === "templates"} onPress={() => setTab("templates")} />
        <TabButton label="onboarding" active={tab === "onboarding"} onPress={() => setTab("onboarding")} icon />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {tab === "access" && <AccessTab currentEmail={user?.email} onError={setError} />}
      {tab === "templates" && <TemplatesTab onError={setError} />}
      {tab === "onboarding" && <OnboardingTab onError={setError} />}
    </SafeAreaView>
  );
}

function TabButton({ label, active, onPress, icon }: { label: string; active: boolean; onPress: () => void; icon?: boolean }) {
  return (
    <Pressable onPress={onPress} style={[styles.tabBtn, active && styles.tabBtnActive]}>
      {icon ? <Sparkles size={11} color={active ? colors.action : colors.stone500} /> : null}
      <Text style={[styles.tabBtnText, active && styles.tabBtnTextActive]}>{label}</Text>
    </Pressable>
  );
}

// ── acessos ──────────────────────────────────────────────────────────────
function AccessTab({ currentEmail, onError }: { currentEmail?: string; onError: (e: string) => void }) {
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { users } = await api.adminUsers();
      setUsers(users);
    } catch (e) {
      onError(e instanceof ApiError ? e.body?.error || "Falha ao carregar." : "Falha ao carregar.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  function confirmReset(u: AdminUser) {
    const self = u.email === currentEmail;
    const msg = self
      ? "Resetar SUA conta? Você será desconectado e precisará criar uma nova senha."
      : `Resetar o acesso de ${u.email}? A pessoa precisará criar uma nova senha no próximo acesso.`;
    Alert.alert("Confirmar reset", msg, [
      { text: "Cancelar", style: "cancel" },
      { text: "Resetar", style: "destructive", onPress: () => reset(u.email, self) },
    ]);
  }

  async function reset(email: string, self: boolean) {
    setBusy(email);
    try {
      await api.adminReset(email);
      await load();
      if (self) Alert.alert("Conta resetada", "Faça login novamente para criar uma nova senha.");
    } catch (e) {
      onError(e instanceof ApiError ? e.body?.error || "Falha ao resetar." : "Falha ao resetar.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <Text style={styles.hint}>
        Resetar remove a senha da pessoa. No próximo acesso ela cria uma nova senha em “primeiro acesso”.
      </Text>
      {!users ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.action} />
      ) : (
        <FlatList
          data={users}
          keyExtractor={(u) => u.email}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item: u }) => (
            <View style={styles.row}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={styles.email} numberOfLines={1}>{u.email}</Text>
                  {u.admin && (
                    <View style={styles.adminBadge}>
                      <Text style={styles.adminBadgeText}>admin</Text>
                    </View>
                  )}
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 }}>
                  {u.registered ? <Check size={11} color={colors.success} /> : <Clock size={11} color={colors.warning} />}
                  <Text style={styles.status}>{u.registered ? "registrado" : "pendente"}</Text>
                </View>
              </View>
              <Pressable
                onPress={() => confirmReset(u)}
                disabled={!u.registered || busy === u.email}
                style={[styles.resetBtn, (!u.registered || busy === u.email) && { opacity: 0.3 }]}
              >
                {busy === u.email ? <ActivityIndicator size="small" color={colors.stone500} /> : <RotateCcw size={12} color={colors.stone500} />}
                <Text style={styles.resetText}>resetar</Text>
              </Pressable>
            </View>
          )}
        />
      )}
    </>
  );
}

// ── templates de workflow ────────────────────────────────────────────────
function TemplatesTab({ onError }: { onError: (e: string) => void }) {
  const [templates, setTemplates] = useState<WorkflowTemplate[] | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tasksText, setTasksText] = useState("");
  const [applyProjectId, setApplyProjectId] = useState("");
  const [projectPickerOpen, setProjectPickerOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [{ templates }, { clients }] = await Promise.all([api.listWorkflowTemplates(), api.listClients()]);
      setTemplates(templates);
      setClients(clients);
      setApplyProjectId((prev) => prev || clients?.[0]?.id || "");
    } catch (e) {
      onError(e instanceof ApiError ? e.body?.error || "Falha ao carregar." : "Falha ao carregar.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function createTemplate() {
    const tasks = tasksText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((title) => ({ title, columnId: "todo", priority: "medium" }));
    if (!name.trim() || !tasks.length) return;
    setBusy("create");
    try {
      await api.createWorkflowTemplate({ name, description, tasks });
      setName("");
      setDescription("");
      setTasksText("");
      await load();
    } catch (e) {
      onError(e instanceof ApiError ? e.body?.error || "Falha ao criar template." : "Falha ao criar template.");
    } finally {
      setBusy(null);
    }
  }

  async function applyTemplate(id: string) {
    if (!applyProjectId) return;
    setBusy(id);
    try {
      const { created } = await api.applyWorkflowTemplate(id, applyProjectId);
      Alert.alert("Aplicado", `${created} tarefa(s) criada(s) no projeto.`);
    } catch (e) {
      onError(e instanceof ApiError ? e.body?.error || "Falha ao aplicar template." : "Falha ao aplicar template.");
    } finally {
      setBusy(null);
    }
  }

  function confirmRemove(id: string) {
    Alert.alert("Remover template", "Remover este template?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Remover", style: "destructive", onPress: () => removeTemplate(id) },
    ]);
  }

  async function removeTemplate(id: string) {
    setBusy(id);
    try {
      await api.deleteWorkflowTemplate(id);
      await load();
    } catch (e) {
      onError(e instanceof ApiError ? e.body?.error || "Falha ao remover." : "Falha ao remover.");
    } finally {
      setBusy(null);
    }
  }

  const selectedClient = clients.find((c) => c.id === applyProjectId);

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <Text style={styles.hint}>
        Um template vira um lote de tarefas na coluna “A fazer” de qualquer projeto, de uma vez. Um título por linha.
      </Text>

      <View style={styles.card}>
        <TextInput
          placeholder="Nome do template (ex: Infraestrutura)"
          placeholderTextColor={colors.stone400}
          value={name}
          onChangeText={setName}
          style={styles.input}
        />
        <TextInput
          placeholder="Descrição (opcional)"
          placeholderTextColor={colors.stone400}
          value={description}
          onChangeText={setDescription}
          style={styles.input}
        />
        <TextInput
          placeholder={"Configurar domínio\nSubir ambiente de staging\nConectar DNS via Cloudflare"}
          placeholderTextColor={colors.stone400}
          value={tasksText}
          onChangeText={setTasksText}
          multiline
          numberOfLines={4}
          style={[styles.input, { minHeight: 90, textAlignVertical: "top" }]}
        />
        <Pressable
          onPress={createTemplate}
          disabled={busy === "create" || !name.trim() || !tasksText.trim()}
          style={[styles.primaryBtn, (busy === "create" || !name.trim() || !tasksText.trim()) && { opacity: 0.5 }]}
        >
          {busy === "create" ? <ActivityIndicator size="small" color={colors.clay} /> : <Plus size={13} color={colors.clay} />}
          <Text style={styles.primaryBtnText}>criar template</Text>
        </Pressable>
      </View>

      {clients.length > 0 && (
        <View style={{ marginBottom: 14 }}>
          <Text style={styles.fieldLabel}>Aplicar no projeto</Text>
          <Pressable onPress={() => setProjectPickerOpen(true)} style={styles.selectBtn}>
            <Text style={styles.selectBtnText}>{selectedClient?.name || "Selecionar projeto"}</Text>
            <ChevronDown size={14} color={colors.stone500} />
          </Pressable>
          <PickerModal
            visible={projectPickerOpen}
            title="Aplicar no projeto"
            options={clients.map((c) => ({ value: c.id, label: c.name }))}
            selected={applyProjectId ? [applyProjectId] : []}
            onToggle={(v) => { setApplyProjectId(v); setProjectPickerOpen(false); }}
            onClose={() => setProjectPickerOpen(false)}
          />
        </View>
      )}

      {templates === null ? (
        <ActivityIndicator style={{ marginTop: 20 }} color={colors.action} />
      ) : templates.length === 0 ? (
        <Text style={styles.emptyText}>Nenhum template ainda.</Text>
      ) : (
        <View style={{ gap: 8 }}>
          {templates.map((t) => (
            <View key={t.id} style={styles.card}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1 }}>
                  <Layers size={13} color={colors.action} />
                  <Text style={styles.cardTitle} numberOfLines={1}>{t.name}</Text>
                </View>
                <Text style={styles.metaText}>{t.tasks.length} tarefas</Text>
              </View>
              {t.description ? <Text style={styles.cardDesc}>{t.description}</Text> : null}
              <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                <Pressable
                  onPress={() => applyTemplate(t.id)}
                  disabled={busy === t.id || !applyProjectId}
                  style={[styles.outlineBtn, (busy === t.id || !applyProjectId) && { opacity: 0.3 }]}
                >
                  {busy === t.id ? <ActivityIndicator size="small" color={colors.action} /> : <PlayCircle size={12} color={colors.action} />}
                  <Text style={styles.outlineBtnText}>aplicar</Text>
                </Pressable>
                <Pressable onPress={() => confirmRemove(t.id)} disabled={busy === t.id} style={styles.iconBtn}>
                  <Trash2 size={12} color={colors.stone500} />
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

// ── onboarding (revisão) ─────────────────────────────────────────────────
function OnboardingTab({ onError }: { onError: (e: string) => void }) {
  const [plans, setPlans] = useState<OnboardingPlan[] | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, { plan: OnboardingPlan; steps: OnboardingStep[] }>>({});
  const [newTitle, setNewTitle] = useState("");
  const [newOwner, setNewOwner] = useState<"tektone" | "customer">("tektone");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { plans } = await crmApi.listOnboardingPlans("pending_review");
      setPlans(plans);
    } catch (e) {
      setPlans([]);
      onError(e instanceof CrmApiError ? e.body?.error || "Falha ao carregar." : "Falha ao carregar.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function toggle(planId: string) {
    if (expandedId === planId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(planId);
    setNewTitle("");
    setNewOwner("tektone");
    if (!details[planId]) {
      try {
        const detail = await crmApi.getOnboardingPlan(planId);
        setDetails((d) => ({ ...d, [planId]: detail }));
      } catch (e) {
        onError(e instanceof CrmApiError ? e.body?.error || "Falha ao carregar o plano." : "Falha ao carregar o plano.");
      }
    }
  }

  function patchLocalStep(planId: string, stepId: string, patch: Partial<OnboardingStep>) {
    setDetails((d) => ({
      ...d,
      [planId]: { ...d[planId], steps: d[planId].steps.map((s) => (s.id === stepId ? { ...s, ...patch } : s)) },
    }));
  }

  async function saveStep(planId: string, step: OnboardingStep) {
    setBusy(step.id);
    try {
      const { step: updated } = await crmApi.updateOnboardingStep(planId, step.id, {
        title: step.title,
        description: step.description,
        owner: step.owner,
        category: step.category,
        dueOffsetDays: step.due_offset_days,
      });
      patchLocalStep(planId, step.id, updated);
    } catch (e) {
      onError(e instanceof CrmApiError ? e.body?.error || "Falha ao salvar a etapa." : "Falha ao salvar a etapa.");
    } finally {
      setBusy(null);
    }
  }

  async function removeStep(planId: string, stepId: string) {
    setBusy(stepId);
    try {
      await crmApi.deleteOnboardingStep(planId, stepId);
      setDetails((d) => ({ ...d, [planId]: { ...d[planId], steps: d[planId].steps.filter((s) => s.id !== stepId) } }));
    } catch (e) {
      onError(e instanceof CrmApiError ? e.body?.error || "Falha ao remover a etapa." : "Falha ao remover a etapa.");
    } finally {
      setBusy(null);
    }
  }

  async function addStep(planId: string) {
    if (!newTitle.trim()) return;
    setBusy("add");
    try {
      const { step } = await crmApi.addOnboardingStep(planId, { title: newTitle.trim(), owner: newOwner, category: null });
      setDetails((d) => ({ ...d, [planId]: { ...d[planId], steps: [...d[planId].steps, step] } }));
      setNewTitle("");
      setNewOwner("tektone");
    } catch (e) {
      onError(e instanceof CrmApiError ? e.body?.error || "Falha ao adicionar etapa." : "Falha ao adicionar etapa.");
    } finally {
      setBusy(null);
    }
  }

  function confirmApprove(planId: string, stepCount: number) {
    if (stepCount === 0) return;
    Alert.alert(
      "Aprovar plano",
      "Aprovar este plano? As etapas atuais serão aplicadas ao projeto (tarefas + checklist do cliente).",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Aprovar", onPress: () => approve(planId) },
      ]
    );
  }

  async function approve(planId: string) {
    setBusy("approve");
    try {
      await crmApi.approveOnboardingPlan(planId);
      setExpandedId(null);
      await load();
    } catch (e) {
      onError(e instanceof CrmApiError ? e.body?.error || "Falha ao aprovar o plano." : "Falha ao aprovar o plano.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <Text style={styles.hint}>
        Planos de onboarding gerados por IA a partir do brief do closer, aguardando revisão. Edite as etapas
        conforme necessário antes de aprovar — só depois de aprovado o plano vira tarefas no board e aparece no
        checklist do cliente no Portal.
      </Text>

      {plans === null ? (
        <ActivityIndicator style={{ marginTop: 20 }} color={colors.action} />
      ) : plans.length === 0 ? (
        <Text style={styles.emptyText}>Nenhum plano aguardando revisão.</Text>
      ) : (
        <View style={{ gap: 8 }}>
          {plans.map((p) => {
            const expanded = expandedId === p.id;
            const detail = details[p.id];
            return (
              <View key={p.id} style={styles.card}>
                <Pressable onPress={() => toggle(p.id)} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Sparkles size={13} color={colors.action} />
                      <Text style={styles.cardTitle} numberOfLines={1}>{p.project_name || "Projeto"}</Text>
                    </View>
                    {p.project_type ? <Text style={styles.metaText}>{p.project_type}</Text> : null}
                  </View>
                  {expanded ? <ChevronUp size={15} color={colors.stone500} /> : <ChevronDown size={15} color={colors.stone500} />}
                </Pressable>

                {expanded && (
                  <View style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: "rgba(20,22,24,0.1)", paddingTop: 12 }}>
                    {p.brief ? (
                      <View style={styles.briefBox}>
                        <Text style={styles.briefLabel}>brief do closer</Text>
                        <Text style={styles.briefText}>{p.brief}</Text>
                      </View>
                    ) : null}

                    {!detail ? (
                      <ActivityIndicator style={{ marginTop: 10 }} color={colors.action} />
                    ) : (
                      <>
                        <View style={{ gap: 8 }}>
                          {detail.steps.map((s) => (
                            <StepEditor
                              key={s.id}
                              step={s}
                              busy={busy === s.id}
                              onChange={(patch) => patchLocalStep(p.id, s.id, patch)}
                              onSave={() => saveStep(p.id, s)}
                              onRemove={() => removeStep(p.id, s.id)}
                            />
                          ))}
                        </View>

                        <View style={styles.addStepRow}>
                          <TextInput
                            placeholder="Título da nova etapa"
                            placeholderTextColor={colors.stone400}
                            value={newTitle}
                            onChangeText={setNewTitle}
                            style={[styles.input, { flex: 1, marginBottom: 0 }]}
                          />
                          <Pressable
                            onPress={() => setNewOwner((o) => (o === "tektone" ? "customer" : "tektone"))}
                            style={styles.ownerToggle}
                          >
                            <Text style={styles.ownerToggleText}>{newOwner === "tektone" ? "Tektone" : "Cliente"}</Text>
                          </Pressable>
                          <Pressable
                            onPress={() => addStep(p.id)}
                            disabled={busy === "add" || !newTitle.trim()}
                            style={[styles.iconBtn, (busy === "add" || !newTitle.trim()) && { opacity: 0.4 }]}
                          >
                            {busy === "add" ? <ActivityIndicator size="small" color={colors.stone500} /> : <Plus size={13} color={colors.stone500} />}
                          </Pressable>
                        </View>

                        <Pressable
                          onPress={() => confirmApprove(p.id, detail.steps.length)}
                          disabled={busy === "approve" || detail.steps.length === 0}
                          style={[styles.primaryBtn, { marginTop: 12 }, (busy === "approve" || detail.steps.length === 0) && { opacity: 0.5 }]}
                        >
                          {busy === "approve" ? <ActivityIndicator size="small" color={colors.clay} /> : <CheckCheck size={13} color={colors.clay} />}
                          <Text style={styles.primaryBtnText}>aprovar e aplicar</Text>
                        </Pressable>
                      </>
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

function StepEditor({
  step,
  busy,
  onChange,
  onSave,
  onRemove,
}: {
  step: OnboardingStep;
  busy: boolean;
  onChange: (patch: Partial<OnboardingStep>) => void;
  onSave: () => void;
  onRemove: () => void;
}) {
  const [ownerOpen, setOwnerOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const categoryLabel = ONBOARDING_CATEGORY_OPTIONS.find((o) => o.value === step.category)?.label || "sem categoria";
  const ownerLabel = ONBOARDING_OWNER_OPTIONS.find((o) => o.value === step.owner)?.label || step.owner;

  return (
    <View style={styles.stepBox}>
      <TextInput value={step.title} onChangeText={(v) => onChange({ title: v })} style={[styles.input, { marginBottom: 6 }]} />
      <TextInput
        value={step.description || ""}
        onChangeText={(v) => onChange({ description: v })}
        placeholder="Descrição (opcional)"
        placeholderTextColor={colors.stone400}
        multiline
        numberOfLines={2}
        style={[styles.input, { minHeight: 50, textAlignVertical: "top", marginBottom: 8, fontSize: 12 }]}
      />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
        <Pressable onPress={() => setOwnerOpen(true)} style={styles.chip}>
          <Text style={styles.chipText}>{ownerLabel}</Text>
        </Pressable>
        <Pressable onPress={() => setCategoryOpen(true)} style={styles.chip}>
          <Text style={styles.chipText}>{categoryLabel}</Text>
        </Pressable>
        <TextInput
          value={step.due_offset_days != null ? String(step.due_offset_days) : ""}
          onChangeText={(v) => onChange({ due_offset_days: v === "" ? null : Number(v.replace(/[^0-9-]/g, "")) })}
          placeholder="dias"
          placeholderTextColor={colors.stone400}
          keyboardType="number-pad"
          style={styles.daysInput}
        />
        <View style={{ marginLeft: "auto", flexDirection: "row", gap: 6 }}>
          <Pressable onPress={onSave} disabled={busy} style={[styles.outlineBtn, busy && { opacity: 0.4 }]}>
            {busy ? <ActivityIndicator size="small" color={colors.action} /> : <Check size={11} color={colors.action} />}
            <Text style={styles.outlineBtnText}>salvar</Text>
          </Pressable>
          <Pressable onPress={onRemove} disabled={busy} style={styles.iconBtn}>
            <Trash2 size={11} color={colors.stone500} />
          </Pressable>
        </View>
      </View>

      <PickerModal
        visible={ownerOpen}
        title="Responsável"
        options={ONBOARDING_OWNER_OPTIONS}
        selected={[step.owner]}
        onToggle={(v) => { onChange({ owner: v as "tektone" | "customer" }); setOwnerOpen(false); }}
        onClose={() => setOwnerOpen(false)}
      />
      <PickerModal
        visible={categoryOpen}
        title="Categoria"
        options={[{ value: "", label: "sem categoria" }, ...ONBOARDING_CATEGORY_OPTIONS]}
        selected={[step.category || ""]}
        onToggle={(v) => { onChange({ category: v || null }); setCategoryOpen(false); }}
        onClose={() => setCategoryOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.clay },
  header: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingTop: 8 },
  title: { fontFamily: fonts.sansSemiBold, fontSize: 16, color: colors.ink },
  tabRow: { flexDirection: "row", gap: 6, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  tabBtn: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: radii.md, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: "rgba(20,22,24,0.05)" },
  tabBtnActive: { backgroundColor: `${colors.action}18` },
  tabBtnText: { fontFamily: fonts.mono, fontSize: 10.5, color: colors.stone500 },
  tabBtnTextActive: { color: colors.action, fontFamily: fonts.monoMedium },
  hint: { fontFamily: fonts.sans, fontSize: 12, color: colors.stone500, lineHeight: 18, paddingHorizontal: 16, marginTop: 10 },
  error: { fontFamily: fonts.mono, fontSize: 11, color: colors.danger, paddingHorizontal: 16, marginTop: 8 },
  emptyText: { fontFamily: fonts.sans, fontSize: 12, color: colors.stone500, marginTop: 12 },

  row: {
    flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.paper, borderRadius: radii.lg,
    borderWidth: 1, borderColor: "rgba(20,22,24,0.1)", padding: 12, marginBottom: 8,
  },
  email: { fontFamily: fonts.sansSemiBold, fontSize: 13, color: colors.ink, flexShrink: 1 },
  adminBadge: { backgroundColor: `${colors.action}22`, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  adminBadgeText: { fontFamily: fonts.monoMedium, fontSize: 9, color: colors.action, textTransform: "uppercase" },
  status: { fontFamily: fonts.mono, fontSize: 11, color: colors.stone500 },
  resetBtn: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderColor: "rgba(20,22,24,0.15)", borderRadius: radii.md, paddingHorizontal: 10, paddingVertical: 8 },
  resetText: { fontFamily: fonts.mono, fontSize: 11, color: colors.stone500 },

  card: { ...surfaces[3], borderRadius: radii.lg, padding: 12, marginTop: 12 },
  cardTitle: { fontFamily: fonts.sansSemiBold, fontSize: 13, color: colors.ink, flexShrink: 1 },
  cardDesc: { fontFamily: fonts.sans, fontSize: 12, color: colors.stone500, marginTop: 4 },
  metaText: { fontFamily: fonts.mono, fontSize: 10, color: colors.stone500 },
  input: {
    borderWidth: 1, borderColor: "rgba(20,22,24,0.15)", backgroundColor: "rgba(20,22,24,0.03)", borderRadius: radii.md,
    paddingHorizontal: 10, paddingVertical: 9, fontSize: 13, color: colors.ink, fontFamily: fonts.sans, marginBottom: 8,
  },
  fieldLabel: { fontFamily: fonts.mono, fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: colors.stone500, marginBottom: 6 },
  selectBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1, borderColor: "rgba(20,22,24,0.15)",
    backgroundColor: "rgba(20,22,24,0.03)", borderRadius: radii.md, paddingHorizontal: 12, paddingVertical: 10,
  },
  selectBtnText: { fontFamily: fonts.sans, fontSize: 13, color: colors.ink },
  primaryBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.action, borderRadius: radii.md, paddingVertical: 12 },
  primaryBtnText: { fontFamily: fonts.sansBold, fontSize: 12.5, color: colors.clay },
  outlineBtn: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderColor: `${colors.action}66`, borderRadius: radii.md, paddingHorizontal: 10, paddingVertical: 7 },
  outlineBtnText: { fontFamily: fonts.mono, fontSize: 10.5, color: colors.action },
  iconBtn: { borderWidth: 1, borderColor: "rgba(20,22,24,0.15)", borderRadius: radii.md, padding: 8, alignItems: "center", justifyContent: "center" },

  briefBox: { backgroundColor: "rgba(20,22,24,0.04)", borderRadius: radii.md, padding: 10, marginBottom: 10 },
  briefLabel: { fontFamily: fonts.mono, fontSize: 9.5, textTransform: "uppercase", letterSpacing: 1, color: colors.stone500, marginBottom: 4 },
  briefText: { fontFamily: fonts.sans, fontSize: 12, color: colors.stone500, lineHeight: 17 },

  stepBox: { borderWidth: 1, borderColor: "rgba(20,22,24,0.1)", borderRadius: radii.md, padding: 10 },
  addStepRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10, backgroundColor: "rgba(20,22,24,0.03)", borderRadius: radii.md, padding: 8 },
  ownerToggle: { borderWidth: 1, borderColor: "rgba(20,22,24,0.15)", borderRadius: radii.md, paddingHorizontal: 8, paddingVertical: 9 },
  ownerToggleText: { fontFamily: fonts.mono, fontSize: 10.5, color: colors.ink },
  chip: { borderWidth: 1, borderColor: "rgba(20,22,24,0.15)", borderRadius: radii.md, paddingHorizontal: 8, paddingVertical: 5 },
  chipText: { fontFamily: fonts.mono, fontSize: 10.5, color: colors.ink },
  daysInput: {
    width: 56, borderWidth: 1, borderColor: "rgba(20,22,24,0.15)", borderRadius: radii.md, paddingHorizontal: 8, paddingVertical: 5,
    fontFamily: fonts.mono, fontSize: 10.5, color: colors.ink,
  },
});
