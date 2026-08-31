import { z } from "zod";
import { notifyOwner } from "./notification";
import { adminProcedure, publicProcedure, protectedProcedure, router } from "./trpc";

export const systemRouter = router({
  health: publicProcedure
    .input(
      z.object({
        timestamp: z.number().min(0, "timestamp cannot be negative"),
      })
    )
    .query(() => ({
      ok: true,
    })),

  // Status do sistema para a página de Configurações
  status: protectedProcedure.query(async () => {
    // Verificar banco de dados
    let dbConnected = false;
    try {
      const { getDb } = await import("../db");
      const db = await getDb();
      dbConnected = !!db;
    } catch {
      dbConnected = false;
    }

    // Verificar S3
    const s3Configured = !!(
      process.env.AWS_ACCESS_KEY_ID &&
      process.env.AWS_SECRET_ACCESS_KEY &&
      process.env.S3_BUCKET
    );

    return {
      database: { connected: dbConnected },
      storage: { configured: s3Configured },
    };
  }),

  notifyOwner: adminProcedure
    .input(
      z.object({
        title: z.string().min(1, "title is required"),
        content: z.string().min(1, "content is required"),
      })
    )
    .mutation(async ({ input }) => {
      const delivered = await notifyOwner(input);
      return {
        success: delivered,
      } as const;
    }),
});
