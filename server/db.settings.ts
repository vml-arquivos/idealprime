/**
 * server/db.settings.ts — Configurações globais da aplicação
 *
 * Gerencia a tabela permupay_app_settings (key/value jsonb).
 * Usado para persistir os padrões de precificação entre sessões.
 */

import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { appSettings } from "../drizzle/schema";

// ── Valor padrão de precificação (fallback se settings não existir) ────────────

export const PRICING_DEFAULTS_KEY = "pricing_defaults";

export const HARDCODED_PRICING_DEFAULTS = {
  taxRegime: "SIMPLES_NACIONAL",
  taxCash: "6",
  taxBoleto: "6",
  taxDebit: "6",
  taxCreditCash: "6",
  taxCreditInstallment: "6",
  boletoMonths: "3",
  boletoMonthlyRate: "1.99",
  boletoFixedFee: "3.50",
  boletoDefaultRisk: "2",
  boletoCustomerPaysInterest: false,
  cardDebitFee: "1.5",
  cardCreditCashFee: "2.5",
  cardCreditInstallmentFee: "3.5",
  cardInstallments: "6",
  cardAnticipationRate: "1.5",
  cardMonthlyRate: "1.99",
  cardCustomerPaysInterest: false,
};

// ── Ler uma setting pelo key ──────────────────────────────────────────────────

export async function getSetting(key: string): Promise<unknown | null> {
  try {
    const db = await getDb();
    if (!db) return null;
    const rows = await db
      .select()
      .from(appSettings)
      .where(eq(appSettings.key, key))
      .limit(1);
    return rows[0]?.value ?? null;
  } catch (err) {
    console.warn("[settings] getSetting error:", err);
    return null;
  }
}

// ── Gravar uma setting ────────────────────────────────────────────────────────

export async function setSetting(key: string, value: unknown): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    await db
      .insert(appSettings)
      .values({ key, value: value as any, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: { value: value as any, updatedAt: new Date() },
      });
  } catch (err) {
    console.warn("[settings] setSetting error:", err);
  }
}

// ── Helpers de precificação ───────────────────────────────────────────────────

export async function getPricingDefaults(): Promise<typeof HARDCODED_PRICING_DEFAULTS> {
  const val = await getSetting(PRICING_DEFAULTS_KEY);
  if (val && typeof val === "object") {
    return { ...HARDCODED_PRICING_DEFAULTS, ...(val as any) };
  }
  return HARDCODED_PRICING_DEFAULTS;
}

export async function updatePricingDefaults(
  data: Partial<typeof HARDCODED_PRICING_DEFAULTS>
): Promise<typeof HARDCODED_PRICING_DEFAULTS> {
  const current = await getPricingDefaults();
  const merged = { ...current, ...data };
  await setSetting(PRICING_DEFAULTS_KEY, merged);
  return merged;
}
