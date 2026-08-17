import { View, Text, Pressable, StyleSheet } from "react-native";
import { LogOut } from "lucide-react-native";
import LogoMark from "@/components/LogoMark";
import { useAuth } from "@/lib/auth";
import { colors, fonts, radii } from "@/lib/theme";

// Persistent top bar for the (customer)/ screens — web's CustomerShell.jsx
// has one header above its in-page tab switcher; mobile uses a native tab
// bar instead (no in-page switcher), so this small bar carries the
// branding + sign-out affordance that would otherwise have nowhere to
// live. Rendered per-screen (outside each ScrollView), same as (app)'s
// screens render their own headers.
export default function CustomerTopBar() {
  const { signOut } = useAuth();
  return (
    <View style={styles.bar}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <LogoMark width={22} height={26} />
        <Text style={styles.title}>TEKTONE</Text>
      </View>
      <Pressable onPress={signOut} style={styles.signOutBtn}>
        <LogOut size={12} color={colors.danger} />
        <Text style={styles.signOutText}>sair</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 8 },
  title: { fontFamily: fonts.sansSemiBold, fontSize: 13, letterSpacing: 3, color: colors.ink },
  signOutBtn: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderColor: "rgba(155,61,46,0.3)", borderRadius: radii.md, paddingHorizontal: 9, paddingVertical: 6 },
  signOutText: { fontFamily: fonts.mono, fontSize: 10.5, color: colors.danger },
});
