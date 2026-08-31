/**
 * drizzle/schema.cotacao.ts — Módulo de Cotação de Preços
 *
 * Tabelas para pesquisa e comparação de preços em campo (PWA offline).
 * Mantido separado do schema.ts principal — mesmo padrão de schema.orders.ts.
 *
 * Tabelas:
 *   permupay_cotacao_locais        — Locais/comércios pesquisados
 *   permupay_cotacao_sessoes       — Sessões de cotação (agrupam produtos)
 *   permupay_cotacao_sessao_prods  — Produtos em cada sessão
 *   permupay_cotacao_precos        — Preços coletados por produto/local
 */

import {
  boolean,
  decimal,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { products, users } from "./schema";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const cotacaoSessaoStatusEnum = pgEnum("permupay_cotacao_sessao_status", [
  "em_andamento",
  "concluida",
  "cancelada",
]);

export const cotacaoSyncStatusEnum = pgEnum("permupay_cotacao_sync_status", [
  "local",
  "pendente",
  "sincronizado",
]);

// ─── Tabela: cotacao_locais ───────────────────────────────────────────────────

export const cotacaoLocais = pgTable("permupay_cotacao_locais", {
  id: serial("id").primaryKey(),
  nome: varchar("nome", { length: 200 }).notNull(),
  endereco: text("endereco"),
  lat: decimal("lat", { precision: 10, scale: 8 }),
  lng: decimal("lng", { precision: 11, scale: 8 }),
  fotoFachada: varchar("foto_fachada", { length: 500 }),
  /**
   * Documento do comércio (CNPJ). Armazena apenas números sem máscara
   * para facilitar futuras integrações. Opcional.
   */
  cnpj: varchar("cnpj", { length: 20 }),
  /**
   * Telefone fixo do comércio. Aceita apenas números, opcional.
   */
  telefone: varchar("telefone", { length: 20 }),
  /**
   * Número de WhatsApp do contato. Aceita apenas números, opcional.
   */
  whatsapp: varchar("whatsapp", { length: 20 }),
  /**
   * CEP do endereço. Armazena somente números, opcional.
   */
  cep: varchar("cep", { length: 20 }),
  /**
   * Logradouro do endereço (rua, avenida, etc.). Opcional.
   */
  logradouro: text("logradouro"),
  /**
   * Número do endereço. Opcional.
   */
  numero: varchar("numero", { length: 20 }),
  /**
   * Complemento do endereço. Opcional.
   */
  complemento: varchar("complemento", { length: 50 }),
  /**
   * Bairro do endereço. Opcional.
   */
  bairro: varchar("bairro", { length: 100 }),
  /**
   * Cidade do endereço. Opcional.
   */
  cidade: varchar("cidade", { length: 100 }),
  /**
   * UF do endereço em duas letras (p.ex. "DF"). Opcional.
   */
  estado: varchar("estado", { length: 2 }),
  /**
   * Ponto de referência adicional para o endereço. Opcional.
   */
  referencia: text("referencia"),
  /**
   * Logotipo do comércio. URL de um arquivo no storage. Opcional.
   */
  logoUrl: varchar("logo_url", { length: 500 }),
  tipoComercio: varchar("tipo_comercio", { length: 100 }),
  custoOperacionalPadrao: decimal("custo_operacional_padrao", {
    precision: 10,
    scale: 2,
  })
    .notNull()
    .default("0"),
  usuarioId: integer("usuario_id")
    .notNull()
    .references(() => users.id),
  ativo: boolean("ativo").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type CotacaoLocal = typeof cotacaoLocais.$inferSelect;
export type InsertCotacaoLocal = typeof cotacaoLocais.$inferInsert;

// ─── Tabela: cotacao_sessoes ──────────────────────────────────────────────────

export const cotacaoSessoes = pgTable("permupay_cotacao_sessoes", {
  id: serial("id").primaryKey(),
  titulo: varchar("titulo", { length: 200 }).notNull(),
  usuarioId: integer("usuario_id")
    .notNull()
    .references(() => users.id),
  status: cotacaoSessaoStatusEnum("status").notNull().default("em_andamento"),
  observacao: text("observacao"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type CotacaoSessao = typeof cotacaoSessoes.$inferSelect;
export type InsertCotacaoSessao = typeof cotacaoSessoes.$inferInsert;

// ─── Tabela: cotacao_sessao_produtos ─────────────────────────────────────────

export const cotacaoSessaoProdutos = pgTable("permupay_cotacao_sessao_prods", {
  id: serial("id").primaryKey(),
  sessaoId: integer("sessao_id")
    .notNull()
    .references(() => cotacaoSessoes.id, { onDelete: "cascade" }),
  produtoId: integer("produto_id")
    .notNull()
    .references(() => products.id),
  quantidade: decimal("quantidade", { precision: 10, scale: 3 })
    .notNull()
    .default("1"),
  unidade: varchar("unidade", { length: 20 }).default("un"),
  obrigatorio: boolean("obrigatorio").notNull().default(false),
  ordem: integer("ordem").notNull().default(0),
});

export type CotacaoSessaoProduto = typeof cotacaoSessaoProdutos.$inferSelect;
export type InsertCotacaoSessaoProduto =
  typeof cotacaoSessaoProdutos.$inferInsert;

// ─── Tabela: cotacao_precos ───────────────────────────────────────────────────

export const cotacaoPrecos = pgTable("permupay_cotacao_precos", {
  id: serial("id").primaryKey(),
  sessaoId: integer("sessao_id")
    .notNull()
    .references(() => cotacaoSessoes.id, { onDelete: "cascade" }),
  sessaoProdutoId: integer("sessao_produto_id")
    .notNull()
    .references(() => cotacaoSessaoProdutos.id, { onDelete: "cascade" }),
  localId: integer("local_id")
    .notNull()
    .references(() => cotacaoLocais.id),
  precoUnitario: decimal("preco_unitario", { precision: 10, scale: 2 }),
  fotoPreco: varchar("foto_preco", { length: 500 }),
  encontrado: boolean("encontrado").notNull().default(true),
  observacao: text("observacao"),
  // Controle offline
  uuidLocal: varchar("uuid_local", { length: 36 }),
  syncStatus: cotacaoSyncStatusEnum("sync_status")
    .notNull()
    .default("sincronizado"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type CotacaoPreco = typeof cotacaoPrecos.$inferSelect;
export type InsertCotacaoPreco = typeof cotacaoPrecos.$inferInsert;
