import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { PERMISSIONS, hasPermission, type PermissionKey } from "../shared/permissions";
import { router, publicProcedure, authenticatedProcedure, permissionProcedure, adminProcedure } from "./_core/trpc";
import * as b2b from "./db.b2b";

const orderItems = z.array(z.object({ productId: z.number().int().positive(), quantity: z.number().int().positive() })).min(1).max(200);
const quoteInput = z.object({
  items: orderItems,
  notes: z.string().max(1000).optional(),
  idempotencyKey: z.string().min(8).max(120),
});

const buyerPermissionProcedure = (permission: PermissionKey) =>
  authenticatedProcedure.use(({ ctx, next }) => {
    if (!hasPermission(ctx.user.permissions, permission, ctx.user.role)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Este recurso não está liberado para sua empresa." });
    }
    return next({ ctx: { ...ctx, user: ctx.user } });
  });

export const b2bRouter = router({
  signup: publicProcedure
    .input(z.object({ legalName: z.string().min(2), tradeName: z.string().optional(), cnpj: z.string().min(14), email: z.string().email(), phone: z.string().optional(), name: z.string().min(2), password: z.string().min(8) }))
    .mutation(({ input }) => b2b.signupBusiness(input)),
  me: authenticatedProcedure.query(({ ctx }) => b2b.getMyBusiness(ctx.user.id)),
  catalog: buyerPermissionProcedure(PERMISSIONS.B2B_CATALOG).query(({ ctx }) => b2b.buyerCatalog(ctx.user.id)),
  createQuote: buyerPermissionProcedure(PERMISSIONS.B2B_QUOTES)
    .input(quoteInput)
    .mutation(({ ctx, input }) => b2b.createQuote(ctx.user.id, input)),
  myQuotes: buyerPermissionProcedure(PERMISSIONS.B2B_QUOTES).query(({ ctx }) => b2b.myQuotes(ctx.user.id)),
  createOrder: buyerPermissionProcedure(PERMISSIONS.B2B_ORDERS)
    .input(z.object({ items: orderItems, paymentMethod: z.string().max(30).optional(), delivery: z.record(z.string(), z.unknown()).optional(), idempotencyKey: z.string().min(8).max(120) }))
    .mutation(({ ctx, input }) => b2b.createOrder(ctx.user.id, input)),
  createOrderFromQuote: buyerPermissionProcedure(PERMISSIONS.B2B_ORDERS)
    .input(z.object({ quoteId: z.number().int().positive(), idempotencyKey: z.string().min(8).max(120) }))
    .mutation(({ ctx, input }) => b2b.createOrderFromQuote(ctx.user.id, input.quoteId, input.idempotencyKey)),
  myOrders: buyerPermissionProcedure(PERMISSIONS.B2B_ORDER_HISTORY).query(({ ctx }) => b2b.myOrders(ctx.user.id)),
  order: authenticatedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(({ ctx, input }) => b2b.getOrder(ctx.user.id, input.id, (ctx.user as any).accountType !== "BUYER")),
  admin: router({
    businesses: permissionProcedure(PERMISSIONS.B2B_OPERATIONS).query(() => b2b.listBusinesses()),
    approve: adminProcedure.input(z.object({ id: z.number().int().positive(), priceListId: z.number().int().positive().nullable().optional(), accountManagerUserId: z.number().int().positive().nullable().optional(), paymentTerms: z.unknown().optional(), minOrderCents: z.number().int().min(0).optional() })).mutation(({ input }) => b2b.approveBusiness(input.id, input)),
    suspend: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ input }) => b2b.suspendBusiness(input.id)),
    priceLists: permissionProcedure(PERMISSIONS.B2B_OPERATIONS).query(() => b2b.listPriceLists()),
    createPriceList: adminProcedure.input(z.object({ name: z.string().min(2), isDefault: z.boolean().default(false) })).mutation(({ input }) => b2b.createPriceList(input.name, input.isDefault)),
    orders: permissionProcedure(PERMISSIONS.B2B_OPERATIONS).query(() => b2b.listOrders()),
    transition: adminProcedure.input(z.object({ id: z.number().int().positive(), action: z.enum(["ACCEPT", "PAY", "SHIP", "CANCEL"]) })).mutation(({ input }) => b2b.transitionOrder(input.id, input.action)),
    quotes: permissionProcedure(PERMISSIONS.B2B_OPERATIONS).query(() => b2b.listQuotes()),
    transitionQuote: adminProcedure.input(z.object({ id: z.number().int().positive(), action: z.enum(["APPROVE", "REJECT", "CANCEL"]) })).mutation(({ input }) => b2b.transitionQuote(input.id, input.action)),
    imports: permissionProcedure(PERMISSIONS.B2B_OPERATIONS).query(() => b2b.listImportJobs()),
  }),
});
