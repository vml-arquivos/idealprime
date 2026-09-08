import { describe, expect, it } from "vitest";
import {
  matchImportCurrency,
  matchImportOption,
  normalizeHeaderKey,
  parseImportRow,
  readImportField,
  toImportNumber,
  type ExistingProductForImport,
  type ImportOption,
} from "./batchImport";

const CATEGORY_OPTIONS: ImportOption[] = [
  { value: "CELULAR", label: "Celular" },
  { value: "ELETRONICO", label: "Eletrônico" },
  { value: "PERFUME", label: "Perfume" },
  { value: "OUTRO", label: "Outro" },
];

const PAYMENT_OPTIONS: ImportOption[] = [
  { value: "DINHEIRO", label: "Dinheiro" },
  { value: "PIX", label: "Pix" },
  { value: "BOLETO", label: "Boleto" },
  { value: "CARTAO", label: "Cartão" },
  { value: "DOLAR", label: "Dólar" },
  { value: "OUTRO", label: "Outro" },
];

const EXISTING_PRODUCTS: ExistingProductForImport[] = [
  { id: 1, name: "iPhone 13 128GB", sku: "IPH13-128", category: "CELULAR" },
  { id: 2, name: "Perfume Importado 100ml", sku: null, category: "PERFUME" },
];

describe("normalizeHeaderKey", () => {
  it("remove acentos, normaliza caixa e espaços", () => {
    expect(normalizeHeaderKey("Café Ação Código")).toBe("cafe acao codigo");
    expect(normalizeHeaderKey("  Nome do   Produto ")).toBe("nome do produto");
    expect(normalizeHeaderKey("QUANTIDADE")).toBe("quantidade");
  });
});

describe("toImportNumber", () => {
  it("aceita formatos brasileiros e americanos", () => {
    expect(toImportNumber("1.234,56")).toBeCloseTo(1234.56);
    expect(toImportNumber("1234.56")).toBeCloseTo(1234.56);
    expect(toImportNumber("R$ 10,00")).toBeCloseTo(10);
    expect(toImportNumber(42)).toBe(42);
    expect(toImportNumber("")).toBe(0);
    expect(toImportNumber(undefined)).toBe(0);
  });
});

describe("readImportField", () => {
  it("encontra o valor por qualquer alias, tolerando acento/caixa no cabeçalho", () => {
    const row = { "Nome do Produto": "Fone Bluetooth", Quantidade: "10" };
    expect(readImportField(row, "productName")).toBe("Fone Bluetooth");
    expect(readImportField(row, "quantity")).toBe("10");
  });

  it("retorna string vazia quando nenhum alias está presente ou o valor é vazio", () => {
    const row = { Produto: "  ", Outro: "x" };
    expect(readImportField(row, "productName")).toBe("");
    expect(readImportField(row, "sku")).toBe("");
  });
});

describe("matchImportOption / matchImportCurrency", () => {
  it("casa por valor ou label, ignorando acento/caixa, com fallback", () => {
    expect(matchImportOption("celular", CATEGORY_OPTIONS, "OUTRO")).toBe("CELULAR");
    expect(matchImportOption("Eletrônico", CATEGORY_OPTIONS, "OUTRO")).toBe("ELETRONICO");
    expect(matchImportOption("inexistente", CATEGORY_OPTIONS, "OUTRO")).toBe("OUTRO");
    expect(matchImportOption("", CATEGORY_OPTIONS, "OUTRO")).toBe("OUTRO");
  });

  it("reconhece moeda USD por vários sinônimos, com BRL como padrão", () => {
    expect(matchImportCurrency("USD")).toBe("USD");
    expect(matchImportCurrency("dólar")).toBe("USD");
    expect(matchImportCurrency("US$")).toBe("USD");
    expect(matchImportCurrency("Real")).toBe("BRL");
    expect(matchImportCurrency("")).toBe("BRL");
  });
});

describe("parseImportRow", () => {
  it("faz o parsing completo de uma linha válida em BRL, casando produto por SKU", () => {
    const result = parseImportRow(
      {
        "Nome do Produto": "iPhone 13 128GB",
        SKU: "IPH13-128",
        Quantidade: "3",
        "Custo Unitário": "2.500,00",
        "Forma de Pagamento": "Pix",
      },
      2,
      EXISTING_PRODUCTS,
      CATEGORY_OPTIONS,
      PAYMENT_OPTIONS,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.item.entryMode).toBe("EXISTING");
    expect(result.item.productId).toBe(1);
    expect(result.item.category).toBe("CELULAR"); // herdado do produto existente
    expect(result.item.currency).toBe("BRL");
    expect(result.item.unitCostOriginal).toBeCloseTo(2500);
    expect(result.item.quantity).toBe(3);
    expect(result.item.acquisitionPaymentMethod).toBe("PIX");
  });

  it("casa produto existente por nome quando não há SKU na planilha", () => {
    const result = parseImportRow(
      { Produto: "Perfume Importado 100ml", Quantidade: "1", Custo: "150" },
      3,
      EXISTING_PRODUCTS,
      CATEGORY_OPTIONS,
      PAYMENT_OPTIONS,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.item.entryMode).toBe("EXISTING");
    expect(result.item.productId).toBe(2);
    expect(result.item.category).toBe("PERFUME");
  });

  it("trata produto não encontrado como novo, com categoria padrão OUTRO", () => {
    const result = parseImportRow(
      { Produto: "Caixa de Som Nova", Quantidade: "2", Custo: "80" },
      4,
      EXISTING_PRODUCTS,
      CATEGORY_OPTIONS,
      PAYMENT_OPTIONS,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.item.entryMode).toBe("NEW");
    expect(result.item.productId).toBeUndefined();
    expect(result.item.category).toBe("OUTRO");
    expect(result.item.acquisitionPaymentMethod).toBe("OUTRO");
  });

  it("exige cotação do dólar válida quando a moeda é USD", () => {
    const semCotacao = parseImportRow(
      { Produto: "Produto Importado", Quantidade: "1", Custo: "100", Moeda: "USD" },
      5,
      [],
      CATEGORY_OPTIONS,
      PAYMENT_OPTIONS,
    );
    expect(semCotacao.ok).toBe(false);
    if (semCotacao.ok) return;
    expect(semCotacao.error).toMatch(/cotação do dólar/i);

    const comCotacao = parseImportRow(
      {
        Produto: "Produto Importado",
        Quantidade: "1",
        Custo: "100",
        Moeda: "USD",
        Cotacao: "5,20",
      },
      6,
      [],
      CATEGORY_OPTIONS,
      PAYMENT_OPTIONS,
    );
    expect(comCotacao.ok).toBe(true);
    if (!comCotacao.ok) return;
    expect(comCotacao.item.currency).toBe("USD");
    expect(comCotacao.item.exchangeRate).toBeCloseTo(5.2);
  });

  it("rejeita linha sem nome de produto", () => {
    const result = parseImportRow(
      { Quantidade: "1", Custo: "10" },
      7,
      [],
      CATEGORY_OPTIONS,
      PAYMENT_OPTIONS,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/Linha 7/);
    expect(result.error).toMatch(/nome do produto/i);
  });

  it("rejeita quantidade inválida (zero, negativa ou ausente)", () => {
    for (const quantidade of ["0", "-1", "", "abc"]) {
      const result = parseImportRow(
        { Produto: "X", Quantidade: quantidade, Custo: "10" },
        8,
        [],
        CATEGORY_OPTIONS,
        PAYMENT_OPTIONS,
      );
      expect(result.ok).toBe(false);
    }
  });

  it("rejeita custo unitário inválido (zero, negativo ou ausente)", () => {
    for (const custo of ["0", "-5", ""]) {
      const result = parseImportRow(
        { Produto: "X", Quantidade: "1", Custo: custo },
        9,
        [],
        CATEGORY_OPTIONS,
        PAYMENT_OPTIONS,
      );
      expect(result.ok).toBe(false);
    }
  });
});
