/**
 * db.images.ts — Funções de banco para Galeria de Imagens de Produtos
 *
 * Regra operacional atual:
 * - Qualquer usuário autenticado pode gerenciar imagens de qualquer produto.
 * - O parâmetro userId foi mantido nas assinaturas por compatibilidade com routers.ts,
 *   mas não é usado para bloquear acesso.
 */

import { and, asc, eq } from "drizzle-orm";
import {
  productImages,
  products,
  type InsertProductImage,
  type ProductImage,
} from "../drizzle/schema";
import { deleteProductImage as deleteFromS3 } from "./storage.upload";
import { getDb } from "./db";

export const MAX_IMAGES_PER_PRODUCT = 4;

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function ensureProductExists(productId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [product] = await db
    .select({ id: products.id })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);

  if (!product) throw new Error("Produto não encontrado");
}

// ─── Listar imagens de um produto ─────────────────────────────────────────────

export async function getProductImages(
  productId: number
): Promise<ProductImage[]> {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(productImages)
    .where(eq(productImages.productId, productId))
    .orderBy(asc(productImages.sortOrder), asc(productImages.id));
}

// ─── Adicionar imagem à galeria ───────────────────────────────────────────────

export async function addProductImage(
  productId: number,
  _userId: number,
  data: { url: string; storageKey?: string; altText?: string }
): Promise<ProductImage> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await ensureProductExists(productId);

  const existing = await getProductImages(productId);
  if (existing.length >= MAX_IMAGES_PER_PRODUCT) {
    throw new Error(
      `Limite de ${MAX_IMAGES_PER_PRODUCT} imagens por produto atingido.`
    );
  }

  const isThumbnail = existing.length === 0;
  const sortOrder = existing.length;

  const [inserted] = await db
    .insert(productImages)
    .values({
      productId,
      url: data.url,
      storageKey: data.storageKey ?? null,
      isThumbnail,
      sortOrder,
      altText: data.altText ?? null,
    } satisfies InsertProductImage)
    .returning();

  if (isThumbnail) {
    await db
      .update(products)
      .set({ imageUrl: data.url, updatedAt: new Date() })
      .where(eq(products.id, productId));
  }

  return inserted!;
}

// ─── Definir thumbnail ────────────────────────────────────────────────────────

export async function setThumbnail(
  imageId: number,
  productId: number,
  _userId: number
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await ensureProductExists(productId);

  const [image] = await db
    .select()
    .from(productImages)
    .where(and(eq(productImages.id, imageId), eq(productImages.productId, productId)))
    .limit(1);
  if (!image) throw new Error("Imagem não encontrada");

  await db
    .update(productImages)
    .set({ isThumbnail: false })
    .where(eq(productImages.productId, productId));

  await db
    .update(productImages)
    .set({ isThumbnail: true })
    .where(eq(productImages.id, imageId));

  await db
    .update(products)
    .set({ imageUrl: image.url, updatedAt: new Date() })
    .where(eq(products.id, productId));
}

// ─── Reordenar imagens ────────────────────────────────────────────────────────

export async function reorderProductImages(
  productId: number,
  _userId: number,
  orderedIds: number[]
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await ensureProductExists(productId);

  for (let i = 0; i < orderedIds.length; i++) {
    await db
      .update(productImages)
      .set({ sortOrder: i })
      .where(
        and(
          eq(productImages.id, orderedIds[i]!),
          eq(productImages.productId, productId)
        )
      );
  }
}

// ─── Deletar imagem ───────────────────────────────────────────────────────────

export async function deleteProductImageRecord(
  imageId: number,
  productId: number,
  _userId: number
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await ensureProductExists(productId);

  const [image] = await db
    .select()
    .from(productImages)
    .where(and(eq(productImages.id, imageId), eq(productImages.productId, productId)))
    .limit(1);
  if (!image) throw new Error("Imagem não encontrada");

  const wasThumbnail = image.isThumbnail;

  await db.delete(productImages).where(eq(productImages.id, imageId));

  if (image.storageKey) {
    try {
      await deleteFromS3(image.url);
    } catch {
      // falha ao remover arquivo externo não deve bloquear operação
    }
  }

  if (wasThumbnail) {
    const remaining = await getProductImages(productId);
    if (remaining.length > 0) {
      const next = remaining[0]!;
      await db
        .update(productImages)
        .set({ isThumbnail: true })
        .where(eq(productImages.id, next.id));
      await db
        .update(products)
        .set({ imageUrl: next.url, updatedAt: new Date() })
        .where(eq(products.id, productId));
    } else {
      await db
        .update(products)
        .set({ imageUrl: null, updatedAt: new Date() })
        .where(eq(products.id, productId));
    }
  }
}

// ─── Atualizar alt text ───────────────────────────────────────────────────────

export async function updateImageAltText(
  imageId: number,
  productId: number,
  _userId: number,
  altText: string
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await ensureProductExists(productId);

  await db
    .update(productImages)
    .set({ altText })
    .where(
      and(
        eq(productImages.id, imageId),
        eq(productImages.productId, productId)
      )
    );
}
