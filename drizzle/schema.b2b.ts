import { boolean, integer, jsonb, pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { products, users } from "./schema";

export const businessAccounts = pgTable("permupay_business_accounts", {
  id: serial("id").primaryKey(), legalName: text("legal_name").notNull(), tradeName: text("trade_name"),
  cnpj: varchar("cnpj", { length: 18 }).notNull().unique(), email: varchar("email", { length: 320 }).notNull(),
  phone: varchar("phone", { length: 40 }), status: varchar("status", { length: 20 }).notNull().default("PENDING"),
  assignedPriceListId: integer("assigned_price_list_id"), accountManagerUserId: integer("account_manager_user_id").references(()=>users.id),
  paymentTerms: jsonb("payment_terms").notNull().default({}), minOrderCents: integer("min_order_cents").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(), updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export const businessMemberships = pgTable("permupay_business_memberships", {
  id: serial("id").primaryKey(), businessAccountId: integer("business_account_id").notNull().references(()=>businessAccounts.id,{onDelete:"cascade"}),
  userId: integer("user_id").notNull().references(()=>users.id,{onDelete:"cascade"}), role: varchar("role",{length:20}).notNull().default("BUYER"),
  active: boolean("active").notNull().default(true), createdAt: timestamp("created_at").defaultNow().notNull(),
});
export const priceLists = pgTable("permupay_price_lists", {
  id: serial("id").primaryKey(), name:text("name").notNull(), isDefault:boolean("is_default").notNull().default(false), active:boolean("active").notNull().default(true),
  createdAt:timestamp("created_at").defaultNow().notNull(), updatedAt:timestamp("updated_at").defaultNow().notNull(),
});
export const priceListVersions = pgTable("permupay_price_list_versions", {
  id:serial("id").primaryKey(), priceListId:integer("price_list_id").notNull().references(()=>priceLists.id,{onDelete:"cascade"}), version:integer("version").notNull(),
  effectiveFrom:timestamp("effective_from").defaultNow().notNull(), createdBy:integer("created_by").references(()=>users.id), createdAt:timestamp("created_at").defaultNow().notNull(),
});
export const priceListItems = pgTable("permupay_price_list_items", {
  id:serial("id").primaryKey(), versionId:integer("version_id").notNull().references(()=>priceListVersions.id,{onDelete:"cascade"}),
  productId:integer("product_id").notNull().references(()=>products.id,{onDelete:"cascade"}), priceCents:integer("price_cents").notNull(), active:boolean("active").notNull().default(true),
});
