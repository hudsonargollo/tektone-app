import { Stack, useLocalSearchParams } from "expo-router";
import { WizardProvider } from "@/lib/wizard-context";
import { colors } from "@/lib/theme";

export default function WizardLayout() {
  const { cardId, title, clientId, assignees, priority, dueDate } = useLocalSearchParams<{
    cardId?: string;
    title?: string;
    clientId?: string;
    assignees?: string;
    priority?: string;
    dueDate?: string;
  }>();
  const mode = cardId ? "backfill" : "create";
  // No client/column filter concept on mobile yet — same fallback defaults
  // App.jsx uses on web when no active client is selected.
  const seedDefaults = {
    columnId: "todo",
    priority: "medium",
    clientId: "",
    assignee: "",
    assignees: [],
    dueDate: "",
    labelColor: null,
  };

  let parsedAssignees: string[] = [];
  try {
    parsedAssignees = assignees ? JSON.parse(assignees) : [];
  } catch {
    parsedAssignees = [];
  }

  return (
    <WizardProvider
      mode={mode}
      cardId={cardId ?? null}
      initialTitle={title ?? ""}
      initialClientId={clientId ?? ""}
      initialAssignees={parsedAssignees}
      initialPriority={priority || "medium"}
      initialDueDate={dueDate ?? ""}
      seedDefaults={seedDefaults}
    >
      <Stack
        screenOptions={{
          headerShown: true,
          headerStyle: { backgroundColor: colors.clay },
          headerTintColor: colors.ink,
          headerShadowVisible: false,
          headerBackTitle: "",
        }}
      >
        <Stack.Screen name="index" options={{ title: "Nova tarefa" }} />
        <Stack.Screen name="details" options={{ title: "Detalhes" }} />
        <Stack.Screen name="choice" options={{ title: "Como preencher?" }} />
        <Stack.Screen name="manual-challenge" options={{ title: "O desafio" }} />
        <Stack.Screen name="manual-method" options={{ title: "O método" }} />
        <Stack.Screen name="manual-quest" options={{ title: "A jornada" }} />
        <Stack.Screen name="manual-victory" options={{ title: "A vitória" }} />
        <Stack.Screen name="chat" options={{ title: "Entrevista com IA" }} />
        <Stack.Screen name="review" options={{ title: "Revisar e criar" }} />
      </Stack>
    </WizardProvider>
  );
}
