// The BoltStack-style "paste AI JSON" trick: no server-side AI call, no API
// key — the user copies a prompt describing the block's exact prop shape,
// pastes it into their own Claude/ChatGPT session, then pastes the JSON
// reply back in. See ~/.claude/plans/tektone-block-builder.md section 4.

function shapeForField(field) {
  if (field.type === "array") {
    return [Object.fromEntries(field.fields.map((f) => [f.key, shapeForField(f)]))];
  }
  if (field.type === "list") return ["string"];
  if (field.type === "number") return 0;
  if (field.type === "boolean") return true;
  if (field.type === "select") return (field.options || [])[0]?.value ?? "string";
  return "string";
}

export function buildAiPrompt(mod) {
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
// block's schema actually declares — same validation the schema already
// enforces for the generic panel, so a malformed/partial AI reply can't
// inject unrelated fields.
export function applyAiJson(mod, jsonText) {
  const parsed = JSON.parse(jsonText);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Esperado um objeto JSON.");
  }
  const next = {};
  for (const field of mod.schema) {
    if (field.key in parsed) next[field.key] = parsed[field.key];
  }
  return next;
}
