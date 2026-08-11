// Web Push registration — pairs with public/sw.js (the notification
// display/click side) and functions/api/push/[[path]].js (the server-side
// subscription registry). Never auto-prompts: only called from an explicit
// user action in PushPermissionPrompt.jsx.
import { api } from "./api";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export function isPushSupported() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
}

export async function registerServiceWorker() {
  if (!isPushSupported()) return null;
  try {
    // Registering at "<BASE_URL>sw.js" (not "/sw.js") both resolves correctly
    // under the /hub path mount and, as a side effect, scopes the SW to
    // /hub/ by default (browsers scope to the script's own directory) —
    // exactly right, since this SW should only control the hub app.
    return await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
  } catch {
    return null;
  }
}

export async function getPushSubscription() {
  if (!isPushSupported()) return null;
  const reg = await navigator.serviceWorker.ready.catch(() => null);
  if (!reg) return null;
  return reg.pushManager.getSubscription();
}

export async function subscribeToPush() {
  if (!isPushSupported()) throw new Error("Este navegador não suporta notificações push.");
  const publicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
  if (!publicKey) throw new Error("Push ainda não configurado neste ambiente.");

  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Permissão de notificação negada.");

  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });
  await api.subscribePush(sub.toJSON());
  return sub;
}

export async function unsubscribeFromPush() {
  const sub = await getPushSubscription();
  if (!sub) return;
  await api.unsubscribePush({ endpoint: sub.endpoint }).catch(() => {});
  await sub.unsubscribe().catch(() => {});
}
