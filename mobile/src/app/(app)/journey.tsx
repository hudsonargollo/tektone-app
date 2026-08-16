import { useCallback, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator, StyleSheet } from "react-native";
import { useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Award, Flame, Lock, BookOpen } from "lucide-react-native";
import { api } from "@/lib/api";
import { colors, fonts, radii, surfaces } from "@/lib/theme";

// Port of web's BuilderProfilePanel.jsx — "Jornada," the builder's
// gamification profile: level/XP earned from reviewed tasks (see
// functions/_lib/gamification.js), a daily streak, and a 12-card deck of
// stoic + biblical wisdom that unlocks as levels climb. Read-only display,
// no new backend. Distinct from profile.tsx (account settings). Phase 2 of
// ~/.claude/plans/tektone-mobile-parity.md.

type WisdomCard = {
  id: string;
  unlocked: boolean;
  levelReq: number;
  skillName: string;
  stoicQuote: string;
  stoicSource: string;
  bibleVerse: string;
  bibleRef: string;
};

type Profile = {
  level: number;
  xp: number;
  nextLevelXp: number;
  currentStreak: number;
  longestStreak: number;
  cards: WisdomCard[];
};

// Cumulative XP at the FLOOR of a level — mirrors xpToReachLevel in
// functions/_lib/gamification.js — used only to size the progress bar
// within the current level's span, not sent by the API.
function xpForLevelFloor(level: number) {
  if (level <= 1) return 0;
  const l = level - 1;
  return 50 * l * (l + 1);
}

function StatTile({ Icon, label, value, highlight }: { Icon: any; label: string; value: string | number; highlight?: boolean }) {
  return (
    <View style={styles.statTile}>
      <View style={styles.statHead}>
        <Icon size={14} color={highlight ? colors.action : colors.stone400} />
        <Text style={[styles.statLabel, highlight && { color: colors.action }]}>{label}</Text>
      </View>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function SkillCard({ card }: { card: WisdomCard }) {
  if (!card.unlocked) {
    return (
      <View style={styles.lockedCard}>
        <View style={styles.lockedHead}>
          <Lock size={14} color={colors.stone400} />
          <Text style={styles.lockedLabel}>nível {card.levelReq}</Text>
        </View>
        <Text style={styles.lockedName}>{card.skillName}</Text>
      </View>
    );
  }
  return (
    <View style={styles.skillCard}>
      <View style={styles.skillHead}>
        <BookOpen size={14} color={colors.action} />
        <Text style={styles.skillLevel}>nível {card.levelReq}</Text>
      </View>
      <Text style={styles.skillName}>{card.skillName}</Text>
      <Text style={styles.quote}>“{card.stoicQuote}”</Text>
      <Text style={styles.source}>— {card.stoicSource}</Text>
      <Text style={styles.quote}>“{card.bibleVerse}”</Text>
      <Text style={styles.source}>— {card.bibleRef}</Text>
    </View>
  );
}

export default function JourneyScreen() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState("");

  useFocusEffect(
    useCallback(() => {
      api
        .getBuilderProfile()
        .then(({ profile }: any) => setProfile(profile))
        .catch(() => setError("Não foi possível carregar sua jornada."));
    }, [])
  );

  const levelFloor = profile ? xpForLevelFloor(profile.level) : 0;
  const span = profile ? Math.max(1, profile.nextLevelXp - levelFloor) : 1;
  const progressPct = profile ? Math.min(100, Math.round(((profile.xp - levelFloor) / span) * 100)) : 0;

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <Text style={styles.title}>Jornada</Text>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {!profile ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.action} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
          <View style={styles.statsGrid}>
            <StatTile Icon={Award} label="nível" value={profile.level} />
            <StatTile Icon={BookOpen} label="xp total" value={profile.xp} />
            <StatTile
              Icon={Flame}
              label="sequência"
              value={`${profile.currentStreak} ${profile.currentStreak === 1 ? "dia" : "dias"}`}
              highlight={profile.currentStreak > 0}
            />
            <StatTile
              Icon={Award}
              label="melhor sequência"
              value={profile.longestStreak > 0 ? `${profile.longestStreak} ${profile.longestStreak === 1 ? "dia" : "dias"}` : "—"}
            />
          </View>

          <View style={styles.progressBox}>
            <View style={styles.progressHead}>
              <Text style={styles.progressLabel}>{profile.xp} XP</Text>
              <Text style={styles.progressLabel}>próximo nível: {profile.nextLevelXp} XP</Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
            </View>
          </View>

          <Text style={styles.sectionLabel}>cartas de sabedoria</Text>
          <View style={styles.cardsGrid}>
            {profile.cards.map((card) => (
              <SkillCard key={card.id} card={card} />
            ))}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.clay },
  title: { fontFamily: fonts.sansSemiBold, fontSize: 20, color: colors.ink, paddingHorizontal: 16, paddingTop: 8 },
  errorText: { fontFamily: fonts.sans, fontSize: 13, color: colors.danger, textAlign: "center", marginTop: 16 },

  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  statTile: { ...surfaces[3], borderRadius: radii.lg, padding: 12, width: "47%" },
  statHead: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  statLabel: { fontFamily: fonts.mono, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.6, color: colors.stone400 },
  statValue: { fontFamily: fonts.sansBold, fontSize: 22, color: colors.ink },

  progressBox: { ...surfaces[3], borderRadius: radii.lg, padding: 16, marginTop: 14 },
  progressHead: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  progressLabel: { fontFamily: fonts.mono, fontSize: 10, color: colors.stone500 },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: "rgba(20,22,24,0.1)", overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 4, backgroundColor: colors.action },

  sectionLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: colors.action,
    marginTop: 22,
    marginBottom: 10,
  },
  cardsGrid: { gap: 10 },
  lockedCard: { borderWidth: 1, borderStyle: "dashed", borderColor: "rgba(20,22,24,0.15)", borderRadius: radii.lg, padding: 14, opacity: 0.6 },
  lockedHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  lockedLabel: { fontFamily: fonts.mono, fontSize: 10, textTransform: "uppercase", color: colors.stone400 },
  lockedName: { fontFamily: fonts.sansSemiBold, fontSize: 13, color: colors.stone400 },
  skillCard: { ...surfaces[3], borderRadius: radii.lg, padding: 14 },
  skillHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  skillLevel: { fontFamily: fonts.mono, fontSize: 10, textTransform: "uppercase", color: colors.action },
  skillName: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.ink, marginBottom: 10 },
  quote: { fontFamily: fonts.serifItalic, fontSize: 13, color: "rgba(20,22,24,0.8)", lineHeight: 19, marginBottom: 3 },
  source: { fontFamily: fonts.mono, fontSize: 10, color: colors.stone500, marginBottom: 10 },
});
