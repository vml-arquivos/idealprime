/**
 * Testes de autorização do `fiscalRouter` (camada tRPC), sem precisar de banco.
 *
 * Regras que este módulo precisa garantir no servidor (não só escondendo botão na
 * interface):
 *  - Só quem tem a permissão FISCAL_INVOICES pode consultar/emitir/cancelar notas.
 *  - Compradores B2B (accountType BUYER) NUNCA têm FISCAL_INVOICES por padrão — emitir
 *    nota é operação interna da equipe Ideal Prime, não do comprador.
 *  - Alterar as configurações fiscais (dados do emitente, provedor) exige admin, não
 *    só a permissão SETTINGS — envolve CNPJ/regime tributário da empresa emitente.
 */
import { TRPCError } from "@trpc/server";
import { describe, expect, it } from "vitest";
import { fiscalRouter } from "./fiscal.router";
import { BUYER_DEFAULT_PERMISSIONS, PERMISSIONS, STAFF_DEFAULT_PERMISSIONS } from "../shared/permissions";
import type { SafeUser } from "../drizzle/schema";

function fakeCtx(user: (Partial<SafeUser> & { accountType: string }) | null) {
  return {
    req: {} as any,
    res: {} as any,
    user: user as unknown as SafeUser | null,
  };
}

function staffWithout(permission: string, role: string = "user"): SafeUser {
  return {
    id: 1,
    email: "staff@ideal-prime.local",
    name: "Staff",
    role,
    accountType: "STAFF",
    permissions: STAFF_DEFAULT_PERMISSIONS.filter((p) => p !== permission),
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  } as unknown as SafeUser;
}

function buyer(): SafeUser {
  return {
    id: 2,
    email: "buyer@empresa.local",
    name: "Comprador",
    role: "user",
    accountType: "BUYER",
    permissions: BUYER_DEFAULT_PERMISSIONS,
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  } as unknown as SafeUser;
}

describe("fiscalRouter — autorização no servidor", () => {
  it("nenhum comprador B2B tem a permissão fiscal.invoices por padrão", () => {
    expect(BUYER_DEFAULT_PERMISSIONS).not.toContain(PERMISSIONS.FISCAL_INVOICES);
  });

  it("rejeita usuário não autenticado em qualquer procedure", async () => {
    const caller = fiscalRouter.createCaller(fakeCtx(null));
    await expect(caller.invoices.list()).rejects.toMatchObject({ code: "UNAUTHORIZED" } satisfies Partial<TRPCError>);
    await expect(caller.invoices.emit({ orderType: "RETAIL", orderId: 1 })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.settings.get()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rejeita comprador B2B em qualquer rota de notas fiscais (operação interna da equipe)", async () => {
    const caller = fiscalRouter.createCaller(fakeCtx(buyer()));
    await expect(caller.invoices.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.invoices.forOrder({ orderType: "B2B", orderId: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.invoices.emit({ orderType: "B2B", orderId: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejeita staff sem a permissão fiscal.invoices ao consultar/emitir/cancelar notas", async () => {
    const caller = fiscalRouter.createCaller(fakeCtx(staffWithout(PERMISSIONS.FISCAL_INVOICES)));
    await expect(caller.invoices.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.invoices.emit({ orderType: "RETAIL", orderId: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.invoices.cancel({ invoiceId: 1, reason: "teste de autorização" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejeita staff sem a permissão settings ao consultar as configurações fiscais", async () => {
    const caller = fiscalRouter.createCaller(fakeCtx(staffWithout(PERMISSIONS.SETTINGS)));
    await expect(caller.settings.get()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejeita staff não-admin (mesmo com todas as permissões) ao alterar as configurações fiscais", async () => {
    const nonAdminStaff = staffWithout(""); // todas as permissões, mas role !== 'admin'
    const caller = fiscalRouter.createCaller(fakeCtx(nonAdminStaff));
    await expect(
      caller.settings.update({ provider: "MOCK" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
