import { randomBytes } from "node:crypto";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { getDb } from "./db";
import * as dbOrders from "./db.orders";
import { products } from "../drizzle/schema";
import {
  commissions,
  sellers,
  type InsertSeller,
  type Seller,
} from "../drizzle/schema.sellers";

export type SellerType = "INTERNO" | "EXTERNO";
export type CommissionType = "PERCENT" | "FIXED";
export type CommissionStatus = "PENDENTE" | "PAGO" | "PAGA" | "CANCELADA";
export type SellerStatus = "PENDENTE" | "APROVADO" | "REJEITADO" | "INATIVO";

function normalizeCode(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "")
    .slice(0, 60);
}

function generatedCode(): string {
  return `VEN-${randomBytes(5).toString("hex").toUpperCase()}`;
}

function generatedAccessToken(): string {
  return randomBytes(32).toString("hex");
}

function validateCommission(type: CommissionType, value: number): void {
  if (
    !Number.isFinite(value) ||
    value < 0 ||
    (type === "PERCENT" && value > 100)
  ) {
    throw new Error(
      type === "PERCENT"
        ? "A comissão percentual deve estar entre 0% e 100%"
        : "A comissão fixa não pode ser negativa"
    );
  }
}

export async function createSeller(data: {
  name: string;
  type?: SellerType;
  email?: string;
  phone?: string;
  contact?: string;
  referralCode?: string;
  accessToken?: string | null;
  commissionType?: CommissionType;
  commissionValue?: number;
  commissionRate?: number;
  active?: boolean;
  userId?: number | null;
  status?: SellerStatus;
  parentSellerId?: number | null;
  cpf?: string | null;
  birthDate?: Date | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  pixKey?: string | null;
  documentFrontUrl?: string | null;
  documentBackUrl?: string | null;
  selfiePhotoUrl?: string | null;
  submittedAt?: Date | null;
  reviewedAt?: Date | null;
  reviewedBy?: number | null;
  rejectionReason?: string | null;
}): Promise<Seller> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const name = data.name.trim();
  if (!name) throw new Error("Nome do vendedor é obrigatório");
  const type = data.type ?? "EXTERNO";
  const commissionType = data.commissionType ?? "PERCENT";
  const commissionValue = Number(
    data.commissionValue ?? data.commissionRate ?? 0
  );
  validateCommission(commissionType, commissionValue);
  const referralCode = normalizeCode(data.referralCode || generatedCode());
  if (!referralCode) throw new Error("Código de indicação inválido");

  const [created] = await db
    .insert(sellers)
    .values({
      name,
      type,
      email: data.email?.trim() || null,
      phone: data.phone?.trim() || null,
      contact: data.contact?.trim() || data.phone?.trim() || null,
      referralCode,
      accessToken:
        type === "EXTERNO"
          ? data.accessToken?.trim() || generatedAccessToken()
          : null,
      commissionType,
      commissionValue,
      commissionRate:
        commissionType === "PERCENT"
          ? commissionValue
          : Number(data.commissionRate ?? 0),
      active: data.active ?? true,
      status: data.status ?? "APROVADO",
      parentSellerId: data.parentSellerId ?? null,
      cpf: data.cpf?.trim() || null,
      birthDate: data.birthDate ?? null,
      address: data.address?.trim() || null,
      city: data.city?.trim() || null,
      state: data.state?.trim().toUpperCase() || null,
      zipCode: data.zipCode?.trim() || null,
      pixKey: data.pixKey?.trim() || null,
      documentFrontUrl: data.documentFrontUrl?.trim() || null,
      documentBackUrl: data.documentBackUrl?.trim() || null,
      selfiePhotoUrl: data.selfiePhotoUrl?.trim() || null,
      submittedAt: data.submittedAt ?? null,
      reviewedAt: data.reviewedAt ?? null,
      reviewedBy: data.reviewedBy ?? null,
      rejectionReason: data.rejectionReason?.trim() || null,
      userId: data.userId ?? null,
    } satisfies InsertSeller)
    .returning();

  return created;
}

export async function listSellers(): Promise<Seller[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(sellers).orderBy(desc(sellers.createdAt));
}

export async function getSellerById(id: number): Promise<Seller | null> {
  const db = await getDb();
  if (!db) return null;
  const [seller] = await db
    .select()
    .from(sellers)
    .where(eq(sellers.id, id))
    .limit(1);
  return seller ?? null;
}

export async function getSellerByReferralCode(
  referralCode: string,
  onlyActive = true
): Promise<Seller | null> {
  const db = await getDb();
  if (!db) return null;
  const code = normalizeCode(referralCode);
  if (!code) return null;
  const conditions = [eq(sellers.referralCode, code)];
  if (onlyActive) conditions.push(eq(sellers.active, true));
  const [seller] = await db
    .select()
    .from(sellers)
    .where(and(...conditions))
    .limit(1);
  return seller ?? null;
}

export async function getSellerByAccessToken(
  accessToken: string,
  onlyActive = true
): Promise<Seller | null> {
  const db = await getDb();
  if (!db) return null;
  const conditions = [
    eq(sellers.accessToken, accessToken.trim()),
    eq(sellers.type, "EXTERNO"),
  ];
  if (onlyActive) conditions.push(eq(sellers.active, true));
  const [seller] = await db
    .select()
    .from(sellers)
    .where(and(...conditions))
    .limit(1);
  return seller ?? null;
}

export async function getSellerByToken(
  referralCode: string,
  accessToken: string,
  onlyActive = true
): Promise<Seller | null> {
  const seller = await getSellerByAccessToken(accessToken, onlyActive);
  if (!seller || seller.referralCode !== normalizeCode(referralCode))
    return null;
  return seller;
}

export async function updateSeller(
  id: number,
  data: {
    name?: string;
    type?: SellerType;
    email?: string | null;
    phone?: string | null;
    contact?: string | null;
    referralCode?: string;
    accessToken?: string | null;
    commissionType?: CommissionType;
    commissionValue?: number;
    commissionRate?: number;
    active?: boolean;
    userId?: number | null;
    status?: SellerStatus;
    parentSellerId?: number | null;
    cpf?: string | null;
    birthDate?: Date | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    zipCode?: string | null;
    pixKey?: string | null;
    documentFrontUrl?: string | null;
    documentBackUrl?: string | null;
    selfiePhotoUrl?: string | null;
    submittedAt?: Date | null;
    reviewedAt?: Date | null;
    reviewedBy?: number | null;
    rejectionReason?: string | null;
  }
): Promise<Seller> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const update: Partial<InsertSeller> = { updatedAt: new Date() };
  if (data.name !== undefined) update.name = data.name.trim();
  if (data.type !== undefined) update.type = data.type;
  if (data.email !== undefined) update.email = data.email?.trim() || null;
  if (data.phone !== undefined) update.phone = data.phone?.trim() || null;
  if (data.contact !== undefined) update.contact = data.contact?.trim() || null;
  if (data.referralCode !== undefined)
    update.referralCode = normalizeCode(data.referralCode);
  if (data.accessToken !== undefined)
    update.accessToken = data.accessToken?.trim() || null;
  if (data.commissionType !== undefined)
    update.commissionType = data.commissionType;
  if (data.commissionValue !== undefined || data.commissionType !== undefined) {
    const commissionType = data.commissionType ?? "PERCENT";
    const commissionValue = Number(data.commissionValue ?? 0);
    validateCommission(commissionType, commissionValue);
    update.commissionValue = commissionValue;
    update.commissionRate =
      commissionType === "PERCENT"
        ? commissionValue
        : Number(data.commissionRate ?? 0);
  } else if (data.commissionRate !== undefined) {
    validateCommission("PERCENT", data.commissionRate);
    update.commissionRate = data.commissionRate;
    update.commissionValue = data.commissionRate;
    update.commissionType = "PERCENT";
  }
  if (data.active !== undefined) {
    update.active = data.active;
    if (data.status === undefined)
      update.status = data.active ? "APROVADO" : "INATIVO";
  }
  if (data.userId !== undefined) update.userId = data.userId;
  if (data.status !== undefined) update.status = data.status;
  if (data.parentSellerId !== undefined)
    update.parentSellerId = data.parentSellerId;
  if (data.cpf !== undefined) update.cpf = data.cpf?.trim() || null;
  if (data.birthDate !== undefined) update.birthDate = data.birthDate;
  if (data.address !== undefined) update.address = data.address?.trim() || null;
  if (data.city !== undefined) update.city = data.city?.trim() || null;
  if (data.state !== undefined)
    update.state = data.state?.trim().toUpperCase() || null;
  if (data.zipCode !== undefined) update.zipCode = data.zipCode?.trim() || null;
  if (data.pixKey !== undefined) update.pixKey = data.pixKey?.trim() || null;
  if (data.documentFrontUrl !== undefined)
    update.documentFrontUrl = data.documentFrontUrl?.trim() || null;
  if (data.documentBackUrl !== undefined)
    update.documentBackUrl = data.documentBackUrl?.trim() || null;
  if (data.selfiePhotoUrl !== undefined)
    update.selfiePhotoUrl = data.selfiePhotoUrl?.trim() || null;
  if (data.submittedAt !== undefined) update.submittedAt = data.submittedAt;
  if (data.reviewedAt !== undefined) update.reviewedAt = data.reviewedAt;
  if (data.reviewedBy !== undefined) update.reviewedBy = data.reviewedBy;
  if (data.rejectionReason !== undefined)
    update.rejectionReason = data.rejectionReason?.trim() || null;
  if (update.type === "INTERNO") update.accessToken = null;
  const [updated] = await db
    .update(sellers)
    .set(update)
    .where(eq(sellers.id, id))
    .returning();
  if (!updated) throw new Error("Vendedor não encontrado");
  return updated;
}

export async function deactivateSeller(id: number): Promise<Seller> {
  return updateSeller(id, { active: false });
}

export async function deleteSeller(id: number): Promise<{ success: true }> {
  return deactivateSeller(id).then(() => ({ success: true }));
}

export async function getExternalCatalog(accessToken: string) {
  const seller = await getSellerByAccessToken(accessToken, true);
  if (!seller)
    throw new Error("Código ou token de vendedor inválido ou inativo");
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const catalog = await db
    .select({
      id: products.id,
      name: products.name,
      category: products.category,
      imageUrl: products.imageUrl,
      shortDescription: products.shortDescription,
      description: products.description,
      suggestedPrice: products.suggestedPrice,
      suggestedPricePix: products.suggestedPricePix,
      suggestedPriceCard: products.suggestedPriceCard,
      suggestedPriceBoleto: products.suggestedPriceBoleto,
      stockQuantity: products.stockQuantity,
    })
    .from(products)
    .where(and(eq(products.active, true), eq(products.published, true)))
    .orderBy(desc(products.updatedAt));
  const { accessToken: _accessToken, ...safeSeller } = seller;
  return { seller: safeSeller, products: catalog };
}

export async function createDirectOrder(data: {
  sellerId?: number;
  referralCode?: string;
  accessToken?: string;
  requestingUserId?: number | null;
  productId: number;
  quantity: number;
  unitPrice: number;
  buyerName: string;
  buyerContact: string;
  buyerContactType: string;
  paymentMethod: "PIX" | "DINHEIRO" | "CARTAO" | "BOLETO";
  markAsPaid: boolean;
  allowBelowCost?: boolean;
}) {
  return dbOrders.createSellerOrder(data);
}

export async function listCommissions(filters?: {
  sellerId?: number;
  status?: CommissionStatus;
}) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (filters?.sellerId)
    conditions.push(eq(commissions.sellerId, filters.sellerId));
  if (filters?.status) conditions.push(eq(commissions.status, filters.status));
  return db
    .select({
      id: commissions.id,
      orderId: commissions.orderId,
      sellerId: commissions.sellerId,
      orderTotal: commissions.orderTotal,
      commissionRate: commissions.commissionRate,
      commissionValue: commissions.commissionValue,
      saleAmount: commissions.saleAmount,
      costAmount: commissions.costAmount,
      commissionAmount: commissions.commissionAmount,
      status: commissions.status,
      paidAt: commissions.paidAt,
      createdAt: commissions.createdAt,
      sellerName: sellers.name,
      referralCode: sellers.referralCode,
    })
    .from(commissions)
    .innerJoin(sellers, eq(commissions.sellerId, sellers.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(commissions.createdAt));
}

export async function markCommissionPaid(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [updated] = await db
    .update(commissions)
    .set({ status: "PAGA", paidAt: new Date(), updatedAt: new Date() })
    .where(eq(commissions.id, id))
    .returning();
  if (!updated) throw new Error("Comissão não encontrada");
  return updated;
}

export async function applyAsSeller(data: {
  name: string;
  email: string;
  phone: string;
  cpf: string;
  birthDate: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  pixKey: string;
  documentFrontUrl: string;
  documentBackUrl?: string;
  selfiePhotoUrl: string;
  sponsorReferralCode?: string;
}): Promise<Seller> {
  const birthDate = new Date(`${data.birthDate}T00:00:00.000Z`);
  if (Number.isNaN(birthDate.getTime()))
    throw new Error("Data de nascimento inválida");

  let parentSellerId: number | null = null;
  if (data.sponsorReferralCode?.trim()) {
    const sponsor = await getSellerByReferralCode(
      data.sponsorReferralCode,
      true
    );
    if (!sponsor) throw new Error("Código do patrocinador inválido ou inativo");
    parentSellerId = sponsor.id;
  }

  return createSeller({
    name: data.name,
    email: data.email,
    phone: data.phone,
    contact: data.phone,
    type: "EXTERNO",
    status: "PENDENTE",
    active: false,
    parentSellerId,
    cpf: data.cpf,
    birthDate,
    address: data.address,
    city: data.city,
    state: data.state,
    zipCode: data.zipCode,
    pixKey: data.pixKey,
    documentFrontUrl: data.documentFrontUrl,
    documentBackUrl: data.documentBackUrl,
    selfiePhotoUrl: data.selfiePhotoUrl,
    submittedAt: new Date(),
  });
}

export async function listPendingSellers(): Promise<Seller[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(sellers)
    .where(eq(sellers.status, "PENDENTE"))
    .orderBy(sellers.submittedAt, sellers.createdAt);
}

export async function approveSeller(
  id: number,
  adminUserId: number
): Promise<Seller> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [updated] = await db
    .update(sellers)
    .set({
      status: "APROVADO",
      active: true,
      reviewedAt: new Date(),
      reviewedBy: adminUserId,
      rejectionReason: null,
      updatedAt: new Date(),
    })
    .where(eq(sellers.id, id))
    .returning();
  if (!updated) throw new Error("Vendedor não encontrado");
  return updated;
}

export async function rejectSeller(
  id: number,
  adminUserId: number,
  reason?: string
): Promise<Seller> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [updated] = await db
    .update(sellers)
    .set({
      status: "REJEITADO",
      active: false,
      reviewedAt: new Date(),
      reviewedBy: adminUserId,
      rejectionReason: reason?.trim() || null,
      updatedAt: new Date(),
    })
    .where(eq(sellers.id, id))
    .returning();
  if (!updated) throw new Error("Vendedor não encontrado");
  return updated;
}

export async function getSellerNetwork(sellerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: sellers.id,
      name: sellers.name,
      status: sellers.status,
      active: sellers.active,
      referralCode: sellers.referralCode,
      createdAt: sellers.createdAt,
      totalCommission: sql<number>`COALESCE(SUM(CASE WHEN ${commissions.status} <> 'CANCELADA' THEN ${commissions.commissionAmount} ELSE 0 END), 0)`,
    })
    .from(sellers)
    .leftJoin(commissions, eq(commissions.sellerId, sellers.id))
    .where(eq(sellers.parentSellerId, sellerId))
    .groupBy(sellers.id)
    .orderBy(desc(sellers.createdAt));
}

export async function getSellerRanking(
  period: "7d" | "30d" | "90d" | "all" = "all"
) {
  const db = await getDb();
  if (!db) return [];
  const periodDays =
    period === "7d" ? 7 : period === "30d" ? 30 : period === "90d" ? 90 : null;
  const since = periodDays
    ? new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000)
    : null;
  const commissionIsValid = sql`${commissions.status} <> 'CANCELADA'`;
  const joinCondition = since
    ? and(
        eq(commissions.sellerId, sellers.id),
        commissionIsValid,
        gte(commissions.createdAt, since)
      )
    : and(eq(commissions.sellerId, sellers.id), commissionIsValid);
  const totalSold = sql<number>`COALESCE(SUM(${commissions.saleAmount}), 0)`;
  const totalCommission = sql<number>`COALESCE(SUM(${commissions.commissionAmount}), 0)`;

  return db
    .select({
      sellerId: sellers.id,
      sellerName: sellers.name,
      type: sellers.type,
      status: sellers.status,
      totalSold,
      totalCommission,
    })
    .from(sellers)
    .leftJoin(commissions, joinCondition)
    .groupBy(sellers.id)
    .orderBy(desc(totalSold), desc(totalCommission), sellers.name);
}
