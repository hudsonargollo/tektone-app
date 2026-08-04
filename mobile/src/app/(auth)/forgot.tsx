import { View, Text, Pressable, Linking } from "react-native";
import { useRouter } from "expo-router";
import { ShieldQuestion, Mail, ArrowLeft } from "lucide-react-native";
import { colors } from "@/lib/theme";
import { styles } from "./index";

const ADMIN_CONTACT = "hudson@tektone.com.br";

export default function ForgotStep() {
  const router = useRouter();

  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <View style={styles.head}>
          <View style={styles.headIcon}>
            <ShieldQuestion size={16} color={colors.action} />
          </View>
          <View>
            <Text style={styles.headTitle}>Redefinir senha</Text>
            <Text style={styles.headSub}>reset assistido</Text>
          </View>
        </View>

        <Text style={{ fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 21, color: colors.stone500 }}>
          Por segurança, a redefinição é feita pelo administrador. Peça ao admin para resetar seu acesso — depois
          você poderá criar uma nova senha em primeiro acesso.
        </Text>

        <Pressable
          onPress={() => Linking.openURL(`mailto:${ADMIN_CONTACT}?subject=Reset%20de%20acesso%20-%20TaskTone`)}
          style={{ marginTop: 16, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.paper, borderWidth: 1, borderColor: "rgba(20,22,24,0.1)", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12 }}
        >
          <Mail size={15} color={colors.action} />
          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 14, color: colors.ink }}>{ADMIN_CONTACT}</Text>
        </Pressable>

        <Pressable onPress={() => router.back()} style={{ marginTop: 20, flexDirection: "row", alignItems: "center", gap: 6 }}>
          <ArrowLeft size={12} color={colors.stone500} />
          <Text style={{ fontFamily: "JetBrainsMono_400Regular", fontSize: 11, color: colors.stone500 }}>voltar</Text>
        </Pressable>
      </View>
    </View>
  );
}
