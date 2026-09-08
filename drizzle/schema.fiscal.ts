// drizzle/schema.fiscal.ts — Schema Drizzle do módulo de Nota Fiscal Eletrônica (NF-e/NFC-e)
//
// Este módulo NÃO integra com nenhum provedor real de emissão ainda (nenhuma API foi
// contratada/configurada até o momento desta implementação — ver
// docs/ideal-prime/NFE_INTEGRACAO.md). O objetivo é deixar a arquitetura, o banco e as
// rotas prontos para receber qualquer provedor (Focus NFe, PlugNotas, eNotas, NFe.io ou
// integração direta com a SEFAZ) assim que uma opção for escolhida, sem exigir nova
// migration para o fluxo básico de emitir/cancelar/consultar.
//
// Convenções seguidas (mesmas do restante do banco):
// - Migration aditiva (0032_fiscal_invoices.sql), sem DROP/TRUNCATE.
// - Consultado via Drizzle ORM (mesmo padrão de schema.orders.ts/schema.payment-settings),
//   ao contrário do módulo B2B que fala SQL bruto por herança histórica do PermuPay.
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
import { users } from "./schema";
import { orders } from "./schema.orders";
import { b2bOrders } from "./schema.b2b";

// ─── Configurações fiscais (linha única, id = 1 — mesmo padrão de payment_settings) ────

export const fiscalSettings = pgTable(
  "permupay_fiscal_settings",
  {
    id: serial("id").primaryKey(),

    // Provedor de emissão escolhido. "NONE" (padrão) = nenhum configurado ainda; o
    // sistema aceita solicitações de emissão normalmente, mas elas ficam com status
    // PENDING_PROVIDER até um provedor real ser habilitado. "MOCK" existe só para
    // testes/homologação interna (simula emissão sem falar com a SEFAZ).
    provider: varchar("provider", { length: 30 }).notNull().default("NONE"),
    environment: varchar("environment", { length: 20 }).notNull().default("HOMOLOGACAO"),

    // Dados do emitente — necessários para qualquer provedor futuro.
    issuerLegalName: text("issuer_legal_name"),
    issuerCnpj: varchar("issuer_cnpj", { length: 14 }),
    issuerStateRegistration: varchar("issuer_state_registration", { length: 20 }),
    issuerTaxRegime: varchar("issuer_tax_regime", { length: 30 }).notNull().default("SIMPLES_NACIONAL"),
    issuerCity: text("issuer_city"),
    issuerState: varchar("issuer_state", { length: 2 }),

    // Defaults fiscais aplicados a itens sem classificação própria (podem ser
    // sobrescritos por produto no futuro — fora de escopo desta rodada).
    defaultCfop: varchar("default_cfop", { length: 4 }),
    defaultNcm: varchar("default_ncm", { length: 8 }),

    // Nunca guardamos credenciais de API em texto aqui — apenas se já existe uma
    // configuração de credenciais válida (o valor de fato fica em variável de
    // ambiente/secret manager, nunca no banco). Ver NFE_INTEGRACAO.md.
    apiCredentialsConfigured: boolean("api_credentials_configured").notNull().default(false),

    notes: text("notes"),
    updatedBy: integer("updated_by").references(() => users.id, { onDelete: "set null" }),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    check(
      "permupay_fiscal_settings_provider_check",
      sql`${table.provider} in ('NONE','MOCK','FOCUS_NFE','PLUGNOTAS','ENOTAS','NFEIO','CUSTOM')`,
    ),
    check(
      "permupay_fiscal_settings_env_check",
      sql`${table.environment} in ('HOMOLOGACAO','PRODUCAO')`,
    ),
  ],
);

// ─── Notas fiscais (uma por pedido, com histórico de tentativas via invoice_events) ────

export const invoices = pgTable(
  "permupay_invoices",
  {
    id: serial("id").primaryKey(),

    // Pedido de origem — polimórfico entre pedido varejo (permupay_orders) e pedido B2B
    // (permupay_b2b_orders). Exatamente uma das duas colunas de FK deve estar preenchida
    // (garantido pelo CHECK abaixo), conforme orderType.
    orderType: varchar("order_type", { length: 10 }).notNull(),
    retailOrderId: integer("retail_order_id").references(() => orders.id, { onDelete: "restrict" }),
    b2bOrderId: integer("b2b_order_id").references(() => b2bOrders.id, { onDelete: "restrict" }),

    model: varchar("model", { length: 4 }).notNull().default("NFE"), // NFE (modelo 55) | NFCE (modelo 65)
    series: varchar("series", { length: 10 }),
    number: varchar("number", { length: 20 }),
    accessKey: varchar("access_key", { length: 44 }), // chave de acesso de 44 dígitos, só existe após autorização

    status: varchar("status", { length: 20 }).notNull().default("DRAFT"),
    providerName: varchar("provider_name", { length: 30 }).notNull().default("NONE"),
    providerReference: text("provider_reference"), // id/protocolo do provedor externo, quando houver

    xmlUrl: text("xml_url"),
    danfeUrl: text("danfe_url"),

    totalCents: integer("total_cents").notNull(),
    payloadSnapshot: jsonb("payload_snapshot").notNull().default({}),
    errorMessage: text("error_message"),

    createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    authorizedAt: timestamp("authorized_at"),
    cancelledAt: timestamp("cancelled_at"),
    cancelReason: text("cancel_reason"),
  },
  (table) => [
    check("permupay_invoice_order_type_check", sql`${table.orderType} in ('RETAIL','B2B')`),
    check(
      "permupay_invoice_order_ref_check",
      sql`(${table.orderType} = 'RETAIL' and ${table.retailOrderId} is not null and ${table.b2bOrderId} is null)
          or (${table.orderType} = 'B2B' and ${table.b2bOrderId} is not null and ${table.retailOrderId} is null)`,
    ),
    check("permupay_invoice_model_check", sql`${table.model} in ('NFE','NFCE')`),
    check(
      "permupay_invoice_status_check",
      sql`${table.status} in ('DRAFT','PENDING_PROVIDER','PROCESSING','AUTHORIZED','REJECTED','CANCELLED','ERROR')`,
    ),
    check(
      "permupay_invoice_access_key_format_check",
      sql`${table.accessKey} is null or ${table.accessKey} ~ '^[0-9]{44}$'`,
    ),
    uniqueIndex("permupay_invoice_access_key_unique")
      .on(table.accessKey)
      .where(sql`${table.accessKey} is not null`),
    // Só pode haver uma nota "ativa" (linha ainda não cancelada) por pedido. Rejeição
    // (REJECTED) e erro (ERROR) são retentados na MESMA linha — só depois de CANCELLED
    // (nota autorizada e depois cancelada) é permitido abrir uma nova linha para o
    // mesmo pedido, refletindo o ciclo de vida real de uma NF-e.
    uniqueIndex("permupay_invoice_active_retail_unique")
      .on(table.retailOrderId)
      .where(sql`${table.retailOrderId} is not null and ${table.status} <> 'CANCELLED'`),
    uniqueIndex("permupay_invoice_active_b2b_unique")
      .on(table.b2bOrderId)
      .where(sql`${table.b2bOrderId} is not null and ${table.status} <> 'CANCELLED'`),
    index("permupay_invoice_status_idx").on(table.status),
  ],
);

// ─── Auditoria: histórico de eventos por nota (tentativas, respostas do provedor) ──────

export const invoiceEvents = pgTable(
  "permupay_invoice_events",
  {
    id: serial("id").primaryKey(),
    invoiceId: integer("invoice_id").notNull().references(() => invoices.id, { onDelete: "cascade" }),
    eventType: varchar("event_type", { length: 30 }).notNull(),
    message: text("message"),
    payload: jsonb("payload").notNull().default({}),
    createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("permupay_invoice_events_invoice_idx").on(table.invoiceId, table.createdAt)],
);

export type FiscalSetting = typeof fiscalSettings.$inferSelect;
export type InsertFiscalSetting = typeof fiscalSettings.$inferInsert;
export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = typeof invoices.$inferInsert;
export type InvoiceEvent = typeof invoiceEvents.$inferSelect;
export type InsertInvoiceEvent = typeof invoiceEvents.$inferInsert;
