/**
 * drizzle/schema.ts — PermuPay Vendas
 *
 * CHANGELOG v13:
 * - paymentSettings expandido com campos de Boleto, Fiscal (taxRegime, taxBoleto,
 *   taxDebit, taxCreditCash, taxCreditInstallment), Cartão (cardAnticipationRate,
 *   cardMonthlyRate, cardCustomerPaysInterest) e Descontos Universais
 *   (discountPix, discountCash, discountBoleto, discountDebit, discountCredit).
 * - taxCash travado em 0 no código (PIX isento); não armazena imposto PIX.
 * - Novos tipos exportados: PaymentSetting, InsertPaymentSetting.
 */
import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const roleEnum = pgEnum("permupay_role", ["user", "admin"]);
export const productCategoryEnum = pgEnum("permupay_product_category", [
  "CELULAR",
  "ELETRONICO",
  "PERFUME",
  "OUTRO",
]);
export const taxRegimeEnum = pgEnum("permupay_tax_regime", [
  "SIMPLES_NACIONAL",
  "LUCRO_PRESUMIDO",
  "LUCRO_REAL",
  "MANUAL",
]);
export const marginModeEnum = pgEnum("permupay_margin_mode", [
  "PERCENT",
  "VALUE",
]);
export const batchStatusEnum = pgEnum("permupay_batch_status", [
  "OPEN",
  "CLOSED",
]);

// Enum para status da fila FIFO de estoque
export const queueStatusEnum = pgEnum("permupay_queue_status", [
  "EM_ESPERA", // aguardando — produto ativo ainda tem saldo
  "ATIVO", // sendo vendido agora
  "ESGOTADO", // todas as unidades deste lote vendidas
  "CANCELADO", // cancelado manualmente
]);

// ─── Tabela: users ────────────────────────────────────────────────────────────

export const users = pgTable("permupay_users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("passwordHash").notNull(),
  role: roleEnum("role").default("user").notNull(),
  accountType: text("account_type").default("STAFF").notNull(),
  permissions: jsonb("permissions").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

// ─── Tabela: products ─────────────────────────────────────────────────────────

export const products = pgTable("permupay_products", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),

  // Identidade
  sku: varchar("sku", { length: 80 }),
  unit: varchar("unit", { length: 20 }).notNull().default("UN"),
  salesMultiple: integer("sales_multiple").notNull().default(1),
  b2bEnabled: boolean("b2b_enabled").notNull().default(false),
  name: text("name").notNull(),
  category: productCategoryEnum("category").notNull(),
  ncm: text("ncm"),

  // Custos base
  costPrice: real("cost_price").notNull().default(0),
  packagingCost: real("packaging_cost").notNull().default(0),
  inboundShippingCost: real("inbound_shipping_cost").notNull().default(0),
  operationalCost: real("operational_cost").notNull().default(0),

  // Margem
  desiredMarginRate: real("desired_margin_rate").notNull().default(0),
  desiredMarginValue: real("desired_margin_value").notNull().default(0),
  marginMode: marginModeEnum("margin_mode").notNull().default("PERCENT"),

  // Fiscal (mantidos no produto para compatibilidade com histórico de simulações)
  taxRegime: taxRegimeEnum("tax_regime").notNull().default("SIMPLES_NACIONAL"),
  estimatedTaxRate: real("estimated_tax_rate").notNull().default(0),
  taxCash: real("tax_cash").notNull().default(0), // SEMPRE 0 — PIX isento
  taxBoleto: real("tax_boleto").notNull().default(6),
  taxDebit: real("tax_debit").notNull().default(6),
  taxCreditCash: real("tax_credit_cash").notNull().default(6),
  taxCreditInstallment: real("tax_credit_installment").notNull().default(6),

  // Configuração de Boleto (mantidos no produto para compatibilidade)
  boletoMonths: real("boleto_months").notNull().default(3),
  boletoMonthlyRate: real("boleto_monthly_rate").notNull().default(1.99),
  boletoFixedFee: real("boleto_fixed_fee").notNull().default(3.5),
  boletoDefaultRisk: real("boleto_default_risk").notNull().default(2),
  boletoCustomerPaysInterest: boolean("boleto_customer_pays_interest")
    .notNull()
    .default(false),

  // Configuração de Cartão (mantidos no produto para compatibilidade)
  cardDebitFee: real("card_debit_fee").notNull().default(1.5),
  cardCreditCashFee: real("card_credit_cash_fee").notNull().default(2.5),
  cardCreditInstallmentFee: real("card_credit_installment_fee")
    .notNull()
    .default(3.5),
  cardInstallments: real("card_installments").notNull().default(6),
  cardAnticipationRate: real("card_anticipation_rate").notNull().default(1.5),
  cardMonthlyRate: real("card_monthly_rate").notNull().default(1.99),
  cardCustomerPaysInterest: boolean("card_customer_pays_interest")
    .notNull()
    .default(false),

  // Moeda / câmbio
  costCurrency: text("cost_currency").default("BRL"),
  costPriceUsd: real("cost_price_usd").notNull().default(0),
  usdExchangeRate: real("usd_exchange_rate").notNull().default(0),
  costPriceBrl: real("cost_price_brl").notNull().default(0),

  // Estoque
  stockQuantity: real("stock_quantity").notNull().default(0),
  minimumStock: real("minimum_stock").notNull().default(0),
  averageCostBrl: real("average_cost_brl").notNull().default(0),
  finalUnitCostBrl: real("final_unit_cost_brl").notNull().default(0),

  // Marketplace
  imageUrl: text("image_url"),
  promoTag: text("promo_tag"),
  published: boolean("published").notNull().default(false),

  // Canal de venda / Quase Zero
  salesChannel: text("sales_channel").notNull().default("SHOP"), // SHOP | QUASE_ZERO | BOTH
  productCondition: text("product_condition").notNull().default("NEW"), // NEW | SEMINOVO | USADO | MOSTRUARIO | OPEN_BOX | REEMBALADO
  conditionNotes: text("condition_notes"),
  isUniquePiece: boolean("is_unique_piece").notNull().default(false),

  notes: text("notes"),

  // Catálogo e vitrine
  shortDescription: text("short_description"),
  description: text("description"),

  // Preços sugeridos calculados (salvos para exibição na vitrine)
  suggestedPrice: real("suggested_price").notNull().default(0),
  suggestedPricePix: real("suggested_price_pix").notNull().default(0),
  suggestedPriceCard: real("suggested_price_card").notNull().default(0),
  suggestedPriceBoleto: real("suggested_price_boleto").notNull().default(0),

  // Links de pagamento externos
  paymentPlatform: text("payment_platform").default("MERCADO_PAGO"),
  pixKey: text("pix_key"),
  pixLink: text("pix_link"),
  cardPaymentUrl: text("card_payment_url"),
  boletoUrl: text("boleto_url"),

  // Label customizável de categoria para filtro
  categoryLabel: text("category_label"),

  // Ordenação manual na vitrine (0 = posição não definida, menor = aparece primeiro)
  displayOrder: integer("display_order").notNull().default(0),

  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Tabela: pricing_batches ──────────────────────────────────────────────────

export const pricingBatches = pgTable("permupay_pricing_batches", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, {
    onDelete: "cascade",
  }),
  name: text("name").notNull(),
  description: text("description"),
  totalOperationalCost: real("total_operational_cost").notNull().default(0),
  // Custos adicionais da Entrada de Produtos — nullable/default para não quebrar registros antigos
  totalTaxCost: real("total_tax_cost").notNull().default(0),
  totalOtherCost: real("total_other_cost").notNull().default(0),
  totalCostOfGoods: real("total_cost_of_goods").notNull().default(0),
  status: batchStatusEnum("status").notNull().default("OPEN"),
  // Modo FIFO: true = novos itens entram na fila se produto já tem estoque ativo
  fifoMode: boolean("fifo_mode").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Tabela: batch_items ──────────────────────────────────────────────────────

export const batchItems = pgTable("permupay_batch_items", {
  id: serial("id").primaryKey(),
  batchId: integer("batch_id")
    .notNull()
    .references(() => pricingBatches.id, { onDelete: "cascade" }),
  productId: integer("product_id").references(() => products.id, {
    onDelete: "set null",
  }),
  productName: text("product_name").notNull(),

  // Dados da aquisição — preservam histórico da entrada sem exigir migração dos produtos antigos
  unitCostOriginal: real("unit_cost_original").notNull().default(0),
  costCurrency: text("cost_currency").notNull().default("BRL"),
  exchangeRate: real("exchange_rate").notNull().default(0),
  acquisitionPaymentMethod: text("acquisition_payment_method")
    .notNull()
    .default("OUTRO"),

  unitCostBrl: real("unit_cost_brl").notNull().default(0),
  quantity: integer("quantity").notNull().default(1),
  totalItemCost: real("total_item_cost").notNull().default(0),
  allocatedOperationalCost: real("allocated_operational_cost")
    .notNull()
    .default(0),
  operationalCostPerUnit: real("operational_cost_per_unit")
    .notNull()
    .default(0),
  allocatedTaxCost: real("allocated_tax_cost").notNull().default(0),
  taxCostPerUnit: real("tax_cost_per_unit").notNull().default(0),
  allocatedOtherCost: real("allocated_other_cost").notNull().default(0),
  otherCostPerUnit: real("other_cost_per_unit").notNull().default(0),
  realTotalCost: real("real_total_cost").notNull().default(0),
  finalUnitCost: real("final_unit_cost").notNull().default(0),
  desiredMarginRate: real("desired_margin_rate").notNull().default(0),
  suggestedPrice: real("suggested_price").notNull().default(0),
  // Rastreia se este item foi para fila FIFO ou entrou direto no estoque
  queueStatus: queueStatusEnum("queue_status").default("EM_ESPERA"),
  queueId: integer("queue_id"), // referência lazy para evitar circular
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Tabela: stock_queue (Fila FIFO de estoque por lote) ──────────────────────
//
// REGRAS:
//  - status = EM_ESPERA : produto tem estoque ativo; este lote aguarda
//  - status = ATIVO     : este é o lote corrente sendo vendido
//  - status = ESGOTADO  : quantity_remaining chegou a 0; próximo lote foi promovido
//  - Apenas 1 entrada ATIVA por produto ao mesmo tempo (garantido por trigger)
//  - Promoção (EM_ESPERA → ATIVO) ordena por position ASC, created_at ASC (FIFO puro)
// ─────────────────────────────────────────────────────────────────────────────

export const stockQueue = pgTable("permupay_stock_queue", {
  id: serial("id").primaryKey(),

  productId: integer("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  batchId: integer("batch_id").references(() => pricingBatches.id, {
    onDelete: "set null",
  }),
  batchItemId: integer("batch_item_id"), // lazy ref para batch_items
  userId: integer("user_id").references(() => users.id, {
    onDelete: "set null",
  }),

  // Quantidades
  quantity: real("quantity").notNull().default(0),
  quantityRemaining: real("quantity_remaining").notNull().default(0),

  // Preços deste lote
  unitCost: real("unit_cost").notNull().default(0),
  suggestedPricePix: real("suggested_price_pix").notNull().default(0),
  suggestedPriceCard: real("suggested_price_card").notNull().default(0),
  suggestedPriceBoleto: real("suggested_price_boleto").notNull().default(0),
  desiredMarginRate: real("desired_margin_rate").notNull().default(0),
  estimatedTaxRate: real("estimated_tax_rate").notNull().default(0),

  // Controle FIFO
  status: queueStatusEnum("status").notNull().default("EM_ESPERA"),
  position: integer("position").notNull().default(0), // menor = primeiro a ser promovido
  activatedAt: timestamp("activated_at"),
  exhaustedAt: timestamp("exhausted_at"),

  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Tabela: stock_entries ────────────────────────────────────────────────────

export const stockEntries = pgTable("permupay_stock_entries", {
  id: serial("id").primaryKey(),
  productId: integer("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  batchId: integer("batch_id").references(() => pricingBatches.id, {
    onDelete: "set null",
  }),
  userId: integer("user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  quantity: real("quantity").notNull(),
  unitCost: real("unit_cost").notNull().default(0),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Tabela: pricing_simulations ─────────────────────────────────────────────

export const pricingSimulations = pgTable("permupay_pricing_simulations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  productId: integer("product_id").references(() => products.id),
  name: text("name").notNull(),
  productSnapshot: jsonb("product_snapshot").notNull(),
  taxSnapshot: jsonb("tax_snapshot").notNull(),
  paymentSnapshot: jsonb("payment_snapshot").notNull(),
  resultSnapshot: jsonb("result_snapshot").notNull(),
  bestPaymentMethod: text("best_payment_method").notNull(),
  worstPaymentMethod: text("worst_payment_method").notNull(),
  recommendedPrice: real("recommended_price").notNull(),
  minimumBreakEvenPrice: real("minimum_break_even_price").notNull(),
  promotionFloorPrice: real("promotion_floor_price").notNull(),
  netProfit: real("net_profit").notNull().default(0),
  netMargin: real("net_margin").notNull().default(0),
  desiredMarginRate: real("desired_margin_rate").notNull(),
  diagnosis: text("diagnosis").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Tipos inferidos — core ───────────────────────────────────────────────────

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type SafeUser = Omit<User, "passwordHash">;

export type Product = typeof products.$inferSelect;
export type InsertProduct = typeof products.$inferInsert;

export type PricingBatch = typeof pricingBatches.$inferSelect;
export type InsertPricingBatch = typeof pricingBatches.$inferInsert;

export type BatchItem = typeof batchItems.$inferSelect;
export type InsertBatchItem = typeof batchItems.$inferInsert;

export type StockEntry = typeof stockEntries.$inferSelect;
export type InsertStockEntry = typeof stockEntries.$inferInsert;

export type StockQueue = typeof stockQueue.$inferSelect;
export type InsertStockQueue = typeof stockQueue.$inferInsert;

export type PricingSimulation = typeof pricingSimulations.$inferSelect;

// ─── Enum: wishlist status ────────────────────────────────────────────────────

export const wishlistStatusEnum = pgEnum("permupay_wishlist_status", [
  "NOVO",
  "VISUALIZADO",
  "CONTATADO",
  "ATENDIDO",
  "FECHADO",
]);

// ─── Tabela: wishlist_requests ────────────────────────────────────────────────

export const wishlistRequests = pgTable("permupay_wishlist_requests", {
  id: serial("id").primaryKey(),

  visitorName: text("visitor_name").notNull(),
  contact: text("contact").notNull(),
  contactType: text("contact_type").notNull().default("WHATSAPP"),

  // Campos legados — mantidos para compatibilidade com pedidos antigos
  category: text("category"),
  brand: text("brand"),
  model: text("model"),
  description: text("description").notNull().default(""),

  budgetMin: real("budget_min").notNull().default(0),
  budgetMax: real("budget_max").notNull().default(0),

  // Campos novos v2 — seleção de produtos do catálogo
  productIds: integer("product_ids")
    .array()
    .notNull()
    .default(sql`'{}'::integer[]`),
  phone: text("phone"),
  notesPublic: text("notes_public"),

  status: wishlistStatusEnum("status").notNull().default("NOVO"),
  adminNotes: text("admin_notes"),
  attendedBy: integer("attended_by").references(() => users.id, {
    onDelete: "set null",
  }),

  isAnonymous: boolean("is_anonymous").notNull().default(false),
  ipHash: text("ip_hash"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type WishlistRequest = typeof wishlistRequests.$inferSelect;
export type InsertWishlistRequest = typeof wishlistRequests.$inferInsert;

// ─── Tabela: categories (categorias dinâmicas) ────────────────────────────────

export const categories = pgTable("permupay_categories", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  label: text("label").notNull(),
  emoji: text("emoji").notNull().default("📦"),
  sortOrder: integer("sort_order").notNull().default(0),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Category = typeof categories.$inferSelect;
export type InsertCategory = typeof categories.$inferInsert;

// ─── Tabela: app_settings (configurações globais) ─────────────────────────────

export const appSettings = pgTable("permupay_app_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type AppSetting = typeof appSettings.$inferSelect;
export type InsertAppSetting = typeof appSettings.$inferInsert;

// ─── Tabela: ai_suggestions_cache (agente interno) ────────────────────────────

export const aiSuggestionsCache = pgTable("permupay_ai_suggestions_cache", {
  id: serial("id").primaryKey(),
  inputHash: varchar("input_hash", { length: 64 }).notNull(),
  sourceType: text("source_type").notNull(),
  matchedProductId: integer("matched_product_id").references(
    () => products.id,
    { onDelete: "set null" }
  ),
  suggestion: jsonb("suggestion").notNull(),
  origin: text("origin").notNull(),
  confidence: real("confidence").notNull().default(0),
  hits: integer("hits").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type AiSuggestionCache = typeof aiSuggestionsCache.$inferSelect;
export type InsertAiSuggestionCache = typeof aiSuggestionsCache.$inferInsert;

// ─── Tabela: product_images (galeria de imagens) ──────────────────────────────

export const productImages = pgTable("permupay_product_images", {
  id: serial("id").primaryKey(),
  productId: integer("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  storageKey: text("storage_key"),
  isThumbnail: boolean("is_thumbnail").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  altText: text("alt_text"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ProductImage = typeof productImages.$inferSelect;
export type InsertProductImage = typeof productImages.$inferInsert;

// ─── Tabela: payment_settings (configurações globais de pagamento) ─────────────
//
// REGRAS DE NEGÓCIO INEGOCIÁVEIS:
// 1. taxCash está AUSENTE — PIX é sempre isento de imposto (forçado no código).
// 2. discountPix..discountCredit: descontos universais independentes por forma.
// 3. Esta tabela é a ÚNICA fonte de verdade para taxas; produtos herdam via query.
// ──────────────────────────────────────────────────────────────────────────────

export const paymentSettings = pgTable("permupay_payment_settings", {
  id: serial("id").primaryKey(),

  // ── Fiscal (taxCash = PIX não existe aqui; é sempre 0 no motor) ──────────
  taxRegime: taxRegimeEnum("tax_regime").notNull().default("SIMPLES_NACIONAL"),
  taxBoleto: real("tax_boleto").notNull().default(6),
  taxDebit: real("tax_debit").notNull().default(6),
  taxCreditCash: real("tax_credit_cash").notNull().default(6),
  taxCreditInstallment: real("tax_credit_installment").notNull().default(6),

  // ── Cartão ────────────────────────────────────────────────────────────────
  cardDebitFee: real("card_debit_fee").notNull().default(1.5),
  cardCreditCashFee: real("card_credit_cash_fee").notNull().default(2.5),
  cardCreditInstallmentFee: real("card_credit_installment_fee")
    .notNull()
    .default(3.5),
  cardInstallments: real("card_installments").notNull().default(6),
  cardAnticipationRate: real("card_anticipation_rate").notNull().default(1.5),
  cardMonthlyRate: real("card_monthly_rate").notNull().default(1.99),
  cardCustomerPaysInterest: boolean("card_customer_pays_interest")
    .notNull()
    .default(false),

  // ── Boleto ────────────────────────────────────────────────────────────────
  boletoMonths: real("boleto_months").notNull().default(3),
  boletoMonthlyRate: real("boleto_monthly_rate").notNull().default(1.99),
  boletoFixedFee: real("boleto_fixed_fee").notNull().default(3.5),
  boletoDefaultRisk: real("boleto_default_risk").notNull().default(2),
  boletoCustomerPaysInterest: boolean("boleto_customer_pays_interest")
    .notNull()
    .default(false),

  // ── Descontos Universais (% sobre preço final ao cliente) ─────────────────
  discountPix: real("discount_pix").notNull().default(0),
  discountCash: real("discount_cash").notNull().default(0),
  discountBoleto: real("discount_boleto").notNull().default(0),
  discountDebit: real("discount_debit").notNull().default(0),
  discountCredit: real("discount_credit").notNull().default(0),

  // ── Legado (mantido para compatibilidade até migração total) ──────────────
  cashDiscountPercent: real("cash_discount_percent").notNull().default(0),

  // ── Links e plataforma globais (defaults para novos produtos) ─────────────
  // Produtos podem sobrescrever individualmente; se vazio, usa o global.
  paymentPlatform: text("payment_platform").default("MERCADO_PAGO"),
  pixKey: text("pix_key"),
  pixLink: text("pix_link"),
  cardPaymentUrl: text("card_payment_url"),
  boletoUrl: text("boleto_url"),

  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type PaymentSetting = typeof paymentSettings.$inferSelect;
export type InsertPaymentSetting = typeof paymentSettings.$inferInsert;

// Tabela separada de clientes finais, exportada pelo entrypoint do Drizzle.
export { customers } from "./schema.customers";
export type { Customer, InsertCustomer } from "./schema.customers";
