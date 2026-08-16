import { Redirect, Stack } from "expo-router";
import { useAuth } from "@/lib/auth";

// Mirrors (app)/_layout.tsx's reverse guard — a staff/admin account has no
// business in the customer shell, same isolation-by-construction principle
// as web's App.jsx CustomerShell/Board split.
export default function CustomerLayout() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Redirect href="/(auth)" />;
  if (user.accessRole !== "CUSTOMER") return <Redirect href="/(app)/board" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
