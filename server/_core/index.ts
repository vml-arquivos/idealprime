import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import fs from "node:fs";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic } from "./serveStatic";
import { expireStaleReservations } from "../db.orders";
import { sdk } from "./sdk";
import { parseImportBuffer } from "../b2b.import";
import { applyImport, pingDatabase } from "../db.b2b";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  const uploadDir = process.env.UPLOAD_DIR ?? "/var/data/ideal-prime/uploads";
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
  app.use("/uploads", express.static(uploadDir));

  app.post(
    "/api/upload/image",
    async (req: any, res: any, next: any) => {
      try {
        const user = await sdk.authenticateRequest(req);
        if (!user || (user as any).accountType === "BUYER") return res.status(403).json({ error: "Upload restrito à equipe Ideal Prime." });
        const max = 10 * 1024 * 1024;
        const length = Number(req.headers["content-length"] ?? 0);
        if (length > max) return res.status(413).json({ error: "Arquivo deve ter no máximo 10MB." });
        const chunks: Buffer[] = []; let size = 0;
        req.on("data", (chunk: Buffer) => { size += chunk.length; if (size > max) req.destroy(); else chunks.push(chunk); });
        req.on("end", () => { if (size <= max) { req.rawBody = Buffer.concat(chunks); next(); } });
        req.on("error", next);
      } catch { return res.status(401).json({ error: "Autenticação obrigatória." }); }
    },
    async (req: any, res: any) => {
      try {
        const { uploadProductImageBuffer, uploadDocumentBuffer } = await import(
          "../storage.upload"
        );
        const folder = String(req.query.folder || "").trim();
        const filename = String(req.query.filename || "image.jpg");
        const mimeType =
          (req.headers["content-type"] as string)?.split(";")[0] ||
          "image/jpeg";
        const url = folder
          ? await uploadDocumentBuffer(folder, req.rawBody, filename, mimeType)
          : await uploadProductImageBuffer(
              Number(req.query.productId) || 0,
              req.rawBody,
              filename,
              mimeType
            );
        res.json({ url });
      } catch (e: any) {
        res.status(400).json({ error: e.message });
      }
    }
  );

  app.post(
    "/api/upload/audio",
    async (req: any, res: any, next: any) => {
      try {
        const user = await sdk.authenticateRequest(req);
        if (!user || (user as any).accountType === "BUYER") return res.status(403).json({ error: "Upload restrito à equipe Ideal Prime." });
        next();
      } catch { return res.status(401).json({ error: "Autenticação obrigatória." }); }
    },
    (req, res, next) => {
      const contentLength = Number(req.headers["content-length"] ?? 0);
      if (contentLength > 16 * 1024 * 1024) {
        res.status(413).json({ error: "Áudio deve ter no máximo 16MB." });
        return;
      }
      const chunks: Buffer[] = []; let size = 0; const max = 16 * 1024 * 1024;
      req.on("data", (chunk: Buffer) => { size += chunk.length; if (size > max) req.destroy(); else chunks.push(chunk); });
      req.on("end", () => { if (size <= max) { (req as any).rawBody = Buffer.concat(chunks); next(); } });
      req.on("error", next);
    },
    async (req: any, res: any) => {
      try {
        const { uploadAudioBuffer } = await import("../storage.upload");
        const filename = String(req.query.filename || "audio.webm");
        const mimeType =
          (req.headers["content-type"] as string)?.split(";")[0] ||
          "audio/webm";
        const url = await uploadAudioBuffer(req.rawBody, filename, mimeType);
        res.json({ url });
      } catch (e: any) {
        res.status(400).json({ error: e.message });
      }
    }
  );

  app.get("/api/private-files/:folder/:filename", async (req: any, res: any) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (!user || (user as any).accountType === "BUYER") return res.status(403).json({ error: "Acesso negado." });
      const safeFolder = String(req.params.folder).replace(/[^a-zA-Z0-9_-]/g, "-");
      const safeName = String(req.params.filename).replace(/[^a-zA-Z0-9_.-]/g, "");
      const file = `${process.env.DATA_DIR ?? "/var/data/ideal-prime"}/private/${safeFolder}/${safeName}`;
      if (!fs.existsSync(file)) return res.status(404).end();
      return res.sendFile(file);
    } catch { return res.status(401).json({ error: "Autenticação obrigatória." }); }
  });

  app.get("/healthz", async (_req, res) => {
    try { const database = await pingDatabase(); res.status(database ? 200 : 503).json({ ok: database, service: "ideal-prime" }); }
    catch { res.status(503).json({ ok: false, service: "ideal-prime" }); }
  });

  app.post("/api/b2b/import", async (req: any, res: any) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (!user || (user as any).accountType === "BUYER") return res.status(403).json({ error: "Importação restrita à equipe Ideal Prime." });
      const max = 10 * 1024 * 1024; const chunks: Buffer[] = []; let size = 0;
      await new Promise<void>((resolve, reject) => { req.on("data", (chunk: Buffer) => { size += chunk.length; if (size > max) reject(new Error("Arquivo excede 10MB")); else chunks.push(chunk); }); req.on("end", resolve); req.on("error", reject); });
      const filename = String(req.query.filename || "produtos.csv"); const mode = String(req.query.mode || "PRICES").toUpperCase();
      if (mode !== "PRICES" && mode !== "INVENTORY") throw new Error("Modo inválido");
      const priceListId = Number(req.query.priceListId); if (!Number.isInteger(priceListId) || priceListId <= 0) throw new Error("Tabela de preços obrigatória");
      const parsed = parseImportBuffer(Buffer.concat(chunks), filename);
      const profileKey = `${mode}:${priceListId}:${String(req.query.referenceAt || "")}`;
      const result = await applyImport(user.id, { hash: parsed.hash, profileKey, mode: mode as any, priceListId, referenceAt: req.query.referenceAt ? new Date(String(req.query.referenceAt)) : null, rows: parsed.rows });
      res.json(result);
    } catch (e: any) { res.status(400).json({ error: e.message || "Falha na importação" }); }
  });

  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ limit: "2mb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  if (process.env.NODE_ENV === "development") {
    const viteDevModulePath = "./viteDev";
    const { setupVite } = await import(viteDevModulePath);
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "4000");
  const port = process.env.NODE_ENV === "production" ? preferredPort : await findAvailablePort(preferredPort);
  if (process.env.NODE_ENV === "production" && !(await isPortAvailable(port))) throw new Error(`Porta configurada ${port} já está ocupada; produção não muda de porta silenciosamente.`);
  await pingDatabase();

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });

  // Job: expirar reservas vencidas a cada 10 minutos
  setInterval(
    async () => {
      try {
        const count = await expireStaleReservations();
        if (count > 0) console.log(`[job] ${count} reserva(s) expirada(s)`);
      } catch (err) {
        console.error("[job] Erro ao expirar reservas:", err);
      }
    },
    10 * 60 * 1000
  );
}

startServer().catch(console.error);
