import { z } from "zod";
import { router, publicProcedure, authenticatedProcedure, protectedProcedure, adminProcedure } from "./_core/trpc";
import * as b2b from "./db.b2b";

const orderItems=z.array(z.object({productId:z.number().int().positive(),quantity:z.number().int().positive()})).min(1).max(200);
export const b2bRouter=router({
 signup:publicProcedure.input(z.object({legalName:z.string().min(2),tradeName:z.string().optional(),cnpj:z.string().min(14),email:z.string().email(),phone:z.string().optional(),name:z.string().min(2),password:z.string().min(8)})).mutation(({input})=>b2b.signupBusiness(input)),
 me:authenticatedProcedure.query(({ctx})=>b2b.getMyBusiness(ctx.user.id)),
 catalog:authenticatedProcedure.query(({ctx})=>b2b.buyerCatalog(ctx.user.id)),
 createOrder:authenticatedProcedure.input(z.object({items:orderItems,paymentMethod:z.string().max(30).optional(),delivery:z.record(z.string(),z.unknown()).optional(),idempotencyKey:z.string().min(8).max(120)})).mutation(({ctx,input})=>b2b.createOrder(ctx.user.id,input)),
 myOrders:authenticatedProcedure.query(({ctx})=>b2b.myOrders(ctx.user.id)),
 order:authenticatedProcedure.input(z.object({id:z.number().int().positive()})).query(({ctx,input})=>b2b.getOrder(ctx.user.id,input.id,(ctx.user as any).accountType!=="BUYER")),
 admin:router({
  businesses:protectedProcedure.query(()=>b2b.listBusinesses()),
  approve:adminProcedure.input(z.object({id:z.number().int().positive(),priceListId:z.number().int().positive().nullable().optional(),accountManagerUserId:z.number().int().positive().nullable().optional(),paymentTerms:z.unknown().optional(),minOrderCents:z.number().int().min(0).optional()})).mutation(({input})=>b2b.approveBusiness(input.id,input)),
  suspend:adminProcedure.input(z.object({id:z.number().int().positive()})).mutation(({input})=>b2b.suspendBusiness(input.id)),
  priceLists:protectedProcedure.query(()=>b2b.listPriceLists()),
  createPriceList:adminProcedure.input(z.object({name:z.string().min(2),isDefault:z.boolean().default(false)})).mutation(({input})=>b2b.createPriceList(input.name,input.isDefault)),
  orders:protectedProcedure.query(()=>b2b.listOrders()),
  transition:protectedProcedure.input(z.object({id:z.number().int().positive(),action:z.enum(['ACCEPT','PAY','SHIP','CANCEL'])})).mutation(({input})=>b2b.transitionOrder(input.id,input.action)),
  imports:protectedProcedure.query(()=>b2b.listImportJobs()),
 })
});
