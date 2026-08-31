/**
 * db.wishlist.ts — Funções de banco para Lista de Desejos
 *
 * v2 — Refatoração completa:
 * - Phone como chave de identificação do visitante
 * - productIds: array de IDs de produtos selecionados no catálogo
 * - Categorias dinâmicas (tabela permupay_categories)
 * - Lookup por telefone retorna todos os pedidos ativos do visitante
 */

import { and, asc, desc, eq, or, sql } from "drizzle-orm";
import {
  categories,
  wishlistRequests,
  type Category,
  type InsertCategory,
  type InsertWishlistRequest,
  type WishlistRequest,
} from "../drizzle/schema";
import { getDb } from "./db";

// ─── Público — criar desejo ───────────────────────────────────────────────────
// [INJETADO] phone é salvo normalizado (apenas dígitos) para lookup futuro

export async function createWishlistRequest(
  data: Omit<
    InsertWishlistRequest,
    "id" | "createdAt" | "updatedAt" | "status" | "attendedBy"
  >
): Promise<WishlistRequest> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Normaliza phone: extrai apenas dígitos do contato quando for WHATSAPP
  const phone =
    data.contactType === "WHATSAPP" || !data.contactType
      ? (data.contact ?? "").replace(/\D/g, "")
      : null;

  const [entry] = await db
    .insert(wishlistRequests)
    .values({
      ...data,
      phone: phone || null,
      status: "NOVO",
      // Garante array vazio caso não seja passado
      productIds: (data as any).productIds ?? [],
    })
    .returning();

  return entry!;
}

// ─── Público — buscar por telefone (chave de identificação) ──────────────────
// [INJETADO] Busca por phone normalizado OU por contact direto
// Ao digitar o telefone no form, recupera todos os pedidos anteriores do visitante

export async function getWishlistByPhone(
  phone: string
): Promise<WishlistRequest[]> {
  const db = await getDb();
  if (!db) return [];

  // Normaliza para comparar: apenas dígitos
  const normalized = phone.replace(/\D/g, "");
  if (!normalized) return [];

  return db
    .select()
    .from(wishlistRequests)
    .where(
      or(
        eq(wishlistRequests.phone, normalized),
        eq(wishlistRequests.contact, phone),
        eq(wishlistRequests.contact, normalized)
      )
    )
    .orderBy(desc(wishlistRequests.createdAt))
    .limit(30);
}

// ─── Público — buscar por contato (legado + novo) ─────────────────────────────
// Mantido para compatibilidade com código existente

export async function getWishlistByContact(
  contact: string
): Promise<WishlistRequest[]> {
  return getWishlistByPhone(contact);
}

// ─── Admin — listar todos ─────────────────────────────────────────────────────

export async function listWishlistRequests(filters?: {
  status?: string;
  category?: string;
}): Promise<WishlistRequest[]> {
  const db = await getDb();
  if (!db) return [];

  const conditions = [];
  if (filters?.status) {
    conditions.push(
      eq(
        wishlistRequests.status,
        filters.status as WishlistRequest["status"]
      )
    );
  }
  if (filters?.category) {
    conditions.push(eq(wishlistRequests.category, filters.category));
  }

  return db
    .select()
    .from(wishlistRequests)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(wishlistRequests.createdAt));
}

// ─── Admin — atualizar status ─────────────────────────────────────────────────

export async function updateWishlistStatus(
  id: number,
  status: "NOVO" | "VISUALIZADO" | "CONTATADO" | "ATENDIDO" | "FECHADO",
  adminNotes?: string,
  attendedBy?: number
): Promise<WishlistRequest> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [updated] = await db
    .update(wishlistRequests)
    .set({ status, adminNotes, attendedBy, updatedAt: new Date() })
    .where(eq(wishlistRequests.id, id))
    .returning();

  return updated!;
}

// ─── Admin — deletar ──────────────────────────────────────────────────────────

export async function deleteWishlistRequest(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(wishlistRequests).where(eq(wishlistRequests.id, id));
}

// ─── Admin — contadores para dashboard ───────────────────────────────────────

export async function getWishlistCounts(): Promise<{
  total: number;
  novo: number;
  contatado: number;
  atendido: number;
}> {
  const db = await getDb();
  if (!db) return { total: 0, novo: 0, contatado: 0, atendido: 0 };

  try {
    const rows = await db
      .select({
        status: wishlistRequests.status,
        count: sql<number>`count(*)::int`,
      })
      .from(wishlistRequests)
      .groupBy(wishlistRequests.status);

    const counts: Record<string, number> = {};
    rows.forEach((r) => { counts[r.status] = r.count; });

    return {
      total: rows.reduce((s, r) => s + r.count, 0),
      novo: counts["NOVO"] ?? 0,
      contatado: counts["CONTATADO"] ?? 0,
      atendido: counts["ATENDIDO"] ?? 0,
    };
  } catch {
    return { total: 0, novo: 0, contatado: 0, atendido: 0 };
  }
}

// ─── Categorias dinâmicas ─────────────────────────────────────────────────────
// [NOVO] CRUD completo de categorias gerenciadas pelo admin

export async function listCategories(onlyActive = false): Promise<Category[]> {
  const db = await getDb();
  if (!db) return getFallbackCategories();

  try {
    const q = db
      .select()
      .from(categories)
      .orderBy(asc(categories.sortOrder), asc(categories.label));

    if (onlyActive) {
      return (await db
        .select()
        .from(categories)
        .where(eq(categories.active, true))
        .orderBy(asc(categories.sortOrder), asc(categories.label))) as Category[];
    }

    return (await q) as Category[];
  } catch {
    // Tabela ainda não existe (migration pendente) — retorna seed padrão
    return getFallbackCategories();
  }
}

export async function createCategory(
  data: Omit<InsertCategory, "id" | "createdAt" | "updatedAt">
): Promise<Category> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const slug = data.slug.toUpperCase().replace(/\s+/g, "_");

  const [created] = await db
    .insert(categories)
    .values({ ...data, slug })
    .returning();

  return created!;
}

export async function updateCategory(
  id: number,
  data: Partial<Omit<InsertCategory, "id" | "createdAt">>
): Promise<Category> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [updated] = await db
    .update(categories)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(categories.id, id))
    .returning();

  return updated!;
}

export async function deleteCategory(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(categories).where(eq(categories.id, id));
}

// ─── Fallback se tabela não existir ainda ─────────────────────────────────────

function getFallbackCategories(): Category[] {
  const now = new Date();
  return [
    { id: 1, slug: "CELULAR", label: "Celulares", emoji: "📱", sortOrder: 1, active: true, createdAt: now, updatedAt: now },
    { id: 2, slug: "ELETRONICO", label: "Eletrônicos", emoji: "💻", sortOrder: 2, active: true, createdAt: now, updatedAt: now },
    { id: 3, slug: "PERFUME", label: "Perfumes & Fragrâncias", emoji: "🌸", sortOrder: 3, active: true, createdAt: now, updatedAt: now },
    { id: 4, slug: "OUTRO", label: "Outros", emoji: "📦", sortOrder: 4, active: true, createdAt: now, updatedAt: now },
  ] as Category[];
}
