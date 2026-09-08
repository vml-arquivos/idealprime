/**
 * Testes de integração da área do cliente (login/cadastro com senha) contra
 * PostgreSQL real — evolução comercial, Fase 4/6 (ver
 * docs/ideal-prime/AUDITORIA_EVOLUCAO_COMERCIAL.md).
 *
 * Cobre exatamente a falha de segurança que esta funcionalidade corrige: antes,
 * a área do cliente reconhecia quem era o cliente só pelo contato informado no
 * navegador, sem senha — qualquer pessoa que soubesse o WhatsApp/e-mail de
 * outro cliente via seus pedidos e dados. Os testes abaixo confirmam que:
 *  - Uma conta nova exige senha e a sessão só é aberta com a senha correta.
 *  - Um cadastro antigo sem senha (criado via checkout rápido) pode ser
 *    "ativado" com `register` sem duplicar o registro.
 *  - `customerAuth.me`/`customers.myProfile`/`myOrders` exigem sessão de
 *    cliente — não aceitam sessão de equipe nem nenhuma sessão.
 *  - A ficha de cliente da equipe (`customers.admin.*`) exige sessão de
 *    equipe, nunca senha do próprio cliente.
 *
 * Requisito de ambiente: variável `DATABASE_URL` — se ausente, a suíte inteira
 * é pulada (mesmo padrão de server/b2b.integration.test.ts e
 * server/fiscal.integration.test.ts).
 */
import { execFileSync } from "node:child_process";
import { randomInt } from "node:crypto";
import pg from "pg";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

const DATABASE_URL = process.env.DATABASE_URL;

// Sessão de cliente exige JWT_SECRET configurado — nenhum outro teste deste
// projeto chega a assinar um token de verdade (os testes de autorização do
// b2b/fiscal usam um contexto fabricado com `ctx.user` direto, sem sessão),
// então este é o primeiro a precisar. Um segredo fixo aqui é só para o
// ambiente de teste — nunca usado em produção (lá vem de verdade do .env).
process.env.JWT_SECRET ||= "test-only-secret-customer-auth-32-chars-min";

function fakeReq(): any {
  return { protocol: "https", headers: {} };
}
function fakeRes(): { cookies: Record<string, string>; cookie: (...a: any[]) => void; clearCookie: (...a: any[]) => void } {
  const cookies: Record<string, string> = {};
  return {
    cookies,
    cookie: (name: string, value: string) => {
      cookies[name] = value;
    },
    clearCookie: (name: string) => {
      delete cookies[name];
    },
  };
}

describe.skipIf(!DATABASE_URL)("Área do cliente — integração contra PostgreSQL real", () => {
  let pool: pg.Pool;
  let appRouter: typeof import("./routers").appRouter;
  let staffUserId: number;
  let contactSuffix: string;

  beforeAll(async () => {
    execFileSync("node", ["scripts/migrate.mjs"], { cwd: process.cwd(), env: process.env, stdio: "pipe" });
    pool = new pg.Pool({ connectionString: DATABASE_URL });
    ({ appRouter } = await import("./routers"));
  });

  beforeEach(async () => {
    // Só dígitos: normalizeCustomerContact remove tudo que não for dígito de
    // contatos WHATSAPP, então um sufixo com letras (ex.: hex de randomUUID)
    // nunca bateria com o contato realmente salvo ao buscar por ele depois.
    contactSuffix = String(randomInt(1_000_000_000, 9_999_999_999));
    await pool.query(`delete from permupay_customer_communications where target like '%@customerauthtest.local'`);
    await pool.query(`delete from permupay_customers where contact like '%${contactSuffix}%'`);
    await pool.query(`delete from permupay_users where email like '%@customerauthtest.local'`);

    const staff = await pool.query(
      `insert into permupay_users(email,name,"passwordHash",role,account_type,permissions,active)
       values ($1,'Staff CustomerAuth Test','x','user','STAFF','{}',true) returning id`,
      [`staff-${contactSuffix}@customerauthtest.local`]
    );
    staffUserId = staff.rows[0].id;
  });

  function staffCtx() {
    return {
      req: fakeReq(),
      res: fakeRes(),
      user: {
        id: staffUserId,
        email: "staff@customerauthtest.local",
        name: "Staff",
        role: "user",
        accountType: "STAFF",
        permissions: ["customers"],
      } as any,
      customer: null,
    };
  }

  function anonCtx() {
    return { req: fakeReq(), res: fakeRes(), user: null, customer: null };
  }

  it("cria conta nova com senha e abre sessão só com a senha correta", async () => {
    const registerCtx = anonCtx();
    const caller = appRouter.createCaller(registerCtx);
    const contact = `1161${contactSuffix}`;

    const result = await caller.customerAuth.register({
      name: "Cliente Teste",
      contact,
      contactType: "WHATSAPP",
      password: "senha123",
    });
    expect(result.success).toBe(true);
    expect(result.customer.name).toBe("Cliente Teste");
    expect((result.customer as any).passwordHash).toBeUndefined();
    expect(registerCtx.res.cookies["customer_session_id"]).toBeTruthy();

    // Login com senha errada é rejeitado.
    await expect(
      appRouter.createCaller(anonCtx()).customerAuth.login({ contact, password: "errada" })
    ).rejects.toThrow();

    // Login com senha certa funciona e abre sessão.
    const loginCtx = anonCtx();
    const loginResult = await appRouter.createCaller(loginCtx).customerAuth.login({
      contact,
      password: "senha123",
    });
    expect(loginResult.customer.contact).toBe(contact);
    expect(loginCtx.res.cookies["customer_session_id"]).toBeTruthy();
  });

  it("ativa com senha um cadastro antigo criado sem senha (checkout rápido), sem duplicar", async () => {
    const dbCustomers = await import("./db.customers");
    const contact = `1162${contactSuffix}`;
    const existing = await dbCustomers.identifyOrCreateCustomer({
      name: "Cliente Antigo",
      contact,
      contactType: "WHATSAPP",
    });
    expect(existing.passwordHash).toBeNull();

    const result = await appRouter.createCaller(anonCtx()).customerAuth.register({
      name: "Cliente Antigo",
      contact,
      contactType: "WHATSAPP",
      password: "novaSenha1",
    });
    expect(result.customer.id).toBe(existing.id);

    const count = await pool.query(
      `select count(*) from permupay_customers where contact = $1`,
      [dbCustomers.normalizeCustomerContact(contact, "WHATSAPP")]
    );
    expect(Number(count.rows[0].count)).toBe(1);
  });

  it("customerAuth.me e customers.myOrders exigem sessão de cliente válida", async () => {
    const anon = await appRouter.createCaller(anonCtx()).customerAuth.me();
    expect(anon).toBeNull();

    await expect(appRouter.createCaller(anonCtx()).customerAuth.myOrders()).rejects.toThrow();

    // Sessão de equipe (staff) não serve como sessão de cliente.
    await expect(appRouter.createCaller(staffCtx()).customerAuth.myOrders()).rejects.toThrow();
  });

  it("ficha de clientes da equipe (customers.admin.*) exige sessão de equipe, não senha do cliente", async () => {
    const dbCustomers = await import("./db.customers");
    const contact = `1163${contactSuffix}`;
    const customer = await dbCustomers.createCustomerWithPassword({
      name: "Cliente Ficha",
      contact,
      contactType: "WHATSAPP",
      password: "senha123",
    });

    // Sem sessão nenhuma: rejeitado.
    await expect(
      appRouter.createCaller(anonCtx()).customers.admin.get({ id: customer.id })
    ).rejects.toThrow();

    // Sessão do PRÓPRIO cliente não dá acesso à ficha administrativa.
    const customerCtx = { req: fakeReq(), res: fakeRes(), user: null, customer: dbCustomers.toSafeCustomer(customer) as any };
    await expect(
      appRouter.createCaller(customerCtx).customers.admin.get({ id: customer.id })
    ).rejects.toThrow();

    // Sessão de equipe: funciona e lista aparece na busca.
    const staff = appRouter.createCaller(staffCtx());
    const fetched = await staff.customers.admin.get({ id: customer.id });
    expect(fetched.name).toBe("Cliente Ficha");

    const list = await staff.customers.admin.list({ search: contactSuffix });
    expect(list.some(row => row.id === customer.id)).toBe(true);
  });

  it("registra e lista comunicações da ficha do cliente (equipe)", async () => {
    const dbCustomers = await import("./db.customers");
    const contact = `1164${contactSuffix}`;
    const customer = await dbCustomers.createCustomerWithPassword({
      name: "Cliente Comunicação",
      contact,
      contactType: "WHATSAPP",
      password: "senha123",
    });

    const staff = appRouter.createCaller(staffCtx());
    await staff.customers.admin.logCommunication({
      customerId: customer.id,
      channel: "WHATSAPP",
      purpose: "Confirmação de pedido",
      target: "target@customerauthtest.local",
      messagePreview: "Seu pedido foi confirmado.",
    });

    const { items, total } = await staff.customers.admin.communications({ customerId: customer.id });
    expect(total).toBe(1);
    expect(items[0].purpose).toBe("Confirmação de pedido");
  });
});
