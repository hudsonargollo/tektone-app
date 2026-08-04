import { useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { UserPlus } from "lucide-react-native";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { colors } from "@/lib/theme";
import { styles } from "./index";

export default function SignupStep() {
  const { email: emailParam } = useLocalSearchParams<{ email: string }>();
  const email = (emailParam || "").trim();
  const router = useRouter();
  const { signIn } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (password.length < 8) return setError("A senha precisa ter ao menos 8 caracteres.");
    if (password !== confirm) return setError("As senhas não coincidem.");
    setLoading(true);
    setError("");
    try {
      const res = await api.signup(email, password);
      await signIn(res.token);
    } catch (e) {
      setError(e instanceof ApiError ? e.body?.error || "Falha ao criar a conta." : "Falha ao criar a conta.");
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.card}>
        <View style={styles.head}>
          <View style={styles.headIcon}>
            <UserPlus size={16} color={colors.action} />
          </View>
          <View>
            <Text style={styles.headTitle}>Primeiro acesso</Text>
            <Text style={styles.headSub}>crie sua senha</Text>
          </View>
        </View>

        <Pressable onPress={() => router.replace("/(auth)")} style={{ marginBottom: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderWidth: 1, borderColor: "rgba(20,22,24,0.1)", backgroundColor: "rgba(20,22,24,0.03)", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 }}>
          <Text style={{ fontFamily: "JetBrainsMono_400Regular", fontSize: 12, color: colors.stone500 }} numberOfLines={1}>{email}</Text>
          <Text style={{ fontFamily: "JetBrainsMono_400Regular", fontSize: 11, color: colors.action }}>trocar</Text>
        </Pressable>

        <Text style={styles.label}>Nova senha</Text>
        <TextInput
          autoFocus
          value={password}
          onChangeText={setPassword}
          placeholder="mín. 8 caracteres"
          placeholderTextColor={colors.stone400}
          secureTextEntry
          style={[styles.input, { marginBottom: 14 }]}
        />

        <Text style={styles.label}>Confirmar senha</Text>
        <TextInput
          value={confirm}
          onChangeText={setConfirm}
          placeholder="repita a senha"
          placeholderTextColor={colors.stone400}
          secureTextEntry
          style={styles.input}
          onSubmitEditing={submit}
          returnKeyType="go"
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable onPress={submit} disabled={loading || !password || !confirm} style={[styles.button, (loading || !password || !confirm) && styles.buttonDisabled]}>
          {loading ? <ActivityIndicator color={colors.clay} /> : <Text style={styles.buttonText}>Criar conta</Text>}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
