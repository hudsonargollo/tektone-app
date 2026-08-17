// Port of src/builder/aiJson.js — the "paste AI JSON" trick: no server-side
// AI call, no API key. The user copies a prompt describing the block's
// exact prop shape, pastes it into their own Claude/ChatGPT session, then
// pastes the JSON reply back in.
import type { BlockModule } from "./blockRegistry";
import type { SchemaField } from "@/components/BlockPropertyPanel";

function shapeForField(field: SchemaField): any {
  if (field.type === "array") {
    return [Object.fromEntries((field.fields || []).map((f) => [f.key, shapeForField(f)]))];
  }
  if (field.type === "list") return ["string"];
  if (field.type === "number") return 0;
  if (field.type === "boolean") return true;
  if (field.type === "select") return (field.options || [])[0]?.value ?? "string";
  return "string";
}

export function buildAiPrompt(mod: BlockModule): string {
  const shape = Object.fromEntries(mod.schema.map((f) => [f.key, shapeForField(f)]));
  return [
    `Preencha o conteúdo do bloco "${mod.label}" de uma página seguindo EXATAMENTE este formato JSON`,
    `(responda só com o JSON, sem markdown ao redor, sem comentários):`,
    "",
    JSON.stringify(shape, null, 2),
    "",
    "Contexto sobre a página/empresa: [descreva aqui o que a página deve comunicar]",
  ].join("\n");
}

// Applies a pasted JSON object to a block's props, keeping only keys the
// block's schema actually declares — a malformed/partial AI reply can't
// inject unrelated fields.
export function applyAiJson(mod: BlockModule, jsonText: string): Record<string, any> {
  const parsed = JSON.parse(jsonText);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Esperado um objeto JSON.");
  }
  const next: Record<string, any> = {};
  for (const field of mod.schema) {
    if (field.key in parsed) next[field.key] = parsed[field.key];
  }
  return next;
}
