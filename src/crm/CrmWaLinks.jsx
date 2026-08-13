import { useEffect, useState } from "react";
import {
  Link2,
  Copy,
  Check,
  Pencil,
  Trash2,
  Plus,
  X,
  MousePointerClick,
  Tag,
  MessageCircle,
  ExternalLink,
  ArrowUpRight,
} from "lucide-react";
import { crmApi } from "@/crm/crmApi";
import { Spinner } from "@/components/ui";
import { timeAgo } from "@/crm/crmStatus";

const LINK_BASE = "https://go.tektone.com.br";

// Selectable chip for the quick-pick number row — every entry comes from the
// saved-numbers catalog, so every chip is deletable.
function NumberChip({ label, active, onClick, onDelete }) {
  return (
    <span className={`inline-flex items-center overflow-hidden rounded-md border ${active ? "border-action" : "border-ink/15"}`}>
      <button
        type="button"
        onClick={onClick}
        className={`px-2.5 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-wide ${
          active ? "bg-action text-clay" : "text-ink"
        }`}
      >
        {label}
      </button>
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          title="Remover número salvo"
          className={`px-2 py-1.5 ${active ? "bg-action text-clay" : "text-danger"}`}
        >
          <X size={11} />
        </button>
      )}
    </span>
  );
}

// WhatsApp / URL segmented toggle, reused by both the create form and the
// inline editor.
function TypeToggle({ value, onChange }) {
  const opt = (v, label, Icon) => (
    <button
      type="button"
      onClick={() => onChange(v)}
      className={`flex flex-1 items-center justify-center gap-1.5 px-2.5 py-2 font-mono text-[11px] font-semibold uppercase tracking-wide ${
        value === v ? "bg-action text-clay" : "text-stone-500"
      }`}
    >
      <Icon size={12} /> {label}
    </button>
  );
  return (
    <div className="flex overflow-hidden rounded-md border border-ink/15">
      {opt("whatsapp", "WhatsApp", MessageCircle)}
      {opt("url", "URL", ExternalLink)}
    </div>
  );
}

export default function CrmWaLinks() {
  const [links, setLinks] = useState(null);
  const [waNumbers, setWaNumbers] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  function load() {
    setLoading(true);
    Promise.all([crmApi.listWaLinks(), crmApi.listWaNumbers()])
      .then(([l, n]) => {
        setLinks(l.links);
        setWaNumbers(n.numbers);
      })
      .catch((e) => setError(e.body?.error || "Falha ao carregar."))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  const savedNumbers = (waNumbers || []).map((n) => ({ phone: n.phone, label: n.label, id: n.id }));

  const [form, setForm] = useState({ title: "", type: "whatsapp", phone: "", message: "", url: "", slug: "" });
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [copied, setCopied] = useState(null);
  const [justCreated, setJustCreated] = useState(null);
  const [savingLabel, setSavingLabel] = useState(false);
  const [numberLabel, setNumberLabel] = useState("");

  function copyUrl(slug) {
    navigator.clipboard?.writeText(`${LINK_BASE}/${slug}`);
    setCopied(slug);
    setTimeout(() => setCopied(null), 1500);
  }

  async function create(e) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const body =
        form.type === "url"
          ? { title: form.title, type: "url", slug: form.slug, url: form.url }
          : { title: form.title, type: "whatsapp", slug: form.slug, phone: form.phone, message: form.message };
      const { link } = await crmApi.createWaLink(body);
      setForm({ title: "", type: "whatsapp", phone: "", message: "", url: "", slug: "" });
      setJustCreated(link.slug);
      load();
    } catch (e2) {
      setErr(e2.body?.error || e2.message);
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    setBusy(true);
    setErr(null);
    try {
      const body =
        editing.type === "url"
          ? { title: editing.title, type: "url", url: editing.url }
          : { title: editing.title, type: "whatsapp", phone: editing.phone, message: editing.message };
      if (editing.newSlug !== editing.slug) body.newSlug = editing.newSlug;
      await crmApi.updateWaLink(editing.slug, body);
      setEditing(null);
      load();
    } catch (e2) {
      setErr(e2.body?.error || e2.message);
    } finally {
      setBusy(false);
    }
  }
  async function remove(l) {
    if (!window.confirm(`Excluir o link "${LINK_BASE}/${l.slug}"? O rastreamento de cliques será perdido.`)) return;
    setBusy(true);
    setErr(null);
    try {
      await crmApi.deleteWaLink(l.slug);
      load();
    } catch (e2) {
      setErr(e2.body?.error || e2.message);
    } finally {
      setBusy(false);
    }
  }
  async function saveNumber() {
    if (!form.phone.trim() || !numberLabel.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      await crmApi.createWaNumber({ label: numberLabel.trim(), phone: form.phone.trim() });
      setNumberLabel("");
      setSavingLabel(false);
      load();
    } catch (e2) {
      setErr(e2.body?.error || e2.message);
    } finally {
      setBusy(false);
    }
  }
  async function removeNumber(n) {
    if (!window.confirm(`Remover o número salvo "${n.label}"?`)) return;
    setBusy(true);
    setErr(null);
    try {
      await crmApi.deleteWaNumber(n.id);
      load();
    } catch (e2) {
      setErr(e2.body?.error || e2.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-ink">Links</h1>
      <p className="mt-1 text-sm text-stone-500">
        Crie um link curto para um chat de WhatsApp ou para qualquer outra URL, e acompanhe os cliques de cada um.
      </p>
      {error && <p className="mt-3 font-mono text-[11px] text-danger">{error}</p>}
      {err && <p className="mt-3 font-mono text-[11px] text-danger">{err}</p>}

      <div className="mt-6 grid grid-cols-1 items-start gap-5 lg:grid-cols-[1fr_1.6fr]">
        <div className="flex flex-col gap-5">
          <div className="surface-2 overflow-hidden rounded-xl">
            <div className="flex items-center gap-2 border-b border-ink/10 px-4 py-3">
              <Link2 size={13} className="text-action" />
              <h3 className="text-[12.5px] font-bold text-ink">Novo link</h3>
            </div>
            <form onSubmit={create} className="flex flex-col gap-3 p-4">
              <div>
                <label className="mb-1 block font-mono text-[10px] uppercase tracking-wide text-stone-500">Título</label>
                <input
                  placeholder="Ex: Instagram — Bio"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  className="w-full rounded-lg border border-ink/15 bg-transparent px-3 py-2 text-sm text-ink"
                />
              </div>
              <TypeToggle value={form.type} onChange={(type) => setForm((f) => ({ ...f, type }))} />

              {form.type === "whatsapp" ? (
                <div>
                  <label className="mb-1 block font-mono text-[10px] uppercase tracking-wide text-stone-500">WhatsApp</label>
                  <input
                    placeholder="55479..."
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    required
                    className="w-full rounded-lg border border-ink/15 bg-transparent px-3 py-2 text-sm text-ink"
                  />
                  {savedNumbers.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {savedNumbers.map((n) => (
                        <NumberChip
                          key={n.id}
                          label={n.label}
                          active={form.phone === n.phone}
                          onClick={() => setForm((f) => ({ ...f, phone: n.phone }))}
                          onDelete={() => removeNumber(n)}
                        />
                      ))}
                    </div>
                  )}
                  {form.phone.trim() && !savedNumbers.some((n) => n.phone === form.phone.trim()) && (
                    savingLabel ? (
                      <div className="mt-2 flex gap-2">
                        <input
                          autoFocus
                          placeholder="Nome (ex: Hudson, Pedro)"
                          value={numberLabel}
                          onChange={(e) => setNumberLabel(e.target.value)}
                          className="flex-1 rounded-lg border border-ink/15 bg-transparent px-2.5 py-1.5 text-xs text-ink"
                        />
                        <button
                          type="button"
                          onClick={saveNumber}
                          disabled={busy || !numberLabel.trim()}
                          className="shrink-0 rounded-lg border border-ink/15 px-3 text-action disabled:opacity-40"
                        >
                          <Check size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSavingLabel(false);
                            setNumberLabel("");
                          }}
                          className="shrink-0 text-stone-500"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setSavingLabel(true)}
                        className="mt-2 flex items-center gap-1.5 font-mono text-[11px] text-stone-500 hover:text-ink"
                      >
                        <Tag size={11} /> Salvar este número com um nome
                      </button>
                    )
                  )}
                </div>
              ) : (
                <div>
                  <label className="mb-1 block font-mono text-[10px] uppercase tracking-wide text-stone-500">URL de destino</label>
                  <input
                    placeholder="https://..."
                    value={form.url}
                    onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                    required
                    className="w-full rounded-lg border border-ink/15 bg-transparent px-3 py-2 text-sm text-ink"
                  />
                </div>
              )}

              {form.type === "whatsapp" && (
                <div>
                  <label className="mb-1 block font-mono text-[10px] uppercase tracking-wide text-stone-500">Mensagem (opcional)</label>
                  <textarea
                    rows={3}
                    placeholder="Olá! Vim pelo link..."
                    value={form.message}
                    onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                    className="w-full rounded-lg border border-ink/15 bg-transparent px-3 py-2 text-sm text-ink"
                  />
                </div>
              )}
              <div>
                <label className="mb-1 block font-mono text-[10px] uppercase tracking-wide text-stone-500">Identificador (opcional)</label>
                <input
                  placeholder="gerado automaticamente se vazio"
                  value={form.slug}
                  onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                  className="w-full rounded-lg border border-ink/15 bg-transparent px-3 py-2 text-sm text-ink"
                />
                <p className="mt-1 font-mono text-[10.5px] text-stone-500">
                  {LINK_BASE}/{form.slug.trim() || "••••••"}
                </p>
              </div>
              <button
                disabled={busy}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-action px-3 py-2.5 font-mono text-[11px] font-semibold text-clay disabled:opacity-50"
              >
                {busy ? <Spinner /> : <Plus size={13} />} Criar link
              </button>
              {justCreated && (
                <div className="flex items-center justify-between gap-2 rounded-lg border border-success/30 bg-success/10 px-2.5 py-2 text-success">
                  <span className="truncate font-mono text-[11px]">{LINK_BASE}/{justCreated}</span>
                  <button type="button" onClick={() => copyUrl(justCreated)} className="shrink-0">
                    {copied === justCreated ? <Check size={13} /> : <Copy size={13} />}
                  </button>
                </div>
              )}
            </form>
          </div>

          <div className="surface-2 overflow-hidden rounded-xl">
            <div className="flex items-center gap-2 border-b border-ink/10 px-4 py-3">
              <Tag size={13} className="text-action" />
              <h3 className="text-[12.5px] font-bold text-ink">Números salvos</h3>
            </div>
            {(waNumbers || []).length === 0 && (
              <p className="p-4 font-mono text-[11px] text-stone-500">
                Nenhum número salvo ainda — use "Salvar este número com um nome" ao criar um link.
              </p>
            )}
            {(waNumbers || []).map((n) => (
              <div key={n.id} className="flex items-center justify-between gap-3 border-t border-ink/10 px-4 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{n.label}</p>
                  <p className="truncate font-mono text-[11px] text-stone-500">{n.phone}</p>
                </div>
                <button onClick={() => removeNumber(n)} disabled={busy} title="Excluir número salvo" className="shrink-0 text-danger">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="surface-2 overflow-hidden rounded-xl">
          <div className="flex items-center gap-2 border-b border-ink/10 px-4 py-3">
            <MousePointerClick size={13} className="text-action" />
            <h3 className="text-[12.5px] font-bold text-ink">Todos os links</h3>
          </div>
          {loading && (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          )}
          {!loading && (links || []).length === 0 && <p className="p-8 text-center text-sm text-stone-500">Nenhum link ainda.</p>}
          {(links || []).map((l) => (
            <div key={l.slug} className="flex items-center gap-3 border-t border-ink/10 px-4 py-3">
              {editing?.slug === l.slug ? (
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <input
                    value={editing.title || ""}
                    onChange={(e) => setEditing((s) => ({ ...s, title: e.target.value }))}
                    placeholder="Título"
                    className="rounded-lg border border-ink/15 bg-transparent px-3 py-2 text-sm text-ink"
                  />
                  <div>
                    <label className="mb-1 block font-mono text-[10px] uppercase tracking-wide text-stone-500">Identificador</label>
                    <div className="flex items-center gap-1.5">
                      <span className="truncate font-mono text-[11px] text-stone-500">{LINK_BASE}/</span>
                      <input
                        value={editing.newSlug}
                        onChange={(e) => setEditing((s) => ({ ...s, newSlug: e.target.value }))}
                        className="flex-1 rounded-lg border border-ink/15 bg-transparent px-3 py-1.5 text-sm text-ink"
                      />
                    </div>
                  </div>
                  <TypeToggle value={editing.type} onChange={(type) => setEditing((s) => ({ ...s, type }))} />
                  {editing.type === "whatsapp" ? (
                    <>
                      <input
                        value={editing.phone}
                        onChange={(e) => setEditing((s) => ({ ...s, phone: e.target.value }))}
                        placeholder="WhatsApp"
                        className="rounded-lg border border-ink/15 bg-transparent px-3 py-2 text-sm text-ink"
                      />
                      {savedNumbers.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {savedNumbers.map((n) => (
                            <NumberChip
                              key={n.id}
                              label={n.label}
                              active={editing.phone === n.phone}
                              onClick={() => setEditing((s) => ({ ...s, phone: n.phone }))}
                              onDelete={() => removeNumber(n)}
                            />
                          ))}
                        </div>
                      )}
                      <textarea
                        rows={2}
                        value={editing.message || ""}
                        onChange={(e) => setEditing((s) => ({ ...s, message: e.target.value }))}
                        placeholder="Mensagem"
                        className="rounded-lg border border-ink/15 bg-transparent px-3 py-2 text-sm text-ink"
                      />
                    </>
                  ) : (
                    <input
                      value={editing.url || ""}
                      onChange={(e) => setEditing((s) => ({ ...s, url: e.target.value }))}
                      placeholder="https://..."
                      className="rounded-lg border border-ink/15 bg-transparent px-3 py-2 text-sm text-ink"
                    />
                  )}
                </div>
              ) : (
                <div className="min-w-0 flex-1">
                  {l.title && <p className="truncate text-[13.5px] font-bold text-ink">{l.title}</p>}
                  <p className={`truncate font-mono font-semibold text-action ${l.title ? "text-[11px]" : "text-[12.5px]"}`}>
                    {LINK_BASE}/{l.slug}
                  </p>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    {l.type === "url" ? (
                      <ExternalLink size={11} className="shrink-0 text-stone-500" />
                    ) : (
                      <MessageCircle size={11} className="shrink-0 text-stone-500" />
                    )}
                    <p className="truncate text-[11.5px] text-ink">{l.type === "url" ? l.url : l.phone}</p>
                  </div>
                  {l.type === "whatsapp" && l.message && (
                    <p className="mt-0.5 truncate font-mono text-[11px] text-stone-500">{l.message}</p>
                  )}
                  <p className="mt-1 font-mono text-[10px] text-stone-500">
                    {l.clicks} {l.clicks === 1 ? "clique" : "cliques"} · criado {timeAgo(l.created_at)}
                    {l.created_by ? ` por ${l.created_by}` : ""}
                  </p>
                </div>
              )}
              <div className="flex shrink-0 items-start gap-2.5 self-start">
                {editing?.slug === l.slug ? (
                  <>
                    <button onClick={save} disabled={busy || !editing.newSlug.trim()} title="Salvar" className="text-success">
                      <Check size={15} />
                    </button>
                    <button onClick={() => setEditing(null)} disabled={busy} title="Cancelar" className="text-stone-500">
                      <X size={15} />
                    </button>
                  </>
                ) : (
                  <>
                    <a href={`${LINK_BASE}/${l.slug}`} target="_blank" rel="noopener noreferrer" title="Abrir link" className="text-stone-500 hover:text-ink">
                      <ArrowUpRight size={14} />
                    </a>
                    <button onClick={() => copyUrl(l.slug)} title="Copiar link" className={copied === l.slug ? "text-success" : "text-stone-500 hover:text-ink"}>
                      {copied === l.slug ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                    <button
                      onClick={() =>
                        setEditing({
                          slug: l.slug,
                          newSlug: l.slug,
                          title: l.title || "",
                          type: l.type,
                          phone: l.phone || "",
                          message: l.message || "",
                          url: l.url || "",
                        })
                      }
                      title="Editar"
                      className="text-stone-500 hover:text-ink"
                    >
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => remove(l)} title="Excluir" className="text-danger">
                      <Trash2 size={13} />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
