import {
  date,
  integer,
  pgTable,
  real,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { sellers } from "./schema.sellers";

export const customers = pgTable("permupay_customers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  contact: text("contact").notNull(),
  contactType: text("contact_type").notNull().default("WHATSAPP"),
  email: varchar("email", { length: 320 }),
  address: text("address"),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 2 }),
  zipCode: varchar("zip_code", { length: 20 }),
  referredBySellerId: integer("referred_by_seller_id").references(
    () => sellers.id,
    { onDelete: "set null" }
  ),
  // Documentação pessoa física (ficha de cliente) — reintroduzido na Fase 4
  // da evolução comercial; ver docs/ideal-prime/AUDITORIA_EVOLUCAO_COMERCIAL.md.
  cpf: text("cpf"),
  rg: text("rg"),
  birthDate: date("birth_date"),
  documentFrontUrl: text("document_front_url"),
  documentBackUrl: text("document_back_url"),
  proofAddressUrl: text("proof_address_url"),
  // Análise de crédito (crediário/boleto) — pedida explicitamente para o
  // cadastro de clientes ("deixe também a de crédito, pode deixar tudo,
  // sem distinção"), sem diferenciar PF/PJ; ver
  // docs/ideal-prime/AUDITORIA_EVOLUCAO_COMERCIAL.md.
  creditStatus: text("credit_status").notNull().default("NAO_ANALISADO"),
  creditNotes: text("credit_notes"),
  creditLimit: real("credit_limit"),
  reviewedBy: integer("reviewed_by"),
  reviewedAt: timestamp("reviewed_at"),
  // Área do cliente — login com senha própria (separado da sessão da
  // equipe). Nullable: cadastros criados antes desta funcionalidade
  // (checkout rápido, cadastro interno) continuam existindo sem senha até
  // o cliente "ativar" a conta em /minha-conta.
  passwordHash: text("password_hash"),
  lastSignedIn: timestamp("last_signed_in"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const CUSTOMER_CREDIT_STATUSES = [
  "NAO_ANALISADO",
  "APROVADO",
  "REPROVADO",
] as const;
export type CustomerCreditStatus = (typeof CUSTOMER_CREDIT_STATUSES)[number];

export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = typeof customers.$inferInsert;

// Nunca enviado ao navegador — mesma convenção usada para SafeUser (usuários
// internos) em drizzle/schema.ts.
export type SafeCustomer = Omit<Customer, "passwordHash">;

// ── Histórico de análise de crédito ────────────────────────────────────────
// Uma linha por mudança de status — permite mostrar o histórico completo na
// aba "Crédito" da ficha do cliente, não só o status atual.
export const creditStatusHistory = pgTable("permupay_credit_status_history", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id")
    .notNull()
    .references(() => customers.id, { onDelete: "cascade" }),
  previousStatus: text("previous_status"),
  newStatus: text("new_status").notNull(),
  notes: text("notes"),
  creditLimit: real("credit_limit"),
  changedByUserId: integer("changed_by_user_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type CreditStatusHistoryEntry = typeof creditStatusHistory.$inferSelect;

// ── Trilha de comunicações com o cliente (WhatsApp/e-mail) ─────────────────
// Registrada quando a equipe aciona um envio pela ficha do cliente. Não é
// confirmação de entrega do provedor (exigiria integração paga de terceiros,
// não configurada neste ambiente) — é o registro de que a ação foi
// disparada, por quem, quando e para qual contato ("conversas" na ficha do
// cliente pedida na evolução comercial).
export const CUSTOMER_COMMUNICATION_CHANNELS = ["WHATSAPP", "EMAIL"] as const;
export type CustomerCommunicationChannel =
  (typeof CUSTOMER_COMMUNICATION_CHANNELS)[number];

export const customerCommunications = pgTable(
  "permupay_customer_communications",
  {
    id: serial("id").primaryKey(),
    customerId: integer("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    orderId: integer("order_id"),
    channel: text("channel").notNull(),
    purpose: text("purpose").notNull(),
    target: text("target").notNull(),
    messagePreview: text("message_preview"),
    sentByUserId: integer("sent_by_user_id"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  }
);

export type CustomerCommunication = typeof customerCommunications.$inferSelect;
