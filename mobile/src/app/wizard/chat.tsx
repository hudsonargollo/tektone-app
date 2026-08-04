import { useEffect, useRef, useState } from "react";
import { View, Text, TextInput, Pressable, FlatList, ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Send } from "lucide-react-native";
import { useWizard } from "@/lib/wizard-context";
import { colors, fonts, radii } from "@/lib/theme";

type Bubble = { id: string; from: "ai" | "user"; text: string };

export default function WizardChatStep() {
  const router = useRouter();
  const { turns, currentQuestion, chatBusy, chatError, finished, sendReply } = useWizard();
  const [reply, setReply] = useState("");
  const listRef = useRef<FlatList<Bubble>>(null);

  useEffect(() => {
    if (finished) router.replace("/wizard/review");
  }, [finished, router]);

  const bubbles: Bubble[] = [
    ...turns.flatMap((t, i) => [
      { id: `q${i}`, from: "ai" as const, text: t.question },
      { id: `a${i}`, from: "user" as const, text: t.answer },
    ]),
    ...(currentQuestion ? [{ id: "current", from: "ai" as const, text: currentQuestion.text }] : []),
  ];

  function send(finalize = false) {
    const val = reply;
    setReply("");
    sendReply(val, finalize);
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.clay }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={90}>
      <FlatList
        ref={listRef}
        data={bubbles}
        keyExtractor={(b) => b.id}
        contentContainerStyle={{ padding: 16 }}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        renderItem={({ item }) => (
          <View style={[styles.bubbleRow, item.from === "user" && { justifyContent: "flex-end" }]}>
            <View style={[styles.bubble, item.from === "ai" ? styles.bubbleAi : styles.bubbleUser]}>
              <Text style={[styles.bubbleText, item.from === "user" && { color: colors.clay }]}>{item.text}</Text>
            </View>
          </View>
        )}
        ListFooterComponent={chatBusy && !currentQuestion ? <ActivityIndicator color={colors.stone500} style={{ marginTop: 8 }} /> : null}
      />
      {chatError ? <Text style={styles.error}>{chatError}</Text> : null}
      <View style={styles.inputBar}>
        <TextInput
          value={reply}
          onChangeText={setReply}
          placeholder={currentQuestion ? "Digite sua resposta…" : "Aguardando…"}
          placeholderTextColor={colors.stone400}
          editable={!chatBusy && Boolean(currentQuestion)}
          style={styles.input}
          multiline
        />
        <Pressable onPress={() => send(true)} disabled={chatBusy || !currentQuestion} style={styles.finalizeBtn}>
          <Text style={styles.finalizeText}>Finalizar</Text>
        </Pressable>
        <Pressable onPress={() => send(false)} disabled={chatBusy || !currentQuestion || !reply.trim()} style={styles.sendBtn}>
          <Send size={16} color={colors.clay} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  bubbleRow: { flexDirection: "row", marginBottom: 10 },
  bubble: { maxWidth: "85%", borderRadius: radii.lg, paddingHorizontal: 12, paddingVertical: 9 },
  bubbleAi: { backgroundColor: colors.paper, borderWidth: 1, borderColor: "rgba(20,22,24,0.1)" },
  bubbleUser: { backgroundColor: colors.action },
  bubbleText: { fontFamily: fonts.sans, fontSize: 14, color: colors.ink, lineHeight: 20 },
  error: { fontFamily: fonts.mono, fontSize: 11, color: colors.danger, paddingHorizontal: 16, marginBottom: 4 },
  inputBar: { flexDirection: "row", alignItems: "flex-end", gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: "rgba(20,22,24,0.1)", backgroundColor: colors.paper },
  input: { flex: 1, fontFamily: fonts.sans, fontSize: 14, color: colors.ink, maxHeight: 100, borderWidth: 1, borderColor: "rgba(20,22,24,0.15)", borderRadius: radii.md, paddingHorizontal: 10, paddingVertical: 8 },
  finalizeBtn: { paddingHorizontal: 10, paddingVertical: 10 },
  finalizeText: { fontFamily: fonts.mono, fontSize: 10, color: colors.stone500 },
  sendBtn: { backgroundColor: colors.action, borderRadius: radii.md, padding: 10 },
});
