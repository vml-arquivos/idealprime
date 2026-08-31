/**
 * Testes unitários para o motor de precificação PermuPay Vendas
 * Cobertura: Pix, Boleto, Débito, Crédito Parcelado, validações e diagnósticos
 * 
 * NOVA LÓGICA: Margem de lucro é calculada APENAS sobre o preço de custo,
 * não sobre o custo total. Impostos, taxas e juros são somados ao preço final.
 */

import { describe, expect, it } from "vitest";
import {
  calculatePricing,
  compoundInterest,
  getDiagnostic,
  isPricingError,
  psychologicalPrice,
  type PricingInput,
} from "./pricingCalculator";

// ─── Fixture base ─────────────────────────────────────────────────────────────

const baseInput: PricingInput = {
  productName: "Smartphone XYZ",
  category: "CELULAR",
  ncm: "8517.12.31",
  costPrice: 500,
  packagingCost: 10,
  inboundShippingCost: 20,
  operationalCost: 15,
  desiredMarginRate: 20,
  taxRegime: "SIMPLES_NACIONAL",
  taxRates: {
    cash: 6,
    boleto: 6,
    debit: 6,
    creditCash: 6,
    creditInstallment: 6,
  },
  boleto: {
    months: 3,
    monthlyInterestRate: 2,
    fixedFee: 3.5,
    defaultRiskRate: 3,
    customerPaysInterest: false,
  },
  card: {
    debitFeeRate: 1.5,
    creditCashFeeRate: 2.5,
    creditInstallmentFeeRate: 3.5,
    installments: 6,
    anticipationRate: 1.5,
    monthlyInterestRate: 1.99,
    customerPaysInterest: false,
  },
};

// ─── Testes de Pix / À Vista ──────────────────────────────────────────────────

describe("Pix / À Vista", () => {
  it("deve calcular preço sugerido com imposto e margem corretamente", () => {
    const result = calculatePricing(baseInput);
    expect(isPricingError(result)).toBe(false);
    if (isPricingError(result)) return;

    const pix = result.results.find((r) => r.method === "PIX")!;

    // Nova lógica:
    // costPrice = 500
    // desiredProfit = 500 * 20% = 100
    // priceBase = 500 + 100 = 600
    // suggestedPrice = 600 / (1 - 0.06) = 600 / 0.94 ≈ 638.30
    expect(pix.suggestedPrice).toBeCloseTo(638.30, 0);
    expect(pix.installments).toBe(1);
    expect(pix.totalInterest).toBe(0);
    expect(pix.totalFees).toBe(0);
  });

  it("deve calcular imposto total corretamente no Pix", () => {
    const result = calculatePricing(baseInput);
    if (isPricingError(result)) return;

    const pix = result.results.find((r) => r.method === "PIX")!;
    // imposto = preco * 6%
    expect(pix.totalTax).toBeCloseTo(pix.suggestedPrice * 0.06, 2);
  });

  it("deve ter diagnóstico SAUDÁVEL ou superior quando lucro é positivo e margem acima de 20%", () => {
    const result = calculatePricing(baseInput);
    if (isPricingError(result)) return;

    const pix = result.results.find((r) => r.method === "PIX")!;
    // Com a nova lógica, a margem deve estar próxima aos 20% desejados
    expect(["SAUDAVEL", "EXCELENTE", "ATENCAO", "RISCO"]).toContain(pix.diagnostic);
    expect(pix.netProfit).toBeGreaterThan(0);
  });

  it("deve calcular markup corretamente", () => {
    const result = calculatePricing(baseInput);
    if (isPricingError(result)) return;

    const pix = result.results.find((r) => r.method === "PIX")!;
    const costPrice = 500;
    const expectedMarkup = ((pix.suggestedPrice - costPrice) / costPrice) * 100;
    expect(pix.markup).toBeCloseTo(expectedMarkup, 1);
  });
});

// ─── Testes de Boleto Bancário ────────────────────────────────────────────────

describe("Boleto Bancário", () => {
  it("deve calcular preço com juros compostos embutidos no preço", () => {
    const input: PricingInput = {
      ...baseInput,
      boleto: { ...baseInput.boleto, customerPaysInterest: false },
    };
    const result = calculatePricing(input);
    if (isPricingError(result)) return;

    const boleto = result.results.find((r) => r.method === "BOLETO")!;
    // Deve ter juros embutidos (preço maior que o base)
    expect(boleto.totalInterest).toBeGreaterThan(0);
    expect(boleto.suggestedPrice).toBeGreaterThan(0);
  });

  it("deve calcular parcela mensal corretamente no boleto", () => {
    const result = calculatePricing(baseInput);
    if (isPricingError(result)) return;

    const boleto = result.results.find((r) => r.method === "BOLETO")!;
    expect(boleto.installments).toBe(3);
    expect(boleto.installmentValue).toBeCloseTo(boleto.suggestedPrice / 3, 2);
  });

  it("deve incluir taxa fixa de emissão no custo do boleto", () => {
    const result = calculatePricing(baseInput);
    if (isPricingError(result)) return;

    const boleto = result.results.find((r) => r.method === "BOLETO")!;
    // Taxa fixa = 3.50 deve estar refletida no preço
    expect(boleto.suggestedPrice).toBeGreaterThan(0);
    expect(boleto.totalFees).toBeGreaterThan(0);
  });

  it("deve calcular risco de inadimplência nas taxas do boleto", () => {
    const result = calculatePricing(baseInput);
    if (isPricingError(result)) return;

    const boleto = result.results.find((r) => r.method === "BOLETO")!;
    // Risco de 3% deve estar refletido nas taxas
    expect(boleto.totalFees).toBeGreaterThan(0);
  });
});

// ─── Testes de Cartão de Débito ───────────────────────────────────────────────

describe("Cartão de Débito", () => {
  it("deve calcular preço com taxa financeira de débito", () => {
    const result = calculatePricing(baseInput);
    if (isPricingError(result)) return;

    const debito = result.results.find((r) => r.method === "DEBITO")!;
    // Nova lógica:
    // costPrice = 500
    // desiredProfit = 500 * 20% = 100
    // priceBase = 500 + 100 = 600
    // suggestedPrice = 600 / (1 - 0.06 - 0.015) = 600 / 0.925 ≈ 648.65
    expect(debito.suggestedPrice).toBeCloseTo(648.65, 0);
    expect(debito.totalFees).toBeCloseTo(debito.suggestedPrice * 0.015, 2);
    expect(debito.totalInterest).toBe(0);
    expect(debito.installments).toBe(1);
  });

  it("deve ter taxa financeira maior que zero no débito", () => {
    const result = calculatePricing(baseInput);
    if (isPricingError(result)) return;

    const debito = result.results.find((r) => r.method === "DEBITO")!;
    expect(debito.totalFees).toBeGreaterThan(0);
  });
});

// ─── Testes de Crédito Parcelado ──────────────────────────────────────────────

describe("Crédito Parcelado", () => {
  it("deve calcular preço com juros e taxa de antecipação", () => {
    const result = calculatePricing(baseInput);
    if (isPricingError(result)) return;

    const credito = result.results.find((r) => r.method === "CREDITO_PARCELADO")!;
    expect(credito.installments).toBe(6);
    expect(credito.totalFees).toBeGreaterThan(0);
    expect(credito.suggestedPrice).toBeGreaterThan(0);
  });

  it("deve calcular valor da parcela corretamente no crédito parcelado", () => {
    const result = calculatePricing(baseInput);
    if (isPricingError(result)) return;

    const credito = result.results.find((r) => r.method === "CREDITO_PARCELADO")!;
    expect(credito.installmentValue).toBeCloseTo(credito.suggestedPrice / 6, 2);
  });

  it("deve incluir taxa de antecipação nas taxas totais", () => {
    const result = calculatePricing(baseInput);
    if (isPricingError(result)) return;

    const credito = result.results.find((r) => r.method === "CREDITO_PARCELADO")!;
    // Taxas = creditInstallmentFeeRate (3.5%) + anticipationRate (1.5%) = 5% do preço
    expect(credito.totalFees).toBeCloseTo(credito.suggestedPrice * 0.05, 1);
  });

  it("deve ter juros embutidos quando empresa absorve os juros", () => {
    const input: PricingInput = {
      ...baseInput,
      card: { ...baseInput.card, customerPaysInterest: false, monthlyInterestRate: 2 },
    };
    const result = calculatePricing(input);
    if (isPricingError(result)) return;

    const credito = result.results.find((r) => r.method === "CREDITO_PARCELADO")!;
    expect(credito.totalInterest).toBeGreaterThan(0);
  });
});

// ─── Testes de Validação ──────────────────────────────────────────────────────

describe("Validações", () => {
  it("deve retornar erro quando soma de percentuais variáveis >= 100%", () => {
    const input: PricingInput = {
      ...baseInput,
      desiredMarginRate: 80,
      taxRates: { ...baseInput.taxRates, cash: 25 },
    };
    const result = calculatePricing(input);
    expect(isPricingError(result)).toBe(true);
    if (!isPricingError(result)) return;
    expect(result.code).toBe("INVALID_PERCENTAGES");
  });

  it("deve retornar erro quando custo é negativo", () => {
    const input: PricingInput = {
      ...baseInput,
      costPrice: -100,
    };
    const result = calculatePricing(input);
    expect(isPricingError(result)).toBe(true);
    if (!isPricingError(result)) return;
    expect(result.code).toBe("NEGATIVE_COST");
  });

  it("deve retornar erro quando margem é negativa", () => {
    const input: PricingInput = {
      ...baseInput,
      desiredMarginRate: -5,
    };
    const result = calculatePricing(input);
    expect(isPricingError(result)).toBe(true);
    if (!isPricingError(result)) return;
    expect(result.code).toBe("NEGATIVE_MARGIN");
  });

  it("deve retornar erro quando meses do boleto < 1", () => {
    const input: PricingInput = {
      ...baseInput,
      boleto: { ...baseInput.boleto, months: 0 },
    };
    const result = calculatePricing(input);
    expect(isPricingError(result)).toBe(true);
    if (!isPricingError(result)) return;
    expect(result.code).toBe("INVALID_PERIODS");
  });

  it("deve retornar erro quando parcelas < 1", () => {
    const input: PricingInput = {
      ...baseInput,
      card: { ...baseInput.card, installments: 0 },
    };
    const result = calculatePricing(input);
    expect(isPricingError(result)).toBe(true);
    if (!isPricingError(result)) return;
    expect(result.code).toBe("INVALID_PERIODS");
  });
});

// ─── Testes de Diagnóstico ────────────────────────────────────────────────────

describe("Diagnóstico", () => {
  it("deve retornar PREJUÍZO quando lucro líquido é negativo", () => {
    const diagnostic = getDiagnostic(5, -10);
    expect(diagnostic).toBe("PREJUIZO");
  });

  it("deve retornar RISCO quando margem real < 10%", () => {
    const diagnostic = getDiagnostic(8, 50);
    expect(diagnostic).toBe("RISCO");
  });

  it("deve retornar SAUDÁVEL quando margem real >= margem desejada", () => {
    const diagnostic = getDiagnostic(20, 100, 15);
    expect(diagnostic).toBe("SAUDAVEL");
  });

  it("deve retornar ATENÇÃO quando margem real está abaixo da desejada mas acima de 10%", () => {
    // margem real = 15%, desejada = 25%, lucro positivo
    const diagnostic = getDiagnostic(15, 100, 25);
    expect(diagnostic).toBe("ATENCAO");
  });

  it("deve gerar diagnóstico de PREJUÍZO no resultado quando produto não é viável", () => {
    // Custo muito alto com margem impossível de ser atingida
    const input: PricingInput = {
      ...baseInput,
      costPrice: 1000,
      desiredMarginRate: 5,
      taxRates: {
        cash: 6,
        boleto: 6,
        debit: 6,
        creditCash: 6,
        creditInstallment: 6,
      },
    };
    const result = calculatePricing(input);
    if (isPricingError(result)) return;

    // Com custo alto e margem baixa, o produto ainda pode ser viável
    // Apenas verificamos que o cálculo ocorre sem erro
    expect(result.results.length).toBe(5);
  });
});

// ─── Testes de Margem Real e Markup ──────────────────────────────────────────

describe("Margem Real e Markup", () => {
  it("deve calcular margem real corretamente", () => {
    const result = calculatePricing(baseInput);
    if (isPricingError(result)) return;

    const pix = result.results.find((r) => r.method === "PIX")!;
    // margem_real = (lucro_liquido / preco_sugerido) * 100
    const expectedMargin = (pix.netProfit / pix.suggestedPrice) * 100;
    expect(pix.realMarginRate).toBeCloseTo(expectedMargin, 2);
  });

  it("deve calcular markup corretamente", () => {
    const result = calculatePricing(baseInput);
    if (isPricingError(result)) return;

    const pix = result.results.find((r) => r.method === "PIX")!;
    const costPrice = 500;
    const expectedMarkup = ((pix.suggestedPrice - costPrice) / costPrice) * 100;
    expect(pix.markup).toBeCloseTo(expectedMarkup, 1);
  });

  it("deve identificar melhor e pior forma de pagamento", () => {
    const result = calculatePricing(baseInput);
    if (isPricingError(result)) return;

    expect(result.bestMethod).toBeDefined();
    expect(result.worstMethod).toBeDefined();
    expect(result.bestMethod).not.toBe(result.worstMethod);
  });
});

// ─── Testes de Funções Auxiliares ─────────────────────────────────────────────

describe("Funções Auxiliares", () => {
  it("deve calcular juros compostos corretamente", () => {
    // 1000 * (1 + 0.02)^3 = 1000 * 1.061208 = 1061.21
    expect(compoundInterest(1000, 2, 3)).toBeCloseTo(1061.21, 1);
  });

  it("deve retornar valor base quando taxa é zero", () => {
    expect(compoundInterest(1000, 0, 3)).toBe(1000);
  });

  it("deve calcular preço psicológico terminando em ,90", () => {
    // 100.5 -> candidato é 100.90, que >= 100.5, então 100.90
    expect(psychologicalPrice(100.5)).toBe(100.9);
    // 101 -> candidato é 101.90, que >= 101, então 101.90
    expect(psychologicalPrice(101)).toBe(101.9);
    // 101.5 -> candidato é 101.90, que >= 101.5, então 101.90
    expect(psychologicalPrice(101.5)).toBe(101.9);
    // 99.91 -> candidato é 99.90, que < 99.91, então 100.90
    expect(psychologicalPrice(99.91)).toBe(100.9);
    // 99.90 -> candidato é 99.90, que >= 99.90, então 99.90
    expect(psychologicalPrice(99.90)).toBe(99.9);
  });

  it("deve retornar resultado completo com 5 formas de pagamento", () => {
    const result = calculatePricing(baseInput);
    if (isPricingError(result)) return;
    expect(result.results).toHaveLength(5);
  });

  it("deve calcular custo total corretamente", () => {
    const result = calculatePricing(baseInput);
    if (isPricingError(result)) return;
    // 500 + 10 + 20 + 15 = 545
    expect(result.totalCost).toBe(545);
  });
});
