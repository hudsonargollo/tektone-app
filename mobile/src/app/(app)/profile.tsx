import { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, Image, ScrollView, ActivityIndicator, Switch, Alert, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { Camera, Trash2, Check, Mail, Bell, LogOut } from "lucide-react-native";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { colors, fonts, radii } from "@/lib/theme";
import { initials } from "@/lib/constants";

type Profile = {
  email: string;
  name: string;
  role: string;
  phone: string;
  location: string;
  bio: string;
  avatar: string;
  emailNotifications: boolean;
  admin: boolean;
};

// Center-crop to a square, then resize — matches web's canvas-based
// fileToAvatar (ProfilePage.jsx): 256×256 JPEG @0.85 quality, as a data URL.
async function pickAvatar(): Promise<string | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    Alert.alert("Permissão necessária", "Autorize o acesso às fotos para trocar o avatar.");
    return null;
  }
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1 });
  if (result.canceled || !result.assets?.[0]) return null;

  const asset = result.assets[0];
  const side = Math.min(asset.width, asset.height);
  const originX = (asset.width - side) / 2;
  const originY = (asset.height - side) / 2;

  const manipulated = await manipulateAsync(
    asset.uri,
    [{ crop: { originX, originY, width: side, height: side } }, { resize: { width: 256, height: 256 } }],
    { compress: 0.85, format: SaveFormat.JPEG, base64: true }
  );
  return manipulated.base64 ? `data:image/jpeg;base64,${manipulated.base64}` : null;
}

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const [p, setP] = useState<Profile | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .getProfile()
      .then(({ profile }) => setP(profile))
      .catch((e) => setError(e instanceof ApiError ? e.body?.error || "Falha ao carregar." : "Falha ao carregar."));
  }, []);

  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setP((prev) => (prev ? { ...prev, [k]: v } : prev));

  async function onPickAvatar() {
    try {
      const avatar = await pickAvatar();
      if (avatar) set("avatar", avatar);
    } catch {
      setError("Não foi possível processar a imagem.");
    }
  }

  async function save() {
    if (!p) return;
    setSaving(true);
    setError("");
    try {
      const { profile } = await api.updateProfile({
        name: p.name,
        role: p.role,
        phone: p.phone,
        location: p.location,
        bio: p.bio,
        avatar: p.avatar,
        emailNotifications: p.emailNotifications,
      });
      setP(profile);
    } catch (e) {
      setError(e instanceof ApiError ? e.body?.error || "Falha ao salvar." : "Falha ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function logout() {
    await api.logout().catch(() => {});
    await signOut();
  }

  if (!user) return null;

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Text style={styles.title}>Perfil</Text>

        {!p ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={colors.action} />
        ) : (
          <>
            <View style={styles.avatarRow}>
              <View style={styles.avatarWrap}>
                {p.avatar ? (
                  <Image source={{ uri: p.avatar }} style={styles.avatarImg} />
                ) : (
                  <View style={[styles.avatarImg, styles.avatarFallback]}>
                    <Text style={styles.avatarFallbackText}>{initials(p.name || p.email)}</Text>
                  </View>
                )}
                <Pressable onPress={onPickAvatar} style={styles.cameraBtn}>
                  <Camera size={13} color={colors.clay} />
                </Pressable>
              </View>
              <View style={{ gap: 6 }}>
                <Pressable onPress={onPickAvatar} style={styles.uploadBtn}>
                  <Text style={styles.uploadBtnText}>Enviar foto</Text>
                </Pressable>
                {p.avatar ? (
                  <Pressable onPress={() => set("avatar", "")} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <Trash2 size={12} color={colors.stone400} />
                    <Text style={styles.removeText}>Remover</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <View style={styles.emailRow}>
              <Mail size={14} color={colors.stone400} />
              <Text style={styles.emailText}>{p.email}</Text>
              {p.admin && (
                <View style={styles.adminBadge}>
                  <Text style={styles.adminBadgeText}>admin</Text>
                </View>
              )}
            </View>

            <Field label="Nome" value={p.name} onChange={(v) => set("name", v)} />
            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Field label="Cargo" value={p.role} onChange={(v) => set("role", v)} placeholder="Ex.: CTO" />
              </View>
              <View style={{ flex: 1 }}>
                <Field label="Telefone" value={p.phone} onChange={(v) => set("phone", v)} placeholder="(00) 00000-0000" />
              </View>
            </View>
            <Field label="Localização" value={p.location} onChange={(v) => set("location", v)} placeholder="Cidade, país" />
            <Field label="Bio" value={p.bio} onChange={(v) => set("bio", v)} placeholder="Sobre você…" multiline />

            <View style={styles.toggleRow}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Bell size={14} color={colors.stone400} />
                <Text style={styles.toggleLabel}>Notificações por e-mail</Text>
              </View>
              <Switch
                value={p.emailNotifications !== false}
                onValueChange={(v) => set("emailNotifications", v)}
                trackColor={{ true: colors.action }}
              />
            </View>

            <Pressable onPress={save} disabled={saving} style={[styles.saveBtn, saving && { opacity: 0.6 }]}>
              {saving ? <ActivityIndicator color={colors.clay} /> : <Check size={14} color={colors.clay} />}
              <Text style={styles.saveBtnText}>Salvar</Text>
            </Pressable>
          </>
        )}

        <Pressable onPress={logout} style={styles.logoutBtn}>
          <LogOut size={14} color={colors.danger} />
          <Text style={styles.logoutText}>Sair</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  return (
    <View style={{ marginTop: 14 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value ?? ""}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.stone400}
        multiline={multiline}
        style={[styles.input, multiline && { minHeight: 70, textAlignVertical: "top" }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.clay },
  title: { fontFamily: fonts.sansSemiBold, fontSize: 20, color: colors.ink, marginBottom: 16 },
  avatarRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  avatarWrap: { position: "relative" },
  avatarImg: { width: 72, height: 72, borderRadius: 36 },
  avatarFallback: { backgroundColor: colors.action, alignItems: "center", justifyContent: "center" },
  avatarFallbackText: { fontFamily: fonts.sansBold, fontSize: 24, color: colors.clay },
  cameraBtn: { position: "absolute", bottom: -2, right: -2, backgroundColor: colors.action, borderRadius: 14, padding: 6 },
  uploadBtn: { borderWidth: 1, borderColor: "rgba(20,22,24,0.15)", borderRadius: radii.md, paddingHorizontal: 12, paddingVertical: 8, alignSelf: "flex-start" },
  uploadBtnText: { fontFamily: fonts.sansSemiBold, fontSize: 12, color: colors.stone500 },
  removeText: { fontFamily: fonts.sans, fontSize: 12, color: colors.stone400 },
  error: { fontFamily: fonts.mono, fontSize: 11, color: colors.danger, marginTop: 14 },
  emailRow: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: "rgba(20,22,24,0.1)", backgroundColor: "rgba(20,22,24,0.02)", borderRadius: radii.md, paddingHorizontal: 12, paddingVertical: 10, marginTop: 16 },
  emailText: { flex: 1, fontFamily: fonts.sans, fontSize: 13, color: colors.stone500 },
  adminBadge: { backgroundColor: `${colors.action}22`, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  adminBadgeText: { fontFamily: fonts.monoMedium, fontSize: 9, color: colors.action, textTransform: "uppercase" },
  fieldLabel: { fontFamily: fonts.mono, fontSize: 11, textTransform: "uppercase", letterSpacing: 1.5, color: colors.stone500, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: "rgba(20,22,24,0.15)", backgroundColor: "rgba(20,22,24,0.03)", borderRadius: radii.md, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.ink, fontFamily: fonts.sans },
  toggleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderWidth: 1, borderColor: "rgba(20,22,24,0.1)", backgroundColor: "rgba(20,22,24,0.02)", borderRadius: radii.md, paddingHorizontal: 12, paddingVertical: 10, marginTop: 16 },
  toggleLabel: { fontFamily: fonts.sans, fontSize: 13, color: colors.ink },
  saveBtn: { flexDirection: "row", gap: 8, marginTop: 20, backgroundColor: colors.action, borderRadius: radii.md, paddingVertical: 13, alignItems: "center", justifyContent: "center" },
  saveBtnText: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.clay },
  logoutBtn: { flexDirection: "row", gap: 8, marginTop: 24, borderWidth: 1, borderColor: "rgba(155,61,46,0.3)", borderRadius: radii.md, paddingVertical: 12, alignItems: "center", justifyContent: "center" },
  logoutText: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.danger },
});
