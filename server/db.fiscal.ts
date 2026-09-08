/**
 * server/db.fiscal.ts — Nota Fiscal Eletrônica (NF-e/NFC-e)
 *
 * Camada de acesso a dados do módulo fiscal. Não fala com nenhuma SEFAZ/API real —
 * delega a emissão/cancelamento/consulta ao provedor resolvido por
 * `server/fiscal/registry.ts` (hoje só NONE/MOCK existem; ver
 * docs/ideal-prime/NFE_INTEGRACAO.md para o plano de integração real).
 *
 * Fluxo de emissão (`emitInvoiceForOrder`):
 *   1. Trava o pedido de origem (retail ou B2B) com `FOR UPDATE` dentro de uma
 *      transação, para impedir duas emissões concorrentes do mesmo pedido.
 *   2. Cria (ou reaproveita, se já existir e não estiver CANCELLED) a linha de
 *      `permupay_invoices` para esse pedido — trava essa linha também.
 *   3. Chama o provedor configurado; qualquer exceção do provedor é capturada e
 *      transforma a nota em status ERROR (nunca deixa a exceção subir crua).
 *   4. Grava o resultado e um evento de auditoria em `permupay_invoice_events`.
 * Reemitir uma nota AUTHORIZED é um no-op idempotente (retorna a nota existente sem
 * chamar o provedor de novo). Reemitir uma nota REJECTED/ERROR tenta de novo na MESMA
 * linha. Só depois de CANCELLED uma nova linha pode ser criada para o mesmo pedido.
 */
import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "./db";
import { fiscalSettings, invoices, invoiceEvents, type FiscalSetting, type Invoice, type InvoiceEvent } from "../drizzle/schema.fiscal";
import { getFiscalProvider } from "./fiscal/registry";
import type { NfeIssuerProfile, NfeInvoiceItem, NfeRecipient, FiscalEnvironment } from "./fiscal/types";

export type OrderType = "RETAIL" | "B2B";

type OrderSnapshot = {
  totalCents: number;
  items: NfeInvoiceItem[];
  recipient: NfeRecipient;
};

const SETTINGS_DEFAULTS: Omit<FiscalSetting, "id" | "updatedAt" | "updatedBy"> = {
  provider: "NONE",
  environment: "HOMOLOGACAO",
  issuerLegalName: null,
  issuerCnpj: null,
  issuerStateRegistration: null,
  issuerTaxRegime: "SIMPLES_NACIONAL",
  issuerCity: null,
  issuerState: null,
  defaultCfop: null,
  defaultNcm: null,
  apiCredentialsConfigured: false,
  notes: null,
};

// ─── Configurações ──────────────────────────────────────────────────────────────

export async function getFiscalSettings(): Promise<FiscalSetting> {
  const db = await getDb();
  if (!db) return { id: 1, updatedAt: new Date(), updatedBy: null, ...SETTINGS_DEFAULTS };

  const rows = await db.select().from(fiscalSettings).where(eq(fiscalSettings.id, 1)).limit(1);
  if (rows[0]) return rows[0];

  const [inserted] = await db.insert(fiscalSettings).values({ id: 1, ...SETTINGS_DEFAULTS }).returning();
  return inserted;
}

export async function updateFiscalSettings(
  data: Partial<Omit<FiscalSetting, "id" | "updatedAt" | "updatedBy">>,
  updatedByUserId: number,
): Promise<FiscalSetting> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await getFiscalSettings(); // garante que a linha existe

  const [updated] = await db
    .update(fiscalSettings)
    .set({ ...data, updatedBy: updatedByUserId, updatedAt: new Date() })
    .where(eq(fiscalSettings.id, 1))
    .returning();
  return updated;
}

function toIssuerProfile(settings: FiscalSetting): NfeIssuerProfile {
  return {
    legalName: settings.issuerLegalName,
    cnpj: settings.issuerCnpj,
    stateRegistration: settings.issuerStateRegistration,
    taxRegime: settings.issuerTaxRegime,
    city: settings.issuerCity,
    state: settings.issuerState,
    environment: settings.environment as FiscalEnvironment,
    defaultCfop: settings.defaultCfop,
    defaultNcm: settings.defaultNcm,
  };
}

// ─── Instantâneos do pedido de origem ───────────────────────────────────────────

async function loadRetailOrderSnapshot(tx: any, orderId: number): Promise<OrderSnapshot> {
  const orderResult = await tx.execute(sql`SELECT * FROM permupay_orders WHERE id = ${orderId} FOR UPDATE`);
  const order = orderResult?.rows?.[0];
  if (!order) throw new Error("Pedido não encontrado.");

  const productResult = await tx.execute(sql`SELECT * FROM permupay_products WHERE id = ${order.product_id}`);
  const product = productResult?.rows?.[0];

  const quantity = Number(order.quantity ?? 1);
  const unitPriceCents = Math.round(Number(order.unit_price ?? 0) * 100);
  const totalCents = Math.round(Number(order.total_price ?? 0) * 100);

  const items: NfeInvoiceItem[] = [
    {
      skuOrProductId: product?.sku || String(order.product_id),
      name: product?.name || `Produto #${order.product_id}`,
      quantity,
      unit: product?.unit || "UN",
      unitPriceCents,
      totalCents,
      ncm: product?.ncm || null,
    },
  ];

  // NOTA: o pedido de varejo hoje não coleta CPF/CNPJ do comprador (só nome e
  // contato). Para NFC-e isso é aceitável em muitos regimes/valores; se o provedor
  // escolhido exigir o documento, será preciso um campo novo no cadastro do pedido
  // (fora do escopo desta rodada — ver docs/ideal-prime/NFE_INTEGRACAO.md).
  const recipient: NfeRecipient = {
    name: order.buyer_name || "Consumidor",
    document: null,
    phone: order.buyer_contact || null,
  };

  return { totalCents, items, recipient };
}

async function loadB2BOrderSnapshot(tx: any, orderId: number): Promise<OrderSnapshot> {
  const orderResult = await tx.execute(sql`SELECT * FROM permupay_b2b_orders WHERE id = ${orderId} FOR UPDATE`);
  const order = orderResult?.rows?.[0];
  if (!order) throw new Error("Pedido B2B não encontrado.");

  const businessResult = await tx.execute(
    sql`SELECT * FROM permupay_business_accounts WHERE id = ${order.business_account_id}`,
  );
  const business = businessResult?.rows?.[0];

  const itemsResult = await tx.execute(sql`SELECT * FROM permupay_b2b_order_items WHERE order_id = ${orderId}`);
  const items: NfeInvoiceItem[] = (itemsResult?.rows ?? []).map((row: any) => ({
    skuOrProductId: row.sku_snapshot,
    name: row.name_snapshot,
    quantity: Number(row.quantity),
    unit: row.unit_snapshot,
    unitPriceCents: Number(row.unit_price_cents),
    totalCents: Number(row.total_cents),
  }));

  const recipient: NfeRecipient = {
    name: business?.trade_name || business?.legal_name || "Empresa",
    document: business?.cnpj || null,
    email: business?.email || null,
    phone: business?.phone || null,
  };

  return { totalCents: Number(order.total_cents ?? 0), items, recipient };
}

// ─── Emissão / cancelamento / consulta ──────────────────────────────────────────

export async function emitInvoiceForOrder(
  orderType: OrderType,
  orderId: number,
  actingUserId: number,
): Promise<Invoice> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.transaction(async (tx) => {
    const snapshot =
      orderType === "RETAIL"
        ? await loadRetailOrderSnapshot(tx, orderId)
        : await loadB2BOrderSnapshot(tx, orderId);

    const orderColumn = orderType === "RETAIL" ? invoices.retailOrderId : invoices.b2bOrderId;
    const existingRows = await tx
      .select()
      .from(invoices)
      .where(and(eq(orderColumn, orderId), sql`${invoices.status} <> 'CANCELLED'`))
      .for("update");
    let invoice: Invoice | undefined = existingRows[0];

    // Nota já autorizada — reemissão é um no-op idempotente, não fala com o provedor de novo.
    if (invoice && invoice.status === "AUTHORIZED") {
      return invoice;
    }

    const settings = await getFiscalSettings();
    const provider = getFiscalProvider(settings.provider);
    const model = orderType === "B2B" ? "NFE" : "NFCE";

    if (!invoice) {
      const [created] = await tx
        .insert(invoices)
        .values({
          orderType,
          retailOrderId: orderType === "RETAIL" ? orderId : null,
          b2bOrderId: orderType === "B2B" ? orderId : null,
          model,
          status: "PROCESSING",
          providerName: settings.provider,
          totalCents: snapshot.totalCents,
          payloadSnapshot: snapshot as any,
          createdBy: actingUserId,
        })
        .returning();
      invoice = created;
    } else {
      const [updated] = await tx
        .update(invoices)
        .set({
          status: "PROCESSING",
          providerName: settings.provider,
          totalCents: snapshot.totalCents,
          payloadSnapshot: snapshot as any,
          errorMessage: null,
          updatedAt: new Date(),
        })
        .where(eq(invoices.id, invoice.id))
        .returning();
      invoice = updated;
    }

    await tx.insert(invoiceEvents).values({
      invoiceId: invoice.id,
      eventType: "EMIT_REQUESTED",
      message: `Emissão solicitada via provedor ${settings.provider}.`,
      payload: snapshot as any,
      createdBy: actingUserId,
    });

    let result;
    try {
      result = await provider.emit({
        invoiceId: invoice.id,
        model: invoice.model as "NFE" | "NFCE",
        issuer: toIssuerProfile(settings),
        recipient: snapshot.recipient,
        items: snapshot.items,
        totalCents: snapshot.totalCents,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro desconhecido ao chamar o provedor de NF-e.";
      const [errored] = await tx
        .update(invoices)
        .set({ status: "ERROR", errorMessage: message, updatedAt: new Date() })
        .where(eq(invoices.id, invoice.id))
        .returning();
      await tx.insert(invoiceEvents).values({
        invoiceId: invoice.id,
        eventType: "PROVIDER_ERROR",
        message,
        createdBy: actingUserId,
      });
      return errored;
    }

    const [updated] = await tx
      .update(invoices)
      .set({
        status: result.status,
        series: result.series ?? invoice.series,
        number: result.number ?? invoice.number,
        accessKey: result.accessKey ?? invoice.accessKey,
        providerReference: result.providerReference ?? invoice.providerReference,
        xmlUrl: result.xmlUrl ?? invoice.xmlUrl,
        danfeUrl: result.danfeUrl ?? invoice.danfeUrl,
        errorMessage: result.status === "REJECTED" || result.status === "ERROR" ? result.message : null,
        authorizedAt: result.status === "AUTHORIZED" ? new Date() : invoice.authorizedAt,
        updatedAt: new Date(),
      })
      .where(eq(invoices.id, invoice.id))
      .returning();

    await tx.insert(invoiceEvents).values({
      invoiceId: invoice.id,
      eventType: `PROVIDER_${result.status}`,
      message: result.message,
      createdBy: actingUserId,
    });

    return updated;
  });
}

export async function cancelInvoice(invoiceId: number, reason: string, actingUserId: number): Promise<Invoice> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.transaction(async (tx) => {
    const rows = await tx.select().from(invoices).where(eq(invoices.id, invoiceId)).for("update");
    const invoice = rows[0];
    if (!invoice) throw new Error("Nota fiscal não encontrada.");
    if (invoice.status === "CANCELLED") return invoice; // idempotente

    const settings = await getFiscalSettings();
    const provider = getFiscalProvider(invoice.providerName || settings.provider);

    const result = await provider.cancel({
      invoiceId: invoice.id,
      accessKey: invoice.accessKey,
      providerReference: invoice.providerReference,
      reason,
    });

    const [updated] = await tx
      .update(invoices)
      .set({
        status: result.status,
        cancelledAt: result.status === "CANCELLED" ? new Date() : invoice.cancelledAt,
        cancelReason: result.status === "CANCELLED" ? reason : invoice.cancelReason,
        errorMessage: result.status === "ERROR" ? result.message : invoice.errorMessage,
        updatedAt: new Date(),
      })
      .where(eq(invoices.id, invoice.id))
      .returning();

    await tx.insert(invoiceEvents).values({
      invoiceId: invoice.id,
      eventType: `CANCEL_${result.status}`,
      message: `${result.message}${reason ? ` — motivo informado: ${reason}` : ""}`,
      createdBy: actingUserId,
    });

    return updated;
  });
}

export async function refreshInvoiceStatus(invoiceId: number): Promise<Invoice> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const rows = await db.select().from(invoices).where(eq(invoices.id, invoiceId)).limit(1);
  const invoice = rows[0];
  if (!invoice) throw new Error("Nota fiscal não encontrada.");

  const settings = await getFiscalSettings();
  const provider = getFiscalProvider(invoice.providerName || settings.provider);
  const result = await provider.getStatus({
    invoiceId: invoice.id,
    accessKey: invoice.accessKey,
    providerReference: invoice.providerReference,
  });

  const [updated] = await db
    .update(invoices)
    .set({ status: result.status, errorMessage: result.status === "ERROR" ? result.message : invoice.errorMessage, updatedAt: new Date() })
    .where(eq(invoices.id, invoiceId))
    .returning();
  return updated;
}

// ─── Consultas ───────────────────────────────────────────────────────────────────

export async function getInvoiceById(invoiceId: number): Promise<Invoice | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(invoices).where(eq(invoices.id, invoiceId)).limit(1);
  return rows[0];
}

export async function getActiveInvoiceForOrder(orderType: OrderType, orderId: number): Promise<Invoice | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const column = orderType === "RETAIL" ? invoices.retailOrderId : invoices.b2bOrderId;
  const rows = await db
    .select()
    .from(invoices)
    .where(and(eq(column, orderId), sql`${invoices.status} <> 'CANCELLED'`))
    .limit(1);
  return rows[0];
}

export async function listInvoices(filters: { status?: string; orderType?: OrderType; limit?: number } = {}): Promise<Invoice[]> {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (filters.status) conditions.push(eq(invoices.status, filters.status));
  if (filters.orderType) conditions.push(eq(invoices.orderType, filters.orderType));
  const limit = Math.min(Math.max(filters.limit ?? 100, 1), 500);

  const query = db.select().from(invoices).orderBy(desc(invoices.createdAt)).limit(limit);
  if (conditions.length) return query.where(and(...conditions));
  return query;
}

export async function getInvoiceEvents(invoiceId: number): Promise<InvoiceEvent[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(invoiceEvents).where(eq(invoiceEvents.invoiceId, invoiceId)).orderBy(desc(invoiceEvents.createdAt));
}

/** Últimos pedidos de varejo (independente de já terem nota ou não) para a tela de Notas Fiscais. */
export async function listEligibleRetailOrders(limit = 50): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];
  const result = await db.execute(sql`
    SELECT o.id, o.buyer_name, o.total_price, o.status AS order_status, o.created_at,
           p.name AS product_name,
           i.id AS invoice_id, i.status AS invoice_status, i.model AS invoice_model,
           i.access_key, i.number AS invoice_number
    FROM permupay_orders o
    LEFT JOIN permupay_products p ON p.id = o.product_id
    LEFT JOIN permupay_invoices i ON i.retail_order_id = o.id AND i.status <> 'CANCELLED'
    ORDER BY o.created_at DESC
    LIMIT ${limit}
  `);
  return (result as any)?.rows ?? [];
}

/** Últimos pedidos B2B (independente de já terem nota ou não) para a tela de Notas Fiscais. */
export async function listEligibleB2BOrders(limit = 50): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];
  const result = await db.execute(sql`
    SELECT o.id, o.order_number, o.total_cents, o.commercial_status, o.created_at,
           b.trade_name, b.legal_name, b.cnpj,
           i.id AS invoice_id, i.status AS invoice_status, i.model AS invoice_model,
           i.access_key, i.number AS invoice_number
    FROM permupay_b2b_orders o
    LEFT JOIN permupay_business_accounts b ON b.id = o.business_account_id
    LEFT JOIN permupay_invoices i ON i.b2b_order_id = o.id AND i.status <> 'CANCELLED'
    ORDER BY o.created_at DESC
    LIMIT ${limit}
  `);
  return (result as any)?.rows ?? [];
}
