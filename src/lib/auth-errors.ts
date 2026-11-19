import { isAuthError } from "@supabase/supabase-js";

// Friendly, actionable messages for the Supabase Auth failures applicants actually hit.
export const DUPLICATE_ACCOUNT_MESSAGE =
  "An account with this email already exists. Sign in instead, or reset your password if you've forgotten it.";
export const EXPIRED_RESET_MESSAGE =
  "This password reset link is invalid, expired, or already used.";

const MESSAGES: Record<string, string> = {
  user_already_exists: DUPLICATE_ACCOUNT_MESSAGE,
  email_exists: DUPLICATE_ACCOUNT_MESSAGE,
  invalid_credentials: "Incorrect email or password.",
  email_not_confirmed: "Please verify your email before signing in. Check your inbox (and spam) for the link.",
  email_address_invalid: "Please enter a valid email address.",
  email_address_not_authorized: "This email address can't be used to sign up. Try a different one.",
  signup_disabled: "New sign-ups are currently closed.",
  user_banned: "This account has been disabled. Contact operations@t4sg.dev if you think this is a mistake.",
  captcha_failed: "The CAPTCHA check failed. Please complete it again.",
  over_request_rate_limit: "Too many attempts. Please wait a minute and try again.",
  over_email_send_rate_limit: "Too many emails have been sent to this address. Please wait a few minutes and try again.",
  same_password: "Your new password must be different from your current password.",
  session_not_found: "Your session has expired. Please sign in again.",
  session_expired: "Your session has expired. Please sign in again.",
  refresh_token_not_found: "Your session has expired. Please sign in again.",
  refresh_token_already_used: "Your session has expired. Please sign in again.",
  otp_expired: EXPIRED_RESET_MESSAGE,
  flow_state_expired: EXPIRED_RESET_MESSAGE,
  flow_state_not_found: EXPIRED_RESET_MESSAGE,
  bad_code_verifier: "Open the link in the same browser you requested it from, or request a new one.",
  request_timeout: "The request timed out. Please try again.",
};

export function friendlyAuthError(error: unknown): string {
  if (isAuthError(error)) {
    if (error.code && MESSAGES[error.code]) return MESSAGES[error.code];
    if (error.code === "weak_password") return error.message || "Please choose a stronger password.";
    if (error.status === 429) return MESSAGES.over_request_rate_limit;
    if (error.name === "AuthRetryableFetchError" || error.status === 0) return NETWORK_MESSAGE;
    if (/session missing/i.test(error.message)) return MESSAGES.session_not_found;
    return error.message || GENERIC_MESSAGE;
  }
  if (error instanceof TypeError) return NETWORK_MESSAGE;
  return error instanceof Error && error.message ? error.message : GENERIC_MESSAGE;
}

export const NETWORK_MESSAGE = "We couldn't reach the server. Check your internet connection and try again.";
const GENERIC_MESSAGE = "Something went wrong. Please try again.";

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}
