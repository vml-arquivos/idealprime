import { z } from "zod";
import { PERMISSIONS } from "../shared/permissions";
import { adminProcedure, permissionProcedure, router } from "./_core/trpc";
import * as dbFiscal from "./db.fiscal";
import { listKnownProviders } from "./fiscal/registry";

const orderRefInput = z.object({
  orderType: z.enum(["RETAIL", "B2B"]),
  orderId: z.number().int().positive(),
});

export const fiscalRouter = router({
  // ── Configurações (dados do emitente, provedor, ambiente) ──────────────────
  settings: router({
    get: permissionProcedure(PERMISSIONS.SETTINGS).query(() => dbFiscal.getFiscalSettings()),
    update: adminProcedure
      .input(
        z.object({
          provider: z.enum(["NONE", "MOCK", "FOCUS_NFE", "PLUGNOTAS", "ENOTAS", "NFEIO", "CUSTOM"]).optional(),
          environment: z.enum(["HOMOLOGACAO", "PRODUCAO"]).optional(),
          issuerLegalName: z.string().max(200).nullable().optional(),
          issuerCnpj: z.string().regex(/^\d{14}$/).nullable().optional(),
          issuerStateRegistration: z.string().max(20).nullable().optional(),
          issuerTaxRegime: z.string().max(30).optional(),
          issuerCity: z.string().max(120).nullable().optional(),
          issuerState: z.string().length(2).nullable().optional(),
          defaultCfop: z.string().max(4).nullable().optional(),
          defaultNcm: z.string().max(8).nullable().optional(),
          notes: z.string().max(2000).nullable().optional(),
        }),
      )
      .mutation(({ ctx, input }) => dbFiscal.updateFiscalSettings(input, ctx.user.id)),
    // Lista informativa de provedores conhecidos (implementados ou não) para o seletor
    // da tela de configurações — não expõe nenhuma credencial.
    knownProviders: permissionProcedure(PERMISSIONS.SETTINGS).query(() => listKnownProviders()),
  }),

  // ── Notas fiscais ────────────────────────────────────────────────────────────
  invoices: router({
    list: permissionProcedure(PERMISSIONS.FISCAL_INVOICES)
      .input(z.object({ status: z.string().optional(), orderType: z.enum(["RETAIL", "B2B"]).optional(), limit: z.number().int().min(1).max(500).optional() }).optional())
      .query(({ input }) => dbFiscal.listInvoices(input ?? {})),
    forOrder: permissionProcedure(PERMISSIONS.FISCAL_INVOICES)
      .input(orderRefInput)
      .query(({ input }) => dbFiscal.getActiveInvoiceForOrder(input.orderType, input.orderId)),
    events: permissionProcedure(PERMISSIONS.FISCAL_INVOICES)
      .input(z.object({ invoiceId: z.number().int().positive() }))
      .query(({ input }) => dbFiscal.getInvoiceEvents(input.invoiceId)),
    eligibleRetailOrders: permissionProcedure(PERMISSIONS.FISCAL_INVOICES)
      .input(z.object({ limit: z.number().int().min(1).max(200).optional() }).optional())
      .query(({ input }) => dbFiscal.listEligibleRetailOrders(input?.limit)),
    eligibleB2BOrders: permissionProcedure(PERMISSIONS.FISCAL_INVOICES)
      .input(z.object({ limit: z.number().int().min(1).max(200).optional() }).optional())
      .query(({ input }) => dbFiscal.listEligibleB2BOrders(input?.limit)),
    emit: permissionProcedure(PERMISSIONS.FISCAL_INVOICES)
      .input(orderRefInput)
      .mutation(({ ctx, input }) => dbFiscal.emitInvoiceForOrder(input.orderType, input.orderId, ctx.user.id)),
    cancel: permissionProcedure(PERMISSIONS.FISCAL_INVOICES)
      .input(z.object({ invoiceId: z.number().int().positive(), reason: z.string().min(3).max(500) }))
      .mutation(({ ctx, input }) => dbFiscal.cancelInvoice(input.invoiceId, input.reason, ctx.user.id)),
    refreshStatus: permissionProcedure(PERMISSIONS.FISCAL_INVOICES)
      .input(z.object({ invoiceId: z.number().int().positive() }))
      .mutation(({ input }) => dbFiscal.refreshInvoiceStatus(input.invoiceId)),
  }),
});
