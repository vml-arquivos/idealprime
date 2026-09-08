/**
 * server/_core/customerAuth.ts
 *
 * Autenticação própria do CLIENTE FINAL (área do cliente / minha conta) —
 * com senha de verdade, sessão via JWT em cookie httpOnly, seguindo
 * exatamente o mesmo padrão já usado em server/_core/sdk.ts para o login
 * interno (admin/vendedor), mas com cookie e payload completamente
 * separados, para nunca misturar as duas sessões.
 *
 * Portado da base PermuPay Vendas (onde esta funcionalidade já existia e
 * funcionava) na evolução comercial do Ideal Prime — ver
 * docs/ideal-prime/AUDITORIA_EVOLUCAO_COMERCIAL.md.
 */
import { SignJWT, jwtVerify } from "jose";
import type { Request } from "express";
import { CUSTOMER_COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSecretKey, parseCookies } from "./sdk";
import * as dbCustomers from "../db.customers";
import type { SafeCustomer } from "../../drizzle/schema.customers";

export type CustomerSessionPayload = {
  customerId: number;
  contact: string;
};

class CustomerAuthService {
  /**
   * Cria um JWT de sessão para o cliente autenticado.
   */
  async createSessionToken(
    payload: CustomerSessionPayload,
    options: { expiresInMs?: number } = {}
  ): Promise<string> {
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((Date.now() + expiresInMs) / 1000);
    const secretKey = getSecretKey();
    return new SignJWT({
      customerId: payload.customerId,
      contact: payload.contact,
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setExpirationTime(expirationSeconds)
      .sign(secretKey);
  }

  /**
   * Verifica e decodifica um JWT de sessão de cliente.
   */
  async verifySession(
    cookieValue: string | undefined | null
  ): Promise<CustomerSessionPayload | null> {
    if (!cookieValue) return null;
    try {
      const secretKey = getSecretKey();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"],
      });
      const { customerId, contact } = payload as Record<string, unknown>;
      if (typeof customerId !== "number" || typeof contact !== "string") {
        return null;
      }
      return { customerId, contact };
    } catch {
      return null;
    }
  }

  /**
   * Autentica a requisição lendo o cookie de sessão do cliente. Retorna
   * SafeCustomer (nunca inclui passwordHash) ou lança erro.
   */
  async authenticateRequest(req: Request): Promise<SafeCustomer> {
    const cookies = parseCookies(req.headers.cookie);
    const sessionCookie = cookies.get(CUSTOMER_COOKIE_NAME);
    const session = await this.verifySession(sessionCookie);
    if (!session) throw new Error("Sessão inválida ou expirada");

    const customer = await dbCustomers.getCustomerById(session.customerId);
    if (!customer) throw new Error("Cliente não encontrado");

    return dbCustomers.toSafeCustomer(customer);
  }
}

export const customerSdk = new CustomerAuthService();
