import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Plus, X, Square, CheckSquare, Lock, ChevronLeft, ChevronRight, Repeat } from "lucide-react-native";
import { api } from "@/lib/api";
import { colors, fonts, radii } from "@/lib/theme";

// Port of web's PersonalTodoPanel.jsx — a private, per-user daily checklist,
// unrelated to the board (GET/POST/PUT/DELETE /kanban/todos, see
// functions/api/kanban/[[path]].js's header doc comment). Phase 2 of
// ~/.claude/plans/tektone-mobile-parity.md.

type Todo = {
  id: string;
  text: string;
  done: boolean;
  date: string;
  recurrence?: "daily" | "weekdays" | "weekly";
  templateId?: string;
};

const RECURRENCE_OPTIONS: { value: "" | "daily" | "weekdays" | "weekly"; label: string }[] = [
  { value: "", label: "não repete" },
  { value: "daily", label: "todo dia" },
  { value: "weekdays", label: "dias úteis" },
  { value: "weekly", label: "toda semana" },
];
const RECURRENCE_LABEL: Record<string, string> = { daily: "todo dia", weekdays: "dias úteis", weekly: "toda semana" };

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const WEEKDAYS = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];

const isoOf = (d: Date) => d.toISOString().slice(0, 10);
const todayISO = () => isoOf(new Date());
const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + n);
  return isoOf(d);
};
const dayLabel = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`);
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} de ${MONTHS[d.getMonth()]}`;
};

function TodoRow({
  item,
  onToggle,
  onEdit,
  onRemove,
}: {
  item: Todo;
  onToggle: () => void;
  onEdit: (text: string) => void;
  onRemove: (series: boolean) => void;
}) {
  const [text, setText] = useState(item.text);
  const [confirming, setConfirming] = useState(false);
  useEffect(() => setText(item.text), [item.text]);

  return (
    <View style={styles.row}>
      <Pressable onPress={onToggle} hitSlop={8} style={styles.rowCheck}>
        {item.done ? <CheckSquare size={18} color={colors.success} /> : <Square size={18} color={colors.stone400} />}
      </Pressable>
      <TextInput
        value={text}
        onChangeText={setText}
        onBlur={() => {
          const t = text.trim();
          if (t && t !== item.text) onEdit(t);
          else setText(item.text);
        }}
        multiline
        style={[styles.rowText, item.done && styles.rowTextDone]}
      />
      {item.recurrence && (
        <View style={styles.recurrenceTag}>
          <Repeat size={11} color={colors.stone400} />
          <Text style={styles.recurrenceTagText}>{RECURRENCE_LABEL[item.recurrence]}</Text>
        </View>
      )}
      {confirming ? (
        <View style={styles.confirmRow}>
          <Pressable onPress={() => onRemove(false)} hitSlop={6}>
            <Text style={styles.confirmOnce}>só hoje</Text>
          </Pressable>
          <Pressable onPress={() => onRemove(true)} hitSlop={6}>
            <Text style={styles.confirmSeries}>série toda</Text>
          </Pressable>
          <Pressable onPress={() => setConfirming(false)} hitSlop={6}>
            <X size={12} color={colors.stone400} />
          </Pressable>
        </View>
      ) : (
        <Pressable onPress={() => (item.recurrence ? setConfirming(true) : onRemove(false))} hitSlop={8} style={{ marginTop: 2 }}>
          <X size={14} color={colors.stone400} />
        </Pressable>
      )}
    </View>
  );
}

export default function TodosScreen() {
  const [viewDate, setViewDate] = useState(todayISO());
  const [items, setItems] = useState<Todo[] | null>(null);
  const [text, setText] = useState("");
  const [recurrence, setRecurrence] = useState<"" | "daily" | "weekdays" | "weekly">("");
  const [error, setError] = useState("");
  const inputRef = useRef<TextInput>(null);

  const load = useCallback((date: string) => {
    setItems(null);
    api
      .listTodos(date)
      .then(({ items }) => setItems(items))
      .catch(() => setError("Não foi possível carregar suas tarefas."));
  }, []);

  useFocusEffect(useCallback(() => { load(viewDate); }, [load, viewDate]));

  const done = (items ?? []).filter((i) => i.done).length;
  const pct = items?.length ? Math.round((done / items.length) * 100) : 0;
  const isToday = viewDate === todayISO();

  async function add() {
    const t = text.trim();
    if (!t) return;
    setText("");
    const usedRecurrence = recurrence;
    setRecurrence("");
    try {
      const { item } = await api.createTodo(t, viewDate, usedRecurrence || undefined);
      setItems((p) => [...(p ?? []), item]);
    } catch {
      setError("Não foi possível salvar. Tente de novo.");
    }
  }

  async function toggle(item: Todo) {
    setItems((p) => (p ?? []).map((i) => (i.id === item.id ? { ...i, done: !i.done } : i)));
    try {
      await api.updateTodo(item.id, { done: !item.done });
    } catch {
      setItems((p) => (p ?? []).map((i) => (i.id === item.id ? { ...i, done: item.done } : i)));
    }
  }

  function edit(item: Todo, nextText: string) {
    setItems((p) => (p ?? []).map((i) => (i.id === item.id ? { ...i, text: nextText } : i)));
    api.updateTodo(item.id, { text: nextText }).catch(() => {});
  }

  function remove(item: Todo, series: boolean) {
    setItems((p) => (p ?? []).filter((i) => i.id !== item.id));
    api.deleteTodo(item.id, series).catch(() => {});
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.header}>
          <Text style={styles.title}>Minhas tarefas</Text>
          <View style={styles.dateNav}>
            <Pressable onPress={() => setViewDate((d) => addDays(d, -1))} hitSlop={8}>
              <ChevronLeft size={16} color={colors.stone400} />
            </Pressable>
            <Text style={styles.dateLabel}>{dayLabel(viewDate)}</Text>
            <Pressable onPress={() => setViewDate((d) => addDays(d, 1))} hitSlop={8}>
              <ChevronRight size={16} color={colors.stone400} />
            </Pressable>
            {!isToday && (
              <Pressable onPress={() => setViewDate(todayISO())} style={styles.todayBtn}>
                <Text style={styles.todayBtnText}>hoje</Text>
              </Pressable>
            )}
          </View>
          <View style={styles.lockRow}>
            <Lock size={9} color={colors.stone400} />
            <Text style={styles.lockText}>só você vê isto</Text>
          </View>
        </View>

        <View style={styles.addBox}>
          <View style={styles.addRow}>
            <Plus size={15} color={colors.stone400} />
            <TextInput
              ref={inputRef}
              value={text}
              onChangeText={setText}
              onSubmitEditing={add}
              placeholder={isToday ? "Adicionar tarefa do dia…" : `Adicionar tarefa…`}
              placeholderTextColor={colors.stone400}
              style={styles.addInput}
              returnKeyType="done"
            />
          </View>
          <View style={styles.recurrenceRow}>
            {RECURRENCE_OPTIONS.map((opt) => (
              <Pressable
                key={opt.value || "none"}
                onPress={() => setRecurrence(opt.value)}
                style={[styles.recurrenceChip, recurrence === opt.value && styles.recurrenceChipActive]}
              >
                <Text style={[styles.recurrenceChipText, recurrence === opt.value && styles.recurrenceChipTextActive]}>
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>
          {items && items.length > 0 && (
            <View style={styles.progressRow}>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${pct}%` }]} />
              </View>
              <Text style={styles.progressText}>{done}/{items.length}</Text>
            </View>
          )}
        </View>

        {items === null ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={colors.action} />
        ) : error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : items.length === 0 ? (
          <Text style={styles.empty}>
            {isToday ? "Nada por aqui ainda. Adicione o que precisa fazer hoje." : "Nada agendado para este dia."}
          </Text>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(i) => i.id}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
            renderItem={({ item }) => (
              <TodoRow
                item={item}
                onToggle={() => toggle(item)}
                onEdit={(t) => edit(item, t)}
                onRemove={(series) => remove(item, series)}
              />
            )}
          />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.clay },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "rgba(20,22,24,0.1)" },
  title: { fontFamily: fonts.sansSemiBold, fontSize: 20, color: colors.ink },
  dateNav: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
  dateLabel: { fontFamily: fonts.mono, fontSize: 11, color: colors.stone500, flex: 1 },
  todayBtn: { backgroundColor: "rgba(20,22,24,0.06)", borderRadius: radii.sm, paddingHorizontal: 8, paddingVertical: 3 },
  todayBtnText: { fontFamily: fonts.monoMedium, fontSize: 10, color: colors.ink },
  lockRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 },
  lockText: { fontFamily: fonts.mono, fontSize: 10, color: colors.stone400 },

  addBox: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "rgba(20,22,24,0.1)" },
  addRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  addInput: { flex: 1, fontFamily: fonts.sans, fontSize: 14, color: colors.ink, paddingVertical: 4 },
  recurrenceRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
  recurrenceChip: { borderWidth: 1, borderColor: "rgba(20,22,24,0.12)", borderRadius: radii.md, paddingHorizontal: 8, paddingVertical: 4 },
  recurrenceChipActive: { backgroundColor: colors.action, borderColor: colors.action },
  recurrenceChipText: { fontFamily: fonts.mono, fontSize: 10, color: colors.stone500 },
  recurrenceChipTextActive: { color: colors.clay },
  progressRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12 },
  progressTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: "rgba(20,22,24,0.08)", overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 3, backgroundColor: colors.success },
  progressText: { fontFamily: fonts.monoMedium, fontSize: 11, color: colors.stone500 },

  empty: { fontFamily: fonts.sans, fontSize: 13, color: colors.stone400, textAlign: "center", marginTop: 40, paddingHorizontal: 24 },
  errorText: { fontFamily: fonts.sans, fontSize: 13, color: colors.danger, textAlign: "center", marginTop: 24 },

  row: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "rgba(20,22,24,0.06)" },
  rowCheck: { marginTop: 2 },
  rowText: { flex: 1, fontFamily: fonts.sans, fontSize: 14, color: colors.ink, paddingVertical: 0 },
  rowTextDone: { color: colors.stone400, textDecorationLine: "line-through" },
  recurrenceTag: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 3 },
  recurrenceTagText: { fontFamily: fonts.mono, fontSize: 9, color: colors.stone400 },
  confirmRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 },
  confirmOnce: { fontFamily: fonts.mono, fontSize: 10, color: colors.stone500 },
  confirmSeries: { fontFamily: fonts.mono, fontSize: 10, color: colors.danger },
});
