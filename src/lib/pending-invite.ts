// A team-invite token needs to survive redirects we don't fully control —
// Supabase's email-confirmation and password-recovery links redirect back
// to a configured URL that doesn't reliably preserve our own query string
// (it depends on the project's allow-listed redirect URLs). localStorage
// survives those redirects on the same device/browser regardless, so it's
// the primary source of truth once a token has been seen; the URL query
// param is only the very first place we look, on the page that started it.
const KEY = "wf-pending-invite";

export function savePendingInvite(token: string) {
  window.localStorage.setItem(KEY, token);
}

/** The invite token from the URL if present, else whatever was last saved. */
export function getPendingInvite(): string | null {
  const fromUrl = new URLSearchParams(window.location.search).get("invite");
  if (fromUrl) return fromUrl;
  return window.localStorage.getItem(KEY);
}

export function clearPendingInvite() {
  window.localStorage.removeItem(KEY);
}
