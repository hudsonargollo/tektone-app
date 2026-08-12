import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Briefcase,
  Plus,
  UserPlus,
  CheckCircle2,
  Clock,
  ShoppingBag,
  Trash2,
  EyeOff,
  Eye,
  ImagePlus,
  Award,
  Users,
  FileText,
  Receipt,
  FileUp,
} from "lucide-react";
import { api } from "@/lib/api";
import { Avatar, Spinner } from "@/components/ui";

const brl = (n, currency = "BRL") =>
  Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency });

// Resize a banner image to a wide data URL and store it directly in D1 —
// same fallback this app already uses for user avatars (see ProfilePage.jsx
// fileToAvatar / functions/api/auth's MAX_AVATAR_LEN), used here because R2
// isn't enabled on this Cloudflare account yet. Swap to a real upload once
// it is; the column is just a URL either way.
async function fileToBanner(file, w = 640, h = 240) {
  const dataUrl = await new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result);
    fr.onerror = rej;
    fr.readAsDataURL(file);
  });
  const img = await new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = rej;
    im.src = dataUrl;
  });
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  const scale = Math.max(w / img.width, h / img.height);
  const sw = img.width * scale;
  const sh = img.height * scale;
  ctx.drawImage(img, (w - sw) / 2, (h - sh) / 2, sw, sh);
  return canvas.toDataURL("image/jpeg", 0.82);
}

// Client-side PDF text extraction (pdfjs-dist) for the contract draft form —
// staff can drop in an existing signed/drafted PDF instead of retyping the
// contract body. Runs entirely in the browser, same "no backend round trip
// for file processing" pattern as fileToBanner above.
async function fileToPdfText(file) {
  const [{ getDocument, GlobalWorkerOptions }, workerUrl] = await Promise.all([
    import("pdfjs-dist"),
    import("pdfjs-dist/build/pdf.worker.min.mjs?url").then((m) => m.default),
  ]);
  GlobalWorkerOptions.workerSrc = workerUrl;
  const buf = await file.arrayBuffer();
  const pdf = await getDocument({ data: buf }).promise;
  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    pages.push(content.items.map((it) => it.str).join(" "));
  }
  return pages.join("\n\n").trim();
}

function SectionIntro({ icon: Icon, children }) {
  return (
    <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-action/20 bg-action/5 px-3.5 py-3">
      <Icon size={14} className="mt-0.5 shrink-0 text-action" />
      <p className="text-xs leading-relaxed text-ink/70">{children}</p>
    </div>
  );
}

function EmptyState({ icon: Icon, children }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-ink/10 py-10 text-center">
      <Icon size={18} className="text-stone-300" />
      <p className="text-xs text-stone-500">{children}</p>
    </div>
  );
}

// STAFF/ADMIN side of the Phase 4 commercial module: invite a customer to a
// project, draft a contract for them to sign, create a manual invoice. The
// customer's own view is CustomerShell.jsx — a completely separate
// component tree, never this one.
export default function CommercialPanel({ clients, isAdmin, onClose }) {
  const [projectId, setProjectId] = useState(clients[0]?.id ?? "");
  const [tab, setTab] = useState("members");
  const [members, setMembers] = useState(null);
  const [contracts, setContracts] = useState(null);
  const [invoices, setInvoices] = useState(null);
  const [catalog, setCatalog] = useState(null);
  const [builders, setBuilders] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [inviteEmail, setInviteEmail] = useState("");
  const [contractDraft, setContractDraft] = useState({ title: "", content: "" });
  const [invoiceDraft, setInvoiceDraft] = useState({ description: "", amount: "", dueDate: "" });
  const [addonDraft, setAddonDraft] = useState({ title: "", description: "", price: "", specialPrice: "", aiBannerUrl: "" });
  const [bannerBusy, setBannerBusy] = useState(null); // addon id (or "new") being uploaded
  const [pdfBusy, setPdfBusy] = useState(false);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function load() {
    if (!projectId) return;
    api.listProjectUsers(projectId).then(({ users }) => setMembers(users)).catch(() => {});
    api.listContracts(projectId).then(({ contracts }) => setContracts(contracts)).catch(() => {});
    api.listInvoices(projectId).then(({ invoices }) => setInvoices(invoices)).catch(() => {});
    api.getProjectBuilders(projectId).then(({ builders }) => setBuilders(builders)).catch(() => {});
  }
  useEffect(load, [projectId]);

  function loadCatalog() {
    api.listAddonsCatalog().then(({ addons }) => setCatalog(addons)).catch(() => {});
  }
  useEffect(() => {
    if (tab === "addons") loadCatalog();
  }, [tab]);

  async function createAddon() {
    if (!addonDraft.title.trim() || !(Number(addonDraft.price) > 0)) return;
    setBusy(true);
    setError("");
    try {
      await api.createAddon({
        title: addonDraft.title,
        description: addonDraft.description,
        price: Number(addonDraft.price),
        specialPrice: addonDraft.specialPrice ? Number(addonDraft.specialPrice) : null,
        aiBannerUrl: addonDraft.aiBannerUrl || null,
      });
      setAddonDraft({ title: "", description: "", price: "", specialPrice: "", aiBannerUrl: "" });
      loadCatalog();
    } catch (e) {
      setError(e.body?.error || "Falha ao criar add-on.");
    } finally {
      setBusy(false);
    }
  }

  async function pickBannerForDraft(file) {
    if (!file) return;
    setBannerBusy("new");
    try {
      const dataUrl = await fileToBanner(file);
      setAddonDraft((d) => ({ ...d, aiBannerUrl: dataUrl }));
    } catch {
      setError("Falha ao processar a imagem.");
    } finally {
      setBannerBusy(null);
    }
  }

  async function pickBannerForExisting(addonId, file) {
    if (!file) return;
    setBannerBusy(addonId);
    setError("");
    try {
      const dataUrl = await fileToBanner(file);
      await api.updateAddon(addonId, { aiBannerUrl: dataUrl });
      loadCatalog();
    } catch (e) {
      setError(e.body?.error || "Falha ao atualizar banner.");
    } finally {
      setBannerBusy(null);
    }
  }

  async function toggleAddonActive(a) {
    setBusy(true);
    try {
      await api.updateAddon(a.id, { isActive: !a.is_active });
      loadCatalog();
    } catch (e) {
      setError(e.body?.error || "Falha ao atualizar.");
    } finally {
      setBusy(false);
    }
  }

  async function removeAddon(a) {
    if (!window.confirm(`Remover "${a.title}" do catálogo?`)) return;
    setBusy(true);
    try {
      await api.deleteAddon(a.id);
      loadCatalog();
    } catch (e) {
      setError(e.body?.error || "Falha ao remover.");
    } finally {
      setBusy(false);
    }
  }

  async function invite() {
    const target = inviteEmail.trim().toLowerCase();
    if (!target) return;
    setBusy(true);
    setError("");
    try {
      await api.inviteProjectUser(projectId, target, "CUSTOMER");
      setInviteEmail("");
      load();
    } catch (e) {
      setError(e.body?.error || "Falha ao convidar.");
    } finally {
      setBusy(false);
    }
  }

  async function createContract() {
    if (!contractDraft.title.trim() || !contractDraft.content.trim()) return;
    setBusy(true);
    setError("");
    try {
      await api.createContract(projectId, contractDraft);
      setContractDraft({ title: "", content: "" });
      load();
    } catch (e) {
      setError(e.body?.error || "Falha ao criar contrato.");
    } finally {
      setBusy(false);
    }
  }

  async function pickPdfForContract(file) {
    if (!file) return;
    setPdfBusy(true);
    setError("");
    try {
      const text = await fileToPdfText(file);
      if (!text) {
        setError("Não foi possível extrair texto deste PDF (pode ser um PDF escaneado/imagem).");
        return;
      }
      setContractDraft((d) => ({
        title: d.title.trim() || file.name.replace(/\.pdf$/i, ""),
        content: text,
      }));
    } catch {
      setError("Falha ao ler o PDF.");
    } finally {
      setPdfBusy(false);
    }
  }

  async function createInvoice() {
    if (!(Number(invoiceDraft.amount) > 0)) return;
    setBusy(true);
    setError("");
    try {
      await api.createInvoice(projectId, invoiceDraft);
      setInvoiceDraft({ description: "", amount: "", dueDate: "" });
      load();
    } catch (e) {
      setError(e.body?.error || "Falha ao criar fatura.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full flex-col surface-2">
      <div className="flex items-center justify-between border-b border-ink/15 px-6 py-4">
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="-ml-1.5 rounded-lg p-1.5 text-stone-500 hover:bg-ink/[0.05] hover:text-ink lg:hidden"
          >
            <ArrowLeft size={16} />
          </button>
          <Briefcase size={15} className="text-action" />
          <span className="label-tech">Comercial</span>
        </div>
      </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="mb-4 w-full rounded-lg border border-ink/15 bg-transparent px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-action"
          >
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          {error && (
            <p className="mb-3 rounded-lg border border-danger/20 bg-danger/5 px-3 py-2 font-mono text-[11px] text-danger">
              {error}
            </p>
          )}

          <div className="mb-4 flex gap-1 rounded-lg surface-3 p-1">
            {["members", "contracts", "invoices", "builders", ...(isAdmin ? ["addons"] : [])].map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 rounded-md py-1.5 font-mono text-[11px] transition-colors ${
                  tab === t ? "bg-clay text-ink shadow-sm" : "text-stone-500 hover:text-ink"
                }`}
              >
                {t === "members" ? "clientes" : t === "contracts" ? "contratos" : t === "invoices" ? "faturas" : t === "builders" ? "construtores" : "add-ons"}
              </button>
            ))}
          </div>

          {tab === "members" && (
            <div>
              <div className="mb-4 flex gap-2 rounded-lg surface-3 p-3">
                <input
                  type="email"
                  placeholder="email@cliente.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && invite()}
                  className="flex-1 rounded-lg border border-ink/15 bg-transparent px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-action"
                />
                <button
                  onClick={invite}
                  disabled={busy || !inviteEmail.trim()}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-action px-3 py-2 font-mono text-[11px] font-semibold text-clay transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <UserPlus size={13} /> convidar
                </button>
              </div>
              {members === null ? (
                <div className="flex justify-center py-6"><Spinner /></div>
              ) : members.length === 0 ? (
                <EmptyState icon={Users}>Nenhum membro vinculado a este projeto ainda.</EmptyState>
              ) : (
                <ul className="space-y-1.5">
                  {members.map((m) => (
                    <li key={m.user_email} className="flex items-center gap-2.5 rounded-lg surface-3 px-3 py-2.5 text-sm">
                      <Avatar name={m.user_email} size="sm" />
                      <span className="min-w-0 flex-1 truncate text-ink">{m.user_email}</span>
                      <span className="shrink-0 rounded-md bg-ink/[0.06] px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-stone-500">
                        {m.role}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {tab === "builders" && (
            <div>
              <SectionIntro icon={Award}>
                Nível e XP de cada construtor, ganhos apenas com tarefas revisadas dentro deste projeto — um espelho do
                perfil "Jornada" de cada um, restrito ao que foi feito aqui.
              </SectionIntro>
              {builders === null ? (
                <div className="flex justify-center py-6"><Spinner /></div>
              ) : builders.length === 0 ? (
                <EmptyState icon={Award}>Nenhuma tarefa revisada neste projeto ainda.</EmptyState>
              ) : (
                <ul className="space-y-1.5">
                  {builders.map((b) => (
                    <li key={b.email} className="flex items-center gap-2.5 rounded-lg surface-3 px-3 py-2.5 text-sm">
                      <Avatar name={b.name} size="sm" />
                      <span className="min-w-0 flex-1 truncate text-ink">{b.name}</span>
                      <span className="flex shrink-0 items-center gap-2">
                        <span className="font-mono text-[10px] text-stone-500">{b.xp} XP</span>
                        <span className="inline-flex items-center gap-1 rounded-md bg-action/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-action">
                          <Award size={11} /> nível {b.level}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {tab === "contracts" && (
            <div>
              <div className="mb-4 space-y-2 rounded-lg surface-3 p-3">
                <input
                  placeholder="Título do contrato"
                  value={contractDraft.title}
                  onChange={(e) => setContractDraft((d) => ({ ...d, title: e.target.value }))}
                  className="w-full rounded-lg border border-ink/15 bg-transparent px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-action"
                />
                <div className="relative">
                  <textarea
                    placeholder="Conteúdo do contrato"
                    value={contractDraft.content}
                    onChange={(e) => setContractDraft((d) => ({ ...d, content: e.target.value }))}
                    rows={6}
                    className="w-full rounded-lg border border-ink/15 bg-transparent px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-action"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label
                    className={`inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-ink/20 px-3 py-2 font-mono text-[11px] text-stone-500 transition-colors hover:border-action/40 hover:text-action ${
                      pdfBusy ? "pointer-events-none opacity-60" : ""
                    }`}
                  >
                    {pdfBusy ? <Spinner /> : <FileUp size={13} />}
                    {pdfBusy ? "lendo pdf…" : "importar de pdf"}
                    <input
                      type="file"
                      accept="application/pdf"
                      className="hidden"
                      onChange={(e) => pickPdfForContract(e.target.files?.[0])}
                    />
                  </label>
                  <span className="text-[10px] text-stone-400">extrai o texto direto para o campo acima</span>
                </div>
                <button
                  onClick={createContract}
                  disabled={busy || !contractDraft.title.trim() || !contractDraft.content.trim()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-action px-3 py-2 font-mono text-[11px] font-semibold text-clay transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Plus size={13} /> criar contrato
                </button>
              </div>
              {contracts === null ? (
                <div className="flex justify-center py-6"><Spinner /></div>
              ) : contracts.length === 0 ? (
                <EmptyState icon={FileText}>Nenhum contrato ainda.</EmptyState>
              ) : (
                <ul className="space-y-1.5">
                  {contracts.map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-2 rounded-lg surface-3 px-3 py-2.5 text-sm">
                      <span className="flex min-w-0 items-center gap-2.5">
                        <FileText size={14} className="shrink-0 text-stone-400" />
                        <span className="truncate text-ink">{c.title}</span>
                      </span>
                      <span className={`flex shrink-0 items-center gap-1 font-mono text-[10px] uppercase tracking-wider ${c.status === "SIGNED" ? "text-success" : "text-warning"}`}>
                        {c.status === "SIGNED" ? <CheckCircle2 size={11} /> : <Clock size={11} />}
                        {c.status === "SIGNED" ? "assinado" : "pendente"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {tab === "invoices" && (
            <div>
              <div className="mb-4 grid grid-cols-2 gap-2 rounded-lg surface-3 p-3">
                <input
                  placeholder="Descrição"
                  value={invoiceDraft.description}
                  onChange={(e) => setInvoiceDraft((d) => ({ ...d, description: e.target.value }))}
                  className="col-span-2 rounded-lg border border-ink/15 bg-transparent px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-action"
                />
                <input
                  type="number"
                  placeholder="Valor (R$)"
                  value={invoiceDraft.amount}
                  onChange={(e) => setInvoiceDraft((d) => ({ ...d, amount: e.target.value }))}
                  className="rounded-lg border border-ink/15 bg-transparent px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-action"
                />
                <input
                  type="date"
                  value={invoiceDraft.dueDate}
                  onChange={(e) => setInvoiceDraft((d) => ({ ...d, dueDate: e.target.value }))}
                  className="rounded-lg border border-ink/15 bg-transparent px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-action"
                />
                <button
                  onClick={createInvoice}
                  disabled={busy || !(Number(invoiceDraft.amount) > 0)}
                  className="col-span-2 inline-flex items-center justify-center gap-1.5 rounded-lg bg-action px-3 py-2 font-mono text-[11px] font-semibold text-clay transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Plus size={13} /> criar fatura
                </button>
              </div>
              {invoices === null ? (
                <div className="flex justify-center py-6"><Spinner /></div>
              ) : invoices.length === 0 ? (
                <EmptyState icon={Receipt}>Nenhuma fatura ainda.</EmptyState>
              ) : (
                <ul className="space-y-1.5">
                  {invoices.map((inv) => (
                    <li key={inv.id} className="flex items-center justify-between gap-2 rounded-lg surface-3 px-3 py-2.5 text-sm">
                      <span className="flex min-w-0 items-center gap-2.5">
                        <Receipt size={14} className="shrink-0 text-stone-400" />
                        <span className="truncate text-ink">{inv.description || "Fatura"}</span>
                      </span>
                      <span className="shrink-0 font-semibold text-ink">{brl(inv.amount, inv.currency)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {tab === "addons" && isAdmin && (
            <div>
              <SectionIntro icon={ShoppingBag}>
                Catálogo global — visível para todos os clientes no marketplace.
              </SectionIntro>
              <div className="mb-4 grid grid-cols-2 gap-2 rounded-lg surface-3 p-3">
                <input
                  placeholder="Título"
                  value={addonDraft.title}
                  onChange={(e) => setAddonDraft((d) => ({ ...d, title: e.target.value }))}
                  className="col-span-2 rounded-lg border border-ink/15 bg-transparent px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-action"
                />
                <textarea
                  placeholder="Descrição"
                  value={addonDraft.description}
                  onChange={(e) => setAddonDraft((d) => ({ ...d, description: e.target.value }))}
                  rows={2}
                  className="col-span-2 rounded-lg border border-ink/15 bg-transparent px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-action"
                />
                <input
                  type="number"
                  placeholder="Preço (R$)"
                  value={addonDraft.price}
                  onChange={(e) => setAddonDraft((d) => ({ ...d, price: e.target.value }))}
                  className="rounded-lg border border-ink/15 bg-transparent px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-action"
                />
                <input
                  type="number"
                  placeholder="Preço promocional (opcional)"
                  value={addonDraft.specialPrice}
                  onChange={(e) => setAddonDraft((d) => ({ ...d, specialPrice: e.target.value }))}
                  className="rounded-lg border border-ink/15 bg-transparent px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-action"
                />
                <label className="col-span-2 flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-ink/20 px-3 py-2 text-xs text-stone-500 transition-colors hover:border-action/40 hover:text-action">
                  {bannerBusy === "new" ? <Spinner /> : <ImagePlus size={14} />}
                  {addonDraft.aiBannerUrl ? "banner selecionado — trocar" : "banner (opcional — gerado via Higgsfield, por exemplo)"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => pickBannerForDraft(e.target.files?.[0])}
                  />
                </label>
                <button
                  onClick={createAddon}
                  disabled={busy || !addonDraft.title.trim() || !(Number(addonDraft.price) > 0)}
                  className="col-span-2 inline-flex items-center justify-center gap-1.5 rounded-lg bg-action px-3 py-2 font-mono text-[11px] font-semibold text-clay transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Plus size={13} /> criar add-on
                </button>
              </div>
              {catalog === null ? (
                <div className="flex justify-center py-6"><Spinner /></div>
              ) : catalog.length === 0 ? (
                <EmptyState icon={ShoppingBag}>Nenhum add-on no catálogo ainda.</EmptyState>
              ) : (
                <ul className="space-y-1.5">
                  {catalog.map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-2 rounded-lg surface-3 px-3 py-2 text-sm">
                      <div className="flex min-w-0 items-center gap-2.5">
                        {a.ai_banner_url ? (
                          <img src={a.ai_banner_url} alt="" className="h-9 w-14 shrink-0 rounded-md object-cover" />
                        ) : (
                          <div className="flex h-9 w-14 shrink-0 items-center justify-center rounded-md bg-ink/[0.06] text-stone-400">
                            <ImagePlus size={13} />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className={`truncate ${a.is_active ? "text-ink" : "text-stone-400 line-through"}`}>{a.title}</p>
                          <p className="font-mono text-[10px] text-stone-500">
                            {brl(a.special_price || a.price)}
                            {a.special_price && <span className="ml-1 line-through">{brl(a.price)}</span>}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <label
                          title={a.ai_banner_url ? "Trocar banner" : "Adicionar banner"}
                          className="cursor-pointer rounded-lg p-1.5 text-stone-500 transition-colors hover:bg-ink/[0.05] hover:text-ink"
                        >
                          {bannerBusy === a.id ? <Spinner /> : <ImagePlus size={14} />}
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => pickBannerForExisting(a.id, e.target.files?.[0])}
                          />
                        </label>
                        <button
                          onClick={() => toggleAddonActive(a)}
                          disabled={busy}
                          title={a.is_active ? "Desativar" : "Ativar"}
                          className="rounded-lg p-1.5 text-stone-500 transition-colors hover:bg-ink/[0.05] hover:text-ink"
                        >
                          {a.is_active ? <Eye size={14} /> : <EyeOff size={14} />}
                        </button>
                        <button
                          onClick={() => removeAddon(a)}
                          disabled={busy}
                          title="Remover"
                          className="rounded-lg p-1.5 text-stone-500 transition-colors hover:bg-danger/10 hover:text-danger"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
    </div>
  );
}
