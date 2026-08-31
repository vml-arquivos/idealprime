/**
 * Rotas de autenticação própria (sem OAuth externo).
 * POST /api/auth/login    — login com email + senha
 * POST /api/auth/register — cadastro (primeiro usuário vira admin)
 * POST /api/auth/logout   — limpa o cookie de sessão
 * GET  /api/auth/me       — retorna o usuário autenticado
 */
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";

export function registerOAuthRoutes(app: Express) {
  // ── Login ─────────────────────────────────────────────────────────────────────────────
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    const { email, password } = req.body ?? {};
    if (!email || !password) {
      res.status(400).json({ error: "Email e senha são obrigatórios" });
      return;
    }
    try {
      const user = await db.getUserByEmail(email);
      if (!user || !user.active) {
        res.status(401).json({ error: "Credenciais inválidas" });
        return;
      }
      const valid = await db.verifyPassword(user, password);
      if (!valid) {
        res.status(401).json({ error: "Credenciais inválidas" });
        return;
      }
      await db.updateLastSignedIn(user.id);
      const token = await sdk.createSessionToken({
        userId: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.json({ success: true, user: db.toSafeUser(user) });
    } catch (error) {
      console.error("[Auth] Login failed", error);
      res.status(500).json({ error: "Erro interno no login" });
    }
  });

  // ── Registro ────────────────────────────────────────────────────────────────────────
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    const { email, password, name } = req.body ?? {};
    if (!email || !password || !name) {
      res.status(400).json({ error: "Nome, email e senha são obrigatórios" });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ error: "A senha deve ter no mínimo 8 caracteres" });
      return;
    }
    try {
      const existing = await db.getUserByEmail(email);
      if (existing) {
        res.status(409).json({ error: "Email já cadastrado" });
        return;
      }
      // Primeiro usuário cadastrado vira admin automaticamente
      const totalUsers = await db.countUsers();
      const role: "admin" | "user" = totalUsers === 0 ? "admin" : "user";
      const user = await db.createUser({ email, password, name, role });
      const token = await sdk.createSessionToken({
        userId: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.status(201).json({ success: true, user });
    } catch (error) {
      console.error("[Auth] Register failed", error);
      res.status(500).json({ error: "Erro interno no cadastro" });
    }
  });

  // ── Logout ────────────────────────────────────────────────────────────────────────────
  app.post("/api/auth/logout", (req: Request, res: Response) => {
    const cookieOptions = getSessionCookieOptions(req);
    res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    res.json({ success: true });
  });

  // ── Me (REST) ───────────────────────────────────────────────────────────────────────
  app.get("/api/auth/me", async (req: Request, res: Response) => {
    try {
      const user = await sdk.authenticateRequest(req);
      res.json(user);
    } catch {
      res.status(401).json({ error: "Não autenticado" });
    }
  });
}
