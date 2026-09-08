/**
 * client/src/lib/customerSession.ts
 *
 * A sessão de verdade do cliente vive num cookie httpOnly (ver
 * server/_core/customerAuth.ts) — este módulo só lembra localmente (no
 * navegador do próprio cliente, nunca em outro dispositivo) o último contato
 * usado, para pré-preencher o campo de login/cadastro quando o cliente
 * volta ao site.
 */

const STORAGE_KEY = "ideal_prime_customer_contact";

export function getRememberedContact(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function rememberContact(contact: string): void {
  if (typeof window === "undefined") return;
  const value = contact.trim();
  if (!value) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // localStorage indisponível (modo privado, navegador embutido, etc.) —
    // não bloqueia o fluxo, só perde a conveniência de lembrar o contato.
  }
}

export function forgetRememberedContact(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // idem — silenciosamente ignorado.
  }
}
