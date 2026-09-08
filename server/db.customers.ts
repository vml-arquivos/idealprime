import bcrypt from "bcryptjs";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import {
  customers,
  customerCommunications,
  creditStatusHistory,
  type Customer,
  type InsertCustomer,
  type SafeCustomer,
  type CustomerCommunicationChannel,
  type CustomerCreditStatus,
} from "../drizzle/schema.customers";
import { sellers } from "../drizzle/schema.sellers";
import { getDb } from "./db";
import * as dbOrders from "./db.orders";

export type CustomerContactType = "WHATSAPP" | "EMAIL";

export type CustomerInput = {
  name: string;
  contact: string;
  contactType?: CustomerContactType;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  referredBySellerReferralCode?: string;
  // KYC / documentação e crediário — cadastro completo pedido para "Novo
  // cliente" na ficha da equipe (opcionais: podem ser preenchidos depois).
  cpf?: string;
  rg?: string;
  birthDate?: string;
  documentFrontUrl?: string;
  documentBackUrl?: string;
  proofAddressUrl?: string;
};

/**
 * Normaliza CPF para só dígitos (mantém `null`/vazio como `null`). Não faz
 * validação de dígito verificador — é um campo de cadastro informado pelo
 * próprio cliente/equipe, não um documento oficial verificado por API
 * externa (fora de escopo desta rodada).
 */
export function normalizeCpf(value?: string | null): string | null {
  if (value === undefined || value === null) return null;
  const digits = value.replace(/\D/g, "");
  return digits || null;
}

export function normalizeCustomerContact(
  contact: string,
  contactType?: CustomerContactType
): string {
  const value = contact.trim();
  return contactType === "EMAIL" || value.includes("@")
    ? value.toLowerCase()
    : value.replace(/\D/g, "");
}

function cleanOptional(value?: string | null): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const normalized = value.trim();
  return normalized || null;
}

async function resolveSellerId(referralCode?: string): Promise<number | null> {
  if (!referralCode?.trim()) return null;
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const normalized = referralCode.trim().toUpperCase();
  const [seller] = await db
    .select({ id: sellers.id })
    .from(sellers)
    .where(and(eq(sellers.referralCode, normalized), eq(sellers.active, true)))
    .limit(1);
  return seller?.id ?? null;
}

export async function identifyOrCreateCustomer(
  data: CustomerInput
): Promise<Customer> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const name = data.name.trim();
  const contact = normalizeCustomerContact(data.contact, data.contactType);
  if (name.length < 2) throw new Error("Nome do cliente é obrigatório");
  if (contact.length < 5) throw new Error("Contato do cliente é inválido");

  const [existing] = await db
    .select()
    .from(customers)
    .where(eq(sql`LOWER(${customers.contact})`, contact.toLowerCase()))
    .limit(1);

  if (existing) {
    const update: Partial<InsertCustomer> = {
      name,
      contactType: data.contactType ?? existing.contactType,
      updatedAt: new Date(),
    };
    const optionalFields = [
      "email",
      "address",
      "city",
      "state",
      "zipCode",
      "rg",
      "documentFrontUrl",
      "documentBackUrl",
      "proofAddressUrl",
    ] as const;
    for (const field of optionalFields) {
      const value = cleanOptional(data[field]);
      if (value !== undefined) update[field] = value;
    }
    if (data.cpf !== undefined) update.cpf = normalizeCpf(data.cpf);
    if (data.birthDate !== undefined) {
      update.birthDate = cleanOptional(data.birthDate) ?? null;
    }
    const [updated] = await db
      .update(customers)
      .set(update)
      .where(eq(customers.id, existing.id))
      .returning();
    return updated ?? existing;
  }

  const referredBySellerId = await resolveSellerId(
    data.referredBySellerReferralCode
  );
  const [created] = await db
    .insert(customers)
    .values({
      name,
      contact,
      contactType:
        data.contactType ?? (contact.includes("@") ? "EMAIL" : "WHATSAPP"),
      email: cleanOptional(data.email) ?? null,
      address: cleanOptional(data.address) ?? null,
      city: cleanOptional(data.city) ?? null,
      state: cleanOptional(data.state)?.toUpperCase() ?? null,
      zipCode: cleanOptional(data.zipCode) ?? null,
      referredBySellerId,
      cpf: normalizeCpf(data.cpf),
      rg: cleanOptional(data.rg) ?? null,
      birthDate: cleanOptional(data.birthDate) ?? null,
      documentFrontUrl: cleanOptional(data.documentFrontUrl) ?? null,
      documentBackUrl: cleanOptional(data.documentBackUrl) ?? null,
      proofAddressUrl: cleanOptional(data.proofAddressUrl) ?? null,
    })
    .returning();

  if (!created) throw new Error("Não foi possível cadastrar o cliente");
  return created;
}

export async function getCustomerByContact(
  contact: string
): Promise<Customer | null> {
  const db = await getDb();
  if (!db) return null;
  const normalized = normalizeCustomerContact(contact);
  if (!normalized) return null;
  const [customer] = await db
    .select()
    .from(customers)
    .where(eq(sql`LOWER(${customers.contact})`, normalized.toLowerCase()))
    .limit(1);
  return customer ?? null;
}

export async function listCustomerOrders(customerId: number) {
  return dbOrders.listOrders({ customerId });
}

export async function getCustomerById(id: number): Promise<Customer | null> {
  const db = await getDb();
  if (!db) return null;
  const [customer] = await db
    .select()
    .from(customers)
    .where(eq(customers.id, id))
    .limit(1);
  return customer ?? null;
}

export type UpdateCustomerByIdInput = {
  name?: string;
  contact?: string;
  contactType?: CustomerContactType;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  cpf?: string;
  rg?: string;
  birthDate?: string;
  documentFrontUrl?: string;
  documentBackUrl?: string;
  proofAddressUrl?: string;
};

/**
 * Edição administrativa da ficha do cliente (/clientes/:id → "Editar
 * cadastro"). Diferente de `identifyOrCreateCustomer` (que faz upsert por
 * contato, usado no checkout rápido), esta função edita um registro já
 * existente PELO ID — permite corrigir o próprio contato de um cadastro sem
 * risco de acidentalmente "resgatar"/mesclar outro cliente que já use aquele
 * contato (checa colisão explicitamente).
 */
export async function updateCustomerById(
  id: number,
  data: UpdateCustomerByIdInput
): Promise<Customer> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await getCustomerById(id);
  if (!existing) throw new Error("Cliente não encontrado");

  const update: Partial<InsertCustomer> = { updatedAt: new Date() };

  if (data.name !== undefined) {
    const name = data.name.trim();
    if (name.length < 2) throw new Error("Nome do cliente é obrigatório");
    update.name = name;
  }

  if (data.contact !== undefined) {
    const contactType = data.contactType ?? (existing.contactType as CustomerContactType);
    const contact = normalizeCustomerContact(data.contact, contactType);
    if (contact.length < 5) throw new Error("Contato do cliente é inválido");
    if (contact.toLowerCase() !== existing.contact.toLowerCase()) {
      const [conflict] = await db
        .select({ id: customers.id })
        .from(customers)
        .where(eq(sql`LOWER(${customers.contact})`, contact.toLowerCase()))
        .limit(1);
      if (conflict && conflict.id !== id) {
        throw new Error("Já existe outro cliente cadastrado com este contato.");
      }
    }
    update.contact = contact;
    update.contactType = contactType;
  } else if (data.contactType !== undefined) {
    update.contactType = data.contactType;
  }

  const optionalFields = [
    "email",
    "address",
    "city",
    "zipCode",
    "rg",
    "documentFrontUrl",
    "documentBackUrl",
    "proofAddressUrl",
  ] as const;
  for (const field of optionalFields) {
    const value = cleanOptional(data[field]);
    if (value !== undefined) update[field] = value;
  }
  if (data.state !== undefined) {
    update.state = cleanOptional(data.state)?.toUpperCase() ?? null;
  }
  if (data.cpf !== undefined) update.cpf = normalizeCpf(data.cpf);
  if (data.birthDate !== undefined) {
    update.birthDate = cleanOptional(data.birthDate) ?? null;
  }

  const [updated] = await db
    .update(customers)
    .set(update)
    .where(eq(customers.id, id))
    .returning();
  if (!updated) throw new Error("Cliente não encontrado");
  return updated;
}

// ─── Segurança da área do cliente (senha) ──────────────────────────────────
// Mesmo padrão de hashing (bcryptjs, custo 12) já usado em server/db.ts para
// os usuários internos (equipe).

export function toSafeCustomer(customer: Customer): SafeCustomer {
  const { passwordHash: _removed, ...safe } = customer;
  return safe;
}

export async function verifyCustomerPassword(
  customer: Customer,
  password: string
): Promise<boolean> {
  if (!customer.passwordHash) return false;
  return bcrypt.compare(password, customer.passwordHash);
}

/**
 * Cria uma conta de cliente nova, já com senha — usado por
 * customerAuth.register quando ainda não existe nenhum cadastro para este
 * contato.
 */
export async function createCustomerWithPassword(data: {
  name: string;
  contact: string;
  contactType?: CustomerContactType;
  password: string;
}): Promise<Customer> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const name = data.name.trim();
  const contact = normalizeCustomerContact(data.contact, data.contactType);
  if (name.length < 2) throw new Error("Nome é obrigatório");
  if (contact.length < 5) throw new Error("Contato inválido");

  const passwordHash = await bcrypt.hash(data.password, 12);
  const [created] = await db
    .insert(customers)
    .values({
      name,
      contact,
      contactType:
        data.contactType ?? (contact.includes("@") ? "EMAIL" : "WHATSAPP"),
      passwordHash,
    })
    .returning();

  if (!created) throw new Error("Não foi possível criar a conta");
  return created;
}

/**
 * "Ativa" (define senha em) um cadastro de cliente que já existia sem senha
 * — criado antes desta funcionalidade, via checkout rápido ou cadastro
 * interno pela equipe. Evita bloquear clientes antigos: eles simplesmente
 * usam "Criar conta" com o mesmo contato para ganhar acesso com senha ao
 * cadastro que já tinham.
 */
export async function claimExistingCustomer(
  customerId: number,
  data: { name?: string; password: string }
): Promise<Customer> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const passwordHash = await bcrypt.hash(data.password, 12);
  const update: Partial<InsertCustomer> = {
    passwordHash,
    updatedAt: new Date(),
  };
  if (data.name?.trim()) update.name = data.name.trim();

  const [updated] = await db
    .update(customers)
    .set(update)
    .where(eq(customers.id, customerId))
    .returning();
  if (!updated) throw new Error("Cliente não encontrado");
  return updated;
}

export async function updateCustomerLastSignedIn(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(customers)
    .set({ lastSignedIn: new Date() })
    .where(eq(customers.id, id));
}

export type ListCustomersFilters = {
  search?: string;
  creditStatus?: CustomerCreditStatus;
};

/**
 * Listagem para a ficha de clientes da equipe (staff) — unifica busca por
 * nome, contato, e-mail ou CPF. A parte pessoa jurídica (empresas B2B) tem
 * listagem própria em `db.b2b.ts` (`listBusinesses`); a tela `Clientes.tsx`
 * combina as duas no cliente.
 */
export async function listCustomers(
  filters: ListCustomersFilters = {}
): Promise<Customer[]> {
  const db = await getDb();
  if (!db) return [];

  const conditions = [];
  if (filters.search?.trim()) {
    const term = `%${filters.search.trim()}%`;
    conditions.push(
      or(
        ilike(customers.name, term),
        ilike(customers.contact, term),
        ilike(customers.email, term),
        ilike(customers.cpf, term)
      )
    );
  }
  if (filters.creditStatus) {
    conditions.push(eq(customers.creditStatus, filters.creditStatus));
  }

  const query = db.select().from(customers);
  const rows = conditions.length
    ? await query.where(and(...conditions)).orderBy(desc(customers.createdAt))
    : await query.orderBy(desc(customers.createdAt));
  return rows;
}

/**
 * Registra uma comunicação (WhatsApp/e-mail) disparada pela equipe a partir
 * da ficha do cliente — trilha de auditoria ("conversas"). Isto NÃO é uma
 * confirmação de entrega do provedor (exigiria integração paga com API de
 * terceiros, não configurada neste ambiente) — é o registro de que a ação
 * foi disparada, por quem, quando e para qual contato.
 */
export async function logCustomerCommunication(params: {
  customerId: number;
  orderId?: number;
  channel: CustomerCommunicationChannel;
  purpose: string;
  target: string;
  messagePreview?: string;
  sentByUserId?: number;
}): Promise<Record<string, unknown>> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [row] = await db
    .insert(customerCommunications)
    .values({
      customerId: params.customerId,
      orderId: params.orderId ?? null,
      channel: params.channel,
      purpose: params.purpose,
      target: params.target,
      messagePreview: cleanOptional(params.messagePreview) ?? null,
      sentByUserId: params.sentByUserId ?? null,
    })
    .returning();
  return row as Record<string, unknown>;
}

/**
 * Trilha de comunicações de um cliente, mais recente primeiro — paginada.
 */
export async function listCustomerCommunications(
  customerId: number,
  opts: { limit?: number; offset?: number } = {}
): Promise<{ items: Array<Record<string, unknown>>; total: number }> {
  const db = await getDb();
  if (!db) return { items: [], total: 0 };

  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 100);
  const offset = Math.max(opts.offset ?? 0, 0);

  const [items, totalRows] = await Promise.all([
    db
      .select()
      .from(customerCommunications)
      .where(eq(customerCommunications.customerId, customerId))
      .orderBy(desc(customerCommunications.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(customerCommunications)
      .where(eq(customerCommunications.customerId, customerId)),
  ]);

  return { items, total: Number(totalRows[0]?.count ?? 0) };
}

/**
 * Exclui o cadastro do cliente. Pedidos já existentes NÃO são apagados — a
 * coluna `customer_id` deles é apenas zerada (ON DELETE SET NULL, ver
 * drizzle/schema.orders.ts), então o histórico de vendas/faturamento
 * permanece intacto. Só o histórico de análise de crédito e a trilha de
 * comunicações deste cliente (que só fazem sentido junto do cadastro) são
 * removidos em cascata pelo próprio banco.
 *
 * Ação irreversível e administrativa — o chamador (router) restringe a
 * admin (adminProcedure) e a UI deve confirmar explicitamente antes de
 * chamar isto.
 */
export async function deleteCustomer(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await getCustomerById(id);
  if (!existing) throw new Error("Cliente não encontrado");
  await db.delete(customers).where(eq(customers.id, id));
}

/**
 * Atualiza a análise de crédito do cliente (aprovar/reprovar, limite,
 * observações) e registra a mudança no histórico — pedido explicitamente
 * para a ficha de clientes ("deixe também a de crédito, pode deixar tudo,
 * sem distinção").
 */
export async function updateCreditStatus(params: {
  customerId: number;
  creditStatus: CustomerCreditStatus;
  creditNotes?: string;
  creditLimit?: number;
  reviewerUserId?: number;
}): Promise<Customer> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Guarda o status anterior antes de sobrescrever — é o que alimenta o
  // histórico de análise de crédito exibido na ficha do cliente.
  const [before] = await db
    .select({ creditStatus: customers.creditStatus })
    .from(customers)
    .where(eq(customers.id, params.customerId))
    .limit(1);

  const update: Partial<InsertCustomer> = {
    creditStatus: params.creditStatus,
    reviewedAt: new Date(),
    updatedAt: new Date(),
  };
  if (params.creditNotes !== undefined) {
    update.creditNotes = cleanOptional(params.creditNotes) ?? null;
  }
  if (params.creditLimit !== undefined) {
    update.creditLimit = params.creditLimit;
  }
  if (params.reviewerUserId !== undefined) {
    update.reviewedBy = params.reviewerUserId;
  }

  const [updated] = await db
    .update(customers)
    .set(update)
    .where(eq(customers.id, params.customerId))
    .returning();
  if (!updated) throw new Error("Cliente não encontrado");

  // Nunca bloqueia a atualização de crédito se o log de histórico falhar
  // por algum motivo — o status em si já foi salvo com sucesso acima.
  try {
    await db.insert(creditStatusHistory).values({
      customerId: params.customerId,
      previousStatus: before?.creditStatus ?? null,
      newStatus: params.creditStatus,
      notes: cleanOptional(params.creditNotes) ?? null,
      creditLimit: params.creditLimit ?? null,
      changedByUserId: params.reviewerUserId ?? null,
    });
  } catch (error) {
    console.error("[customers] Falha ao registrar histórico de crédito:", error);
  }

  return updated;
}

/**
 * Histórico de análise de crédito de um cliente, mais recente primeiro —
 * paginado para clientes com muitas mudanças de status ao longo do tempo.
 */
export async function getCreditHistory(
  customerId: number,
  opts: { limit?: number; offset?: number } = {}
): Promise<{ items: Array<Record<string, unknown>>; total: number }> {
  const db = await getDb();
  if (!db) return { items: [], total: 0 };

  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 100);
  const offset = Math.max(opts.offset ?? 0, 0);

  const [items, totalRows] = await Promise.all([
    db
      .select()
      .from(creditStatusHistory)
      .where(eq(creditStatusHistory.customerId, customerId))
      .orderBy(desc(creditStatusHistory.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(creditStatusHistory)
      .where(eq(creditStatusHistory.customerId, customerId)),
  ]);

  return { items, total: Number(totalRows[0]?.count ?? 0) };
}
