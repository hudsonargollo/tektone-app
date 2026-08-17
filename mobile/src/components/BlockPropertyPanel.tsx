import { useState } from "react";
import { View, Text, TextInput, Pressable, Switch, StyleSheet } from "react-native";
import { Plus, Trash2, ChevronDown } from "lucide-react-native";
import { colors, fonts, radii } from "@/lib/theme";
import PickerModal from "@/components/CardDetail/PickerModal";
import DraggableList from "@/components/DraggableList";

// Generic schema-driven property panel — port of src/builder/PropertyPanel.jsx.
// Every block type except `richtext` (its own bespoke editor, see
// RichtextEditor.tsx) is edited entirely through this component, no
// per-block-type mobile code needed — same principle as web.
export type SchemaField = {
  key: string;
  label: string;
  type: "text" | "textarea" | "url" | "image" | "number" | "boolean" | "select" | "list" | "array" | "markdown";
  optional?: boolean;
  options?: { label: string; value: string }[];
  fields?: SchemaField[];
  itemLabel?: string;
};

function placeholderForType(type: SchemaField["type"]) {
  if (type === "number") return 0;
  if (type === "boolean") return false;
  return "";
}

function FieldLabel({ children }: { children: string }) {
  return <Text style={styles.fieldLabel}>{children}</Text>;
}

function SelectInput({ field, value, onChange }: { field: SchemaField; value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const selected = (field.options || []).find((o) => o.value === value);
  return (
    <>
      <Pressable onPress={() => setOpen(true)} style={styles.selectBtn}>
        <Text style={styles.selectBtnText}>{selected?.label || "Selecionar…"}</Text>
        <ChevronDown size={14} color={colors.stone500} />
      </Pressable>
      <PickerModal
        visible={open}
        title={field.label}
        options={(field.options || []).map((o) => ({ value: o.value, label: o.label }))}
        selected={value ? [value] : []}
        onToggle={(v) => { onChange(v); setOpen(false); }}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

function ScalarInput({ field, value, onChange }: { field: SchemaField; value: any; onChange: (v: any) => void }) {
  switch (field.type) {
    case "textarea":
      return (
        <TextInput
          value={value ?? ""}
          onChangeText={onChange}
          multiline
          numberOfLines={3}
          style={[styles.input, { minHeight: 70, textAlignVertical: "top" }]}
        />
      );
    case "url":
      return (
        <TextInput
          value={value ?? ""}
          onChangeText={onChange}
          placeholder="https://…"
          placeholderTextColor={colors.stone400}
          autoCapitalize="none"
          keyboardType="url"
          style={styles.input}
        />
      );
    case "image":
      return (
        <TextInput
          value={value ?? ""}
          onChangeText={onChange}
          placeholder="URL da imagem"
          placeholderTextColor={colors.stone400}
          autoCapitalize="none"
          style={styles.input}
        />
      );
    case "number":
      return (
        <TextInput
          value={value === "" || value == null ? "" : String(value)}
          onChangeText={(v) => onChange(v === "" ? "" : Number(v.replace(/[^0-9.-]/g, "")))}
          keyboardType="numeric"
          style={styles.input}
        />
      );
    case "boolean":
      return (
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Switch value={!!value} onValueChange={onChange} trackColor={{ true: colors.action }} />
        </View>
      );
    case "select":
      return <SelectInput field={field} value={value} onChange={onChange} />;
    default:
      return <TextInput value={value ?? ""} onChangeText={onChange} style={styles.input} />;
  }
}

function ListField({ value, onChange }: { value: string[] | undefined; onChange: (v: string[]) => void }) {
  const items = value || [];
  return (
    <View style={{ gap: 6 }}>
      <DraggableList
        data={items}
        keyExtractor={(_, i) => String(i)}
        rowHeight={44}
        onReorder={onChange}
        renderItem={(v, i) => (
          <View style={styles.listRow}>
            <TextInput
              value={v}
              onChangeText={(t) => onChange(items.map((it, j) => (j === i ? t : it)))}
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
            />
            <Pressable onPress={() => onChange(items.filter((_, j) => j !== i))} style={{ padding: 8 }}>
              <Trash2 size={13} color={colors.stone400} />
            </Pressable>
          </View>
        )}
      />
      <Pressable onPress={() => onChange([...items, ""])} style={styles.addLink}>
        <Plus size={12} color={colors.action} />
        <Text style={styles.addLinkText}>adicionar</Text>
      </Pressable>
    </View>
  );
}

function ArrayField({ field, value, onChange }: { field: SchemaField; value: any[] | undefined; onChange: (v: any[]) => void }) {
  const items = value?.length ? value : [];
  const subFields = field.fields || [];

  function updateItem(i: number, key: string, v: any) {
    onChange(items.map((it, j) => (j === i ? { ...it, [key]: v } : it)));
  }
  function add() {
    const blank = Object.fromEntries(subFields.map((f) => [f.key, placeholderForType(f.type)]));
    onChange([...items, blank]);
  }

  return (
    <View style={{ gap: 8 }}>
      <DraggableList
        data={items}
        keyExtractor={(_, i) => String(i)}
        rowHeight={subFields.length * 60 + 50}
        onReorder={onChange}
        renderItem={(it, i) => (
          <View style={styles.arrayCard}>
            <View style={styles.arrayCardHead}>
              <Text style={styles.arrayCardLabel}>{field.itemLabel || "item"} {i + 1}</Text>
              <Pressable onPress={() => onChange(items.filter((_, j) => j !== i))}>
                <Trash2 size={13} color={colors.stone400} />
              </Pressable>
            </View>
            <View style={{ gap: 8 }}>
              {subFields.map((sub) => (
                <View key={sub.key}>
                  <FieldLabel>{sub.label}</FieldLabel>
                  <ScalarInput field={sub} value={it[sub.key]} onChange={(v) => updateItem(i, sub.key, v)} />
                </View>
              ))}
            </View>
          </View>
        )}
      />
      <Pressable onPress={add} style={styles.addLink}>
        <Plus size={12} color={colors.action} />
        <Text style={styles.addLinkText}>adicionar {field.itemLabel || "item"}</Text>
      </Pressable>
    </View>
  );
}

export default function BlockPropertyPanel({
  schema,
  values,
  onChange,
}: {
  schema: SchemaField[];
  values: Record<string, any>;
  onChange: (values: Record<string, any>) => void;
}) {
  function set(key: string, v: any) {
    onChange({ ...values, [key]: v });
  }
  return (
    <View style={{ gap: 14 }}>
      {schema
        .filter((field) => field.type !== "markdown")
        .map((field) => (
          <View key={field.key}>
            <FieldLabel>{field.label}</FieldLabel>
            {field.type === "list" ? (
              <ListField value={values[field.key]} onChange={(v) => set(field.key, v)} />
            ) : field.type === "array" ? (
              <ArrayField field={field} value={values[field.key]} onChange={(v) => set(field.key, v)} />
            ) : (
              <ScalarInput field={field} value={values[field.key]} onChange={(v) => set(field.key, v)} />
            )}
          </View>
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  fieldLabel: { fontFamily: fonts.mono, fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: colors.stone500, marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: "rgba(20,22,24,0.15)", backgroundColor: colors.paper, borderRadius: radii.md,
    paddingHorizontal: 10, paddingVertical: 9, fontSize: 13, color: colors.ink, fontFamily: fonts.sans, marginBottom: 8,
  },
  selectBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1, borderColor: "rgba(20,22,24,0.15)",
    backgroundColor: colors.paper, borderRadius: radii.md, paddingHorizontal: 12, paddingVertical: 10,
  },
  selectBtnText: { fontFamily: fonts.sans, fontSize: 13, color: colors.ink },
  listRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  addLink: { flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start" },
  addLinkText: { fontFamily: fonts.monoMedium, fontSize: 11, color: colors.action },
  arrayCard: { borderWidth: 1, borderColor: "rgba(20,22,24,0.1)", borderRadius: radii.md, padding: 10, backgroundColor: colors.clay },
  arrayCardHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  arrayCardLabel: { fontFamily: fonts.mono, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.6, color: colors.stone400 },
});
