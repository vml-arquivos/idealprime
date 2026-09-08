/**
 * Testes de autorização do `b2bRouter` (camada tRPC), não apenas de `db.b2b`.
 *
 * O achado B1 da auditoria (docs/ideal-prime/AUDITORIA_PERMUPAY_IDEAL_PRIME.md) era
 * justamente um bug NO ROUTER (`order` usava `authenticatedProcedure` puro, sem
 * checar permissão) que uma bateria de testes só em `db.b2b.ts` nunca pegaria — por
 * isso este arquivo chama o router de verdade via `createCaller`, com um contexto
 * fabricado, e confirma que a rejeição acontece ANTES de qualquer acesso ao banco.
 */
import { TRPCError } from "@trpc/server";
import { describe, expect, it } from "vitest";
import { b2bRouter } from "./b2b.router";
import { BUYER_DEFAULT_PERMISSIONS, PERMISSIONS, STAFF_DEFAULT_PERMISSIONS } from "../shared/permissions";
import type { SafeUser } from "../drizzle/schema";

function fakeCtx(user: Partial<SafeUser> & { accountType: string } | null) {
  return {
    req: {} as any,
    res: {} as any,
    user: user as unknown as SafeUser | null,
    customer: null,
  };
}

function staffWithout(permission: string): SafeUser {
  return {
    id: 1,
    email: "staff@ideal-prime.local",
    name: "Staff",
    role: "user",
    accountType: "STAFF",
    permissions: STAFF_DEFAULT_PERMISSIONS.filter((p) => p !== permission),
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  } as unknown as SafeUser;
}

function buyerWithout(permission: string): SafeUser {
  return {
    id: 2,
    email: "buyer@empresa.local",
    name: "Comprador",
    role: "user",
    accountType: "BUYER",
    permissions: BUYER_DEFAULT_PERMISSIONS.filter((p) => p !== permission),
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  } as unknown as SafeUser;
}

describe("b2bRouter — autorização no servidor (achado B1)", () => {
  it("rejeita staff sem permissão B2B_OPERATIONS ao consultar um pedido por id", async () => {
    const caller = b2bRouter.createCaller(fakeCtx(staffWithout(PERMISSIONS.B2B_OPERATIONS)));
    await expect(caller.order({ id: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" } satisfies Partial<TRPCError>);
  });

  it("rejeita comprador sem permissão B2B_ORDER_HISTORY ao consultar um pedido por id", async () => {
    const caller = b2bRouter.createCaller(fakeCtx(buyerWithout(PERMISSIONS.B2B_ORDER_HISTORY)));
    await expect(caller.order({ id: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejeita usuário não autenticado em qualquer procedure autenticada", async () => {
    const caller = b2bRouter.createCaller(fakeCtx(null));
    await expect(caller.order({ id: 1 })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.catalog()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.createOrder({ items: [{ productId: 1, quantity: 1 }], idempotencyKey: "12345678" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rejeita comprador sem permissão B2B_CATALOG ao consultar o catálogo", async () => {
    const caller = b2bRouter.createCaller(fakeCtx(buyerWithout(PERMISSIONS.B2B_CATALOG)));
    await expect(caller.catalog()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejeita staff sem permissão B2B_OPERATIONS nas rotas administrativas de listagem", async () => {
    const caller = b2bRouter.createCaller(fakeCtx(staffWithout(PERMISSIONS.B2B_OPERATIONS)));
    await expect(caller.admin.businesses()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.admin.orders()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.admin.quotes()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.admin.imports()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejeita staff não-admin (mesmo com todas as permissões) nas mutations restritas a admin", async () => {
    const nonAdminStaff = staffWithout(""); // possui todas as permissões, mas role !== 'admin'
    const caller = b2bRouter.createCaller(fakeCtx(nonAdminStaff));
    await expect(caller.admin.approve({ id: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.admin.suspend({ id: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      caller.admin.register({ legalName: "X LTDA", cnpj: "12345678901234", email: "x@empresa.local" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejeita comprador em qualquer procedure restrita à equipe interna", async () => {
    const buyer = buyerWithout("");
    const caller = b2bRouter.createCaller(fakeCtx(buyer));
    await expect(caller.admin.businesses()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
