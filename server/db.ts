import bcrypt from "bcryptjs";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import {
  InsertUser,
  SafeUser,
  User,
  pricingSimulations,
  products,
  users,
} from "../drizzle/schema";
import { orders, orderStatusEnum } from "../drizzle/schema.orders";

let _db: ReturnType<typeof drizzle> | null = null;
let _pool: Pool | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: true } : false,
      });
      _db = drizzle(_pool);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Helpers de usuário ───────────────────────────────────────────────────────

export function toSafeUser(user: User): SafeUser {
  const { passwordHash: _, ...safe } = user;
  return safe;
}

export async function getUserByEmail(email: string): Promise<User | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase().trim()))
    .limit(1);
  return result[0];
}

export async function getUserById(id: number): Promise<User | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  return result[0];
}

export async function createUser(data: {
  email: string;
  name: string;
  password: string;
  role?: "user" | "admin";
  accountType?: "STAFF" | "BUYER";
}): Promise<SafeUser> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const passwordHash = await bcrypt.hash(data.password, 12);
  const insert: InsertUser = {
    email: data.email.toLowerCase().trim(),
    name: data.name.trim(),
    passwordHash,
    role: data.role ?? "user",
    accountType: data.accountType ?? "STAFF",
  };

  const result = await db.insert(users).values(insert).returning();
  return toSafeUser(result[0]);
}

export async function verifyPassword(
  user: User,
  password: string
): Promise<boolean> {
  return bcrypt.compare(password, user.passwordHash);
}

export async function updateLastSignedIn(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(users)
    .set({ lastSignedIn: new Date(), updatedAt: new Date() })
    .where(eq(users.id, id));
}

export async function countUsers(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select().from(users);
  return result.length;
}

// ─── Helpers de cálculo de custo ──────────────────────────────────────────────

function calculateCostPriceBrl(data: any): number {
  if (data.costCurrency === "USD") {
    if (!data.usdExchangeRate || data.usdExchangeRate <= 0) {
      throw new Error("Cotação do dólar deve ser maior que zero para moeda USD");
    }
    return Number(data.costPriceUsd || 0) * Number(data.usdExchangeRate || 0);
  }
  return Number(data.costPrice || 0);
}

function calculateFinalUnitCost(costPriceBrl: number, data: any): number {
  return (
    costPriceBrl +
    Number(data.packagingCost || 0) +
    Number(data.inboundShippingCost || 0) +
    Number(data.operationalCost || 0)
  );
}

function normalizeSalesChannel(value: unknown): "SHOP" | "QUASE_ZERO" | "BOTH" {
  const v = String(value ?? "SHOP").toUpperCase();
  if (v === "QUASE_ZERO" || v === "BOTH" || v === "SHOP") return v as any;
  return "SHOP";
}

function normalizeProductCondition(value: unknown): "NEW" | "SEMINOVO" | "USADO" | "MOSTRUARIO" | "OPEN_BOX" | "REEMBALADO" {
  const v = String(value ?? "NEW").toUpperCase();
  if (["NEW", "SEMINOVO", "USADO", "MOSTRUARIO", "OPEN_BOX", "REEMBALADO"].includes(v)) return v as any;
  return "NEW";
}

// ─── Funções de Produtos ──────────────────────────────────────────────────────

export async function listProducts(_userId?: number) {
  const db = await getDb();
  if (!db) return [];
  try {
    return await db
      .select()
      .from(products)
      .orderBy(asc(products.displayOrder), desc(products.createdAt));
  } catch (error) {
    console.error("[DB] Erro ao listar produtos:", error);
    return [];
  }
}

export async function listProductsToPublish(_userId?: number) {
  const all = await listProducts(_userId);

  return (all as any[])
    .filter((p) => {
      const hasStock = Number(p.stockQuantity ?? 0) > 0;
      const hasRealCost = Number(p.finalUnitCostBrl ?? p.averageCostBrl ?? 0) > 0;

      return p.active !== false && p.published !== true && hasStock && hasRealCost;
    })
    .sort((a, b) => {
      const aDate = new Date(a.updatedAt ?? a.createdAt ?? 0).getTime();
      const bDate = new Date(b.updatedAt ?? b.createdAt ?? 0).getTime();
      return bDate - aDate;
    });
}


export async function getProductById(id: number, _userId?: number) {
  const db = await getDb();
  if (!db) return undefined;
  try {
    const r = await db
      .select()
      .from(products)
      .where(eq(products.id, id))
      .limit(1);
    return r[0];
  } catch (error) {
    console.error("[DB] Erro ao buscar produto:", error);
    return undefined;
  }
}

export type ProductCostContext = {
  source: "ACTIVE_QUEUE" | "LATEST_ENTRY" | "LEGACY";
  productId: number;
  batchId: number | null;
  batchItemId: number | null;
  queueId: number | null;
  quantityAvailable: number;
  unitCostOriginal: number;
  costCurrency: "BRL" | "USD";
  exchangeRate: number;
  unitCostBrl: number;
  operationalCostPerUnit: number;
  taxCostPerUnit: number;
  otherCostPerUnit: number;
  realUnitCost: number;
  realTotalCost: number;
  suggestedPrice: number;
  warning?: string;
};

function asNumber(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function normalizeCostCurrency(value: unknown): "BRL" | "USD" {
  return String(value ?? "BRL").toUpperCase() === "USD" ? "USD" : "BRL";
}

export async function getProductCostContext(
  productId: number,
  _userId?: number,
): Promise<ProductCostContext | null> {
  const db = await getDb();
  if (!db) return null;

  const productResult = (await db.execute(sql`
    SELECT
      id,
      cost_price,
      cost_price_brl,
      cost_price_usd,
      usd_exchange_rate,
      cost_currency,
      operational_cost,
      stock_quantity,
      average_cost_brl,
      final_unit_cost_brl,
      suggested_price,
      suggested_price_pix
    FROM permupay_products
    WHERE id = ${productId}
    LIMIT 1
  `)) as any;

  const product = productResult?.rows?.[0];
  if (!product) return null;

  const activeResult = (await db.execute(sql`
    SELECT
      q.id AS queue_id,
      q.batch_id,
      q.quantity_remaining,
      bi.id AS batch_item_id,
      bi.unit_cost_original,
      bi.cost_currency,
      bi.exchange_rate,
      bi.unit_cost_brl,
      bi.quantity,
      bi.operational_cost_per_unit,
      bi.tax_cost_per_unit,
      bi.other_cost_per_unit,
      bi.real_total_cost,
      bi.final_unit_cost,
      bi.suggested_price
    FROM permupay_stock_queue q
    LEFT JOIN permupay_batch_items bi
      ON bi.queue_id = q.id
      OR (bi.batch_id = q.batch_id AND bi.product_id = q.product_id)
    WHERE q.product_id = ${productId}
      AND q.status = 'ATIVO'
      AND q.quantity_remaining > 0
    ORDER BY q.activated_at DESC NULLS LAST, q.created_at DESC, bi.id DESC
    LIMIT 1
  `)) as any;

  const active = activeResult?.rows?.[0];
  if (active?.batch_item_id) {
    const realUnitCost = asNumber(active.final_unit_cost);
    const quantityAvailable = asNumber(active.quantity_remaining);
    return {
      source: "ACTIVE_QUEUE",
      productId,
      batchId: active.batch_id != null ? Number(active.batch_id) : null,
      batchItemId: active.batch_item_id != null ? Number(active.batch_item_id) : null,
      queueId: active.queue_id != null ? Number(active.queue_id) : null,
      quantityAvailable,
      unitCostOriginal: asNumber(active.unit_cost_original),
      costCurrency: normalizeCostCurrency(active.cost_currency),
      exchangeRate: asNumber(active.exchange_rate),
      unitCostBrl: asNumber(active.unit_cost_brl),
      operationalCostPerUnit: asNumber(active.operational_cost_per_unit),
      taxCostPerUnit: asNumber(active.tax_cost_per_unit),
      otherCostPerUnit: asNumber(active.other_cost_per_unit),
      realUnitCost,
      realTotalCost: asNumber(active.real_total_cost) || realUnitCost * quantityAvailable,
      suggestedPrice: asNumber(active.suggested_price) || asNumber(product.suggested_price_pix) || asNumber(product.suggested_price),
    };
  }

  const latestResult = (await db.execute(sql`
    SELECT
      bi.id AS batch_item_id,
      bi.batch_id,
      bi.queue_id,
      bi.unit_cost_original,
      bi.cost_currency,
      bi.exchange_rate,
      bi.unit_cost_brl,
      bi.quantity,
      bi.operational_cost_per_unit,
      bi.tax_cost_per_unit,
      bi.other_cost_per_unit,
      bi.real_total_cost,
      bi.final_unit_cost,
      bi.suggested_price
    FROM permupay_batch_items bi
    LEFT JOIN permupay_pricing_batches b ON b.id = bi.batch_id
    WHERE bi.product_id = ${productId}
    ORDER BY bi.created_at DESC, bi.id DESC
    LIMIT 1
  `)) as any;

  const latest = latestResult?.rows?.[0];
  if (latest?.batch_item_id) {
    const realUnitCost = asNumber(latest.final_unit_cost);
    const quantity = asNumber(latest.quantity);
    return {
      source: "LATEST_ENTRY",
      productId,
      batchId: latest.batch_id != null ? Number(latest.batch_id) : null,
      batchItemId: latest.batch_item_id != null ? Number(latest.batch_item_id) : null,
      queueId: latest.queue_id != null ? Number(latest.queue_id) : null,
      quantityAvailable: asNumber(product.stock_quantity) || quantity,
      unitCostOriginal: asNumber(latest.unit_cost_original),
      costCurrency: normalizeCostCurrency(latest.cost_currency),
      exchangeRate: asNumber(latest.exchange_rate),
      unitCostBrl: asNumber(latest.unit_cost_brl),
      operationalCostPerUnit: asNumber(latest.operational_cost_per_unit),
      taxCostPerUnit: asNumber(latest.tax_cost_per_unit),
      otherCostPerUnit: asNumber(latest.other_cost_per_unit),
      realUnitCost,
      realTotalCost: asNumber(latest.real_total_cost) || realUnitCost * quantity,
      suggestedPrice: asNumber(latest.suggested_price) || asNumber(product.suggested_price_pix) || asNumber(product.suggested_price),
    };
  }

  const legacyBase =
    asNumber(product.final_unit_cost_brl) ||
    asNumber(product.average_cost_brl) ||
    asNumber(product.cost_price_brl) ||
    asNumber(product.cost_price);
  const legacyOperational = asNumber(product.operational_cost);
  const realUnitCost = legacyBase + legacyOperational;
  const quantityAvailable = asNumber(product.stock_quantity);

  return {
    source: "LEGACY",
    productId,
    batchId: null,
    batchItemId: null,
    queueId: null,
    quantityAvailable,
    unitCostOriginal: asNumber(product.cost_price_usd) || legacyBase,
    costCurrency: normalizeCostCurrency(product.cost_currency),
    exchangeRate: asNumber(product.usd_exchange_rate),
    unitCostBrl: legacyBase,
    operationalCostPerUnit: legacyOperational,
    taxCostPerUnit: 0,
    otherCostPerUnit: 0,
    realUnitCost,
    realTotalCost: realUnitCost * quantityAvailable,
    suggestedPrice: asNumber(product.suggested_price_pix) || asNumber(product.suggested_price),
    warning: "Produto legado sem entrada/lote vinculado. O custo exibido vem do cadastro antigo.",
  };
}

export async function createProduct(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  try {
    if (!data.name || !data.category) {
      throw new Error("Nome e categoria são obrigatórios");
    }

    const costCurrency = data.costCurrency || "BRL";
    if (!["BRL", "USD"].includes(costCurrency)) {
      throw new Error("Moeda deve ser BRL ou USD");
    }

    if (costCurrency === "USD") {
      const exchangeRate = Number(data.usdExchangeRate || 0);
      if (exchangeRate <= 0) {
        throw new Error("Cotação do dólar deve ser maior que zero para moeda USD");
      }
    }

    const costPriceUsd = Number(data.costPriceUsd || 0);
    const usdExchangeRate = Number(data.usdExchangeRate || 0);
    const stockQuantity = Number(data.stockQuantity || 0);
    const minimumStock = Number(data.minimumStock || 0);

    if (costPriceUsd < 0) throw new Error("Preço em dólar não pode ser negativo");
    if (usdExchangeRate < 0) throw new Error("Cotação do dólar não pode ser negativa");
    if (stockQuantity < 0) throw new Error("Estoque não pode ser negativo");
    if (minimumStock < 0) throw new Error("Estoque mínimo não pode ser negativo");

    const costPriceBrl = calculateCostPriceBrl({ ...data, costCurrency });
    const finalUnitCostBrl = calculateFinalUnitCost(costPriceBrl, data);

    // Herdar links globais de pagamento se o produto não tiver links próprios
    let inheritedPix: string | null = null;
    let inheritedPixLink: string | null = null;
    let inheritedCard: string | null = null;
    let inheritedBoleto: string | null = null;
    try {
      const { getPaymentSettings } = await import("./db.payment-settings");
      const gs = await getPaymentSettings();
      inheritedPix      = gs.pixKey      ?? null;
      inheritedPixLink  = gs.pixLink     ?? null;
      inheritedCard     = gs.cardPaymentUrl ?? null;
      inheritedBoleto   = gs.boletoUrl   ?? null;
    } catch { /* fallback silencioso — não bloqueia criação */ }

    const productData = {
      name: String(data.name).trim(),
      category: data.category,
      ncm: data.ncm ? String(data.ncm).trim() : null,
      costPrice: Math.max(0, Number(data.costPrice) || 0),
      packagingCost: Math.max(0, Number(data.packagingCost) || 0),
      inboundShippingCost: Math.max(0, Number(data.inboundShippingCost) || 0),
      operationalCost: Math.max(0, Number(data.operationalCost) || 0),
      desiredMarginRate: Math.max(0, Number(data.desiredMarginRate) || 0),
      taxRegime: data.taxRegime || "SIMPLES_NACIONAL",
      estimatedTaxRate: Math.max(0, Number(data.estimatedTaxRate) || 0),
      notes: data.notes ? String(data.notes).trim() : null,
      userId: data.userId ? Number(data.userId) : null,
      active: data.active !== false,
      costCurrency,
      costPriceUsd,
      usdExchangeRate,
      costPriceBrl,
      stockQuantity,
      minimumStock,
      averageCostBrl: costPriceBrl,
      finalUnitCostBrl,
      shortDescription: data.shortDescription ? String(data.shortDescription).trim() : null,
      description: data.description ? String(data.description).trim() : null,
      categoryLabel: data.categoryLabel ? String(data.categoryLabel).trim() : null,
      promoTag: data.promoTag ? String(data.promoTag).trim() : null,
      published: data.published === true,
      suggestedPrice: Math.max(0, Number(data.suggestedPrice) || 0),
      suggestedPricePix: Math.max(0, Number(data.suggestedPricePix) || 0),
      suggestedPriceCard: Math.max(0, Number(data.suggestedPriceCard) || 0),
      suggestedPriceBoleto: Math.max(0, Number(data.suggestedPriceBoleto) || 0),
      paymentPlatform: data.paymentPlatform || "MERCADO_PAGO",
      // Links de pagamento: usa os do produto se informados, senão herda os globais
      pixKey:        data.pixKey        ? String(data.pixKey).trim()        : inheritedPix,
      pixLink:       data.pixLink       ? String(data.pixLink).trim()       : inheritedPixLink,
      cardPaymentUrl: data.cardPaymentUrl ? String(data.cardPaymentUrl).trim() : inheritedCard,
      boletoUrl:     data.boletoUrl     ? String(data.boletoUrl).trim()     : inheritedBoleto,
      desiredMarginValue: Math.max(0, Number(data.desiredMarginValue) || 0),
      marginMode: data.marginMode || "PERCENT",
      taxCash: Math.max(0, Number(data.taxCash) || 6),
      taxBoleto: Math.max(0, Number(data.taxBoleto) || 6),
      taxDebit: Math.max(0, Number(data.taxDebit) || 6),
      taxCreditCash: Math.max(0, Number(data.taxCreditCash) || 6),
      taxCreditInstallment: Math.max(0, Number(data.taxCreditInstallment) || 6),
      boletoMonths: Math.max(1, Number(data.boletoMonths) || 3),
      boletoMonthlyRate: Math.max(0, Number(data.boletoMonthlyRate) || 1.99),
      boletoFixedFee: Math.max(0, Number(data.boletoFixedFee) || 3.5),
      boletoDefaultRisk: Math.max(0, Number(data.boletoDefaultRisk) || 2),
      boletoCustomerPaysInterest: data.boletoCustomerPaysInterest === true,
      cardDebitFee: Math.max(0, Number(data.cardDebitFee) || 1.5),
      cardCreditCashFee: Math.max(0, Number(data.cardCreditCashFee) || 2.5),
      cardCreditInstallmentFee: Math.max(0, Number(data.cardCreditInstallmentFee) || 3.5),
      cardInstallments: Math.max(1, Number(data.cardInstallments) || 6),
      cardAnticipationRate: Math.max(0, Number(data.cardAnticipationRate) || 1.5),
      cardMonthlyRate: Math.max(0, Number(data.cardMonthlyRate) || 1.99),
      cardCustomerPaysInterest: data.cardCustomerPaysInterest === true,
      salesChannel: normalizeSalesChannel(data.salesChannel),
      productCondition: normalizeProductCondition(data.productCondition),
      conditionNotes: data.conditionNotes ? String(data.conditionNotes).trim() : null,
      isUniquePiece: data.isUniquePiece === true,
    };

    const [r] = await db.insert(products).values(productData).returning();
    return r;
  } catch (error) {
    console.error("[DB] Erro ao criar produto:", error);
    throw error;
  }
}

export async function updateProduct(id: number, data: any, _userId?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  try {
    const updateData: any = { updatedAt: new Date() };

    if (data.costCurrency !== undefined) {
      if (!["BRL", "USD"].includes(data.costCurrency)) {
        throw new Error("Moeda deve ser BRL ou USD");
      }
      updateData.costCurrency = data.costCurrency;
    }
    if (data.usdExchangeRate !== undefined) {
      const v = Number(data.usdExchangeRate || 0);
      if (v < 0) throw new Error("Cotação do dólar não pode ser negativa");
      updateData.usdExchangeRate = v;
    }
    if (data.costPriceUsd !== undefined) {
      const v = Number(data.costPriceUsd || 0);
      if (v < 0) throw new Error("Preço em dólar não pode ser negativo");
      updateData.costPriceUsd = v;
    }
    if (data.stockQuantity !== undefined) {
      const v = Number(data.stockQuantity || 0);
      if (v < 0) throw new Error("Estoque não pode ser negativo");
      updateData.stockQuantity = v;
    }
    if (data.minimumStock !== undefined) {
      const v = Number(data.minimumStock || 0);
      if (v < 0) throw new Error("Estoque mínimo não pode ser negativo");
      updateData.minimumStock = v;
    }

    if (data.name !== undefined) updateData.name = String(data.name).trim();
    if (data.category !== undefined) updateData.category = data.category;
    if (data.ncm !== undefined) updateData.ncm = data.ncm ? String(data.ncm).trim() : null;
    if (data.costPrice !== undefined) updateData.costPrice = Number(data.costPrice) || 0;
    if (data.packagingCost !== undefined) updateData.packagingCost = Number(data.packagingCost) || 0;
    if (data.inboundShippingCost !== undefined) updateData.inboundShippingCost = Number(data.inboundShippingCost) || 0;
    if (data.operationalCost !== undefined) updateData.operationalCost = Number(data.operationalCost) || 0;
    if (data.desiredMarginRate !== undefined) updateData.desiredMarginRate = Number(data.desiredMarginRate) || 0;
    if (data.taxRegime !== undefined) updateData.taxRegime = data.taxRegime;
    if (data.estimatedTaxRate !== undefined) updateData.estimatedTaxRate = Number(data.estimatedTaxRate) || 0;
    if (data.notes !== undefined) updateData.notes = data.notes ? String(data.notes).trim() : null;
    if (data.active !== undefined) updateData.active = data.active;
    if (data.shortDescription !== undefined) updateData.shortDescription = data.shortDescription ? String(data.shortDescription).trim() : null;
    if (data.description !== undefined) updateData.description = data.description ? String(data.description).trim() : null;
    if (data.categoryLabel !== undefined) updateData.categoryLabel = data.categoryLabel ? String(data.categoryLabel).trim() : null;
    if (data.promoTag !== undefined) updateData.promoTag = data.promoTag ? String(data.promoTag).trim() : null;
    if (data.salesChannel !== undefined) updateData.salesChannel = normalizeSalesChannel(data.salesChannel);
    if (data.productCondition !== undefined) updateData.productCondition = normalizeProductCondition(data.productCondition);
    if (data.conditionNotes !== undefined) updateData.conditionNotes = data.conditionNotes ? String(data.conditionNotes).trim() : null;
    if (data.isUniquePiece !== undefined) updateData.isUniquePiece = data.isUniquePiece === true;
    if (data.published !== undefined) updateData.published = data.published === true;
    if (data.suggestedPrice !== undefined) updateData.suggestedPrice = Math.max(0, Number(data.suggestedPrice) || 0);
    if (data.suggestedPricePix !== undefined) updateData.suggestedPricePix = Math.max(0, Number(data.suggestedPricePix) || 0);
    if (data.suggestedPriceCard !== undefined) updateData.suggestedPriceCard = Math.max(0, Number(data.suggestedPriceCard) || 0);
    if (data.suggestedPriceBoleto !== undefined) updateData.suggestedPriceBoleto = Math.max(0, Number(data.suggestedPriceBoleto) || 0);
    if (data.paymentPlatform !== undefined) updateData.paymentPlatform = data.paymentPlatform || "MERCADO_PAGO";
    if (data.pixKey !== undefined) updateData.pixKey = data.pixKey ? String(data.pixKey).trim() : null;
    if (data.pixLink !== undefined) updateData.pixLink = data.pixLink ? String(data.pixLink).trim() : null;
    if (data.cardPaymentUrl !== undefined) updateData.cardPaymentUrl = data.cardPaymentUrl ? String(data.cardPaymentUrl).trim() : null;
    if (data.boletoUrl !== undefined) updateData.boletoUrl = data.boletoUrl ? String(data.boletoUrl).trim() : null;
    if (data.desiredMarginValue !== undefined) updateData.desiredMarginValue = Math.max(0, Number(data.desiredMarginValue) || 0);
    if (data.marginMode !== undefined) updateData.marginMode = data.marginMode || "PERCENT";
    if (data.taxCash !== undefined) updateData.taxCash = Math.max(0, Number(data.taxCash) || 6);
    if (data.taxBoleto !== undefined) updateData.taxBoleto = Math.max(0, Number(data.taxBoleto) || 6);
    if (data.taxDebit !== undefined) updateData.taxDebit = Math.max(0, Number(data.taxDebit) || 6);
    if (data.taxCreditCash !== undefined) updateData.taxCreditCash = Math.max(0, Number(data.taxCreditCash) || 6);
    if (data.taxCreditInstallment !== undefined) updateData.taxCreditInstallment = Math.max(0, Number(data.taxCreditInstallment) || 6);
    if (data.boletoMonths !== undefined) updateData.boletoMonths = Math.max(1, Number(data.boletoMonths) || 3);
    if (data.boletoMonthlyRate !== undefined) updateData.boletoMonthlyRate = Math.max(0, Number(data.boletoMonthlyRate) || 1.99);
    if (data.boletoFixedFee !== undefined) updateData.boletoFixedFee = Math.max(0, Number(data.boletoFixedFee) || 3.5);
    if (data.boletoDefaultRisk !== undefined) updateData.boletoDefaultRisk = Math.max(0, Number(data.boletoDefaultRisk) || 2);
    if (data.boletoCustomerPaysInterest !== undefined) updateData.boletoCustomerPaysInterest = data.boletoCustomerPaysInterest === true;
    if (data.cardDebitFee !== undefined) updateData.cardDebitFee = Math.max(0, Number(data.cardDebitFee) || 1.5);
    if (data.cardCreditCashFee !== undefined) updateData.cardCreditCashFee = Math.max(0, Number(data.cardCreditCashFee) || 2.5);
    if (data.cardCreditInstallmentFee !== undefined) updateData.cardCreditInstallmentFee = Math.max(0, Number(data.cardCreditInstallmentFee) || 3.5);
    if (data.cardInstallments !== undefined) updateData.cardInstallments = Math.max(1, Number(data.cardInstallments) || 6);
    if (data.cardAnticipationRate !== undefined) updateData.cardAnticipationRate = Math.max(0, Number(data.cardAnticipationRate) || 1.5);
    if (data.cardMonthlyRate !== undefined) updateData.cardMonthlyRate = Math.max(0, Number(data.cardMonthlyRate) || 1.99);
    if (data.cardCustomerPaysInterest !== undefined) updateData.cardCustomerPaysInterest = data.cardCustomerPaysInterest === true;

    if (
      data.costCurrency !== undefined ||
      data.costPrice !== undefined ||
      data.costPriceUsd !== undefined ||
      data.usdExchangeRate !== undefined ||
      data.packagingCost !== undefined ||
      data.inboundShippingCost !== undefined ||
      data.operationalCost !== undefined
    ) {
      const current = await getProductById(id);
      if (current) {
        const mergedData = { ...current, ...updateData };
        const costPriceBrl = calculateCostPriceBrl(mergedData);
        const finalUnitCostBrl = calculateFinalUnitCost(costPriceBrl, mergedData);
        updateData.costPriceBrl = costPriceBrl;
        updateData.averageCostBrl = costPriceBrl;
        updateData.finalUnitCostBrl = finalUnitCostBrl;
      }
    }

    const [r] = await db
      .update(products)
      .set(updateData)
      .where(eq(products.id, id))
      .returning();
    return r;
  } catch (error) {
    console.error("[DB] Erro ao atualizar produto:", error);
    throw error;
  }
}

export async function deactivateProduct(id: number, _userId?: number) {
  return updateProduct(id, { active: false });
}

export async function deleteProduct(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  try {
    // 1. Desvincula simulações de precificação (productId sem onDelete no schema)
    await db
      .update(pricingSimulations)
      .set({ productId: null })
      .where(eq(pricingSimulations.productId, id));

    // 2. Cancela pedidos ativos vinculados ao produto.
    //    A migration 0022 remove a FK RESTRICT de permupay_orders.product_id,
    //    mas cancelamos pedidos pendentes por integridade de negócio.
    //    Pedidos já finalizados (PAGO/CANCELADO/EXPIRADO) são preservados.
    await db
      .update(orders)
      .set({ status: "CANCELADO" as const, cancelledAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(orders.productId, id),
          sql`${orders.status} IN ('AGUARDANDO_PAGAMENTO', 'RESERVADO')`
        )
      );

    // 3. Deleta o produto
    await db.delete(products).where(eq(products.id, id));
  } catch (error) {
    console.error("[DB] Erro ao deletar produto:", error);
    throw error;
  }
}

export async function duplicateProduct(id: number, _userId?: number) {
  const p = await getProductById(id);
  if (!p) throw new Error("Produto não encontrado");
  const { id: _, createdAt, updatedAt, ...rest } = p as any;
  return createProduct({ ...rest, name: `${p.name} (Cópia)` });
}

// ─── Funções de Simulações ────────────────────────────────────────────────────

export async function createSimulation(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  try {
    if (!data.name) throw new Error("Nome da simulação é obrigatório");

    const simulationData = {
      name: String(data.name).trim(),
      productSnapshot: data.productSnapshot || {},
      taxSnapshot: data.taxSnapshot || {},
      paymentSnapshot: data.paymentSnapshot || {},
      resultSnapshot: data.resultSnapshot || {},
      bestPaymentMethod: String(data.bestPaymentMethod || "PIX"),
      worstPaymentMethod: String(data.worstPaymentMethod || "PIX"),
      recommendedPrice: Number(data.recommendedPrice) || 0,
      minimumBreakEvenPrice: Number(data.minimumBreakEvenPrice) || 0,
      promotionFloorPrice: Number(data.promotionFloorPrice) || 0,
      desiredMarginRate: Math.max(0, Number(data.desiredMarginRate) || 0),
      diagnosis: String(data.diagnosis || "SAUDAVEL"),
      notes: data.notes ? String(data.notes).trim() : null,
      userId: data.userId ? Number(data.userId) : null,
      productId: data.productId ? Number(data.productId) : null,
    };

    const [r] = await db.insert(pricingSimulations).values(simulationData).returning();
    return r;
  } catch (error) {
    console.error("[DB] Erro ao criar simulação:", error);
    throw error;
  }
}

export async function listSimulations(_userId?: number) {
  const db = await getDb();
  if (!db) return [];
  try {
    return await db
      .select()
      .from(pricingSimulations)
      .orderBy(desc(pricingSimulations.createdAt));
  } catch (error) {
    console.error("[DB] Erro ao listar simulações:", error);
    return [];
  }
}

export async function getSimulationById(id: number, _userId?: number) {
  const db = await getDb();
  if (!db) return undefined;
  try {
    const r = await db
      .select()
      .from(pricingSimulations)
      .where(eq(pricingSimulations.id, id))
      .limit(1);
    return r[0];
  } catch (error) {
    console.error("[DB] Erro ao buscar simulação:", error);
    return undefined;
  }
}

export async function deleteSimulation(id: number, _userId?: number) {
  const db = await getDb();
  if (!db) return;
  try {
    await db
      .delete(pricingSimulations)
      .where(eq(pricingSimulations.id, id));
  } catch (error) {
    console.error("[DB] Erro ao deletar simulação:", error);
    throw error;
  }
}

export async function duplicateSimulation(id: number, _userId?: number) {
  const s = await getSimulationById(id);
  if (!s) throw new Error("Simulação não encontrada");
  const { id: _, createdAt, updatedAt, ...rest } = s as any;
  return createSimulation({ ...rest, name: `${s.name} (Cópia)` });
}

// ─── Funções de Usuários ──────────────────────────────────────────────────────

export async function updateUserAdmin(
  userId: number,
  data: {
    name: string;
    email: string;
    role: "user" | "admin";
    active: boolean;
    newPassword?: string;
  }
): Promise<SafeUser> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existingEmail = await getUserByEmail(data.email);
  if (existingEmail && existingEmail.id !== userId) {
    throw new Error("Email já cadastrado por outro usuário");
  }

  const patch: any = {
    name: data.name.trim(),
    email: data.email.toLowerCase().trim(),
    role: data.role,
    active: data.active,
    updatedAt: new Date(),
  };

  if (data.newPassword && data.newPassword.trim()) {
    patch.passwordHash = await bcrypt.hash(data.newPassword.trim(), 12);
  }

  const [updated] = await db
    .update(users)
    .set(patch)
    .where(eq(users.id, userId))
    .returning();

  if (!updated) throw new Error("Usuário não encontrado");
  return toSafeUser(updated);
}

export async function deleteUser(userId: number, currentUserId: number) {
  if (userId === currentUserId) throw new Error("Não é possível remover sua própria conta");
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  try {
    // Evita erro de chave estrangeira em produtos/simulações antigas.
    await db.update(products).set({ userId: null as any, updatedAt: new Date() } as any).where(eq(products.userId, userId));
    await db.update(pricingSimulations).set({ userId: null as any, updatedAt: new Date() } as any).where(eq(pricingSimulations.userId, userId));
    await db.execute(sql`UPDATE permupay_stock_entries SET user_id = NULL WHERE user_id = ${userId}`);
    await db.execute(sql`UPDATE permupay_pricing_batches SET user_id = NULL WHERE user_id = ${userId}`);
    await db.execute(sql`UPDATE permupay_orders SET confirmed_by = NULL WHERE confirmed_by = ${userId}`);
    await db.delete(users).where(eq(users.id, userId));
    return { success: true as const };
  } catch (error) {
    console.error("[DB] Erro ao deletar usuário:", error);
    throw error;
  }
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export async function getDashboardData(_userId?: number) {
  try {
    const [prods, sims] = await Promise.all([
      listProducts(),
      listSimulations(),
    ]);

    let orderCounts = {
      aguardando: 0,
      pagos: 0,
      cancelados: 0,
      expirados: 0,
      faturamento: 0,
      ticketMedio: 0,
    };
    try {
      const { getOrderCounts } = await import("./db.orders");
      orderCounts = await getOrderCounts();
    } catch {
      // tabela ainda não existe — ignora
    }

    return {
      totalProducts: prods.length,
      activeProducts: prods.filter((p: any) => p.active).length,
      totalSimulations: sims.length,
      lastSimulation: sims[0] ?? null,
      attentionCount: sims.filter((s: any) =>
        ["RISCO", "ATENCAO", "PREJUIZO"].includes(s.diagnosis)
      ).length,
      healthyCount: sims.filter((s: any) =>
        ["SAUDAVEL", "EXCELENTE"].includes(s.diagnosis)
      ).length,
      recentSimulations: sims.slice(0, 5),
      ordersAguardando: orderCounts.aguardando,
      ordersPagos: orderCounts.pagos,
      ordersCancelados: orderCounts.cancelados,
      faturamentoConfirmado: orderCounts.faturamento,
      ticketMedio: orderCounts.ticketMedio,
    };
  } catch (err) {
    console.error("[DB] getDashboardData error:", err);
    return {
      totalProducts: 0,
      activeProducts: 0,
      totalSimulations: 0,
      lastSimulation: null,
      attentionCount: 0,
      healthyCount: 0,
      recentSimulations: [],
      ordersAguardando: 0,
      ordersPagos: 0,
      ordersCancelados: 0,
      faturamentoConfirmado: 0,
      ticketMedio: 0,
    };
  }
}

// ─── Próximo ID de Produto ────────────────────────────────────────────────────

export async function getNextProductId(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  try {
    // Consulta o próximo valor da sequência do Postgres sem consumi-lo
    const result = await db.execute(
      "SELECT last_value + 1 AS next_id FROM permupay_products_id_seq" as any
    );
    const rows = (result as any).rows ?? result;
    const row = rows?.[0];
    const nextId = Number(row?.next_id ?? 0);
    if (nextId > 0) return nextId;
    throw new Error("sequence not found");
  } catch {
    // Fallback: busca o maior ID atual + 1
    try {
      const last = await db.select({ id: products.id }).from(products).orderBy(desc(products.id)).limit(1);
      return (last[0]?.id ?? 0) + 1;
    } catch {
      return 0;
    }
  }
}

// ─── Reordenação de Produtos ──────────────────────────────────────────────────

export async function reorderProducts(orderedIds: number[]) {
  const db = await getDb();
  if (!db) return;
  try {
    await db.transaction(async (tx) => {
      for (let i = 0; i < orderedIds.length; i++) {
        await tx
          .update(products)
          .set({ displayOrder: i + 1 })
          .where(eq(products.id, orderedIds[i]));
      }
    });
  } catch (error) {
    console.error("[DB] Erro ao reordenar produtos:", error);
    throw error;
  }
}
