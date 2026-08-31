import { UNAUTHED_ERR_MSG } from "@shared/const";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const FRIENDLY_ERROR_MESSAGE="Não foi possível processar sua solicitação agora. Tente novamente.";
const t=initTRPC.context<TrpcContext>().create({transformer:superjson,errorFormatter({shape}){return shape.data.code==="INTERNAL_SERVER_ERROR"?{...shape,message:FRIENDLY_ERROR_MESSAGE}:shape;}});
export const router=t.router;
export const publicProcedure=t.procedure;
const requireAuthenticated=t.middleware(async({ctx,next})=>{if(!ctx.user)throw new TRPCError({code:"UNAUTHORIZED",message:UNAUTHED_ERR_MSG});return next({ctx:{...ctx,user:ctx.user}})});
const requireStaff=t.middleware(async({ctx,next})=>{if(!ctx.user)throw new TRPCError({code:"UNAUTHORIZED",message:UNAUTHED_ERR_MSG});if((ctx.user as any).accountType==="BUYER")throw new TRPCError({code:"FORBIDDEN",message:"Acesso restrito à equipe Ideal Prime."});return next({ctx:{...ctx,user:ctx.user}})});
const requireAdmin=t.middleware(async({ctx,next})=>{if(!ctx.user)throw new TRPCError({code:"UNAUTHORIZED",message:UNAUTHED_ERR_MSG});if((ctx.user as any).accountType==="BUYER"||ctx.user.role!=="admin")throw new TRPCError({code:"FORBIDDEN",message:"Acesso restrito ao administrador."});return next({ctx:{...ctx,user:ctx.user}})});
export const authenticatedProcedure=t.procedure.use(requireAuthenticated);
export const protectedProcedure=t.procedure.use(requireStaff);
export const adminProcedure=t.procedure.use(requireAdmin);
