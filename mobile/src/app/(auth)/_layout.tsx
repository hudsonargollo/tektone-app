import { Redirect, Stack } from "expo-router";
import { useAuth } from "@/lib/auth";

export default function AuthLayout() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Redirect href={user.accessRole === "CUSTOMER" ? "/(customer)/onboarding" : "/(app)/board"} />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
