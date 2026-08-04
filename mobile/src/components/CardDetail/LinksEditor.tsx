import { useState } from "react";
import { View, Text, TextInput, Pressable, Linking, StyleSheet } from "react-native";
import { Plus, X, Link2, ExternalLink, Pencil } from "lucide-react-native";
import { colors, fonts, radii } from "@/lib/theme";

export type LinkItem = { id: string; label: string; url: string };

const genId = () => Math.random().toString(36).slice(2, 10);
const normalizeUrl = (u: string) => {
  const t = u.trim();
  if (!t) return "";
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
};

function LinkRow({ item, onSave, onRemove }: { item: LinkItem; onSave: (l: LinkItem) => void; onRemove: (id: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(item.label);
  const [url, setUrl] = useState(item.url);

  const save = () => {
    const u = normalizeUrl(url);
    if (!u) return;
    onSave({ ...item, label: label.trim() || u, url: u });
    setEditing(false);
  };

  if (editing) {
    return (
      <View style={styles.editRow}>
        <TextInput value={label} onChangeText={setLabel} placeholder="Rótulo (opcional)" placeholderTextColor={colors.stone400} style={styles.input} />
        <TextInput value={url} onChangeText={setUrl} placeholder="https://…" placeholderTextColor={colors.stone400} autoCapitalize="none" style={styles.input} />
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable onPress={save} style={styles.saveBtn}>
            <Text style={styles.saveBtnText}>Salvar</Text>
          </Pressable>
          <Pressable onPress={() => setEditing(false)} style={styles.cancelBtn}>
            <Text style={styles.cancelBtnText}>Cancelar</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.row}>
      <Link2 size={13} color={colors.stone500} />
      <Pressable style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 4 }} onPress={() => Linking.openURL(item.url)}>
        <Text style={styles.linkText} numberOfLines={1}>{item.label}</Text>
        <ExternalLink size={11} color={colors.action} />
      </Pressable>
      <Pressable onPress={() => setEditing(true)}>
        <Pencil size={12} color={colors.stone400} />
      </Pressable>
      <Pressable onPress={() => onRemove(item.id)}>
        <X size={13} color={colors.stone400} />
      </Pressable>
    </View>
  );
}

export default function LinksEditor({ items, onChange }: { items: LinkItem[]; onChange: (v: LinkItem[]) => void }) {
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");

  const add = () => {
    const u = normalizeUrl(url);
    if (!u) return;
    onChange([...items, { id: genId(), label: label.trim() || u, url: u }]);
    setLabel("");
    setUrl("");
  };
  const save = (next: LinkItem) => onChange(items.map((i) => (i.id === next.id ? next : i)));
  const remove = (id: string) => onChange(items.filter((i) => i.id !== id));

  return (
    <View>
      <Text style={styles.label}>Links & referências</Text>
      {items.map((i) => (
        <LinkRow key={i.id} item={i} onSave={save} onRemove={remove} />
      ))}
      <View style={styles.addRow}>
        <TextInput value={label} onChangeText={setLabel} placeholder="Rótulo (opcional)" placeholderTextColor={colors.stone400} style={styles.input} />
        <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
          <TextInput value={url} onChangeText={setUrl} placeholder="https://…" placeholderTextColor={colors.stone400} autoCapitalize="none" style={[styles.input, { flex: 1 }]} onSubmitEditing={add} />
          <Pressable onPress={add}>
            <Plus size={16} color={colors.stone500} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontFamily: fonts.mono, fontSize: 11, textTransform: "uppercase", letterSpacing: 1.5, color: colors.stone500, marginBottom: 6 },
  row: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.paper, borderRadius: radii.md, borderWidth: 1, borderColor: "rgba(20,22,24,0.1)", paddingHorizontal: 10, paddingVertical: 8, marginBottom: 6 },
  linkText: { fontFamily: fonts.sans, fontSize: 13, color: colors.action },
  editRow: { gap: 6, marginBottom: 8, borderWidth: 1, borderColor: `${colors.action}66`, borderRadius: radii.md, padding: 8 },
  input: { fontFamily: fonts.sans, fontSize: 13, color: colors.ink, borderWidth: 1, borderColor: "rgba(20,22,24,0.15)", borderRadius: radii.md, paddingHorizontal: 10, paddingVertical: 8, marginBottom: 6 },
  saveBtn: { backgroundColor: colors.action, borderRadius: radii.md, paddingHorizontal: 12, paddingVertical: 8 },
  saveBtnText: { fontFamily: fonts.sansBold, fontSize: 11, color: colors.clay },
  cancelBtn: { borderWidth: 1, borderColor: "rgba(20,22,24,0.15)", borderRadius: radii.md, paddingHorizontal: 12, paddingVertical: 8 },
  cancelBtnText: { fontFamily: fonts.sansSemiBold, fontSize: 11, color: colors.stone500 },
  addRow: { marginTop: 4 },
});
