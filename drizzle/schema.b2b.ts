// Schema Drizzle do módulo B2B do Ideal Prime.
//
// IMPORTANTE: `server/db.b2b.ts` NÃO usa Drizzle — ele fala diretamente com um
// `pg.Pool` via SQL manual. Este arquivo existe apenas para que `drizzle-kit`
// (cujo `schema` glob em drizzle.config.ts é `./drizzle/schema*.ts`) enxergue a
// estrutura real do banco e não proponha `DROP TABLE`/`DROP COLUMN` destrutivos ao
// gerar uma futura migration por divergir do que as migrations 0029/0030 já
// aplicaram. Sempre que uma migration alterar estas tabelas, atualize este arquivo
// no mesmo commit (achado B5 da auditoria — ver docs/ideal-prime/AUDITORIA_PERMUPAY_IDEAL_PRIME.md).
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { products, users } from "./schema";

export const businessAccounts = pgTable(
  "permupay_business_accounts",
  {
    id: serial("id").primaryKey(),
    legalName: text("legal_name").notNull(),
    tradeName: text("trade_name"),
    cnpj: varchar("cnpj", { length: 18 }).notNull().unique(),
    email: varchar("email", { length: 320 }).notNull(),
    phone: varchar("phone", { length: 40 }),
    status: varchar("status", { length: 20 }).notNull().default("PENDING"),
    assignedPriceListId: integer("assigned_price_list_id"),
    accountManagerUserId: integer("account_manager_user_id").references(() => users.id, { onDelete: "set null" }),
    paymentTerms: jsonb("payment_terms").notNull().default({}),
    minOrderCents: integer("min_order_cents").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    check("permupay_business_status_check", sql`${table.status} in ('PENDING','APPROVED','SUSPENDED')`),
    check("permupay_business_cnpj_format_check", sql`${table.cnpj} ~ '^[0-9]{14}$'`),
  ],
);

export const businessMemberships = pgTable(
  "permupay_business_memberships",
  {
    id: serial("id").primaryKey(),
    businessAccountId: integer("business_account_id").notNull().references(() => businessAccounts.id, { onDelete: "cascade" }),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 20 }).notNull().default("BUYER"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("permupay_business_membership_unique").on(table.businessAccountId, table.userId),
    check("permupay_business_membership_role_check", sql`${table.role} in ('MANAGER','BUYER')`),
  ],
);

export const priceLists = pgTable(
  "permupay_price_lists",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    isDefault: boolean("is_default").notNull().default(false),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("permupay_one_default_price_list")
      .on(sql`(1)`)
      .where(sql`${table.isDefault} = true and ${table.active} = true`),
  ],
);

export const priceListVersions = pgTable(
  "permupay_price_list_versions",
  {
    id: serial("id").primaryKey(),
    priceListId: integer("price_list_id").notNull().references(() => priceLists.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    effectiveFrom: timestamp("effective_from").defaultNow().notNull(),
    createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("permupay_price_list_version_unique").on(table.priceListId, table.version)],
);

export const priceListItems = pgTable(
  "permupay_price_list_items",
  {
    id: serial("id").primaryKey(),
    versionId: integer("version_id").notNull().references(() => priceListVersions.id, { onDelete: "cascade" }),
    productId: integer("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    priceCents: integer("price_cents").notNull(),
    active: boolean("active").notNull().default(true),
  },
  (table) => [
    uniqueIndex("permupay_price_item_unique").on(table.versionId, table.productId),
    check("permupay_price_item_positive", sql`${table.priceCents} >= 0`),
  ],
);

export const b2bOrders = pgTable(
  "permupay_b2b_orders",
  {
    id: serial("id").primaryKey(),
    orderNumber: varchar("order_number", { length: 40 }).notNull().unique(),
    businessAccountId: integer("business_account_id").notNull().references(() => businessAccounts.id),
    buyerUserId: integer("buyer_user_id").notNull().references(() => users.id),
    priceListVersionId: integer("price_list_version_id").references(() => priceListVersions.id),
    idempotencyKey: varchar("idempotency_key", { length: 120 }).notNull(),
    commercialStatus: varchar("commercial_status", { length: 30 }).notNull().default("ENVIADO"),
    paymentStatus: varchar("payment_status", { length: 30 }).notNull().default("PENDENTE"),
    fulfillmentStatus: varchar("fulfillment_status", { length: 40 }).notNull().default("AGUARDANDO_SEPARACAO"),
    paymentMethod: varchar("payment_method", { length: 30 }),
    totalCents: integer("total_cents").notNull(),
    deliverySnapshot: jsonb("delivery_snapshot").notNull().default({}),
    termsSnapshot: jsonb("terms_snapshot").notNull().default({}),
    assignedToUserId: integer("assigned_to_user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("permupay_b2b_idempotency_unique").on(table.businessAccountId, table.idempotencyKey),
    index("permupay_b2b_orders_business_created").on(table.businessAccountId, table.createdAt),
  ],
);

export const b2bOrderItems = pgTable(
  "permupay_b2b_order_items",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id").notNull().references(() => b2bOrders.id, { onDelete: "cascade" }),
    productId: integer("product_id").notNull().references(() => products.id),
    skuSnapshot: varchar("sku_snapshot", { length: 80 }).notNull(),
    nameSnapshot: text("name_snapshot").notNull(),
    unitSnapshot: varchar("unit_snapshot", { length: 20 }).notNull(),
    quantity: integer("quantity").notNull(),
    unitPriceCents: integer("unit_price_cents").notNull(),
    totalCents: integer("total_cents").notNull(),
  },
  (table) => [check("permupay_b2b_item_qty_positive", sql`${table.quantity} > 0`)],
);

export const b2bStockReservations = pgTable(
  "permupay_b2b_stock_reservations",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id").notNull().references(() => b2bOrders.id, { onDelete: "cascade" }),
    orderItemId: integer("order_item_id").notNull().references(() => b2bOrderItems.id, { onDelete: "cascade" }),
    productId: integer("product_id").notNull().references(() => products.id),
    quantity: integer("quantity").notNull(),
    status: varchar("status", { length: 20 }).notNull().default("ACTIVE"),
    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    check("permupay_b2b_reservation_status_check", sql`${table.status} in ('ACTIVE','CONSUMED','RELEASED','EXPIRED')`),
    check("permupay_b2b_reservation_qty_positive", sql`${table.quantity} > 0`),
    index("permupay_b2b_reservations_product_active").on(table.productId).where(sql`${table.status} = 'ACTIVE'`),
  ],
);

export const b2bNotifications = pgTable("permupay_b2b_notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  orderId: integer("order_id").references(() => b2bOrders.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  body: text("body").notNull(),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const importJobs = pgTable(
  "permupay_import_jobs",
  {
    id: serial("id").primaryKey(),
    contentHash: varchar("content_hash", { length: 64 }).notNull(),
    profileKey: varchar("profile_key", { length: 120 }).notNull(),
    mode: varchar("mode", { length: 20 }).notNull(),
    priceListId: integer("price_list_id").references(() => priceLists.id, { onDelete: "set null" }),
    referenceAt: timestamp("reference_at"),
    actorUserId: integer("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    status: varchar("status", { length: 20 }).notNull(),
    summary: jsonb("summary").notNull().default({}),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    completedAt: timestamp("completed_at"),
  },
  (table) => [
    uniqueIndex("permupay_import_idempotency").on(table.contentHash, table.profileKey),
    check("permupay_import_mode_check", sql`${table.mode} in ('PRICES','INVENTORY')`),
  ],
);

export const importRows = pgTable("permupay_import_rows", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").notNull().references(() => importJobs.id, { onDelete: "cascade" }),
  rowNumber: integer("row_number").notNull(),
  sku: varchar("sku", { length: 80 }),
  status: varchar("status", { length: 20 }).notNull(),
  beforeData: jsonb("before_data"),
  afterData: jsonb("after_data"),
  errors: jsonb("errors").notNull().default([]),
});

export const b2bQuotes = pgTable(
  "permupay_b2b_quotes",
  {
    id: serial("id").primaryKey(),
    quoteNumber: varchar("quote_number", { length: 40 }).notNull().unique(),
    businessAccountId: integer("business_account_id").notNull().references(() => businessAccounts.id, { onDelete: "cascade" }),
    buyerUserId: integer("buyer_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    priceListVersionId: integer("price_list_version_id").references(() => priceListVersions.id, { onDelete: "set null" }),
    status: varchar("status", { length: 20 }).notNull().default("PENDING"),
    notes: text("notes"),
    totalCents: integer("total_cents").notNull().default(0),
    idempotencyKey: varchar("idempotency_key", { length: 120 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    check("permupay_b2b_quote_status_check", sql`${table.status} in ('PENDING','APPROVED','REJECTED','CONVERTED','CANCELLED')`),
    uniqueIndex("permupay_b2b_quote_idempotency_unique").on(table.businessAccountId, table.idempotencyKey),
    index("permupay_b2b_quotes_business_created").on(table.businessAccountId, table.createdAt),
    index("permupay_b2b_quotes_status").on(table.status),
  ],
);

export const b2bQuoteItems = pgTable(
  "permupay_b2b_quote_items",
  {
    id: serial("id").primaryKey(),
    quoteId: integer("quote_id").notNull().references(() => b2bQuotes.id, { onDelete: "cascade" }),
    productId: integer("product_id").notNull().references(() => products.id, { onDelete: "restrict" }),
    skuSnapshot: varchar("sku_snapshot", { length: 80 }).notNull(),
    nameSnapshot: text("name_snapshot").notNull(),
    unitSnapshot: varchar("unit_snapshot", { length: 20 }).notNull(),
    quantity: integer("quantity").notNull(),
    unitPriceCents: integer("unit_price_cents").notNull(),
    totalCents: integer("total_cents").notNull(),
  },
  (table) => [check("permupay_b2b_quote_item_qty_positive", sql`${table.quantity} > 0`)],
);
