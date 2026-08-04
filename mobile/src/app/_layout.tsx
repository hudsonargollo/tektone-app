import { useEffect } from "react";
import { Stack } from "expo-router";
import { useFonts } from "expo-font";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import { JetBrainsMono_400Regular, JetBrainsMono_500Medium } from "@expo-google-fonts/jetbrains-mono";
import { EBGaramond_500Medium_Italic } from "@expo-google-fonts/eb-garamond";
import * as SplashScreen from "expo-splash-screen";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AuthProvider } from "@/lib/auth";
import { api } from "@/lib/api";
import { colors } from "@/lib/theme";

SplashScreen.preventAutoHideAsync().catch(() => {});

async function bootstrap() {
  const res = await api.me();
  if (!res.authed) throw new Error("not authed");
  return { email: res.email, name: res.name, admin: res.admin, avatar: res.avatar };
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
    EBGaramond_500Medium_Italic,
  });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider bootstrap={bootstrap}>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.clay } }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(app)" />
          <Stack.Screen
            name="card/[id]"
            options={{
              headerShown: true,
              headerTitle: "Tarefa",
              headerStyle: { backgroundColor: colors.clay },
              headerTintColor: colors.ink,
              headerShadowVisible: false,
              presentation: "card",
            }}
          />
          <Stack.Screen name="wizard" options={{ presentation: "modal" }} />
        </Stack>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
