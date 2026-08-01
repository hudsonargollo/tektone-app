import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { X, Camera, Trash2, Check, Mail, Bell } from "lucide-react";
import { api } from "@/lib/api";
import { Avatar, Spinner, Toggle } from "@/components/ui";

const labelCls =
  "mb-1.5 block font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-stone-500";
const inputCls =
  "w-full rounded-lg border border-ink/15 bg-ink/[0.03] px-3 py-2.5 text-sm text-ink outline-none transition-colors placeholder:text-stone-400 focus:border-action";

// Resize + center-crop an image file to a square data URL (keeps KV small).
async function fileToAvatar(file, size = 256) {
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
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const scale = Math.max(size / img.width, size / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
  return canvas.toDataURL("image/jpeg", 0.85);
}

export default function ProfilePage({ onClose, onSaved }) {
  const [p, setP] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef(null);
  const set = (k, v) => setP((prev) => ({ ...prev, [k]: v }));

  useEffect(() => {
    api
      .getProfile()
      .then(({ profile }) => setP(profile))
      .catch((e) => setError(e.body?.error || "Falha ao carregar."));
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function pickFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return setError("Selecione um arquivo de imagem.");
    try {
      const avatar = await fileToAvatar(file);
      set("avatar", avatar);
      setError("");
    } catch {
      setError("Não foi possível processar a imagem.");
    }
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      const { profile } = await api.updateProfile({
        name: p.name,
        role: p.role,
        phone: p.phone,
        location: p.location,
        bio: p.bio,
        avatar: p.avatar,
        emailNotifications: p.emailNotifications,
      });
      setP(profile);
      onSaved?.(profile);
      onClose();
    } catch (e) {
      setError(e.body?.error || "Falha ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      />
      <motion.div
        className="relative flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-2xl surface-2 shadow-2xl"
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.98 }}
        transition={{ type: "spring", stiffness: 320, damping: 28 }}
      >
        <div className="flex items-center justify-between border-b border-ink/15 px-6 py-4">
          <span className="label-tech">Meu perfil</span>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-stone-500 transition-colors hover:bg-ink/[0.05] hover:text-ink"
          >
            <X size={16} />
          </button>
        </div>

        {!p ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : (
          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
            {/* Avatar */}
            <div className="flex items-center gap-4">
              <div className="relative">
                <Avatar name={p.name} src={p.avatar} size="lg" />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="absolute -bottom-1 -right-1 rounded-full bg-action p-1.5 text-clay shadow-md transition-transform hover:scale-105"
                  title="Trocar foto"
                >
                  <Camera size={13} />
                </button>
              </div>
              <div className="flex flex-col items-start gap-1.5">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="rounded-lg border border-ink/15 px-3 py-1.5 text-xs font-semibold text-stone-600 transition-colors hover:border-action/40 hover:text-action"
                >
                  Enviar foto
                </button>
                {p.avatar && (
                  <button
                    type="button"
                    onClick={() => set("avatar", "")}
                    className="flex items-center gap-1 text-xs text-stone-400 transition-colors hover:text-danger"
                  >
                    <Trash2 size={12} /> Remover
                  </button>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={pickFile}
                className="hidden"
              />
            </div>

            {error && <p className="font-mono text-[11px] text-danger">{error}</p>}

            <div>
              <label className={labelCls}>E-mail</label>
              <div className="flex items-center gap-2 rounded-lg border border-ink/10 bg-ink/[0.02] px-3 py-2.5 text-sm text-stone-500">
                <Mail size={14} className="shrink-0 text-stone-400" />
                <span className="truncate">{p.email}</span>
                {p.admin && (
                  <span className="ml-auto shrink-0 rounded bg-action/15 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-action">
                    admin
                  </span>
                )}
              </div>
            </div>

            <div>
              <label className={labelCls}>Nome</label>
              <input
                value={p.name ?? ""}
                onChange={(e) => set("name", e.target.value)}
                className={inputCls}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Cargo</label>
                <input
                  value={p.role ?? ""}
                  onChange={(e) => set("role", e.target.value)}
                  placeholder="Ex.: CTO"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Telefone</label>
                <input
                  value={p.phone ?? ""}
                  onChange={(e) => set("phone", e.target.value)}
                  placeholder="(00) 00000-0000"
                  className={inputCls}
                />
              </div>
            </div>

            <div>
              <label className={labelCls}>Localização</label>
              <input
                value={p.location ?? ""}
                onChange={(e) => set("location", e.target.value)}
                placeholder="Cidade, país"
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>Bio</label>
              <textarea
                rows={3}
                value={p.bio ?? ""}
                onChange={(e) => set("bio", e.target.value)}
                placeholder="Sobre você…"
                className={`${inputCls} resize-none`}
              />
            </div>

            <div className="flex items-center justify-between gap-3 rounded-lg border border-ink/10 bg-ink/[0.02] px-3 py-2.5">
              <span className="flex items-center gap-2 text-sm text-ink">
                <Bell size={14} className="shrink-0 text-stone-400" />
                Notificações por e-mail
              </span>
              <Toggle
                checked={p.emailNotifications !== false}
                onChange={(v) => set("emailNotifications", v)}
                label="Notificações por e-mail"
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 border-t border-ink/15 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-stone-500 transition-colors hover:text-ink"
          >
            Cancelar
          </button>
          <button
            onClick={save}
            disabled={saving || !p}
            className="inline-flex items-center gap-2 rounded-lg bg-action px-5 py-2 text-sm font-bold text-clay transition-all hover:brightness-110 ring-action disabled:opacity-50"
          >
            {saving ? <Spinner /> : <Check size={14} />} Salvar
          </button>
        </div>
      </motion.div>
    </div>
  );
}
