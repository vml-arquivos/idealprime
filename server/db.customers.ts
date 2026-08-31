import { and, desc, eq, sql } from "drizzle-orm";
import {
  customers,
  type Customer,
  type InsertCustomer,
} from "../drizzle/schema.customers";
import { sellers } from "../drizzle/schema.sellers";
import { getDb } from "./db";
import * as dbOrders from "./db.orders";

export type CustomerContactType = "WHATSAPP" | "EMAIL";

export type CustomerInput = {
  name: string;
  contact: string;
  contactType?: CustomerContactType;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  referredBySellerReferralCode?: string;
};

export function normalizeCustomerContact(
  contact: string,
  contactType?: CustomerContactType
): string {
  const value = contact.trim();
  return contactType === "EMAIL" || value.includes("@")
    ? value.toLowerCase()
    : value.replace(/\D/g, "");
}

function cleanOptional(value?: string | null): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const normalized = value.trim();
  return normalized || null;
}

async function resolveSellerId(referralCode?: string): Promise<number | null> {
  if (!referralCode?.trim()) return null;
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const normalized = referralCode.trim().toUpperCase();
  const [seller] = await db
    .select({ id: sellers.id })
    .from(sellers)
    .where(and(eq(sellers.referralCode, normalized), eq(sellers.active, true)))
    .limit(1);
  return seller?.id ?? null;
}

export async function identifyOrCreateCustomer(
  data: CustomerInput
): Promise<Customer> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const name = data.name.trim();
  const contact = normalizeCustomerContact(data.contact, data.contactType);
  if (name.length < 2) throw new Error("Nome do cliente é obrigatório");
  if (contact.length < 5) throw new Error("Contato do cliente é inválido");

  const [existing] = await db
    .select()
    .from(customers)
    .where(eq(sql`LOWER(${customers.contact})`, contact.toLowerCase()))
    .limit(1);

  if (existing) {
    const update: Partial<InsertCustomer> = {
      name,
      contactType: data.contactType ?? existing.contactType,
      updatedAt: new Date(),
    };
    const optionalFields = [
      "email",
      "address",
      "city",
      "state",
      "zipCode",
    ] as const;
    for (const field of optionalFields) {
      const value = cleanOptional(data[field]);
      if (value !== undefined) update[field] = value;
    }
    const [updated] = await db
      .update(customers)
      .set(update)
      .where(eq(customers.id, existing.id))
      .returning();
    return updated ?? existing;
  }

  const referredBySellerId = await resolveSellerId(
    data.referredBySellerReferralCode
  );
  const [created] = await db
    .insert(customers)
    .values({
      name,
      contact,
      contactType:
        data.contactType ?? (contact.includes("@") ? "EMAIL" : "WHATSAPP"),
      email: cleanOptional(data.email) ?? null,
      address: cleanOptional(data.address) ?? null,
      city: cleanOptional(data.city) ?? null,
      state: cleanOptional(data.state)?.toUpperCase() ?? null,
      zipCode: cleanOptional(data.zipCode) ?? null,
      referredBySellerId,
    })
    .returning();

  if (!created) throw new Error("Não foi possível cadastrar o cliente");
  return created;
}

export async function getCustomerByContact(
  contact: string
): Promise<Customer | null> {
  const db = await getDb();
  if (!db) return null;
  const normalized = normalizeCustomerContact(contact);
  if (!normalized) return null;
  const [customer] = await db
    .select()
    .from(customers)
    .where(eq(sql`LOWER(${customers.contact})`, normalized.toLowerCase()))
    .limit(1);
  return customer ?? null;
}

export async function listCustomerOrders(customerId: number) {
  return dbOrders.listOrders({ customerId });
}
