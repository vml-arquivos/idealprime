const REFERRAL_STORAGE_KEY = "ideal_prime.referralCode";
const REFERRAL_COOKIE_KEY = "ideal_prime_referral";
const LEGACY_STORAGE_KEY = "permupay.referralCode";
const LEGACY_COOKIE_KEY = "permupay_referral";
const REFERRAL_MAX_AGE = 60 * 60 * 24 * 30;

function readCookie(key: string): string | null {
  const cookie = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${key}=`));
  return cookie ? decodeURIComponent(cookie.slice(key.length + 1)) : null;
}

export function persistReferralCode(value?: string | null): string | null {
  if (typeof window === "undefined" || !value) return null;
  const code = value.trim().toUpperCase().slice(0, 32);
  if (!code) return null;
  window.localStorage.setItem(REFERRAL_STORAGE_KEY, code);
  window.localStorage.removeItem(LEGACY_STORAGE_KEY);
  document.cookie = `${REFERRAL_COOKIE_KEY}=${encodeURIComponent(code)}; Max-Age=${REFERRAL_MAX_AGE}; Path=/; SameSite=Lax`;
  document.cookie = `${LEGACY_COOKIE_KEY}=; Max-Age=0; Path=/; SameSite=Lax`;
  return code;
}

export function captureReferralFromLocation(): string | null {
  if (typeof window === "undefined") return null;
  const code = new URLSearchParams(window.location.search).get("ref");
  return code ? persistReferralCode(code) : getStoredReferralCode();
}

export function getStoredReferralCode(): string | null {
  if (typeof window === "undefined") return null;
  const current = window.localStorage.getItem(REFERRAL_STORAGE_KEY);
  if (current) return current;

  const legacy = window.localStorage.getItem(LEGACY_STORAGE_KEY) || readCookie(LEGACY_COOKIE_KEY);
  if (legacy) return persistReferralCode(legacy);
  return readCookie(REFERRAL_COOKIE_KEY);
}
