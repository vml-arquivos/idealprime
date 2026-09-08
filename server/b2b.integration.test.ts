/**
 * Testes de integração do módulo B2B contra um PostgreSQL real.
 *
 * Por que integração de verdade (não mock): os requisitos auditados
 * (docs/ideal-prime/AUDITORIA_PERMUPAY_IDEAL_PRIME.md) são, em sua maioria,
 * garantias de banco — idempotência via UNIQUE, isolamento SERIALIZABLE,
 * bloqueio FOR UPDATE, isolamento entre empresas via JOIN de membership. Mockar o
 * `pg.Pool` daria falso positivo justamente nos pontos mais sensíveis (concorrência).
 *
 * Requisito de ambiente: variável `DATABASE_URL` apontando para um PostgreSQL
 * (local ou efêmero) com as migrations já aplicadas (`pnpm db:migrate`) — ou apontando
 * para um banco vazio, caso em que este arquivo aplica as migrations no `beforeAll`.
 * Se `DATABASE_URL` não estiver definida, a suíte inteira é pulada (não falha o CI) —
 * essa é a limitação documentada em RELATORIO_IMPLANTACAO_IDEAL_PRIME.md: não há
 * Postgres disponível por padrão no pipeline de `pnpm test` sem infraestrutura extra.
 */
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

const DATABASE_URL = process.env.DATABASE_URL;

// CNPJ tem CHECK constraint no banco (^[0-9]{14}$) — nunca usar um sufixo hexadecimal
// (randomUUID) aqui, só dígitos.
function randomCnpj(): string {
  let digits = "";
  for (let i = 0; i < 14; i++) digits += Math.floor(Math.random() * 10);
  return digits;
}

describe.skipIf(!DATABASE_URL)("B2B — integração contra PostgreSQL real", () => {
  let pool: pg.Pool;
  let b2b: typeof import("./db.b2b");

  beforeAll(async () => {
    // Garante que o schema está atualizado antes de rodar os testes.
    execFileSync("node", ["scripts/migrate.mjs"], {
      cwd: process.cwd(),
      env: process.env,
      stdio: "pipe",
    });
    pool = new pg.Pool({ connectionString: DATABASE_URL });
    b2b = await import("./db.b2b");
  });

  beforeEach(async () => {
    await pool.query(`
      truncate table
        permupay_b2b_quote_items,
        permupay_b2b_quotes,
        permupay_b2b_notifications,
        permupay_b2b_stock_reservations,
        permupay_b2b_order_items,
        permupay_b2b_orders,
        permupay_import_rows,
        permupay_import_jobs,
        permupay_price_list_items,
        permupay_price_list_versions,
        permupay_price_lists,
        permupay_business_memberships,
        permupay_business_accounts
      restart identity cascade
    `);
    await pool.query(`delete from permupay_products where sku like 'TEST-%'`);
    await pool.query(`delete from permupay_users where email like '%@b2btest.local'`);
  });

  async function seedApprovedBusiness(opts: { stock?: number; priceCents?: number; salesMultiple?: number } = {}) {
    const suffix = randomUUID().slice(0, 8);
    const c = await pool.connect();
    try {
      await c.query("BEGIN");
      const u = await c.query(
        `insert into permupay_users(email,name,"passwordHash",role,account_type,permissions,active)
         values($1,'Buyer','x','user','BUYER','["b2b.catalog","b2b.quotes","b2b.orders","b2b.order_history"]'::jsonb,true) returning id`,
        [`buyer-${suffix}@b2btest.local`],
      );
      const buyerId = u.rows[0].id;
      const pl = await c.query(`insert into permupay_price_lists(name,is_default,active) values($1,false,true) returning id`, [`Tabela ${suffix}`]);
      const v = await c.query(`insert into permupay_price_list_versions(price_list_id,version) values($1,1) returning id`, [pl.rows[0].id]);
      const p = await c.query(
        `insert into permupay_products(sku,name,category,category_label,unit,sales_multiple,b2b_enabled,active,published,stock_quantity)
         values($1,'Produto Teste','OUTRO','Outro','UN',$2,true,true,false,$3) returning id`,
        [`TEST-${suffix}`, opts.salesMultiple ?? 1, opts.stock ?? 10],
      );
      await c.query(`insert into permupay_price_list_items(version_id,product_id,price_cents,active) values($1,$2,$3,true)`, [
        v.rows[0].id,
        p.rows[0].id,
        opts.priceCents ?? 1000,
      ]);
      const b = await c.query(
        `insert into permupay_business_accounts(legal_name,cnpj,email,status,assigned_price_list_id) values($1,$2,$3,'APPROVED',$4) returning id`,
        [`Empresa ${suffix} LTDA`, randomCnpj(), `empresa-${suffix}@b2btest.local`, pl.rows[0].id],
      );
      await c.query(`insert into permupay_business_memberships(business_account_id,user_id,role) values($1,$2,'MANAGER')`, [b.rows[0].id, buyerId]);
      await c.query("COMMIT");
      return { businessId: b.rows[0].id as number, buyerId: buyerId as number, productId: p.rows[0].id as number, priceListId: pl.rows[0].id as number };
    } catch (e) {
      await c.query("ROLLBACK");
      throw e;
    } finally {
      c.release();
    }
  }

  it("cadastro público cria empresa pendente e usuário sem liberar compra", async () => {
    const suffix = randomUUID().slice(0, 6);
    const { business } = await b2b.signupBusiness({
      legalName: "Nova Empresa LTDA",
      cnpj: randomCnpj(),
      email: `nova-${suffix}@b2btest.local`,
      name: "Responsável",
      password: "senha12345",
    });
    expect(business.status).toBe("PENDING");
  });

  it("registerBusiness (cadastro direto pela equipe) cria empresa já aprovada, sem exigir login do responsável", async () => {
    const suffix = randomUUID().slice(0, 6);
    const { business, managerUserId } = await b2b.registerBusiness({
      legalName: "Empresa Cadastro Direto LTDA",
      tradeName: "Cadastro Direto",
      cnpj: randomCnpj(),
      email: `direto-${suffix}@b2btest.local`,
      phone: "11999990000",
    });
    expect(business.status).toBe("APPROVED");
    expect(business.trade_name).toBe("Cadastro Direto");
    expect(managerUserId).toBeNull();

    // CNPJ duplicado é rejeitado.
    await expect(
      b2b.registerBusiness({
        legalName: "Outra Empresa LTDA",
        cnpj: business.cnpj,
        email: `outra-${suffix}@b2btest.local`,
      })
    ).rejects.toThrow(/CNPJ já cadastrado/);
  });

  it("registerBusiness cria também o login do responsável quando e-mail e senha são informados", async () => {
    const suffix = randomUUID().slice(0, 6);
    const managerEmail = `resp-${suffix}@b2btest.local`;
    const { business, managerUserId } = await b2b.registerBusiness({
      legalName: "Empresa Com Responsável LTDA",
      cnpj: randomCnpj(),
      email: `comresp-${suffix}@b2btest.local`,
      status: "APPROVED",
      managerName: "Responsável Direto",
      managerEmail,
      managerPassword: "senha12345",
    });
    expect(managerUserId).not.toBeNull();

    const membership = await pool.query(
      `select role from permupay_business_memberships where business_account_id=$1 and user_id=$2`,
      [business.id, managerUserId]
    );
    expect(membership.rows[0]?.role).toBe("MANAGER");

    const user = await pool.query(`select account_type from permupay_users where lower(email)=$1`, [managerEmail]);
    expect(user.rows[0]?.account_type).toBe("BUYER");
  });

  it("empresa pendente não compra (catálogo e pedido bloqueados)", async () => {
    const suffix = randomUUID().slice(0, 6);
    const { user, business } = await b2b.signupBusiness({
      legalName: "Empresa Pendente LTDA",
      cnpj: randomCnpj(),
      email: `pendente-${suffix}@b2btest.local`,
      name: "Responsável",
      password: "senha12345",
    });
    expect(business.status).toBe("PENDING");
    await expect(b2b.buyerCatalog(user.id)).rejects.toThrow(/não está aprovada/);
    await expect(b2b.createOrder(user.id, { items: [{ productId: 1, quantity: 1 }], idempotencyKey: "x" })).rejects.toThrow(/não está aprovada/);
  });

  it("aprovação atribui tabela comercial ativa", async () => {
    const suffix = randomUUID().slice(0, 6);
    const pl = await pool.query(`insert into permupay_price_lists(name,is_default,active) values($1,false,true) returning id`, [`Tabela Aprovação ${suffix}`]);
    const { business } = await b2b.signupBusiness({
      legalName: "Empresa Aprovar LTDA",
      cnpj: randomCnpj(),
      email: `aprovar-${suffix}@b2btest.local`,
      name: "Responsável",
      password: "senha12345",
    });
    const approved = await b2b.approveBusiness(business.id, { priceListId: pl.rows[0].id });
    expect(approved.status).toBe("APPROVED");
    expect(approved.assigned_price_list_id).toBe(pl.rows[0].id);
  });

  it("catálogo retorna somente produtos b2b habilitados/ativos da tabela vigente, sem custo/margem", async () => {
    const { buyerId, priceListId } = await seedApprovedBusiness({ priceCents: 2500 });
    // Produto que NÃO deve aparecer: sem preço na tabela.
    await pool.query(`insert into permupay_products(sku,name,category,category_label,unit,b2b_enabled,active,published) values('TEST-FORA','Fora do catálogo','OUTRO','Outro','UN',true,true,false)`);
    // Produto que NÃO deve aparecer: b2b_enabled=false.
    const off = await pool.query(`insert into permupay_products(sku,name,category,category_label,unit,b2b_enabled,active,published) values('TEST-OFF','Desabilitado B2B','OUTRO','Outro','UN',false,true,false) returning id`);
    const version = await pool.query(`select id from permupay_price_list_versions where price_list_id=$1`, [priceListId]);
    await pool.query(`insert into permupay_price_list_items(version_id,product_id,price_cents,active) values($1,$2,999,true)`, [version.rows[0].id, off.rows[0].id]);

    const catalog = await b2b.buyerCatalog(buyerId);
    expect(catalog.items).toHaveLength(1);
    expect(catalog.items[0].price_cents).toBe(2500);
    const payloadKeys = Object.keys(catalog.items[0]).join(",").toLowerCase();
    expect(payloadKeys).not.toMatch(/cost|custo|margem|margin|fornecedor|supplier/);
  });

  it("pedido usa preço do servidor (ignora qualquer valor vindo do cliente)", async () => {
    const { buyerId, productId } = await seedApprovedBusiness({ priceCents: 1500 });
    const order = await b2b.createOrder(buyerId, {
      items: [{ productId, quantity: 2, ...( { unitPrice: 1, total: 1 } as any) }],
      idempotencyKey: randomUUID(),
    });
    expect(order.total_cents).toBe(3000); // 2 x 1500, nunca o valor forjado pelo cliente
  });

  it("repetição da mesma idempotency key não duplica pedido", async () => {
    const { buyerId, productId } = await seedApprovedBusiness({ priceCents: 1000, stock: 50 });
    const key = randomUUID();
    const first = await b2b.createOrder(buyerId, { items: [{ productId, quantity: 1 }], idempotencyKey: key });
    const second = await b2b.createOrder(buyerId, { items: [{ productId, quantity: 1 }], idempotencyKey: key });
    expect(second.id).toBe(first.id);
    const count = await pool.query(`select count(*)::int as n from permupay_b2b_orders`);
    expect(count.rows[0].n).toBe(1);
  });

  it("chaves de idempotência diferentes não colidem (dois pedidos distintos)", async () => {
    const { buyerId, productId } = await seedApprovedBusiness({ priceCents: 1000, stock: 50 });
    const first = await b2b.createOrder(buyerId, { items: [{ productId, quantity: 1 }], idempotencyKey: randomUUID() });
    const second = await b2b.createOrder(buyerId, { items: [{ productId, quantity: 1 }], idempotencyKey: randomUUID() });
    expect(second.id).not.toBe(first.id);
  });

  it("pedido multitem é atômico: item inválido derruba o pedido inteiro (nenhum item criado)", async () => {
    const { buyerId, productId } = await seedApprovedBusiness({ priceCents: 1000, stock: 5, salesMultiple: 1 });
    // productId+1 não existe/não é b2b -> deve falhar e não criar nada, nem para o item válido.
    await expect(
      b2b.createOrder(buyerId, {
        items: [
          { productId, quantity: 1 },
          { productId: 999999, quantity: 1 },
        ],
        idempotencyKey: randomUUID(),
      }),
    ).rejects.toThrow();
    const orders = await pool.query(`select count(*)::int as n from permupay_b2b_orders`);
    const reservations = await pool.query(`select count(*)::int as n from permupay_b2b_stock_reservations`);
    expect(orders.rows[0].n).toBe(0);
    expect(reservations.rows[0].n).toBe(0);
  });

  it("concorrência pela última unidade deixa somente um pedido criado", async () => {
    const { buyerId, productId } = await seedApprovedBusiness({ priceCents: 1000, stock: 1 });
    const results = await Promise.allSettled([
      b2b.createOrder(buyerId, { items: [{ productId, quantity: 1 }], idempotencyKey: randomUUID() }),
      b2b.createOrder(buyerId, { items: [{ productId, quantity: 1 }], idempotencyKey: randomUUID() }),
    ]);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    const count = await pool.query(`select count(*)::int as n from permupay_b2b_orders`);
    expect(count.rows[0].n).toBe(1);
  });

  it("cancelamento libera exatamente a reserva do pedido cancelado", async () => {
    const { buyerId, productId } = await seedApprovedBusiness({ priceCents: 1000, stock: 3 });
    const order = await b2b.createOrder(buyerId, { items: [{ productId, quantity: 3 }], idempotencyKey: randomUUID() });
    const beforeCancel = await b2b.buyerCatalog(buyerId);
    expect(beforeCancel.items[0].available_quantity).toBe(0);
    await b2b.transitionOrder(order.id, "CANCEL");
    const afterCancel = await b2b.buyerCatalog(buyerId);
    expect(afterCancel.items[0].available_quantity).toBe(3);
    const reservation = await pool.query(`select status from permupay_b2b_stock_reservations where order_id=$1`, [order.id]);
    expect(reservation.rows[0].status).toBe("RELEASED");
  });

  it("máquina de estados rejeita transições inválidas (ex.: expedir sem aceitar/pagar)", async () => {
    const { buyerId, productId } = await seedApprovedBusiness({ priceCents: 1000, stock: 3 });
    const order = await b2b.createOrder(buyerId, { items: [{ productId, quantity: 1 }], idempotencyKey: randomUUID() });
    await expect(b2b.transitionOrder(order.id, "SHIP")).rejects.toThrow(/aceito comercialmente/);
    await b2b.transitionOrder(order.id, "ACCEPT");
    await expect(b2b.transitionOrder(order.id, "SHIP")).rejects.toThrow(/pagamento/i);
    await b2b.transitionOrder(order.id, "PAY");
    const shipped = await b2b.transitionOrder(order.id, "SHIP");
    expect(shipped.fulfillment_status).toBe("ENVIADO");
    await expect(b2b.transitionOrder(order.id, "CANCEL")).rejects.toThrow(/já expedido/);
  });

  it("cotação aprovada convertida em pedido não pode ser convertida duas vezes (concorrência)", async () => {
    const { buyerId, productId } = await seedApprovedBusiness({ priceCents: 1000, stock: 10 });
    const quote = await b2b.createQuote(buyerId, { items: [{ productId, quantity: 2 }], idempotencyKey: randomUUID() });
    await b2b.transitionQuote(quote.id, "APPROVE");
    const results = await Promise.allSettled([
      b2b.createOrderFromQuote(buyerId, quote.id, randomUUID()),
      b2b.createOrderFromQuote(buyerId, quote.id, randomUUID()),
    ]);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    expect(fulfilled).toHaveLength(2); // ambos resolvem (idempotência: 2ª chamada devolve o pedido já criado)
    const ordersFromQuote = await pool.query(`select id from permupay_b2b_orders where delivery_snapshot->>'quoteId' = $1`, [String(quote.id)]);
    expect(ordersFromQuote.rows).toHaveLength(1); // mas só existe UM pedido no banco
  });

  it("empresa A não lê dados/pedidos da empresa B", async () => {
    const a = await seedApprovedBusiness({ priceCents: 1000, stock: 10 });
    const b = await seedApprovedBusiness({ priceCents: 1000, stock: 10 });
    const orderA = await b2b.createOrder(a.buyerId, { items: [{ productId: a.productId, quantity: 1 }], idempotencyKey: randomUUID() });
    await expect(b2b.getOrder(b.buyerId, orderA.id, false)).rejects.toThrow(/não encontrado/);
    const myOrdersOfB = await b2b.myOrders(b.buyerId);
    expect(myOrdersOfB.find((o: any) => o.id === orderA.id)).toBeUndefined();
  });

  it("importação repetida pelo mesmo hash/perfil não duplica versão nem produtos", async () => {
    const suffix = randomUUID().slice(0, 6);
    const pl = await pool.query(`insert into permupay_price_lists(name,is_default,active) values($1,false,true) returning id`, [`Tabela Import ${suffix}`]);
    const admin = await pool.query(`insert into permupay_users(email,name,"passwordHash",role,account_type,active) values($1,'Admin','x','admin','STAFF',true) returning id`, [`admin-${suffix}@b2btest.local`]);
    const rows = [{ sku: `TEST-IMP-${suffix}`, nome: "Produto Importado", categoria: "Outro", unidade: "UN", multiplo_venda: 1, preco_venda: "10,00", ativo: true }];
    const first = await b2b.applyImport(admin.rows[0].id, { hash: "hash-abc", profileKey: "PRICES:1", mode: "PRICES", priceListId: pl.rows[0].id, rows });
    expect(first.repeated).toBe(false);
    const second = await b2b.applyImport(admin.rows[0].id, { hash: "hash-abc", profileKey: "PRICES:1", mode: "PRICES", priceListId: pl.rows[0].id, rows });
    expect(second.repeated).toBe(true);
    const products = await pool.query(`select count(*)::int as n from permupay_products where sku=$1`, [`TEST-IMP-${suffix}`.toUpperCase()]);
    expect(products.rows[0].n).toBe(1);
    const versions = await pool.query(`select count(*)::int as n from permupay_price_list_versions where price_list_id=$1`, [pl.rows[0].id]);
    expect(versions.rows[0].n).toBe(1);
  });

  it("produto criado via importação não é publicado automaticamente na vitrine pública", async () => {
    const suffix = randomUUID().slice(0, 6);
    const pl = await pool.query(`insert into permupay_price_lists(name,is_default,active) values($1,false,true) returning id`, [`Tabela Publicação ${suffix}`]);
    const admin = await pool.query(`insert into permupay_users(email,name,"passwordHash",role,account_type,active) values($1,'Admin','x','admin','STAFF',true) returning id`, [`admin2-${suffix}@b2btest.local`]);
    await b2b.applyImport(admin.rows[0].id, {
      hash: `hash-${suffix}`,
      profileKey: "PRICES:2",
      mode: "PRICES",
      priceListId: pl.rows[0].id,
      rows: [{ sku: `TEST-PUB-${suffix}`, nome: "Produto Novo", categoria: "Outro", unidade: "UN", multiplo_venda: 1, preco_venda: "5,00", ativo: true }],
    });
    const product = await pool.query(`select published from permupay_products where sku=$1`, [`TEST-PUB-${suffix}`.toUpperCase()]);
    expect(product.rows[0].published).toBe(false);
  });

  it("reservas B2B vencidas são expiradas pelo job e liberam disponibilidade", async () => {
    const { buyerId, productId } = await seedApprovedBusiness({ priceCents: 1000, stock: 2 });
    const order = await b2b.createOrder(buyerId, { items: [{ productId, quantity: 2 }], idempotencyKey: randomUUID() });
    await pool.query(`update permupay_b2b_stock_reservations set expires_at = now() - interval '1 minute' where order_id=$1`, [order.id]);
    const expiredCount = await b2b.expireStaleB2BReservations();
    expect(expiredCount).toBeGreaterThanOrEqual(1);
    const catalog = await b2b.buyerCatalog(buyerId);
    expect(catalog.items[0].available_quantity).toBe(2);
  });
});
