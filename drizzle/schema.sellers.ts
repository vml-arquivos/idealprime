import {
  AnyPgColumn,
  boolean,
  date,
  integer,
  pgEnum,
  pgTable,
  real,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { orders } from "./schema.orders";
import { users } from "./schema";

export const commissionStatusEnum = pgEnum("permupay_commission_status", [
  "PENDENTE",
  "PAGO",
  "PAGA",
  "CANCELADA",
]);

export const sellerStatusEnum = pgEnum("permupay_seller_status", [
  "PENDENTE",
  "APROVADO",
  "REJEITADO",
  "INATIVO",
]);

export const sellers = pgTable("permupay_sellers", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  name: text("name").notNull(),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 40 }),
  type: text("type").notNull().default("EXTERNO"),
  referralCode: varchar("referral_code", { length: 60 }).notNull().unique(),
  accessToken: varchar("access_token", { length: 64 }),
  contact: text("contact"),
  commissionType: text("commission_type").notNull().default("PERCENT"),
  commissionValue: real("commission_value").notNull().default(0),
  // Campos legados da primeira versão; permanecem para compatibilidade e espelham o percentual quando aplicável.
  commissionRate: real("commission_rate").notNull().default(5),
  active: boolean("active").notNull().default(true),
  status: sellerStatusEnum("status").notNull().default("APROVADO"),
  parentSellerId: integer("parent_seller_id").references(
    (): AnyPgColumn => sellers.id,
    { onDelete: "set null" }
  ),
  cpf: varchar("cpf", { length: 20 }),
  birthDate: date("birth_date", { mode: "date" }),
  address: text("address"),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 2 }),
  zipCode: varchar("zip_code", { length: 20 }),
  pixKey: text("pix_key"),
  documentFrontUrl: text("document_front_url"),
  documentBackUrl: text("document_back_url"),
  selfiePhotoUrl: text("selfie_photo_url"),
  overrideCommissionType: text("override_commission_type")
    .notNull()
    .default("PERCENT"),
  overrideCommissionValue: real("override_commission_value")
    .notNull()
    .default(0),
  submittedAt: timestamp("submitted_at"),
  reviewedAt: timestamp("reviewed_at"),
  reviewedBy: integer("reviewed_by").references(() => users.id, {
    onDelete: "set null",
  }),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const commissions = pgTable("permupay_commissions", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  sellerId: integer("seller_id")
    .notNull()
    .references(() => sellers.id, { onDelete: "cascade" }),
  orderTotal: real("order_total").notNull(),
  commissionRate: real("commission_rate").notNull(),
  commissionValue: real("commission_value").notNull(),
  saleAmount: real("sale_amount").notNull().default(0),
  costAmount: real("cost_amount").notNull().default(0),
  commissionAmount: real("commission_amount").notNull().default(0),
  status: commissionStatusEnum("status").notNull().default("PENDENTE"),
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Seller = typeof sellers.$inferSelect;
export type InsertSeller = typeof sellers.$inferInsert;
export type Commission = typeof commissions.$inferSelect;
export type InsertCommission = typeof commissions.$inferInsert;
