import { createHash } from "node:crypto";
import { desc, eq, inArray, sql } from "drizzle-orm";
import { aiSuggestionsCache, appSettings, products } from "../drizzle/schema";
import { getDb } from "./db";
import {
  normalizeProductSuggestion,
  requestExternalProductSuggestion,
  type ProductSuggestion,
} from "./db.ai.external";

const DEFAULT_SIMILARITY_THRESHOLD = 0.45;
const SIMILARITY_SETTING_KEYS = ["ai_similarity_threshold", "ai_agent"] as const;

type InternalProductMatch = {
  id: number;
  name: string;
  category: string;
  categoryLabel: string | null;
  shortDescription: string | null;
  description: string | null;
  score: number;
};

function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function hashValue(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function buildInputHash(name: string, imageUrl: string): string {
  const normalizedName = normalizeName(name);
  const imageHash = imageUrl ? hashValue(imageUrl) : "";
  return hashValue(`${normalizedName}|${imageHash}`);
}

function readNumericSetting(value: unknown): number | undefined {
  const candidate = value && typeof value === "object"
    ? (value as Record<string, unknown>).threshold ??
      (value as Record<string, unknown>).similarityThreshold ??
      (value as Record<string, unknown>).value
    : value;
  const numeric = Number(candidate);
  return Number.isFinite(numeric) && numeric >= 0 && numeric <= 1 ? numeric : undefined;
}

async function getSimilarityThreshold(db: any): Promise<number> {
  const environmentValue = readNumericSetting(process.env.AI_SIMILARITY_THRESHOLD);
  if (environmentValue !== undefined) return environmentValue;

  try {
    const settings = await db
      .select({ value: appSettings.value })
      .from(appSettings)
      .where(inArray(appSettings.key, [...SIMILARITY_SETTING_KEYS]));
    for (const setting of settings) {
      const configured = readNumericSetting(setting.value);
      if (configured !== undefined) return configured;
    }
  } catch (error) {
    console.warn("[AI_AGENT] similarity_threshold_config_unavailable", {
      message: error instanceof Error ? error.message : String(error),
    });
  }
  return DEFAULT_SIMILARITY_THRESHOLD;
}

function adaptInternalMatch(match: InternalProductMatch): ProductSuggestion {
  const description = String(match.description ?? "").trim();
  const shortDescription = String(match.shortDescription ?? description.slice(0, 160)).trim().slice(0, 160);
  return normalizeProductSuggestion({
    name: match.name,
    category: match.category,
    categoryLabel: match.categoryLabel ?? "",
    shortDescription: shortDescription || description.slice(0, 160),
    description,
  });
}

function logDecision(decision: string, details: Record<string, unknown>): void {
  console.log(JSON.stringify({
    event: "ai_agent_decision",
    decision,
    ...details,
  }));
}

async function findInternalMatch(db: any, name: string): Promise<InternalProductMatch | null> {
  if (!name) return null;
  try {
    const threshold = await getSimilarityThreshold(db);
    const rows = await db.execute(sql`
      SELECT
        ${products.id} AS id,
        ${products.name} AS name,
        ${products.category} AS category,
        ${products.categoryLabel} AS category_label,
        ${products.shortDescription} AS short_description,
        ${products.description} AS description,
        similarity(${products.name}, ${name}) AS score
      FROM ${products}
      WHERE ${products.name} % ${name}
        AND ${products.description} IS NOT NULL
      ORDER BY similarity(${products.name}, ${name}) DESC
      LIMIT 1
    `);
    const candidate = rows[0] as Record<string, unknown> | undefined;
    if (!candidate) return null;
    const score = Number(candidate.score ?? 0);
    if (score < threshold) return null;
    return {
      id: Number(candidate.id),
      name: String(candidate.name ?? ""),
      category: String(candidate.category ?? "OUTRO"),
      categoryLabel: candidate.category_label == null ? null : String(candidate.category_label),
      shortDescription: candidate.short_description == null ? null : String(candidate.short_description),
      description: candidate.description == null ? null : String(candidate.description),
      score,
    };
  } catch (error) {
    console.warn("[AI_AGENT] internal_match_unavailable", {
      reason: "pg_trgm_or_query_failed",
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

async function readSuggestionCache(db: any, inputHash: string): Promise<ProductSuggestion | null> {
  try {
    const rows = await db
      .select()
      .from(aiSuggestionsCache)
      .where(eq(aiSuggestionsCache.inputHash, inputHash))
      .orderBy(desc(aiSuggestionsCache.updatedAt))
      .limit(1);
    const cached = rows[0];
    if (!cached) return null;
    await db
      .update(aiSuggestionsCache)
      .set({
        hits: sql`${aiSuggestionsCache.hits} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(aiSuggestionsCache.id, cached.id));
    logDecision("cache_hit", {
      inputHash,
      origin: cached.origin,
      hits: Number(cached.hits ?? 0) + 1,
    });
    return normalizeProductSuggestion(cached.suggestion);
  } catch (error) {
    console.warn("[AI_AGENT] cache_read_unavailable", {
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

async function writeSuggestionCache(
  db: any,
  input: { inputHash: string; sourceType: string; matchedProductId?: number; suggestion: ProductSuggestion },
): Promise<void> {
  try {
    await db
      .insert(aiSuggestionsCache)
      .values({
        inputHash: input.inputHash,
        sourceType: input.sourceType,
        matchedProductId: input.matchedProductId,
        suggestion: input.suggestion,
        origin: "EXTERNAL_LLM",
        confidence: 1,
        hits: 1,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: aiSuggestionsCache.inputHash,
        set: {
          suggestion: input.suggestion,
          origin: "EXTERNAL_LLM",
          confidence: 1,
          updatedAt: new Date(),
        },
      });
  } catch (error) {
    console.warn("[AI_AGENT] cache_write_unavailable", {
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function resolveProductSuggestion(input: { name?: string; imageUrl?: string }): Promise<ProductSuggestion> {
  const name = input.name?.trim() || "";
  const imageUrl = input.imageUrl?.trim() || "";
  if (!name && !imageUrl) throw new Error("Envie uma imagem ou um nome para a IA sugerir os dados.");

  const db = await getDb();
  if (db) {
    const internalMatch = await findInternalMatch(db, name);
    if (internalMatch) {
      const suggestion = adaptInternalMatch(internalMatch);
      logDecision("internal_match", {
        productId: internalMatch.id,
        score: internalMatch.score,
      });
      return suggestion;
    }

    const inputHash = buildInputHash(name, imageUrl);
    const cachedSuggestion = await readSuggestionCache(db, inputHash);
    if (cachedSuggestion) return cachedSuggestion;

    const suggestion = await requestExternalProductSuggestion({ name, imageUrl });
    await writeSuggestionCache(db, {
      inputHash,
      sourceType: imageUrl ? "PRODUCT_IMAGE" : "PRODUCT_TEXT",
      suggestion,
    });
    logDecision("external_llm", { inputHash, cached: true });
    return suggestion;
  }

  logDecision("external_llm", { reason: "database_unavailable", cached: false });
  return requestExternalProductSuggestion({ name, imageUrl });
}
