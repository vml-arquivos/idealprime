/**
 * Autenticação própria com JWT — sem dependência de OAuth externo.
 * Usa jose para assinar/verificar tokens JWT com JWT_SECRET.
 */
import { SignJWT, jwtVerify } from "jose";
import type { Request } from "express";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { ENV } from "./env";
import * as db from "../db";
import type { SafeUser } from "../../drizzle/schema";

export type SessionPayload = {
  userId: number;
  email: string;
  name: string;
  role: string;
};

function parseCookies(cookieHeader: string | undefined): Map<string, string> {
  if (!cookieHeader) return new Map();
  const map = new Map<string, string>();
  for (const part of cookieHeader.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key) map.set(key.trim(), decodeURIComponent(rest.join("=").trim()));
  }
  return map;
}

function getSecretKey() {
  const secret = ENV.cookieSecret;
  if (!secret) throw new Error("JWT_SECRET not configured");
  return new TextEncoder().encode(secret);
}

class AuthService {
  /**
   * Cria um JWT de sessão para o usuário autenticado.
   */
  async createSessionToken(
    payload: SessionPayload,
    options: { expiresInMs?: number } = {}
  ): Promise<string> {
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((Date.now() + expiresInMs) / 1000);
    const secretKey = getSecretKey();
    return new SignJWT({
      userId: payload.userId,
      email: payload.email,
      name: payload.name,
      role: payload.role,
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setExpirationTime(expirationSeconds)
      .sign(secretKey);
  }

  /**
   * Verifica e decodifica um JWT de sessão.
   */
  async verifySession(
    cookieValue: string | undefined | null
  ): Promise<SessionPayload | null> {
    if (!cookieValue) return null;
    try {
      const secretKey = getSecretKey();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"],
      });
      const { userId, email, name, role } = payload as Record<string, unknown>;
      if (
        typeof userId !== "number" ||
        typeof email !== "string" ||
        typeof name !== "string" ||
        typeof role !== "string"
      ) {
        return null;
      }
      return { userId, email, name, role };
    } catch {
      return null;
    }
  }

  /**
   * Autentica a requisição lendo o cookie de sessão.
   * Retorna o SafeUser ou lança erro.
   */
  async authenticateRequest(req: Request): Promise<SafeUser> {
    const cookies = parseCookies(req.headers.cookie);
    const sessionCookie = cookies.get(COOKIE_NAME);
    const session = await this.verifySession(sessionCookie);
    if (!session) throw new Error("Sessão inválida ou expirada");

    const user = await db.getUserById(session.userId);
    if (!user || !user.active) throw new Error("Usuário não encontrado ou inativo");

    await db.updateLastSignedIn(user.id);
    return db.toSafeUser(user);
  }
}

export const sdk = new AuthService();
