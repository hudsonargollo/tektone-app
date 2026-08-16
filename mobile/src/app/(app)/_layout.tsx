import { useEffect, useRef, type ReactNode } from "react";
import { Animated } from "react-native";
import { Redirect, Tabs } from "expo-router";
import { LayoutGrid, Bell, User, ShieldCheck, ListChecks, Award, MoreHorizontal, Sparkles } from "lucide-react-native";
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

// Bottom bar holds only the highest-frequency destinations (5 max —
// Instagram/most consumer apps' own ceiling for a phone-width bar).
// Everything else (Jornada, Admin, Meetings, and CRM/Finance/Commercial/
// Blog/Builder/Social as later mobile-parity phases add them) lives behind
// "Mais" — a plain menu screen, same role web's AppSidebar plays as a
// scrollable rail. Those screens stay real Tabs.Screen entries (so they're
// addressable via router.push and keep their own back-to-tab-bar chrome)
// with href: null, which hides them from the bar without removing them from
// the navigator — same trick already used for the admin-only gate below,
// just applied unconditionally now instead of conditionally — more.tsx
// reads user.admin itself via useAuth() to decide whether to list Admin.
function AppTabs() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.action,
        tabBarInactiveTintColor: colors.stone500,
        tabBarStyle: { backgroundColor: colors.paper, borderTopColor: "rgba(20,22,24,0.1)" },
        tabBarLabelStyle: { fontFamily: fonts.mono, fontSize: 9, textTransform: "uppercase", letterSpacing: 0.6 },
      }}
    >
      <Tabs.Screen
        name="board"
        options={{ title: "Quadro", tabBarIcon: ({ color, size }) => <LayoutGrid color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="todos"
        options={{ title: "Tarefas", tabBarIcon: ({ color, size }) => <ListChecks color={color} size={size} /> }}
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
        name="more"
        options={{ title: "Mais", tabBarIcon: ({ color, size }) => <MoreHorizontal color={color} size={size} /> }}
      />
      <Tabs.Screen name="journey" options={{ href: null, tabBarIcon: ({ color, size }) => <Award color={color} size={size} /> }} />
      <Tabs.Screen name="meetings" options={{ href: null, tabBarIcon: ({ color, size }) => <Sparkles color={color} size={size} /> }} />
      <Tabs.Screen
        name="admin"
        options={{ href: null, tabBarIcon: ({ color, size }) => <ShieldCheck color={color} size={size} /> }}
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
  // A CUSTOMER-role account gets a completely separate shell, no board
  // access at all — mirrors web's App.jsx `accessRole === "CUSTOMER" ?
  // <CustomerShell/> : <Board/>` isolation-by-construction (PRD's stated
  // defense-in-depth: a customer bundle should never even reach internal
  // task detail).
  if (user.accessRole === "CUSTOMER") return <Redirect href="/(customer)" />;

  return (
    <RealtimeProvider myEmail={user.email}>
      <ShakeWrapper>
        <AppTabs />
      </ShakeWrapper>
    </RealtimeProvider>
  );
}
