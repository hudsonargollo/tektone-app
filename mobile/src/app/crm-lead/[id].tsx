import { useCallback, useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, StyleSheet } from "react-native";
import { useLocalSearchParams, useFocusEffect } from "expo-router";
import { Save, Sparkles, Send, Check, ChevronDown } from "lucide-react-native";
import { crmApi } from "@/lib/crmApi";
import { colors, fonts, radii, surfaces } from "@/lib/theme";
import { PROJECT_TYPE_LABEL } from "@/lib/onboardingLabels";
import PickerModal from "@/components/CardDetail/PickerModal";

// Port of src/crm/CrmLeadDetail.jsx — Phase 8 of
// ~/.claude/plans/tektone-mobile-parity.md. Top-level dynamic route
// (mirrors card/[id].tsx's own pattern) instead of nested under (app)/crm —
// pushed from crm.tsx's Pipeline tab, registered in the root Stack in
// mobile/src/app/_layout.tsx.

const STAGES = ["new", "contacted", "qualified", "won", "lost", "incomplete"] as const;
const STAGE_LABEL: Record<string, string> = {
  new: "novo", contacted: "contatado", qualified: "qualificado", won: "ganho", lost: "perdido", incomplete: "incompleto",
};
const TIER_BG: Record<string, string> = { hot: `${colors.danger}1a`, warm: `${colors.warning}1a`, cold: "rgba(20,22,24,0.06)" };
const TIER_FG: Record<string, string> = { hot: colors.danger, warm: colors.warning, cold: colors.stone500 };
const TIER_LABEL: Record<string, string> = { hot: "quente", warm: "morno", cold: "frio" };

const QUALIFICATION_LABELS: Record<string, Record<string, string>> = {
  teamSize: { solo: "Somente eu", "2-5": "2 a 5", "6-15": "6 a 15", "16-50": "16 a 50", "50+": "Mais de 50" },
  revenue: {
    "0-10k": "Até R$ 10 mil", "10-50k": "R$ 10 mil a R$ 50 mil", "50-200k": "R$ 50 mil a R$ 200 mil",
    "200-500k": "R$ 200 mil a R$ 500 mil", "500k-1m": "R$ 500 mil a R$ 1 milhão", "1m+": "Acima de R$ 1 milhão",
  },
  moment: {
    problema_claro: "Tem um problema claro e quer resolvê-lo",
    poderia_melhor: "Sabe que a empresa poderia estar em outro nível, mas não sabe o quê mudar",
    ideia_oportunidade: "Tem uma ideia ou oportunidade e quer tirá-la do papel",
    nova_receita: "Quer criar uma nova fonte de receita",
    entendendo_momento: "Ainda está entendendo se é o momento certo",
  },
  urgency: { agora: "Agora — próximos 30 dias", "3_meses": "Próximos 3 meses", "6_meses": "Próximos 6 meses", sem_prazo: "Sem prazo definido" },
  investment: {
    pode_agora: "Pode investir agora", precisa_entender: "Precisa entender a solução e o retorno primeiro",
    "30_dias": "Consegue investir nos próximos 30 dias", organizar: "Precisa se organizar financeiramente",
    sem_disponibilidade: "Sem disponibilidade no momento",
  },
  decision: { responsavel_final: "É o responsável final pela decisão", socios: "Decide com sócio(s)", outro_responsavel: "Precisa envolver outro responsável", nao_participa: "Não participa da decisão" },
};
const QUALIFICATION_FIELD_LABEL: Record<string, string> = {
  teamSize: "Tamanho da equipe", revenue: "Faturamento mensal", moment: "Momento atual",
  urgency: "Urgência", investment: "Capacidade de investimento", decision: "Poder de decisão",
};

const brl = (n?: number | null) => Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function CrmLeadDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [data, setData] = useState<any>(null);
  const [notes, setNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);
  const [showWonForm, setShowWonForm] = useState(false);
  const [wonProjectType, setWonProjectType] = useState("");
  const [projectTypePickerOpen, setProjectTypePickerOpen] = useState(false);
  const [wonBrief, setWonBrief] = useState("");
  const [wonPendingReview, setWonPendingReview] = useState(false);
  const [saleAmount, setSaleAmount] = useState("");
  const [creatingSale, setCreatingSale] = useState(false);
  const [questions, setQuestions] = useState<any[] | null>(null);
  const [askText, setAskText] = useState("");
  const [asking, setAsking] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!id) return;
    crmApi.getLead(id).then((d: any) => {
      setData(d);
      setNotes(d.lead.notes || "");
    }).catch(() => {});
    crmApi.listQuestions(id).then(({ questions }: any) => setQuestions(questions)).catch(() => {});
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function submitAsk() {
    if (!askText.trim() || !id) return;
    setAsking(true);
    try {
      await crmApi.askCopilot(id, askText.trim());
      setAskText("");
      load();
    } finally {
      setAsking(false);
    }
  }

  async function runSuggest() {
    if (!id) return;
    setSuggesting(true);
    try {
      await crmApi.suggestCopilot(id);
      load();
    } finally {
      setSuggesting(false);
    }
  }

  async function approve(qid: string) {
    setApprovingId(qid);
    try {
      await crmApi.approveQuestion(qid);
      load();
    } finally {
      setApprovingId(null);
    }
  }

  async function saveNotes() {
    if (!id) return;
    setSavingNotes(true);
    try {
      await crmApi.updateLead(id, { notes });
      load();
    } finally {
      setSavingNotes(false);
    }
  }

  async function setStatus(status: string) {
    if (!id) return;
    setChangingStatus(true);
    try {
      await crmApi.setLeadStatus(id, status);
      load();
    } finally {
      setChangingStatus(false);
    }
  }

  async function confirmWon() {
    if (!id) return;
    setChangingStatus(true);
    try {
      const { automation } = await crmApi.setLeadStatus(id, "won", {
        projectType: wonProjectType || undefined,
        brief: wonBrief.trim() || undefined,
      });
      setShowWonForm(false);
      setWonProjectType("");
      setWonBrief("");
      setWonPendingReview(automation?.onboardingPlan?.status === "pending_review");
      load();
    } finally {
      setChangingStatus(false);
    }
  }

  async function submitSale() {
    const amount = Number(saleAmount);
    if (!amount || amount <= 0 || !id) return;
    setCreatingSale(true);
    try {
      await crmApi.createSale(id, amount, "BRL");
      setSaleAmount("");
      load();
    } finally {
      setCreatingSale(false);
    }
  }

  if (!data) {
    return (
      <View style={styles.screen}>
        <ActivityIndicator style={{ marginTop: 60 }} color={colors.action} />
      </View>
    );
  }

  const { lead, events, sales } = data;
  let qualification: any = null;
  try {
    qualification = lead.qualification ? JSON.parse(lead.qualification) : null;
  } catch {
    qualification = null;
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 14 }}>
      <View style={styles.card}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12, gap: 8 }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.leadTitle}>{lead.name || lead.email || lead.phone}</Text>
            <Text style={styles.leadSub}>{[lead.email, lead.phone, lead.company, lead.segmento].filter(Boolean).join(" · ")}</Text>
          </View>
          <View style={{ flexDirection: "row", gap: 6 }}>
            {lead.tier ? (
              <View style={[styles.pill, { backgroundColor: TIER_BG[lead.tier] }]}>
                <Text style={[styles.pillText, { color: TIER_FG[lead.tier] }]}>
                  {TIER_LABEL[lead.tier] || lead.tier}{typeof lead.score === "number" ? ` · ${lead.score}/90` : ""}
                </Text>
              </View>
            ) : null}
            <View style={styles.pill}><Text style={styles.pillText}>{STAGE_LABEL[lead.status] || lead.status}</Text></View>
          </View>
        </View>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
          {STAGES.map((s) => (
            <Pressable
              key={s}
              disabled={changingStatus || s === lead.status}
              onPress={() => (s === "won" ? setShowWonForm(true) : setStatus(s))}
              style={[styles.stageBtn, s === lead.status && styles.stageBtnActive, (changingStatus || s === lead.status) && s !== lead.status && { opacity: 0.4 }]}
            >
              <Text style={[styles.stageBtnText, s === lead.status && styles.stageBtnTextActive]}>{STAGE_LABEL[s]}</Text>
            </Pressable>
          ))}
        </View>

        {wonPendingReview ? (
          <View style={styles.noticeBox}>
            <Sparkles size={12} color={colors.action} />
            <Text style={styles.noticeText}>Plano de onboarding gerado por IA — revise em Admin → Onboarding (revisão) antes que ele vire tarefas.</Text>
          </View>
        ) : null}

        {showWonForm ? (
          <View style={styles.wonBox}>
            <Text style={styles.wonLabel}>Marcar como ganho</Text>
            <Pressable onPress={() => setProjectTypePickerOpen(true)} style={styles.selectBtn}>
              <Text style={styles.selectBtnText}>{wonProjectType ? PROJECT_TYPE_LABEL[wonProjectType] : "Tipo de projeto (opcional)"}</Text>
              <ChevronDown size={13} color={colors.stone500} />
            </Pressable>
            <TextInput
              value={wonBrief}
              onChangeText={setWonBrief}
              multiline
              numberOfLines={3}
              placeholder="Diretrizes do projeto (opcional) — contexto que ajuda a montar o onboarding certo para este cliente."
              placeholderTextColor={colors.stone400}
              style={[styles.input, { minHeight: 70, textAlignVertical: "top" }]}
            />
            <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
              <Pressable onPress={confirmWon} disabled={changingStatus} style={[styles.primaryBtnSm, changingStatus && { opacity: 0.6 }]}>
                {changingStatus ? <ActivityIndicator size="small" color={colors.clay} /> : null}
                <Text style={styles.primaryBtnSmText}>confirmar ganho</Text>
              </Pressable>
              <Pressable onPress={() => setShowWonForm(false)} disabled={changingStatus} style={styles.outlineBtn}>
                <Text style={styles.outlineBtnText}>cancelar</Text>
              </Pressable>
            </View>
            <PickerModal
              visible={projectTypePickerOpen}
              title="Tipo de projeto"
              options={[{ value: "", label: "Nenhum" }, ...Object.entries(PROJECT_TYPE_LABEL).map(([k, label]) => ({ value: k, label }))]}
              selected={[wonProjectType]}
              onToggle={(v) => { setWonProjectType(v); setProjectTypePickerOpen(false); }}
              onClose={() => setProjectTypePickerOpen(false)}
            />
          </View>
        ) : null}

        <Text style={styles.fieldLabel}>Notas</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={4}
          style={[styles.input, { minHeight: 90, textAlignVertical: "top" }]}
        />
        <Pressable onPress={saveNotes} disabled={savingNotes} style={[styles.outlineBtn, savingNotes && { opacity: 0.6 }]}>
          {savingNotes ? <ActivityIndicator size="small" color={colors.stone500} /> : <Save size={12} color={colors.stone500} />}
          <Text style={styles.outlineBtnText}>salvar notas</Text>
        </Pressable>
      </View>

      {qualification ? (
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Qualificação (formulário do site)</Text>
          <View style={{ gap: 8, marginTop: 10 }}>
            {["teamSize", "revenue", "moment", "urgency", "investment", "decision"].map((field) =>
              qualification[field] ? (
                <View key={field} style={styles.qualRow}>
                  <Text style={styles.qualLabel}>{QUALIFICATION_FIELD_LABEL[field]}</Text>
                  <Text style={styles.qualValue}>{QUALIFICATION_LABELS[field]?.[qualification[field]] || qualification[field]}</Text>
                </View>
              ) : null
            )}
            {qualification.goals?.length > 0 ? (
              <View style={styles.qualRow}>
                <Text style={styles.qualLabel}>Objetivos</Text>
                <Text style={styles.qualValue}>{qualification.goals.join(" · ")}{qualification.goalsOther ? ` · ${qualification.goalsOther}` : ""}</Text>
              </View>
            ) : null}
            {qualification.instagram ? <Text style={styles.metaText}>Instagram: {qualification.instagram}</Text> : null}
          </View>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>Vendas</Text>
        {sales?.length > 0 ? (
          <View style={{ gap: 6, marginTop: 10, marginBottom: 10 }}>
            {sales.map((s: any) => (
              <View key={s.id} style={styles.qualRow}>
                <Text style={styles.qualLabel}>{s.status}</Text>
                <Text style={styles.saleAmount}>{brl(s.amount)}</Text>
              </View>
            ))}
          </View>
        ) : null}
        <View style={{ flexDirection: "row", gap: 8, marginTop: sales?.length > 0 ? 0 : 10 }}>
          <TextInput
            placeholder="Valor da venda (R$)"
            placeholderTextColor={colors.stone400}
            value={saleAmount}
            onChangeText={(v) => setSaleAmount(v.replace(/[^0-9.]/g, ""))}
            keyboardType="decimal-pad"
            style={[styles.input, { flex: 1, marginBottom: 0 }]}
          />
          <Pressable onPress={submitSale} disabled={creatingSale} style={[styles.primaryBtnSm, creatingSale && { opacity: 0.6 }]}>
            {creatingSale ? <ActivityIndicator size="small" color={colors.clay} /> : null}
            <Text style={styles.primaryBtnSmText}>registrar</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.card}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Sparkles size={12} color={colors.action} />
            <Text style={styles.sectionLabel}>Business Specialist Copilot</Text>
          </View>
          <Pressable onPress={runSuggest} disabled={suggesting} style={styles.outlineBtn}>
            {suggesting ? <ActivityIndicator size="small" color={colors.stone500} /> : <Sparkles size={12} color={colors.stone500} />}
            <Text style={styles.outlineBtnText}>sugerir</Text>
          </Pressable>
        </View>

        <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
          <TextInput
            placeholder="Pergunte algo sobre este lead…"
            placeholderTextColor={colors.stone400}
            value={askText}
            onChangeText={setAskText}
            style={[styles.input, { flex: 1, marginBottom: 0 }]}
          />
          <Pressable onPress={submitAsk} disabled={asking} style={[styles.primaryBtnSm, asking && { opacity: 0.6 }]}>
            {asking ? <ActivityIndicator size="small" color={colors.clay} /> : <Send size={13} color={colors.clay} />}
          </Pressable>
        </View>

        {questions === null ? (
          <ActivityIndicator color={colors.action} />
        ) : questions.length === 0 ? (
          <Text style={styles.metaText}>Nenhuma interação ainda.</Text>
        ) : (
          <View style={{ gap: 8 }}>
            {questions.map((q) => (
              <View key={q.id} style={styles.questionCard}>
                {q.question_text ? <Text style={styles.questionText}>&ldquo;{q.question_text}&rdquo;</Text> : null}
                <Text style={styles.answerText}>{q.ai_draft_answer}</Text>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
                  <Text style={styles.metaText}>{q.ai_confidence ? `confiança: ${q.ai_confidence}` : ""}</Text>
                  {q.status === "approved" ? (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Check size={11} color={colors.success} />
                      <Text style={[styles.metaText, { color: colors.success }]}>aprovado</Text>
                    </View>
                  ) : (
                    <Pressable onPress={() => approve(q.id)} disabled={approvingId === q.id}>
                      <Text style={styles.approveLink}>aprovar e salvar na base</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>Histórico</Text>
        <View style={{ gap: 6, marginTop: 10 }}>
          {events.map((e: any) => (
            <View key={e.id} style={styles.qualRow}>
              <Text style={styles.qualLabel}>{e.type}</Text>
              <Text style={styles.metaText}>{e.actor_email}</Text>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.clay },
  card: { ...surfaces[2], borderRadius: radii.xl, padding: 16 },
  leadTitle: { fontFamily: fonts.sansBold, fontSize: 16, color: colors.ink },
  leadSub: { fontFamily: fonts.mono, fontSize: 10.5, color: colors.stone500, marginTop: 3 },
  pill: { backgroundColor: "rgba(20,22,24,0.06)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  pillText: { fontFamily: fonts.mono, fontSize: 9.5, textTransform: "uppercase", letterSpacing: 0.4, color: colors.stone500 },
  stageBtn: { borderRadius: radii.md, paddingHorizontal: 11, paddingVertical: 8, ...surfaces[3] },
  stageBtnActive: { backgroundColor: colors.action, borderColor: colors.action },
  stageBtnText: { fontFamily: fonts.mono, fontSize: 10.5, color: colors.stone500 },
  stageBtnTextActive: { color: colors.clay },
  noticeBox: { flexDirection: "row", alignItems: "flex-start", gap: 8, borderWidth: 1, borderColor: `${colors.action}4d`, backgroundColor: `${colors.action}0f`, borderRadius: radii.md, padding: 10, marginBottom: 12 },
  noticeText: { flex: 1, fontFamily: fonts.mono, fontSize: 10.5, color: colors.action, lineHeight: 15 },
  wonBox: { ...surfaces[3], borderRadius: radii.md, padding: 12, marginBottom: 12, gap: 8 },
  wonLabel: { fontFamily: fonts.mono, fontSize: 10.5, textTransform: "uppercase", letterSpacing: 0.6, color: colors.stone500, marginBottom: 4 },
  fieldLabel: { fontFamily: fonts.mono, fontSize: 10.5, textTransform: "uppercase", letterSpacing: 0.6, color: colors.stone500, marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: "rgba(20,22,24,0.15)", backgroundColor: colors.paper, borderRadius: radii.md,
    paddingHorizontal: 10, paddingVertical: 9, fontSize: 13, color: colors.ink, fontFamily: fonts.sans, marginBottom: 8,
  },
  selectBtn: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1, borderColor: "rgba(20,22,24,0.15)", backgroundColor: colors.paper, borderRadius: radii.md, paddingHorizontal: 10, paddingVertical: 9 },
  selectBtnText: { fontFamily: fonts.sans, fontSize: 13, color: colors.ink },
  primaryBtnSm: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: colors.action, borderRadius: radii.md, paddingHorizontal: 14, paddingVertical: 10 },
  primaryBtnSmText: { fontFamily: fonts.sansBold, fontSize: 11.5, color: colors.clay },
  outlineBtn: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", borderWidth: 1, borderColor: "rgba(20,22,24,0.15)", borderRadius: radii.md, paddingHorizontal: 10, paddingVertical: 8 },
  outlineBtnText: { fontFamily: fonts.mono, fontSize: 10.5, color: colors.stone500 },
  sectionLabel: { fontFamily: fonts.mono, fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: colors.stone500 },
  qualRow: { ...surfaces[3], borderRadius: radii.md, paddingHorizontal: 12, paddingVertical: 9 },
  qualLabel: { fontFamily: fonts.mono, fontSize: 9.5, textTransform: "uppercase", letterSpacing: 0.4, color: colors.stone400 },
  qualValue: { fontFamily: fonts.sans, fontSize: 13, color: colors.ink, marginTop: 2 },
  metaText: { fontFamily: fonts.mono, fontSize: 10.5, color: colors.stone500 },
  saleAmount: { fontFamily: fonts.sansSemiBold, fontSize: 13, color: colors.ink, marginTop: 2 },
  questionCard: { ...surfaces[3], borderRadius: radii.md, padding: 12 },
  questionText: { fontFamily: fonts.mono, fontSize: 11, color: colors.stone500, marginBottom: 6 },
  answerText: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 19, color: colors.ink },
  approveLink: { fontFamily: fonts.mono, fontSize: 10.5, color: colors.action },
});
