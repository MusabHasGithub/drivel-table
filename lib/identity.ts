// Tiny localStorage helpers for "who am I" identity.
//
// We avoid real auth on purpose: this app is for friend-group use, anyone
// with the URL types their name on first visit and that becomes the
// `submittedBy` value on every entry they create. See the plan's
// "Auth-lite identity model" section for tradeoffs.
//
// SSR safety: every call guards against `typeof window === "undefined"`
// because Next renders these modules during the server build too.

const KEY = "drivel.identity.name";

export function getStoredName(): string | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(KEY);
  if (!raw) return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function setStoredName(name: string): void {
  if (typeof window === "undefined") return;
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    window.localStorage.removeItem(KEY);
    return;
  }
  window.localStorage.setItem(KEY, trimmed);
}

export function clearStoredName(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
}
