import { useCallback, useState } from "react";
import { View, Text, Pressable, Image, ScrollView, ActivityIndicator, StyleSheet } from "react-native";
import { useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Sparkles, Check } from "lucide-react-native";
import { api, ApiError } from "@/lib/api";
import { useCustomerProject } from "@/lib/customerProject";
import { colors, fonts, radii, surfaces } from "@/lib/theme";
import CustomerProjectHeader from "@/components/CustomerProjectHeader";
import CustomerTopBar from "@/components/CustomerTopBar";

// Port of CustomerShell.jsx's "marketplace" tab — browse the global
// addons_catalog, purchase auto-generates an UNPAID invoice server-side
// (functions/api/projects/[[path]].js's addons POST route), same as web.
// Phase 7 of ~/.claude/plans/tektone-mobile-parity.md.

type Addon = { id: string; title: string; description?: string; price: number; special_price?: number | null; ai_banner_url?: string | null };
type Purchased = { addon_id: string };

const brl = (n?: number | null, currency = "BRL") => Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency });

export default function CustomerMarketplaceScreen() {
  const { activeProjectId } = useCustomerProject();
  const [catalog, setCatalog] = useState<Addon[] | null>(null);
  const [purchased, setPurchased] = useState<Purchased[] | null>(null);
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useFocusEffect(
    useCallback(() => {
      api.listAddonsCatalog().then(({ addons }: any) => setCatalog(addons)).catch(() => {});
    }, [])
  );

  useFocusEffect(
    useCallback(() => {
      if (!activeProjectId) return;
      api.listProjectAddons(activeProjectId).then(({ addons }: any) => setPurchased(addons)).catch(() => {});
    }, [activeProjectId])
  );

  async function buy(addonId: string) {
    if (!activeProjectId) return;
    setBuyingId(addonId);
    setError("");
    try {
      const { addon } = await api.addProjectAddon(activeProjectId, addonId);
      setPurchased((prev) => [addon, ...(prev || [])]);
    } catch (e) {
      setError(e instanceof ApiError ? e.body?.error || "Falha ao adicionar." : "Falha ao adicionar.");
    } finally {
      setBuyingId(null);
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <CustomerTopBar />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <CustomerProjectHeader />
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {catalog === null ? (
          <ActivityIndicator style={{ marginTop: 24 }} color={colors.action} />
        ) : catalog.length === 0 ? (
          <Text style={styles.emptyText}>Nenhum add-on disponível no momento.</Text>
        ) : (
          <View style={{ gap: 14 }}>
            {catalog.map((a) => {
              const owned = (purchased || []).some((p) => p.addon_id === a.id);
              const hasDiscount = Boolean(a.special_price && a.special_price < a.price);
              return (
                <View key={a.id} style={styles.card}>
                  <View style={styles.banner}>
                    {a.ai_banner_url ? (
                      <Image source={{ uri: a.ai_banner_url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                    ) : (
                      <View style={[StyleSheet.absoluteFill, styles.bannerFallback]} />
                    )}
                    <View style={[StyleSheet.absoluteFill, styles.bannerOverlay]} />
                    {hasDiscount ? (
                      <View style={styles.discountBadge}>
                        <Sparkles size={11} color={colors.ink} />
                        <Text style={styles.discountBadgeText}>oferta especial</Text>
                      </View>
                    ) : null}
                    <Text style={styles.bannerTitle}>{a.title}</Text>
                  </View>
                  <View style={{ padding: 14 }}>
                    {a.description ? <Text style={styles.desc}>{a.description}</Text> : null}
                    <View style={styles.priceRow}>
                      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
                        {hasDiscount ? <Text style={styles.strike}>{brl(a.price)}</Text> : null}
                        <Text style={styles.price}>{brl(hasDiscount ? a.special_price : a.price)}</Text>
                      </View>
                      {owned ? (
                        <View style={styles.ownedBadge}>
                          <Check size={13} color={colors.success} />
                          <Text style={styles.ownedText}>adicionado</Text>
                        </View>
                      ) : (
                        <Pressable onPress={() => buy(a.id)} disabled={buyingId === a.id} style={[styles.buyBtn, buyingId === a.id && { opacity: 0.6 }]}>
                          {buyingId === a.id ? <ActivityIndicator size="small" color={colors.clay} /> : null}
                          <Text style={styles.buyBtnText}>adicionar</Text>
                        </Pressable>
                      )}
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.clay },
  error: { fontFamily: fonts.mono, fontSize: 11, color: colors.danger, marginBottom: 10 },
  emptyText: { fontFamily: fonts.sans, fontSize: 13, color: colors.stone500 },
  card: { ...surfaces[2], borderRadius: radii.xl, overflow: "hidden" },
  banner: { height: 112, justifyContent: "flex-end", padding: 14, overflow: "hidden" },
  bannerFallback: { backgroundColor: colors.sand },
  bannerOverlay: { backgroundColor: "rgba(20,22,24,0.4)" },
  bannerTitle: { fontFamily: fonts.serifItalic, fontSize: 18, color: "#fff" },
  discountBadge: { position: "absolute", top: 12, right: 12, flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.warning, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  discountBadgeText: { fontFamily: fonts.monoMedium, fontSize: 9, textTransform: "uppercase", letterSpacing: 0.6, color: colors.ink },
  desc: { fontFamily: fonts.sans, fontSize: 12.5, lineHeight: 18, color: colors.stone500, marginBottom: 10 },
  priceRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  strike: { fontFamily: fonts.mono, fontSize: 11, color: colors.stone400, textDecorationLine: "line-through" },
  price: { fontFamily: fonts.sansBold, fontSize: 17, color: colors.ink },
  ownedBadge: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(62,107,78,0.15)", borderRadius: radii.md, paddingHorizontal: 10, paddingVertical: 8 },
  ownedText: { fontFamily: fonts.sansBold, fontSize: 11, color: colors.success },
  buyBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.action, borderRadius: radii.md, paddingHorizontal: 12, paddingVertical: 9 },
  buyBtnText: { fontFamily: fonts.sansBold, fontSize: 11.5, color: colors.clay },
});
