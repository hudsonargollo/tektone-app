import { useEffect } from "react";
import { Redirect, Tabs } from "expo-router";
import { ListChecks, FileText, Receipt, ShoppingBag } from "lucide-react-native";
import { useAuth } from "@/lib/auth";
import { CustomerProjectProvider } from "@/lib/customerProject";
import { registerForPushAsync } from "@/lib/push";
import { colors, fonts } from "@/lib/theme";

// The entire experience for a CUSTOMER-role account — a completely
// separate navigator tree from (app)'s staff Kanban shell, not a
// conditional branch inside it, so a customer build can never accidentally
// reach internal task detail, staff workloads, or the finance module (see
// PRD §4's isolation requirement — this mirrors web's CustomerShell.jsx vs
// App.jsx split). Guard here mirrors (app)/_layout.tsx's reverse check.
export default function CustomerLayout() {
  const { user, loading } = useAuth();

  // (app)/_layout.tsx registers push for staff; a CUSTOMER account never
  // mounts that layout, so without this it would silently never register.
  useEffect(() => {
    if (user) registerForPushAsync();
  }, [user]);

  if (loading) return null;
  if (!user) return <Redirect href="/(auth)" />;
  if (user.accessRole !== "CUSTOMER") return <Redirect href="/(app)/board" />;

  return (
    <CustomerProjectProvider>
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
        name="onboarding"
        options={{ title: "Onboarding", tabBarIcon: ({ color, size }) => <ListChecks color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="contracts"
        options={{ title: "Contratos", tabBarIcon: ({ color, size }) => <FileText color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="invoices"
        options={{ title: "Faturas", tabBarIcon: ({ color, size }) => <Receipt color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="marketplace"
        options={{ title: "Add-ons", tabBarIcon: ({ color, size }) => <ShoppingBag color={color} size={size} /> }}
      />
    </Tabs>
    </CustomerProjectProvider>
  );
}
