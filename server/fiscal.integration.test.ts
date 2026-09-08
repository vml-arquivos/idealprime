/**
 * Testes de integração do módulo fiscal (Nota Fiscal Eletrônica) contra PostgreSQL real.
 *
 * Por que integração de verdade: o ponto mais sensível deste módulo é a mesma classe de
 * problema já resolvida no B2B (achado B3 da auditoria) — duas requisições concorrentes
 * de emissão para o MESMO pedido não podem criar duas notas fiscais. Aqui a proteção é
 * mais simples que no B2B (não precisa de SERIALIZABLE+retry): a emissão trava a LINHA
 * DO PEDIDO (que já existe) com `FOR UPDATE` antes de checar/criar a nota, então a
 * segunda chamada concorrente bloqueia até a primeira commitar e, ao continuar, enxerga
 * a nota já criada — este teste comprova isso rodando duas emissões em paralelo de
 * verdade contra o banco.
 *
 * Requisito de ambiente: variável `DATABASE_URL` — se ausente, a suíte inteira é pulada
 * (mesmo padrão de server/b2b.integration.test.ts).
 */
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

const DATABASE_URL = process.env.DATABASE_URL;

function randomCnpj(): string {
  let digits = "";
  for (let i = 0; i < 14; i++) digits += Math.floor(Math.random() * 10);
  return digits;
}

describe.skipIf(!DATABASE_URL)("Fiscal (NF-e/NFC-e) — integração contra PostgreSQL real", () => {
  let pool: pg.Pool;
  let fiscal: typeof import("./db.fiscal");
  let staffUserId: number;

  beforeAll(async () => {
    execFileSync("node", ["scripts/migrate.mjs"], { cwd: process.cwd(), env: process.env, stdio: "pipe" });
    pool = new pg.Pool({ connectionString: DATABASE_URL });
    fiscal = await import("./db.fiscal");
  });

  beforeEach(async () => {
    await pool.query(`
      truncate table
        permupay_invoice_events,
        permupay_invoices,
        permupay_b2b_order_items,
        permupay_b2b_orders,
        permupay_business_accounts,
        permupay_orders
      restart identity cascade
    `);
    await pool.query(`delete from permupay_products where sku like 'FISCAL-TEST-%'`);
    await pool.query(`delete from permupay_users where email like '%@b2btest.local'`);
    await pool.query(`update permupay_fiscal_settings set provider = 'NONE', updated_by = null where id = 1`);

    // Usuário de equipe usado como `actingUserId` em todas as chamadas deste arquivo —
    // as colunas created_by/updated_by têm FK para permupay_users, então não dá para
    // usar um id fixo arbitrário (o banco de teste não necessariamente tem usuário id=1).
    const suffix = randomUUID().slice(0, 8);
    const staff = await pool.query(
      `insert into permupay_users(email,name,"passwordHash",role,account_type,permissions,active)
       values($1,'Staff Fiscal','x','admin','STAFF','[]'::jsonb,true) returning id`,
      [`staff-fiscal-${suffix}@b2btest.local`],
    );
    staffUserId = staff.rows[0].id;
  });

  async function seedRetailOrder(): Promise<{ orderId: number; productId: number }> {
    const suffix = randomUUID().slice(0, 8);
    const p = await pool.query(
      `insert into permupay_products(sku,name,category,category_label,unit,sales_multiple,b2b_enabled,active,published,stock_quantity)
       values($1,'Produto Fiscal Teste','OUTRO','Outro','UN',1,false,true,true,10) returning id`,
      [`FISCAL-TEST-${suffix}`],
    );
    const o = await pool.query(
      `insert into permupay_orders(product_id,quantity,buyer_name,buyer_contact,buyer_contact_type,payment_method,unit_price,total_price,status,expires_at)
       values($1,1,'Cliente Teste','11999998888','WHATSAPP','PIX',100,100,'PAGO',now() + interval '1 day') returning id`,
      [p.rows[0].id],
    );
    return { orderId: o.rows[0].id, productId: p.rows[0].id };
  }

  async function seedB2BOrder(): Promise<{ orderId: number; businessId: number }> {
    const suffix = randomUUID().slice(0, 8);
    const u = await pool.query(
      `insert into permupay_users(email,name,"passwordHash",role,account_type,permissions,active)
       values($1,'Comprador Fiscal','x','user','BUYER','["b2b.catalog","b2b.quotes","b2b.orders","b2b.order_history"]'::jsonb,true) returning id`,
      [`buyer-fiscal-${suffix}@b2btest.local`],
    );
    const p = await pool.query(
      `insert into permupay_products(sku,name,category,category_label,unit,sales_multiple,b2b_enabled,active,published,stock_quantity)
       values($1,'Produto Fiscal B2B','OUTRO','Outro','UN',1,true,true,false,10) returning id`,
      [`FISCAL-TEST-B2B-${suffix}`],
    );
    const b = await pool.query(
      `insert into permupay_business_accounts(legal_name,cnpj,email,status) values($1,$2,$3,'APPROVED') returning id`,
      [`Empresa Fiscal ${suffix} LTDA`, randomCnpj(), `fiscal-${suffix}@b2btest.local`],
    );
    const o = await pool.query(
      `insert into permupay_b2b_orders(order_number,business_account_id,buyer_user_id,idempotency_key,total_cents)
       values($1,$2,$3,$4,5000) returning id`,
      [`B2B-FISCAL-${suffix}`, b.rows[0].id, u.rows[0].id, `fiscal-key-${suffix}`],
    );
    await pool.query(
      `insert into permupay_b2b_order_items(order_id,product_id,sku_snapshot,name_snapshot,unit_snapshot,quantity,unit_price_cents,total_cents)
       values($1,$2,'SKU-1','Item Fiscal','UN',1,5000,5000)`,
      [o.rows[0].id, p.rows[0].id],
    );
    return { orderId: o.rows[0].id, businessId: b.rows[0].id };
  }

  it("getFiscalSettings cria a linha padrão (provider NONE) na primeira leitura", async () => {
    const settings = await fiscal.getFiscalSettings();
    expect(settings.id).toBe(1);
    expect(settings.provider).toBe("NONE");
    expect(settings.environment).toBe("HOMOLOGACAO");
  });

  it("emitir com provedor NONE fica PENDING_PROVIDER (não trava o pedido, mas também não emite de verdade)", async () => {
    const { orderId } = await seedRetailOrder();
    const invoice = await fiscal.emitInvoiceForOrder("RETAIL", orderId, staffUserId);
    expect(invoice.status).toBe("PENDING_PROVIDER");
    expect(invoice.model).toBe("NFCE");
    expect(invoice.accessKey).toBeNull();
  });

  it("emitir com provedor MOCK autoriza a nota com chave de acesso de 44 dígitos", async () => {
    await fiscal.updateFiscalSettings({ provider: "MOCK" }, staffUserId);
    const { orderId } = await seedRetailOrder();
    const invoice = await fiscal.emitInvoiceForOrder("RETAIL", orderId, staffUserId);
    expect(invoice.status).toBe("AUTHORIZED");
    expect(invoice.accessKey).toMatch(/^\d{44}$/);
    expect(invoice.authorizedAt).not.toBeNull();
  });

  it("reemitir uma nota já AUTHORIZED é idempotente — não cria segunda linha", async () => {
    await fiscal.updateFiscalSettings({ provider: "MOCK" }, staffUserId);
    const { orderId } = await seedRetailOrder();
    const first = await fiscal.emitInvoiceForOrder("RETAIL", orderId, staffUserId);
    const second = await fiscal.emitInvoiceForOrder("RETAIL", orderId, staffUserId);
    expect(second.id).toBe(first.id);
    expect(second.accessKey).toBe(first.accessKey);

    const rows = await pool.query(`select count(*)::int as count from permupay_invoices where retail_order_id = $1`, [orderId]);
    expect(rows.rows[0].count).toBe(1);
  });

  it("duas emissões concorrentes do mesmo pedido produzem exatamente uma nota (trava a linha do pedido)", async () => {
    await fiscal.updateFiscalSettings({ provider: "MOCK" }, staffUserId);
    const { orderId } = await seedRetailOrder();

    const [a, b] = await Promise.all([
      fiscal.emitInvoiceForOrder("RETAIL", orderId, staffUserId),
      fiscal.emitInvoiceForOrder("RETAIL", orderId, staffUserId),
    ]);
    expect(a.id).toBe(b.id);

    const rows = await pool.query(`select count(*)::int as count from permupay_invoices where retail_order_id = $1`, [orderId]);
    expect(rows.rows[0].count).toBe(1);
  });

  it("emite nota B2B (modelo NFE) usando o CNPJ da empresa como destinatário", async () => {
    await fiscal.updateFiscalSettings({ provider: "MOCK" }, staffUserId);
    const { orderId } = await seedB2BOrder();
    const invoice = await fiscal.emitInvoiceForOrder("B2B", orderId, staffUserId);
    expect(invoice.status).toBe("AUTHORIZED");
    expect(invoice.model).toBe("NFE");
    const snapshot = invoice.payloadSnapshot as any;
    expect(snapshot.recipient.document).toMatch(/^\d{14}$/);
  });

  it("cancelar uma nota AUTHORIZED permite emitir uma nova nota (nova linha) para o mesmo pedido", async () => {
    await fiscal.updateFiscalSettings({ provider: "MOCK" }, staffUserId);
    const { orderId } = await seedRetailOrder();
    const first = await fiscal.emitInvoiceForOrder("RETAIL", orderId, staffUserId);

    const cancelled = await fiscal.cancelInvoice(first.id, "pedido desfeito pelo cliente", staffUserId);
    expect(cancelled.status).toBe("CANCELLED");

    const reissued = await fiscal.emitInvoiceForOrder("RETAIL", orderId, staffUserId);
    expect(reissued.id).not.toBe(first.id);
    expect(reissued.status).toBe("AUTHORIZED");

    const rows = await pool.query(`select count(*)::int as count from permupay_invoices where retail_order_id = $1`, [orderId]);
    expect(rows.rows[0].count).toBe(2);
  });

  it("grava eventos de auditoria a cada tentativa de emissão", async () => {
    await fiscal.updateFiscalSettings({ provider: "MOCK" }, staffUserId);
    const { orderId } = await seedRetailOrder();
    const invoice = await fiscal.emitInvoiceForOrder("RETAIL", orderId, staffUserId);
    const events = await fiscal.getInvoiceEvents(invoice.id);
    expect(events.length).toBeGreaterThanOrEqual(2); // EMIT_REQUESTED + PROVIDER_AUTHORIZED
    expect(events.some((e) => e.eventType === "EMIT_REQUESTED")).toBe(true);
  });
});
