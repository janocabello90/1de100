// ─── Web Push Notifications ───
// VAPID public key — generate yours at https://vapidkeys.com
// Store the private key in Supabase Edge Function secrets
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || "";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function requestNotificationPermission() {
  if (!("Notification" in window)) {
    return { granted: false, reason: "not_supported" };
  }
  if (Notification.permission === "granted") {
    return { granted: true };
  }
  if (Notification.permission === "denied") {
    return { granted: false, reason: "denied" };
  }
  const result = await Notification.requestPermission();
  return { granted: result === "granted", reason: result };
}

export async function subscribeToPush() {
  if (!VAPID_PUBLIC_KEY) {
    console.warn("VAPID_PUBLIC_KEY not set — push disabled");
    return null;
  }
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
    return subscription.toJSON();
  } catch (err) {
    console.error("Push subscription failed:", err);
    return null;
  }
}

export async function unsubscribeFromPush() {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) await subscription.unsubscribe();
    return true;
  } catch {
    return false;
  }
}

// Check if push is currently subscribed
export async function isPushSubscribed() {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return !!subscription;
  } catch {
    return false;
  }
}

// Send a local notification (fallback when push server isn't set up yet)
export function sendLocalNotification(title, body, icon = "/icons/icon-192.png") {
  if (Notification.permission === "granted") {
    new Notification(title, { body, icon, badge: icon });
  }
}

// Schedule a daily reminder check (runs client-side as fallback)
export function scheduleLocalReminder(targetHour = 20) {
  const now = new Date();
  const target = new Date();
  target.setHours(targetHour, 0, 0, 0);
  if (target <= now) target.setDate(target.getDate() + 1);
  const delay = target - now;

  setTimeout(() => {
    sendLocalNotification(
      "1 de 100 💪",
      "¿Ya completaste tus 100 movimientos hoy?"
    );
    // Re-schedule for next day
    scheduleLocalReminder(targetHour);
  }, delay);
}
