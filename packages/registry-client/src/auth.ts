import type { SessionInfo } from "./types.js";

/**
 * Returns the BetterAuth sign-in URL for a browser-based OAuth redirect flow.
 * The caller opens this URL in a popup or tab; after authentication the registry
 * redirects back to `callbackUrl`.
 */
export function getAuthUrl(
  registryUrl: string,
  callbackUrl: string,
): string {
  const base = registryUrl.replace(/\/+$/, "");
  const params = new URLSearchParams({
    callbackURL: callbackUrl,
  });
  return `${base}/api/auth/sign-in/email?${params.toString()}`;
}

/**
 * Returns the BetterAuth sign-up URL for new user registration.
 */
export function getSignUpUrl(
  registryUrl: string,
  callbackUrl: string,
): string {
  const base = registryUrl.replace(/\/+$/, "");
  const params = new URLSearchParams({
    callbackURL: callbackUrl,
  });
  return `${base}/api/auth/sign-up/email?${params.toString()}`;
}

/**
 * Check whether a bearer token is still valid and retrieve the associated user.
 */
export async function checkSession(
  registryUrl: string,
  token: string,
  fetchFn: typeof fetch = fetch,
): Promise<SessionInfo> {
  const base = registryUrl.replace(/\/+$/, "");
  const res = await fetchFn(`${base}/api/auth/get-session`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    return { valid: false };
  }

  const data = (await res.json()) as {
    user?: { id: string; name: string; email: string };
  };
  if (!data.user) {
    return { valid: false };
  }

  return { valid: true, user: data.user };
}
