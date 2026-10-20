import { createClient, type Session } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

// Browser-managed sessions carry only a public key. Database policies verify
// the signed-in user on every data request.
export const supabase = url && key ? createClient(url, key, {
  auth: { flowType: "implicit", persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
}) : null;
export const backendReady = Boolean(supabase);

export function safeNextPath(value: string | null, fallback = "/workspace") {
  if (!value || !value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(value)) return fallback;
  try {
    const destination = new URL(value, "https://vantage.invalid");
    if (destination.origin !== "https://vantage.invalid" || destination.pathname.startsWith("//") || destination.pathname.startsWith("/auth/")) return fallback;
    return destination.pathname + destination.search + destination.hash;
  } catch { return fallback; }
}

export function authCallbackUrl(next = "/workspace", recovery = false) {
  const callback = new URL("/auth/callback", window.location.origin);
  callback.searchParams.set("next", safeNextPath(next));
  if (recovery) callback.searchParams.set("recovery", "1");
  return callback.toString();
}

export async function updatePasswordForSession(
  session: Pick<Session, "access_token" | "user">,
  expectedUserId: string,
  password: string,
  stillCurrent: () => boolean,
) {
  if (!url || !key || session.user.id !== expectedUserId || !stillCurrent()) {
    throw new Error("Your account has changed. Please reopen your password reset link.");
  }
  // Copy the access token before awaiting anything. Never read or refresh the
  // shared session while preparing this password change.
  const accessToken = session.access_token;
  const isolated = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: `vantage-password-update-${crypto.randomUUID()}`,
    },
  });
  try {
    const { data, error } = await isolated.auth.getUser(accessToken);
    if (error) throw error;
    if (data.user?.id !== expectedUserId || !stillCurrent()) {
      throw new Error("Your account has changed. Please reopen your password reset link.");
    }
    // Match Auth's updateUser request, using the verified access-token snapshot.
    // No refresh token is installed or rotated in this temporary client.
    const response = await fetch(`${url.replace(/\/$/, "")}/auth/v1/user`, {
      method: "PUT",
      headers: { apikey: key, Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) {
      const failure = new Error("The password could not be updated.");
      Object.assign(failure, { code: typeof result?.code === "string" ? result.code : undefined });
      throw failure;
    }
    if (result?.id !== expectedUserId) throw new Error("Your account could not be verified.");
  } finally {
    // Dispose local listeners only; signing out here would revoke the member's
    // actual session on the server.
    await isolated.auth.dispose();
  }
}

export function authErrorMessage(error: unknown, fallback: string) {
  const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
  switch (code) {
    case "invalid_credentials": return "The email or password doesn’t match. Please check both and try again.";
    case "email_not_confirmed": return "Confirm your email before signing in. You can request a new confirmation below.";
    case "email_exists":
    case "user_already_exists": return "An account already uses this email. Sign in or reset your password.";
    case "weak_password": return "Choose a stronger password with at least 8 characters. A mix of letters, numbers and symbols works well.";
    case "same_password": return "Choose a password you haven’t used for this account before.";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit": return "You’ve made a few requests. Please wait a minute before trying again.";
    case "email_address_invalid":
    case "validation_failed": return "Please check your details and enter a valid email address.";
    case "otp_expired":
    case "otp_disabled": return "This email link has expired or has already been used. Please request a new one.";
    case "signup_disabled": return "Registration is temporarily unavailable. Please try again later.";
    default: return fallback;
  }
}
