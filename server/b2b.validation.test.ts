import { describe, expect, it } from "vitest";
import { normalizeCnpj, normalizeSku, parseMoneyToCents, publicPriceFromCents } from "./db.b2b";
describe("Ideal Prime B2B normalization",()=>{
 it("normaliza SKU sem perder zeros",()=>expect(normalizeSku(" 000abc-01 ")).toBe("000ABC-01"));
 it("normaliza CNPJ para 14 dígitos",()=>expect(normalizeCnpj("12.345.678/0001-90")).toBe("12345678000190"));
 it("converte moeda PT-BR em centavos",()=>expect(parseMoneyToCents("1.234,56")).toBe(123456));
 it("rejeita formato monetário ambíguo",()=>expect(()=>parseMoneyToCents("1,234.56")).toThrow());
 it("aceita preço vazio somente no modo opcional de importação",()=>{
   expect(parseMoneyToCents("",{optional:true})).toBe(0);
   expect(()=>parseMoneyToCents("")).toThrow();
 });
 it("converte preço importado para a visualização pública",()=>{
   expect(publicPriceFromCents(35826)).toBe(358.26);
   expect(publicPriceFromCents(0)).toBe(0);
   expect(()=>publicPriceFromCents(-1)).toThrow("preço em centavos inválido");
 });
});
