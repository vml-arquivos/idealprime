/**
 * server/routers.ts
 *
 * CHANGELOG v13:
 * 1. paymentSettingsSchema expandido com Fiscal, Boleto, Cartão e Descontos Universais.
 * 2. taxCash (PIX) removido do paymentSettingsSchema — forçado como 0 no db.payment-settings.ts.
 * 3. Todos os outros procedimentos INTACTOS.
 * 4. Segurança: orders.create não aceita unitPrice vindo do frontend.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { b2bRouter } from "./b2b.router";
import { sdk } from "./_core/sdk";
import * as db from "./db";
import * as dbBatches from "./db.batches";
import * as dbWishlist from "./db.wishlist";
import * as dbImages from "./db.images";
import * as dbOrders from "./db.orders";
import * as dbSettings from "./db.settings";
import * as dbPayment from "./db.payment-settings";
import * as dbCotacao from "./db.cotacao";
import * as dbSellers from "./db.sellers";
import * as dbCustomers from "./db.customers";
import * as dbAi from "./db.ai";
import { transcribeAudio } from "./_core/voiceTranscription";

// ─── Schemas reutilizáveis ────────────────────────────────────────────────────

const productInput = z.object({
  name: z.string().min(1),
  category: z.enum(["CELULAR", "ELETRONICO", "PERFUME", "OUTRO"]),
  ncm: z.string().optional(),
  costPrice: z.number().min(0),
  packagingCost: z.number().min(0),
  inboundShippingCost: z.number().min(0),
  operationalCost: z.number().min(0),
  desiredMarginRate: z.number().min(0),
  desiredMarginValue: z.number().min(0).optional(),
  marginMode: z.enum(["PERCENT", "VALUE"]).optional(),
  taxRegime: z.enum([
    "SIMPLES_NACIONAL",
    "LUCRO_PRESUMIDO",
    "LUCRO_REAL",
    "MANUAL",
  ]),
  estimatedTaxRate: z.number().min(0),
  notes: z.string().optional(),
  active: z.boolean().optional(),
  costCurrency: z.enum(["BRL", "USD"]).optional(),
  costPriceUsd: z.number().min(0).optional(),
  usdExchangeRate: z.number().min(0).optional(),
  stockQuantity: z.number().min(0).optional(),
  minimumStock: z.number().min(0).optional(),
  shortDescription: z.string().optional(),
  description: z.string().optional(),
  suggestedPrice: z.number().min(0).optional(),
  suggestedPricePix: z.number().min(0).optional(),
  suggestedPriceCard: z.number().min(0).optional(),
  suggestedPriceBoleto: z.number().min(0).optional(),
  paymentPlatform: z.enum(["MERCADO_PAGO", "PAGSEGURO", "OUTRO"]).optional(),
  pixKey: z.string().optional(),
  pixLink: z.string().optional(),
  cardPaymentUrl: z.string().optional(),
  boletoUrl: z.string().optional(),
  categoryLabel: z.string().optional(),
  promoTag: z.string().optional(),
  salesChannel: z.enum(["SHOP", "QUASE_ZERO", "BOTH"]).optional(),
  productCondition: z
    .enum(["NEW", "SEMINOVO", "USADO", "MOSTRUARIO", "OPEN_BOX", "REEMBALADO"])
    .optional(),
  conditionNotes: z.string().optional(),
  isUniquePiece: z.boolean().optional(),
  published: z.boolean().optional(),
  taxCash: z.number().min(0).optional(),
  taxBoleto: z.number().min(0).optional(),
  taxDebit: z.number().min(0).optional(),
  taxCreditCash: z.number().min(0).optional(),
  taxCreditInstallment: z.number().min(0).optional(),
  boletoMonths: z.number().min(1).optional(),
  boletoMonthlyRate: z.number().min(0).optional(),
  boletoFixedFee: z.number().min(0).optional(),
  boletoDefaultRisk: z.number().min(0).optional(),
  boletoCustomerPaysInterest: z.boolean().optional(),
  cardDebitFee: z.number().min(0).optional(),
  cardCreditCashFee: z.number().min(0).optional(),
  cardCreditInstallmentFee: z.number().min(0).optional(),
  cardInstallments: z.number().min(1).optional(),
  cardAnticipationRate: z.number().min(0).optional(),
  cardMonthlyRate: z.number().min(0).optional(),
  cardCustomerPaysInterest: z.boolean().optional(),
});

const batchItemSchema = z.object({
  productId: z.number().optional(),
  productName: z.string().min(1),

  // Dados da aquisição — opcionais para compatibilidade com chamadas antigas
  unitCostOriginal: z.number().min(0).optional(),
  costCurrency: z.enum(["BRL", "USD"]).optional(),
  exchangeRate: z.number().min(0).optional(),
  acquisitionPaymentMethod: z
    .enum(["DINHEIRO", "PIX", "BOLETO", "CARTAO", "DOLAR", "OUTRO"])
    .optional(),

  unitCostBrl: z.number().min(0),
  quantity: z.number().int().min(1),
  desiredMarginRate: z.number().min(0).max(99.9),
  estimatedTaxRate: z.number().min(0).max(99.9).optional(),
});

const pricingDefaultsSchema = z.object({
  taxRegime: z.string().optional(),
  taxCash: z.string().optional(),
  taxBoleto: z.string().optional(),
  taxDebit: z.string().optional(),
  taxCreditCash: z.string().optional(),
  taxCreditInstallment: z.string().optional(),
  boletoMonths: z.string().optional(),
  boletoMonthlyRate: z.string().optional(),
  boletoFixedFee: z.string().optional(),
  boletoDefaultRisk: z.string().optional(),
  boletoCustomerPaysInterest: z.boolean().optional(),
  cardDebitFee: z.string().optional(),
  cardCreditCashFee: z.string().optional(),
  cardCreditInstallmentFee: z.string().optional(),
  cardInstallments: z.string().optional(),
  cardAnticipationRate: z.string().optional(),
  cardMonthlyRate: z.string().optional(),
  cardCustomerPaysInterest: z.boolean().optional(),
});

// ─── paymentSettingsSchema — EXPANDIDO (v13) ──────────────────────────────────
// taxCash (PIX) AUSENTE — forçado como 0 no db.payment-settings.ts.
// Todos os campos são opcionais para permitir PATCH parcial.

const adminOnlyProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin")
    throw new Error("Acesso restrito ao administrador");
  return next();
});

const paymentSettingsSchema = z.object({
  // Fiscal
  taxRegime: z
    .enum(["SIMPLES_NACIONAL", "LUCRO_PRESUMIDO", "LUCRO_REAL", "MANUAL"])
    .optional(),
  taxBoleto: z.number().min(0).max(100).optional(),
  taxDebit: z.number().min(0).max(100).optional(),
  taxCreditCash: z.number().min(0).max(100).optional(),
  taxCreditInstallment: z.number().min(0).max(100).optional(),

  // Cartão
  cardDebitFee: z.number().min(0).max(100).optional(),
  cardCreditCashFee: z.number().min(0).max(100).optional(),
  cardCreditInstallmentFee: z.number().min(0).max(100).optional(),
  cardInstallments: z.number().min(1).max(48).optional(),
  cardAnticipationRate: z.number().min(0).max(100).optional(),
  cardMonthlyRate: z.number().min(0).max(100).optional(),
  cardCustomerPaysInterest: z.boolean().optional(),

  // Boleto
  boletoMonths: z.number().min(1).max(60).optional(),
  boletoMonthlyRate: z.number().min(0).max(100).optional(),
  boletoFixedFee: z.number().min(0).optional(),
  boletoDefaultRisk: z.number().min(0).max(100).optional(),
  boletoCustomerPaysInterest: z.boolean().optional(),

  // Descontos universais (% sobre preço final ao cliente)
  discountPix: z.number().min(0).max(100).optional(),
  discountCash: z.number().min(0).max(100).optional(),
  discountBoleto: z.number().min(0).max(100).optional(),
  discountDebit: z.number().min(0).max(100).optional(),
  discountCredit: z.number().min(0).max(100).optional(),

  // Legado (mantido para compatibilidade)
  cashDiscountPercent: z.number().min(0).max(100).optional(),

  // Links e plataforma globais (defaults para novos produtos)
  paymentPlatform: z.enum(["MERCADO_PAGO", "PAGSEGURO", "OUTRO"]).optional(),
  pixKey: z.string().optional().nullable(),
  pixLink: z.string().optional().nullable(),
  cardPaymentUrl: z.string().optional().nullable(),
  boletoUrl: z.string().optional().nullable(),
});

// ─── Router principal ─────────────────────────────────────────────────────────

export const appRouter = router({
  b2b: b2bRouter,
  system: systemRouter,

  voice: router({
    transcribe: protectedProcedure
      .input(
        z.object({
          audioUrl: z.string().min(1).max(4096),
          language: z.string().min(2).max(16).optional(),
          prompt: z.string().max(500).optional(),
        })
      )
      .mutation(({ input }) => transcribeAudio(input)),
  }),

  // ── Configurações globais de precificação (defaults) ───────────────────────
  settings: router({
    getPricingDefaults: publicProcedure.query(() =>
      dbSettings.getPricingDefaults()
    ),
    updatePricingDefaults: protectedProcedure
      .input(pricingDefaultsSchema)
      .mutation(({ input }) => dbSettings.updatePricingDefaults(input)),
  }),

  // ── Configurações de pagamento (centralizadas, travadas) ───────────────────
  paymentSettings: router({
    get: publicProcedure.query(() => dbPayment.getPaymentSettings()),
    update: protectedProcedure
      .input(paymentSettingsSchema)
      .mutation(({ input }) => dbPayment.updatePaymentSettings(input)),
  }),

  // ── Produtos ───────────────────────────────────────────────────────────────
  products: router({
    create: protectedProcedure
      .input(productInput)
      .mutation(({ input, ctx }) =>
        db.createProduct({ ...input, userId: ctx.user.id })
      ),

    quickCreate: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1).max(200),
          category: z
            .enum(["CELULAR", "ELETRONICO", "PERFUME", "OUTRO"])
            .default("OUTRO"),
          notes: z.string().optional(),
          published: z.boolean().optional(),
        })
      )
      .mutation(({ input, ctx }) =>
        db.createProduct({
          name: input.name.trim(),
          category: input.category,
          costPrice: 0,
          packagingCost: 0,
          inboundShippingCost: 0,
          operationalCost: 0,
          desiredMarginRate: 0,
          desiredMarginValue: 0,
          marginMode: "PERCENT",
          taxRegime: "SIMPLES_NACIONAL",
          estimatedTaxRate: 0,
          notes: input.notes,
          active: true,
          costCurrency: "BRL",
          stockQuantity: 0,
          minimumStock: 0,
          published: input.published ?? false,
          userId: ctx.user.id,
        })
      ),

    list: protectedProcedure.query(() => db.listProducts()),

    nextId: protectedProcedure.query(() => db.getNextProductId()),

    pendingToPublish: protectedProcedure.query(() =>
      db.listProductsToPublish()
    ),

    byId: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => db.getProductById(input.id)),

    costContext: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => db.getProductCostContext(input.id)),

    update: protectedProcedure
      .input(z.object({ id: z.number(), data: productInput.partial() }))
      .mutation(({ input }) => db.updateProduct(input.id, input.data)),

    deactivate: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => db.deactivateProduct(input.id)),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => db.deleteProduct(input.id)),

    duplicate: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => db.duplicateProduct(input.id)),

    getImages: protectedProcedure
      .input(z.object({ productId: z.number() }))
      .query(({ input }) => dbImages.getProductImages(input.productId)),

    addImage: protectedProcedure
      .input(
        z.object({
          productId: z.number(),
          url: z.string().url(),
          storageKey: z.string().optional(),
          altText: z.string().optional(),
        })
      )
      .mutation(({ input, ctx }) =>
        dbImages.addProductImage(input.productId, ctx.user.id, {
          url: input.url,
          storageKey: input.storageKey,
          altText: input.altText,
        })
      ),

    setThumbnail: protectedProcedure
      .input(z.object({ imageId: z.number(), productId: z.number() }))
      .mutation(({ input, ctx }) =>
        dbImages.setThumbnail(input.imageId, input.productId, ctx.user.id)
      ),

    reorderImages: protectedProcedure
      .input(
        z.object({
          productId: z.number(),
          orderedIds: z.array(z.number()),
        })
      )
      .mutation(({ input, ctx }) =>
        dbImages.reorderProductImages(
          input.productId,
          ctx.user.id,
          input.orderedIds
        )
      ),

    deleteImage: protectedProcedure
      .input(z.object({ imageId: z.number(), productId: z.number() }))
      .mutation(({ input, ctx }) =>
        dbImages.deleteProductImageRecord(
          input.imageId,
          input.productId,
          ctx.user.id
        )
      ),

    updateImageAlt: protectedProcedure
      .input(
        z.object({
          imageId: z.number(),
          productId: z.number(),
          altText: z.string(),
        })
      )
      .mutation(({ input, ctx }) =>
        dbImages.updateImageAltText(
          input.imageId,
          input.productId,
          ctx.user.id,
          input.altText
        )
      ),

    setImageUrl: protectedProcedure
      .input(z.object({ productId: z.number(), imageUrl: z.string().url() }))
      .mutation(({ input, ctx }) =>
        dbBatches.updateProductImage(
          input.productId,
          ctx.user.id,
          input.imageUrl
        )
      ),

    reorder: protectedProcedure
      .input(z.object({ orderedIds: z.array(z.number()) }))
      .mutation(({ input }) => db.reorderProducts(input.orderedIds)),

    togglePublished: protectedProcedure
      .input(
        z.object({
          productId: z.number(),
          published: z.boolean(),
          promoTag: z.string().optional(),
        })
      )
      .mutation(({ input, ctx }) =>
        dbBatches.togglePublished(
          input.productId,
          ctx.user.id,
          input.published,
          input.promoTag
        )
      ),

    adjustStock: protectedProcedure
      .input(
        z.object({
          productId: z.number(),
          quantity: z.number(),
          unitCost: z.number().min(0),
          notes: z.string().optional(),
        })
      )
      .mutation(({ input, ctx }) =>
        dbBatches.adjustStock(
          input.productId,
          ctx.user.id,
          input.quantity,
          input.unitCost,
          input.notes
        )
      ),

    stockEntries: protectedProcedure
      .input(z.object({ productId: z.number() }))
      .query(({ input }) => dbBatches.getStockEntries(input.productId)),
  }),

  // ── Lotes de Precificação ──────────────────────────────────────────────────
  batches: router({
    create: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1),
          description: z.string().optional(),
          totalOperationalCost: z.number().min(0),
          totalTaxCost: z.number().min(0).optional(),
          totalOtherCost: z.number().min(0).optional(),
        })
      )
      .mutation(({ input, ctx }) =>
        dbBatches.createBatch({ ...input, userId: ctx.user.id })
      ),

    list: protectedProcedure.query(() => dbBatches.listBatches()),

    regularizationCandidates: protectedProcedure.query(() =>
      dbBatches.listInitialRegularizationCandidates()
    ),

    byId: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => dbBatches.getBatchById(input.id)),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => dbBatches.deleteBatch(input.id)),

    process: protectedProcedure
      .input(
        z.object({
          batchId: z.number(),
          items: z.array(batchItemSchema).min(1),
          totalOperationalCost: z.number().min(0),
          totalTaxCost: z.number().min(0).optional(),
          totalOtherCost: z.number().min(0).optional(),
          commitToStock: z.boolean().default(false),
        })
      )
      .mutation(({ input, ctx }) =>
        dbBatches.processBatch(
          input.batchId,
          ctx.user.id,
          input.items,
          input.totalOperationalCost,
          input.totalTaxCost ?? 0,
          input.totalOtherCost ?? 0,
          input.commitToStock
        )
      ),

    // ── FIFO: processar lote com fila de espera ──────────────────────────
    processFIFO: protectedProcedure
      .input(
        z.object({
          batchId: z.number(),
          items: z.array(batchItemSchema).min(1),
          totalOperationalCost: z.number().min(0),
          totalTaxCost: z.number().min(0).optional(),
          totalOtherCost: z.number().min(0).optional(),
        })
      )
      .mutation(({ input, ctx }) =>
        dbBatches.processBatchFIFO(
          input.batchId,
          ctx.user.id,
          input.items,
          input.totalOperationalCost,
          input.totalTaxCost ?? 0,
          input.totalOtherCost ?? 0
        )
      ),

    processInitialRegularization: protectedProcedure
      .input(
        z.object({
          batchId: z.number(),
          items: z.array(batchItemSchema).min(1),
          totalOperationalCost: z.number().min(0),
          totalTaxCost: z.number().min(0).optional(),
          totalOtherCost: z.number().min(0).optional(),
        })
      )
      .mutation(({ input, ctx }) =>
        dbBatches.processInitialRegularizationBatch(
          input.batchId,
          ctx.user.id,
          input.items,
          input.totalOperationalCost,
          input.totalTaxCost ?? 0,
          input.totalOtherCost ?? 0
        )
      ),

    // ── FIFO: registrar venda e disparar gatilho de virada ───────────────
    registerSale: protectedProcedure
      .input(
        z.object({
          productId: z.number(),
          qtySold: z.number().min(0.001),
        })
      )
      .mutation(({ input, ctx }) =>
        dbBatches.triggerStockTransition(
          input.productId,
          input.qtySold,
          ctx.user.id
        )
      ),

    // ── FIFO: consultar fila de um produto ───────────────────────────────
    getQueue: protectedProcedure
      .input(z.object({ productId: z.number() }))
      .query(({ input }) => dbBatches.getStockQueue(input.productId)),

    // ── FIFO: listar toda a fila (admin) ─────────────────────────────────
    allQueues: protectedProcedure
      .input(z.object({ status: z.string().optional() }))
      .query(({ input }) => dbBatches.getAllQueues(input.status)),

    // ── FIFO: cancelar entrada na fila ───────────────────────────────────
    cancelQueue: protectedProcedure
      .input(z.object({ queueId: z.number() }))
      .mutation(({ input }) => dbBatches.cancelQueueEntry(input.queueId)),
  }),

  // ── IA para cadastro de produto ─────────────────────────────────────────────
  ai: router({
    suggestProductInfo: protectedProcedure
      .input(
        z.object({
          imageUrl: z.string().url().optional(),
          name: z.string().trim().optional(),
        })
      )
      .mutation(async ({ input }) => {
        try {
          return await dbAi.suggestProductInfo(input);
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : "Não foi possível obter a sugestão da IA agora.";
          if (message === dbAi.AI_NOT_CONFIGURED_MESSAGE) {
            throw new TRPCError({
              code: "PRECONDITION_FAILED",
              message: dbAi.AI_NOT_CONFIGURED_MESSAGE,
            });
          }
          throw new TRPCError({ code: "BAD_REQUEST", message });
        }
      }),
  }),

  // ── Marketplace / Vitrine pública ──────────────────────────────────────────
  marketplace: router({
    products: publicProcedure.query(() => dbBatches.getPublishedProducts()),
    quaseZeroProducts: publicProcedure.query(() =>
      dbBatches.getQuaseZeroProducts()
    ),
    productsByCategory: publicProcedure
      .input(z.object({ category: z.string().optional() }))
      .query(({ input }) =>
        dbBatches.getPublishedProductsByCategory(input.category)
      ),
    productById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => dbBatches.getPublishedProductById(input.id)),
  }),

  // ── Simulações ─────────────────────────────────────────────────────────────
  simulations: router({
    create: protectedProcedure
      .input(z.any())
      .mutation(({ input, ctx }) =>
        db.createSimulation({ ...input, userId: ctx.user.id })
      ),

    list: protectedProcedure.query(() => db.listSimulations()),

    byId: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => db.getSimulationById(input.id)),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => db.deleteSimulation(input.id)),

    duplicate: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => db.duplicateSimulation(input.id)),
  }),

  // ── Lista de Desejos ──────────────────────────────────────────────────────
  wishlist: router({
    create: publicProcedure
      .input(
        z.object({
          visitorName: z.string().min(2),
          contact: z.string().min(8),
          contactType: z.enum(["WHATSAPP", "EMAIL"]).default("WHATSAPP"),
          // Campos novos v2
          productIds: z.array(z.number().int().positive()).min(1),
          notesPublic: z.string().max(300).optional(),
          // Campos legados opcionais (compatibilidade com código existente)
          category: z
            .enum(["CELULAR", "ELETRONICO", "PERFUME", "OUTRO"])
            .optional(),
          brand: z.string().optional(),
          model: z.string().optional(),
          description: z.string().optional(),
          budgetMin: z.number().min(0).default(0),
          budgetMax: z.number().min(0).default(0),
          isAnonymous: z.boolean().default(false),
        })
      )
      .mutation(({ input, ctx }) => {
        const ipRaw =
          (ctx.req.headers["x-forwarded-for"] as string | undefined) ??
          (ctx.req as any).ip ??
          "";
        const ipHash = ipRaw
          ? Buffer.from(ipRaw).toString("base64").slice(0, 16)
          : undefined;
        // Garante description não-null para schema legado
        const description = input.description ?? "";
        return dbWishlist.createWishlistRequest({
          ...input,
          description,
          ipHash,
        });
      }),

    myRequests: publicProcedure
      .input(
        z.object({
          contact: z.string().min(1).optional(),
          phone: z.string().min(1).optional(),
        })
      )
      .query(({ input }) => {
        const lookup = input.phone ?? input.contact ?? "";
        return dbWishlist.getWishlistByContact(lookup);
      }),

    list: protectedProcedure
      .input(
        z
          .object({
            status: z
              .enum(["NOVO", "VISUALIZADO", "CONTATADO", "ATENDIDO", "FECHADO"])
              .optional(),
            category: z.string().optional(),
          })
          .optional()
      )
      .query(({ input }) => dbWishlist.listWishlistRequests(input)),

    updateStatus: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          status: z.enum([
            "NOVO",
            "VISUALIZADO",
            "CONTATADO",
            "ATENDIDO",
            "FECHADO",
          ]),
          adminNotes: z.string().optional(),
        })
      )
      .mutation(({ input, ctx }) =>
        dbWishlist.updateWishlistStatus(
          input.id,
          input.status,
          input.adminNotes,
          ctx.user.id
        )
      ),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => dbWishlist.deleteWishlistRequest(input.id)),

    counts: protectedProcedure.query(() => dbWishlist.getWishlistCounts()),
  }),

  // ── Categorias ─────────────────────────────────────────────────────────────
  categories: router({
    list: publicProcedure
      .input(z.object({ onlyActive: z.boolean().default(false) }).optional())
      .query(({ input }) => dbWishlist.listCategories(input?.onlyActive)),

    create: protectedProcedure
      .input(
        z.object({
          slug: z.string().min(2).max(50),
          label: z.string().min(2).max(100),
          emoji: z.string().max(10).default("📦"),
          sortOrder: z.number().int().default(0),
          active: z.boolean().default(true),
        })
      )
      .mutation(({ input }) => dbWishlist.createCategory(input)),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number().int(),
          slug: z.string().min(2).max(50).optional(),
          label: z.string().min(2).max(100).optional(),
          emoji: z.string().max(10).optional(),
          sortOrder: z.number().int().optional(),
          active: z.boolean().optional(),
        })
      )
      .mutation(({ input }) => {
        const { id, ...data } = input;
        return dbWishlist.updateCategory(id, data);
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number().int() }))
      .mutation(({ input }) => dbWishlist.deleteCategory(input.id)),
  }),

  // ── Vendedores externos e comissões ────────────────────────────────────────
  sellers: router({
    resolveByToken: publicProcedure
      .input(z.object({ accessToken: z.string().min(1).max(64) }))
      .query(async ({ input }) => {
        const seller = await dbSellers.getSellerByAccessToken(
          input.accessToken
        );
        if (!seller) return null;
        const { accessToken: _accessToken, ...safeSeller } = seller;
        return safeSeller;
      }),

    catalog: publicProcedure
      .input(z.object({ accessToken: z.string().min(1).max(64) }))
      .query(({ input }) => dbSellers.getExternalCatalog(input.accessToken)),

    publicCatalog: publicProcedure
      .input(z.object({ referralCode: z.string().min(1).max(60) }))
      .query(async ({ input }) => {
        const seller = await dbSellers.getSellerByReferralCode(
          input.referralCode,
          true
        );
        if (!seller)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Link de loja inválido ou inativo",
          });
        const products = await dbBatches.getPublishedProducts();
        return {
          sellerName: seller.name,
          referralCode: seller.referralCode,
          products,
        };
      }),

    sponsor: publicProcedure
      .input(z.object({ referralCode: z.string().min(1).max(60) }))
      .query(async ({ input }) => {
        const seller = await dbSellers.getSellerByReferralCode(
          input.referralCode,
          true
        );
        return seller
          ? { name: seller.name, referralCode: seller.referralCode }
          : null;
      }),

    applyAsSeller: publicProcedure
      .input(
        z.object({
          name: z.string().trim().min(3),
          email: z.string().email(),
          phone: z.string().min(8),
          cpf: z.string().min(11),
          birthDate: z.string().date(),
          address: z.string().trim().min(5),
          city: z.string().trim().min(2),
          state: z.string().trim().length(2),
          zipCode: z.string().min(8),
          pixKey: z.string().trim().min(3),
          documentFrontUrl: z.string().url(),
          documentBackUrl: z.string().url().optional(),
          selfiePhotoUrl: z.string().url(),
          sponsorReferralCode: z.string().trim().max(60).optional(),
        })
      )
      .mutation(({ input }) => dbSellers.applyAsSeller(input)),

    pending: adminOnlyProcedure.query(() => dbSellers.listPendingSellers()),

    approve: adminOnlyProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(({ input, ctx }) =>
        dbSellers.approveSeller(input.id, ctx.user.id)
      ),

    reject: adminOnlyProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          reason: z.string().max(500).optional(),
        })
      )
      .mutation(({ input, ctx }) =>
        dbSellers.rejectSeller(input.id, ctx.user.id, input.reason)
      ),

    network: publicProcedure
      .input(z.object({ accessToken: z.string().min(1).max(64) }))
      .query(async ({ input }) => {
        const seller = await dbSellers.getSellerByAccessToken(
          input.accessToken,
          true
        );
        if (!seller)
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Token de vendedor inválido ou inativo",
          });
        return dbSellers.getSellerNetwork(seller.id);
      }),

    ranking: adminOnlyProcedure
      .input(
        z
          .object({
            period: z.enum(["7d", "30d", "90d", "all"]).default("all"),
          })
          .optional()
      )
      .query(({ input }) => dbSellers.getSellerRanking(input?.period ?? "all")),

    myRanking: publicProcedure
      .input(
        z.object({
          accessToken: z.string().min(1).max(64),
          period: z.enum(["7d", "30d", "90d", "all"]).default("all"),
        })
      )
      .query(async ({ input }) => {
        const seller = await dbSellers.getSellerByAccessToken(
          input.accessToken,
          true
        );
        if (!seller)
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Token de vendedor inválido ou inativo",
          });
        const ranking = await dbSellers.getSellerRanking(input.period);
        const position = ranking.findIndex(row => row.sellerId === seller.id);
        const row = position >= 0 ? ranking[position] : null;
        return { position: position >= 0 ? position + 1 : null, seller: row };
      }),

    createDirectOrder: publicProcedure
      .input(
        z.object({
          sellerId: z.number().optional(),
          referralCode: z.string().max(60).optional(),
          accessToken: z.string().max(64).optional(),
          productId: z.number(),
          quantity: z.number().int().min(1).default(1),
          unitPrice: z.number().positive(),
          buyerName: z.string().min(2, "Informe seu nome"),
          buyerContact: z.string().min(8, "Informe WhatsApp ou email"),
          buyerContactType: z.enum(["WHATSAPP", "EMAIL"]).default("WHATSAPP"),
          paymentMethod: z.enum(["PIX", "DINHEIRO", "CARTAO", "BOLETO"]),
          markAsPaid: z.boolean().default(false),
          allowBelowCost: z.boolean().optional(),
        })
      )
      .mutation(({ input, ctx }) =>
        dbSellers.createDirectOrder({
          ...input,
          requestingUserId: ctx.user?.id ?? null,
          allowBelowCost: Boolean(
            ctx.user?.role === "admin" && input.allowBelowCost
          ),
        })
      ),

    list: adminOnlyProcedure.query(() => dbSellers.listSellers()),

    create: adminOnlyProcedure
      .input(
        z.object({
          name: z.string().min(2),
          type: z.enum(["INTERNO", "EXTERNO"]).default("EXTERNO"),
          email: z.string().email().optional().or(z.literal("")),
          phone: z.string().optional(),
          contact: z.string().optional(),
          userId: z.number().int().nullable().optional(),
          referralCode: z.string().max(60).optional(),
          commissionType: z.enum(["PERCENT", "FIXED"]).default("PERCENT"),
          commissionValue: z.number().min(0).default(0),
          commissionRate: z.number().min(0).max(100).optional(),
          active: z.boolean().default(true),
        })
      )
      .mutation(({ input }) =>
        dbSellers.createSeller({ ...input, status: "APROVADO" })
      ),

    update: adminOnlyProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().min(2).optional(),
          type: z.enum(["INTERNO", "EXTERNO"]).optional(),
          email: z.string().email().nullable().optional().or(z.literal("")),
          phone: z.string().nullable().optional(),
          contact: z.string().nullable().optional(),
          userId: z.number().int().nullable().optional(),
          referralCode: z.string().max(60).optional(),
          accessToken: z.string().max(64).nullable().optional(),
          commissionType: z.enum(["PERCENT", "FIXED"]).optional(),
          commissionValue: z.number().min(0).optional(),
          commissionRate: z.number().min(0).max(100).optional(),
          active: z.boolean().optional(),
        })
      )
      .mutation(({ input }) => {
        const { id, ...data } = input;
        return dbSellers.updateSeller(id, data);
      }),

    delete: adminOnlyProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => dbSellers.deleteSeller(input.id)),

    commissions: router({
      list: adminOnlyProcedure
        .input(
          z
            .object({
              sellerId: z.number().optional(),
              status: z
                .enum(["PENDENTE", "PAGO", "PAGA", "CANCELADA"])
                .optional(),
            })
            .optional()
        )
        .query(({ input }) => dbSellers.listCommissions(input)),
      markPaid: adminOnlyProcedure
        .input(z.object({ id: z.number() }))
        .mutation(({ input }) => dbSellers.markCommissionPaid(input.id)),
    }),
  }),

  // ── Clientes finais e carrinho ─────────────────────────────────────────────
  customers: router({
    identify: protectedProcedure
      .input(z.object({ contact: z.string().min(5) }))
      .query(({ input }) => dbCustomers.getCustomerByContact(input.contact)),

    myOrders: protectedProcedure
      .input(z.object({ contact: z.string().min(5) }))
      .query(async ({ input }) => {
        const customer = await dbCustomers.getCustomerByContact(input.contact);
        if (!customer) return [];
        return dbCustomers.listCustomerOrders(customer.id);
      }),

    checkout: protectedProcedure
      .input(
        z.object({
          items: z
            .array(
              z.object({
                productId: z.number().int().positive(),
                quantity: z.number().int().min(1),
                paymentMethod: z.enum(["PIX", "DINHEIRO", "CARTAO", "BOLETO"]),
              })
            )
            .min(1),
          customer: z.object({
            name: z.string().trim().min(2),
            contact: z.string().trim().min(8),
            contactType: z.enum(["WHATSAPP", "EMAIL"]).default("WHATSAPP"),
            email: z.string().email().optional(),
            address: z.string().optional(),
            city: z.string().optional(),
            state: z.string().length(2).optional(),
            zipCode: z.string().optional(),
          }),
          referralCode: z.string().max(60).optional(),
        })
      )
      .mutation(({ input }) => dbOrders.createCartCheckout(input)),
  }),

  // ── Pedidos ────────────────────────────────────────────────────────────────
  orders: router({
    create: protectedProcedure
      .input(
        z.object({
          productId: z.number(),
          quantity: z.number().int().min(1).default(1),
          buyerName: z.string().min(2, "Informe seu nome"),
          buyerContact: z.string().min(8, "Informe WhatsApp ou email"),
          buyerContactType: z.enum(["WHATSAPP", "EMAIL"]).default("WHATSAPP"),
          paymentMethod: z.enum(["PIX", "DINHEIRO", "CARTAO", "BOLETO"]),
          referralCode: z.string().max(32).optional(),
        })
      )
      .mutation(({ input }) => dbOrders.createOrder(input)),

    list: protectedProcedure
      .input(
        z
          .object({
            status: z
              .enum([
                "AGUARDANDO_PAGAMENTO",
                "RESERVADO",
                "PAGO",
                "CANCELADO",
                "EXPIRADO",
              ])
              .optional(),
            productId: z.number().optional(),
            customerId: z.number().int().positive().optional(),
          })
          .optional()
      )
      .query(({ input }) => dbOrders.listOrders(input)),

    byId: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => dbOrders.getOrderById(input.id)),

    confirm: protectedProcedure
      .input(
        z.object({
          orderId: z.number(),
          adminNotes: z.string().optional(),
          paymentMethod: z
            .enum(["PIX", "DINHEIRO", "CARTAO", "BOLETO"])
            .optional(),
        })
      )
      .mutation(({ input, ctx }) =>
        dbOrders.confirmOrder(
          input.orderId,
          ctx.user.id,
          input.adminNotes,
          input.paymentMethod
        )
      ),

    cancel: protectedProcedure
      .input(
        z.object({
          orderId: z.number(),
          adminNotes: z.string().optional(),
        })
      )
      .mutation(({ input }) =>
        dbOrders.cancelOrder(input.orderId, input.adminNotes)
      ),

    delete: protectedProcedure
      .input(
        z.object({
          orderId: z.number(),
          restoreStock: z.boolean().default(true),
        })
      )
      .mutation(({ input, ctx }) =>
        dbOrders.deleteOrder(input.orderId, ctx.user.id, input.restoreStock)
      ),

    expireStale: protectedProcedure.mutation(() =>
      dbOrders.expireStaleReservations()
    ),

    counts: protectedProcedure.query(() => dbOrders.getOrderCounts()),
  }),

  // ── Dashboard ─────────────────────────────────────────────────────────────
  dashboard: protectedProcedure.query(async ({ ctx }) => {
    const [dashData, wishlistCounts] = await Promise.all([
      db.getDashboardData(ctx.user.id),
      dbWishlist.getWishlistCounts(),
    ]);
    return { ...dashData, wishlistCounts };
  }),

  // ── Auth ────────────────────────────────────────────────────────────────────
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),

    login: publicProcedure
      .input(
        z.object({
          email: z.string().email("Email inválido"),
          password: z.string().min(1, "Senha obrigatória"),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const user = await db.getUserByEmail(input.email);
        if (!user || !user.active) throw new Error("Credenciais inválidas");

        const valid = await db.verifyPassword(user, input.password);
        if (!valid) throw new Error("Credenciais inválidas");

        await db.updateLastSignedIn(user.id);

        const token = await sdk.createSessionToken({
          userId: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        });

        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, token, {
          ...cookieOptions,
          maxAge: ONE_YEAR_MS,
        });

        return { success: true as const, user: db.toSafeUser(user) };
      }),

    register: publicProcedure
      .input(
        z.object({
          email: z.string().email("Email inválido"),
          password: z.string().min(8, "Senha deve ter no mínimo 8 caracteres"),
          name: z.string().min(2, "Nome deve ter no mínimo 2 caracteres"),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const existing = await db.getUserByEmail(input.email);
        if (existing) throw new Error("Email já cadastrado");

        const totalUsers = await db.countUsers();
        if (totalUsers > 0) throw new Error("Cadastro interno desabilitado. Solicite acesso a um administrador.");
        const role: "admin" | "user" = "admin";

        const user = await db.createUser({
          email: input.email,
          password: input.password,
          name: input.name,
          role,
        });

        const token = await sdk.createSessionToken({
          userId: (user as any).id,
          email: user.email,
          name: user.name,
          role: user.role,
        });

        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, token, {
          ...cookieOptions,
          maxAge: ONE_YEAR_MS,
        });

        return { success: true as const, user };
      }),

    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ── Admin ──────────────────────────────────────────────────────────────────
  admin: router({
    listUsers: adminOnlyProcedure.query(async () => {
      const dbConn = await db.getDb();
      if (!dbConn) return [];
      const { users } = await import("../drizzle/schema");
      const { desc } = await import("drizzle-orm");
      return dbConn
        .select({
          id: users.id,
          email: users.email,
          name: users.name,
          role: users.role,
          active: users.active,
          createdAt: users.createdAt,
          lastSignedIn: users.lastSignedIn,
        })
        .from(users)
        .orderBy(desc(users.createdAt));
    }),

    createUser: adminOnlyProcedure
      .input(
        z.object({
          email: z.string().email(),
          name: z.string().min(2),
          password: z.string().min(8),
          role: z.enum(["user", "admin"]).default("user"),
        })
      )
      .mutation(async ({ input }) => {
        const existing = await db.getUserByEmail(input.email);
        if (existing) throw new Error("Email já cadastrado");
        return db.createUser(input);
      }),

    updateUser: adminOnlyProcedure
      .input(
        z.object({
          userId: z.number(),
          name: z.string().min(2),
          email: z.string().email(),
          role: z.enum(["user", "admin"]),
          active: z.boolean(),
          newPassword: z.string().min(8).optional().or(z.literal("")),
        })
      )
      .mutation(async ({ input, ctx }) => {
        if (
          input.userId === ctx.user.id &&
          (!input.active || input.role !== ctx.user.role)
        ) {
          throw new Error(
            "Não é possível rebaixar ou desativar sua própria conta"
          );
        }
        return db.updateUserAdmin(input.userId, {
          name: input.name,
          email: input.email,
          role: input.role,
          active: input.active,
          newPassword: input.newPassword || undefined,
        });
      }),

    updateUserRole: adminOnlyProcedure
      .input(z.object({ userId: z.number(), role: z.enum(["user", "admin"]) }))
      .mutation(async ({ input, ctx }) => {
        if (input.userId === ctx.user.id)
          throw new Error("Não é possível alterar seu próprio papel");
        const dbConn = await db.getDb();
        if (!dbConn) throw new Error("Database not available");
        const { users } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const [updated] = await dbConn
          .update(users)
          .set({ role: input.role, updatedAt: new Date() })
          .where(eq(users.id, input.userId))
          .returning({
            id: users.id,
            email: users.email,
            name: users.name,
            role: users.role,
            active: users.active,
          });
        return updated;
      }),

    toggleUserActive: adminOnlyProcedure
      .input(z.object({ userId: z.number(), active: z.boolean() }))
      .mutation(async ({ input, ctx }) => {
        if (input.userId === ctx.user.id)
          throw new Error("Não é possível desativar sua própria conta");
        const dbConn = await db.getDb();
        if (!dbConn) throw new Error("Database not available");
        const { users } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const [updated] = await dbConn
          .update(users)
          .set({ active: input.active, updatedAt: new Date() })
          .where(eq(users.id, input.userId))
          .returning({
            id: users.id,
            email: users.email,
            name: users.name,
            role: users.role,
            active: users.active,
          });
        return updated;
      }),

    resetUserPassword: adminOnlyProcedure
      .input(z.object({ userId: z.number(), newPassword: z.string().min(8) }))
      .mutation(async ({ input }) => {
        const dbConn = await db.getDb();
        if (!dbConn) throw new Error("Database not available");
        const { users } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const bcrypt = await import("bcryptjs");
        const passwordHash = await bcrypt.hash(input.newPassword, 12);
        await dbConn
          .update(users)
          .set({ passwordHash, updatedAt: new Date() })
          .where(eq(users.id, input.userId));
        return { success: true };
      }),

    deleteUser: adminOnlyProcedure
      .input(z.object({ userId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        return db.deleteUser(input.userId, ctx.user.id);
      }),
  }),

  // ── Cotação de Preços ──────────────────────────────────────────────────────
  cotacao: router({
    // ── Locais ────────────────────────────────────────────────────────────
    locais: router({
      listar: protectedProcedure.query(({ ctx }) =>
        dbCotacao.listarLocais(ctx.user.id)
      ),

      criar: protectedProcedure
        .input(
          z.object({
            nome: z.string().min(1).max(200),
            endereco: z.string().optional(),
            lat: z.string().optional(),
            lng: z.string().optional(),
            tipoComercio: z.string().max(100).optional(),
            custoOperacionalPadrao: z.string().optional(),
            // Novos campos opcionais para detalhes do local
            cnpj: z.string().optional(),
            telefone: z.string().optional(),
            whatsapp: z.string().optional(),
            cep: z.string().optional(),
            logradouro: z.string().optional(),
            numero: z.string().optional(),
            complemento: z.string().optional(),
            bairro: z.string().optional(),
            cidade: z.string().optional(),
            estado: z.string().optional(),
            referencia: z.string().optional(),
            logoUrl: z.string().optional(),
          })
        )
        .mutation(({ input, ctx }) => dbCotacao.criarLocal(ctx.user.id, input)),

      atualizar: protectedProcedure
        .input(
          z.object({
            id: z.number(),
            nome: z.string().min(1).max(200).optional(),
            endereco: z.string().optional(),
            lat: z.string().optional(),
            lng: z.string().optional(),
            tipoComercio: z.string().max(100).optional(),
            custoOperacionalPadrao: z.string().optional(),
            fotoFachada: z.string().optional(),
            // Campos opcionais adicionais
            cnpj: z.string().optional(),
            telefone: z.string().optional(),
            whatsapp: z.string().optional(),
            cep: z.string().optional(),
            logradouro: z.string().optional(),
            numero: z.string().optional(),
            complemento: z.string().optional(),
            bairro: z.string().optional(),
            cidade: z.string().optional(),
            estado: z.string().optional(),
            referencia: z.string().optional(),
            logoUrl: z.string().optional(),
          })
        )
        .mutation(({ input, ctx }) => {
          const { id, ...data } = input;
          return dbCotacao.atualizarLocal(id, ctx.user.id, data);
        }),

      reverseGeocode: protectedProcedure
        .input(
          z.object({
            latitude: z.number().min(-90).max(90),
            longitude: z.number().min(-180).max(180),
          })
        )
        .mutation(async ({ input }) => {
          const ufByState: Record<string, string> = {
            acre: "AC",
            alagoas: "AL",
            amapá: "AP",
            amazonas: "AM",
            bahia: "BA",
            ceará: "CE",
            "distrito federal": "DF",
            "espírito santo": "ES",
            goiás: "GO",
            maranhão: "MA",
            "mato grosso": "MT",
            "mato grosso do sul": "MS",
            "minas gerais": "MG",
            pará: "PA",
            paraíba: "PB",
            paraná: "PR",
            pernambuco: "PE",
            piauí: "PI",
            "rio de janeiro": "RJ",
            "rio grande do norte": "RN",
            "rio grande do sul": "RS",
            rondônia: "RO",
            roraima: "RR",
            "santa catarina": "SC",
            "são paulo": "SP",
            sergipe: "SE",
            tocantins: "TO",
          };

          const clean = (value: unknown) =>
            typeof value === "string" && value.trim().length > 0
              ? value.trim()
              : undefined;

          const url = new URL("https://nominatim.openstreetmap.org/reverse");
          url.searchParams.set("format", "jsonv2");
          url.searchParams.set("lat", String(input.latitude));
          url.searchParams.set("lon", String(input.longitude));
          url.searchParams.set("zoom", "18");
          url.searchParams.set("addressdetails", "1");
          url.searchParams.set("accept-language", "pt-BR,pt;q=0.9,en;q=0.5");

          const response = await fetch(url, {
            headers: {
              "User-Agent": "PermuPayVendas/1.0 (reverse-geocoding)",
              Accept: "application/json",
            },
          });

          if (!response.ok) {
            throw new Error(
              `Falha ao localizar endereço pelo GPS (${response.status})`
            );
          }

          const payload = (await response.json()) as {
            name?: string;
            display_name?: string;
            address?: Record<string, string>;
          };

          const address = payload.address ?? {};
          const logradouro =
            clean(address.road) ??
            clean(address.pedestrian) ??
            clean(address.footway) ??
            clean(address.path);
          const numero = clean(address.house_number);
          const bairro =
            clean(address.suburb) ??
            clean(address.neighbourhood) ??
            clean(address.quarter) ??
            clean(address.city_district) ??
            clean(address.residential);
          const cidade =
            clean(address.city) ??
            clean(address.town) ??
            clean(address.village) ??
            clean(address.municipality) ??
            clean(address.county);
          const estadoNome = clean(address.state);
          const estado =
            clean(address.state_code)?.toUpperCase() ??
            (estadoNome ? ufByState[estadoNome.toLowerCase()] : undefined);
          const cep = clean(address.postcode);

          const endereco = [
            [logradouro, numero].filter(Boolean).join(", "),
            bairro,
            cidade && estado ? `${cidade} - ${estado}` : (cidade ?? estado),
            cep ? `CEP ${cep}` : undefined,
          ]
            .filter(Boolean)
            .join(" · ");

          const nomeSugerido =
            clean(payload.name) ??
            clean(address.shop) ??
            clean(address.amenity) ??
            clean(address.building) ??
            clean(payload.display_name)?.split(",")[0];

          return {
            nomeSugerido,
            endereco,
            cep,
            logradouro,
            numero,
            bairro,
            cidade,
            estado,
            referencia: clean(payload.display_name),
          };
        }),

      remover: protectedProcedure
        .input(z.object({ id: z.number() }))
        .mutation(({ input, ctx }) =>
          dbCotacao.removerLocal(input.id, ctx.user.id)
        ),
    }),

    // ── Sessões ───────────────────────────────────────────────────────────
    sessoes: router({
      listar: protectedProcedure.query(({ ctx }) =>
        dbCotacao.listarSessoes(ctx.user.id)
      ),

      obter: protectedProcedure
        .input(z.object({ id: z.number() }))
        .query(({ input, ctx }) =>
          dbCotacao.obterSessao(input.id, ctx.user.id)
        ),

      adicionarProduto: protectedProcedure
        .input(
          z.object({
            sessaoId: z.number(),
            produtoId: z.number(),
            quantidade: z.number().min(0.001).default(1),
            unidade: z.string().max(20).default("un"),
            obrigatorio: z.boolean().default(false),
          })
        )
        .mutation(({ input, ctx }) =>
          dbCotacao.adicionarProdutoSessao(ctx.user.id, input)
        ),

      criar: protectedProcedure
        .input(
          z.object({
            titulo: z.string().min(1).max(200),
            observacao: z.string().optional(),
            produtos: z
              .array(
                z.object({
                  produtoId: z.number(),
                  quantidade: z.number().min(0.001).default(1),
                  unidade: z.string().max(20).default("un"),
                  obrigatorio: z.boolean().default(false),
                  ordem: z.number().int().optional(),
                })
              )
              .min(1),
          })
        )
        .mutation(({ input, ctx }) =>
          dbCotacao.criarSessao(ctx.user.id, input)
        ),

      atualizar: protectedProcedure
        .input(
          z.object({
            id: z.number(),
            titulo: z.string().min(1).max(200).optional(),
            status: z
              .enum(["em_andamento", "concluida", "cancelada"])
              .optional(),
            observacao: z.string().optional(),
          })
        )
        .mutation(({ input, ctx }) => {
          const { id, ...data } = input;
          return dbCotacao.atualizarSessao(id, ctx.user.id, data);
        }),

      remover: protectedProcedure
        .input(z.object({ id: z.number() }))
        .mutation(({ input, ctx }) =>
          dbCotacao.removerSessao(input.id, ctx.user.id)
        ),
    }),

    // ── Preços ────────────────────────────────────────────────────────────
    precos: router({
      registrar: protectedProcedure
        .input(
          z.object({
            sessaoId: z.number(),
            sessaoProdutoId: z.number(),
            localId: z.number(),
            precoUnitario: z.number().min(0).nullable().optional(),
            encontrado: z.boolean().default(true),
            observacao: z.string().optional(),
            uuidLocal: z.string().optional(),
            fotoPreco: z.string().optional(),
          })
        )
        .mutation(({ input }) => dbCotacao.registrarPreco(input)),

      lote: protectedProcedure
        .input(
          z.object({
            itens: z.array(
              z.object({
                sessaoId: z.number(),
                sessaoProdutoId: z.number(),
                localId: z.number(),
                precoUnitario: z.number().min(0).nullable().optional(),
                encontrado: z.boolean().default(true),
                observacao: z.string().optional(),
                uuidLocal: z.string().optional(),
              })
            ),
          })
        )
        .mutation(({ input }) => dbCotacao.registrarPrecoLote(input.itens)),

      listarSessao: protectedProcedure
        .input(z.object({ sessaoId: z.number() }))
        .query(({ input }) => dbCotacao.listarPrecosSessao(input.sessaoId)),
    }),

    // ── Comparativo ───────────────────────────────────────────────────────
    comparativo: protectedProcedure
      .input(z.object({ sessaoId: z.number() }))
      .query(({ input, ctx }) =>
        dbCotacao.gerarComparativo(input.sessaoId, ctx.user.id)
      ),

    // ── Sync offline ──────────────────────────────────────────────────────
    syncUpload: protectedProcedure
      .input(
        z.object({
          precos: z.array(
            z.object({
              sessaoId: z.number(),
              sessaoProdutoId: z.number(),
              localId: z.number(),
              precoUnitario: z.number().min(0).nullable().optional(),
              encontrado: z.boolean().default(true),
              observacao: z.string().optional(),
              uuidLocal: z.string().optional(),
            })
          ),
        })
      )
      .mutation(({ input, ctx }) => dbCotacao.syncUpload(ctx.user.id, input)),

    syncDownload: protectedProcedure.query(({ ctx }) =>
      dbCotacao.syncDownload(ctx.user.id)
    ),
  }),
});

export type AppRouter = typeof appRouter;
