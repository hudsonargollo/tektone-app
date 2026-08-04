import { useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Lock } from "lucide-react-native";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { colors } from "@/lib/theme";
import { styles } from "./index";

export default function LoginStep() {
  const { email: emailParam } = useLocalSearchParams<{ email: string }>();
  const email = (emailParam || "").trim();
  const router = useRouter();
  const { signIn } = useAuth();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!password) return;
    setLoading(true);
    setError("");
    try {
      const res = await api.login(email, password);
      await signIn(res.token);
    } catch (e) {
      setError(e instanceof ApiError ? e.body?.error || "Senha incorreta." : "Falha ao entrar.");
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.card}>
        <View style={styles.head}>
          <View style={styles.headIcon}>
            <Lock size={16} color={colors.action} />
          </View>
          <View>
            <Text style={styles.headTitle}>Bem-vindo de volta</Text>
            <Text style={styles.headSub}>informe sua senha</Text>
          </View>
        </View>

        <Pressable onPress={() => router.replace("/(auth)")} style={{ marginBottom: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderWidth: 1, borderColor: "rgba(20,22,24,0.1)", backgroundColor: "rgba(20,22,24,0.03)", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 }}>
          <Text style={{ fontFamily: "JetBrainsMono_400Regular", fontSize: 12, color: colors.stone500 }} numberOfLines={1}>{email}</Text>
          <Text style={{ fontFamily: "JetBrainsMono_400Regular", fontSize: 11, color: colors.action }}>trocar</Text>
        </Pressable>

        <Text style={styles.label}>Senha</Text>
        <TextInput
          autoFocus
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          placeholderTextColor={colors.stone400}
          secureTextEntry
          style={styles.input}
          onSubmitEditing={submit}
          returnKeyType="go"
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable onPress={submit} disabled={loading || !password} style={[styles.button, (loading || !password) && styles.buttonDisabled]}>
          {loading ? <ActivityIndicator color={colors.clay} /> : <Text style={styles.buttonText}>Entrar</Text>}
        </Pressable>

        <Pressable onPress={() => router.push({ pathname: "/(auth)/forgot", params: { email } })} style={{ marginTop: 16, alignItems: "center" }}>
          <Text style={{ fontFamily: "JetBrainsMono_400Regular", fontSize: 11, color: colors.stone500 }}>esqueci a senha</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
