import { useEffect, useState } from "react";
import { BellRing } from "lucide-react";
import { Toggle } from "@/components/ui";
import { isPushSupported, getPushSubscription, subscribeToPush, unsubscribeFromPush } from "@/lib/push";

// Same visual family as ProfilePage's "Notificações por e-mail" row — sits
// right below it. Never auto-prompts: the permission request only fires when
// the user flips this toggle on.
export default function PushPermissionPrompt() {
  const [supported, setSupported] = useState(true);
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isPushSupported()) {
      setSupported(false);
      return;
    }
    getPushSubscription()
      .then((sub) => setChecked(Boolean(sub)))
      .catch(() => {});
  }, []);

  if (!supported) return null;

  const blocked = typeof Notification !== "undefined" && Notification.permission === "denied";

  async function toggle(next) {
    if (busy || blocked) return;
    setBusy(true);
    setError("");
    try {
      if (next) {
        await subscribeToPush();
      } else {
        await unsubscribeFromPush();
      }
      setChecked(next);
    } catch (e) {
      setError(e.message || "Não foi possível atualizar as notificações push.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-ink/10 bg-ink/[0.02] px-3 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-sm text-ink">
          <BellRing size={14} className="shrink-0 text-stone-400" />
          Notificações push
        </span>
        <Toggle checked={checked} onChange={toggle} label="Notificações push" />
      </div>
      {blocked && (
        <p className="mt-1.5 font-mono text-[10px] text-stone-500">
          Bloqueado nas configurações do navegador — permita notificações para este site para ativar.
        </p>
      )}
      {error && <p className="mt-1.5 font-mono text-[10px] text-danger">{error}</p>}
    </div>
  );
}
