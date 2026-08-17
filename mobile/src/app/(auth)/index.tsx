import { useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator, StyleSheet, KeyboardAvoidingView, Platform } from "react-native";
import { useRouter } from "expo-router";
import { Mail } from "lucide-react-native";
import LogoMark from "@/components/LogoMark";
import { api } from "@/lib/api";
import { colors, fonts, radii } from "@/lib/theme";

export default function EmailStep() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    const addr = email.trim().toLowerCase();
    if (!addr) return;
    setLoading(true);
    setError("");
    try {
      const { allowed, exists } = await api.check(addr);
      if (!allowed) {
        setError("Este e-mail não tem acesso ao painel.");
        setLoading(false);
        return;
      }
      router.push({ pathname: exists ? "/(auth)/login" : "/(auth)/signup", params: { email: addr } });
    } catch {
      setError("Não foi possível verificar o e-mail.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.brand}>
        <LogoMark width={72} height={84} />
        <Text style={styles.brandTitle}>WORKHUB</Text>
        <Text style={styles.brandByline}>by TEKTONE</Text>
        <Text style={styles.brandSub}>Ordo · Tekhnē · Permanentia</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.head}>
          <View style={styles.headIcon}>
            <Mail size={16} color={colors.action} />
          </View>
          <View>
            <Text style={styles.headTitle}>Entrar</Text>
            <Text style={styles.headSub}>informe seu e-mail</Text>
          </View>
        </View>

        <Text style={styles.label}>E-mail</Text>
        <TextInput
          autoFocus
          value={email}
          onChangeText={setEmail}
          placeholder="voce@tektone.com.br"
          placeholderTextColor={colors.stone400}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          style={styles.input}
          onSubmitEditing={submit}
          returnKeyType="go"
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          onPress={submit}
          disabled={loading || !email.trim()}
          style={[styles.button, (loading || !email.trim()) && styles.buttonDisabled]}
        >
          {loading ? <ActivityIndicator color={colors.clay} /> : <Text style={styles.buttonText}>Continuar</Text>}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.clay, justifyContent: "center", padding: 24 },
  brand: { alignItems: "center", marginBottom: 28 },
  brandTitle: { fontFamily: fonts.sansSemiBold, fontSize: 17, letterSpacing: 4, color: colors.ink, marginTop: 10 },
  brandByline: { fontFamily: fonts.mono, fontSize: 10, letterSpacing: 2, color: colors.stone500, marginTop: 3 },
  brandSub: { fontFamily: fonts.serifItalic, fontSize: 14, color: colors.green, marginTop: 6 },
  card: { backgroundColor: colors.paper, borderRadius: radii.xl, padding: 22, borderWidth: 1, borderColor: "rgba(20,22,24,0.1)" },
  head: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 20 },
  headIcon: { width: 36, height: 36, borderRadius: radii.md, backgroundColor: colors.paper, borderWidth: 1, borderColor: "rgba(20,22,24,0.1)", alignItems: "center", justifyContent: "center" },
  headTitle: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.ink },
  headSub: { fontFamily: fonts.mono, fontSize: 11, color: colors.stone500 },
  label: { fontFamily: fonts.mono, fontSize: 11, textTransform: "uppercase", letterSpacing: 1.5, color: colors.stone500, marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: "rgba(20,22,24,0.15)", backgroundColor: "rgba(20,22,24,0.03)",
    borderRadius: radii.md, paddingHorizontal: 12, paddingVertical: 12, fontSize: 15, color: colors.ink, fontFamily: fonts.sans,
  },
  error: { marginTop: 10, fontFamily: fonts.mono, fontSize: 11, color: colors.danger },
  button: { marginTop: 18, backgroundColor: colors.action, borderRadius: radii.md, paddingVertical: 14, alignItems: "center" },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.clay },
});
