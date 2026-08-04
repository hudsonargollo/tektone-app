import { useEffect, useRef, type ReactNode } from "react";
import { Animated } from "react-native";
import { Redirect, Tabs } from "expo-router";
import { LayoutGrid, Bell, User, ShieldCheck } from "lucide-react-native";
import { useAuth } from "@/lib/auth";
import { colors, fonts } from "@/lib/theme";
import { RealtimeProvider, useRealtimeContext } from "@/lib/realtime";
import { registerForPushAsync } from "@/lib/push";
import NudgeToastHost from "@/components/NudgeToast";

// Reproduces web's CSS `tk-shake` keyframe (translateX ∓6px, ~0.5s) using
// RN's core Animated API — deliberately not react-native-reanimated, which
// segfaults inside Expo Go SDK 57's bundled libworklets.so (native
// worklets/reanimated version mismatch, see package.json for the pinned
// versions that work around it). Animated ships in RN core, no native
// module risk, plenty for a one-shot shake.
function ShakeWrapper({ children }: { children: ReactNode }) {
  const { shake } = useRealtimeContext();
  const shakeX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!shake) return;
    Animated.sequence([
      Animated.timing(shakeX, { toValue: -6, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: 6, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: -6, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: 6, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  }, [shake, shakeX]);

  return (
    <Animated.View style={{ flex: 1, transform: [{ translateX: shakeX }] }}>
      {children}
      <NudgeToastHost />
    </Animated.View>
  );
}

function AppTabs({ isAdmin }: { isAdmin: boolean }) {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.action,
        tabBarInactiveTintColor: colors.stone500,
        tabBarStyle: { backgroundColor: colors.paper, borderTopColor: "rgba(20,22,24,0.1)" },
        tabBarLabelStyle: { fontFamily: fonts.mono, fontSize: 10, textTransform: "uppercase", letterSpacing: 1 },
      }}
    >
      <Tabs.Screen
        name="board"
        options={{ title: "Quadro", tabBarIcon: ({ color, size }) => <LayoutGrid color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="notifications"
        options={{ title: "Avisos", tabBarIcon: ({ color, size }) => <Bell color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: "Perfil", tabBarIcon: ({ color, size }) => <User color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          title: "Admin",
          href: isAdmin ? undefined : null,
          tabBarIcon: ({ color, size }) => <ShieldCheck color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}

export default function AppLayout() {
  const { user, loading } = useAuth();

  // Registration needs a session (the token goes straight to the backend),
  // so this can't run any earlier than here. No-ops silently on simulators,
  // without `eas init`/a projectId, or if permission is denied.
  useEffect(() => {
    if (user) registerForPushAsync();
  }, [user]);

  if (loading) return null;
  if (!user) return <Redirect href="/(auth)" />;

  return (
    <RealtimeProvider myEmail={user.email}>
      <ShakeWrapper>
        <AppTabs isAdmin={user.admin} />
      </ShakeWrapper>
    </RealtimeProvider>
  );
}
