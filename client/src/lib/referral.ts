const REFERRAL_STORAGE_KEY = "permupay.referralCode";
const REFERRAL_COOKIE_KEY = "permupay_referral";
const REFERRAL_MAX_AGE = 60 * 60 * 24 * 30;

export function persistReferralCode(value?: string | null): string | null {
  if (typeof window === "undefined" || !value) return null;
  const code = value.trim().toUpperCase().slice(0, 32);
  if (!code) return null;
  window.localStorage.setItem(REFERRAL_STORAGE_KEY, code);
  document.cookie = `${REFERRAL_COOKIE_KEY}=${encodeURIComponent(code)}; Max-Age=${REFERRAL_MAX_AGE}; Path=/; SameSite=Lax`;
  return code;
}

export function captureReferralFromLocation(): string | null {
  if (typeof window === "undefined") return null;
  const code = new URLSearchParams(window.location.search).get("ref");
  return code ? persistReferralCode(code) : getStoredReferralCode();
}

export function getStoredReferralCode(): string | null {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem(REFERRAL_STORAGE_KEY);
  if (stored) return stored;
  const cookie = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${REFERRAL_COOKIE_KEY}=`));
  return cookie ? decodeURIComponent(cookie.slice(REFERRAL_COOKIE_KEY.length + 1)) : null;
}
