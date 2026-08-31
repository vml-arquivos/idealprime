/**
 * pricing.batch.test.ts — Testes do Motor de Rateio Proporcional por Lote
 *
 * Cobre os cenários de negócio descritos no briefing:
 *  - 20 iPhones + 30 Samsungs + 40 garrafas térmicas
 *  - Rateio proporcional ao custo de cada produto
 *  - Custo operacional por unidade
 *  - Verificação de integridade (allocationCheck ≈ totalOperationalCost)
 */

import { describe, it, expect } from "vitest";
import {
  calculateBatchPricing,
  isBatchPricingError,
  type BatchItemInput,
} from "./pricing.batch";

// ─── Cenário Principal do Briefing ────────────────────────────────────────────

describe("Motor de Rateio Proporcional — Cenário do Briefing", () => {
  /**
   * Lote de exemplo:
   *   - 20 iPhones   @ R$ 3.000,00 cada  → custo total = R$ 60.000,00
   *   - 30 Samsungs  @ R$ 1.500,00 cada  → custo total = R$ 45.000,00
   *   - 40 Garrafas  @ R$    50,00 cada  → custo total = R$  2.000,00
   *
   * Total mercadorias = R$ 107.000,00
   * Custo operacional = R$ 10.700,00
   *
   * Proporções esperadas:
   *   iPhone:  60.000 / 107.000 ≈ 56,07%  → op. rateado = R$ 5.999,07
   *   Samsung: 45.000 / 107.000 ≈ 42,06%  → op. rateado = R$ 4.499,30
   *   Garrafa:  2.000 / 107.000 ≈  1,87%  → op. rateado = R$   200,63
   */
  const items: BatchItemInput[] = [
    {
      productId: 1,
      productName: "iPhone 15 Pro",
      unitCostBrl: 3000,
      quantity: 20,
      desiredMarginRate: 30,
      estimatedTaxRate: 6,
    },
    {
      productId: 2,
      productName: "Samsung Galaxy S24",
      unitCostBrl: 1500,
      quantity: 30,
      desiredMarginRate: 25,
      estimatedTaxRate: 6,
    },
    {
      productId: 3,
      productName: "Garrafa Térmica Stanley",
      unitCostBrl: 50,
      quantity: 40,
      desiredMarginRate: 40,
      estimatedTaxRate: 6,
    },
  ];

  const totalOperationalCost = 10700;

  it("deve calcular sem erros", () => {
    const result = calculateBatchPricing({ items, totalOperationalCost });
    expect(isBatchPricingError(result)).toBe(false);
  });

  it("deve ter custo total de mercadorias correto", () => {
    const result = calculateBatchPricing({ items, totalOperationalCost });
    if (isBatchPricingError(result)) throw new Error("Erro inesperado");
    // 20*3000 + 30*1500 + 40*50 = 60000 + 45000 + 2000 = 107000
    expect(result.totalCostOfGoods).toBeCloseTo(107000, 2);
  });

  it("deve ter grand total correto (mercadorias + operacional)", () => {
    const result = calculateBatchPricing({ items, totalOperationalCost });
    if (isBatchPricingError(result)) throw new Error("Erro inesperado");
    expect(result.grandTotal).toBeCloseTo(117700, 2);
  });

  it("deve ratear proporcionalmente — iPhone tem maior proporção", () => {
    const result = calculateBatchPricing({ items, totalOperationalCost });
    if (isBatchPricingError(result)) throw new Error("Erro inesperado");

    const iphone = result.items[0]!;
    const samsung = result.items[1]!;
    const garrafa = result.items[2]!;

    // iPhone tem maior custo total, deve ter maior custo operacional rateado
    expect(iphone.allocatedOperationalCost).toBeGreaterThan(samsung.allocatedOperationalCost);
    expect(samsung.allocatedOperationalCost).toBeGreaterThan(garrafa.allocatedOperationalCost);
  });

  it("deve ter proporções corretas para cada produto", () => {
    const result = calculateBatchPricing({ items, totalOperationalCost });
    if (isBatchPricingError(result)) throw new Error("Erro inesperado");

    const iphone = result.items[0]!;
    const samsung = result.items[1]!;
    const garrafa = result.items[2]!;

    // iPhone: 60000/107000 ≈ 0.5607
    expect(iphone.costProportion).toBeCloseTo(60000 / 107000, 4);
    // Samsung: 45000/107000 ≈ 0.4206
    expect(samsung.costProportion).toBeCloseTo(45000 / 107000, 4);
    // Garrafa: 2000/107000 ≈ 0.0187
    expect(garrafa.costProportion).toBeCloseTo(2000 / 107000, 4);
  });

  it("deve ter custo operacional rateado por item correto", () => {
    const result = calculateBatchPricing({ items, totalOperationalCost });
    if (isBatchPricingError(result)) throw new Error("Erro inesperado");

    const iphone = result.items[0]!;
    const samsung = result.items[1]!;
    const garrafa = result.items[2]!;

    // iPhone: (60000/107000) * 10700 ≈ 5999.07
    expect(iphone.allocatedOperationalCost).toBeCloseTo((60000 / 107000) * 10700, 2);
    // Samsung: (45000/107000) * 10700 ≈ 4499.30
    expect(samsung.allocatedOperationalCost).toBeCloseTo((45000 / 107000) * 10700, 2);
    // Garrafa: (2000/107000) * 10700 ≈ 200.00
    expect(garrafa.allocatedOperationalCost).toBeCloseTo((2000 / 107000) * 10700, 2);
  });

  it("deve calcular custo unitário final corretamente (custo + rateio/qtd)", () => {
    const result = calculateBatchPricing({ items, totalOperationalCost });
    if (isBatchPricingError(result)) throw new Error("Erro inesperado");

    const iphone = result.items[0]!;
    const samsung = result.items[1]!;
    const garrafa = result.items[2]!;

    // iPhone: 3000 + (iphone.allocatedOperationalCost / 20)
    expect(iphone.finalUnitCost).toBeCloseTo(
      3000 + iphone.allocatedOperationalCost / 20, 2
    );
    // Samsung: 1500 + (samsung.allocatedOperationalCost / 30)
    expect(samsung.finalUnitCost).toBeCloseTo(
      1500 + samsung.allocatedOperationalCost / 30, 2
    );
    // Garrafa: 50 + (garrafa.allocatedOperationalCost / 40)
    expect(garrafa.finalUnitCost).toBeCloseTo(
      50 + garrafa.allocatedOperationalCost / 40, 2
    );
  });

  it("deve ter verificação de integridade: soma dos rateios ≈ custo operacional total", () => {
    const result = calculateBatchPricing({ items, totalOperationalCost });
    if (isBatchPricingError(result)) throw new Error("Erro inesperado");

    expect(result.allocationCheck).toBeCloseTo(totalOperationalCost, 2);
    expect(Math.abs(result.allocationCheck - totalOperationalCost)).toBeLessThan(0.01);
  });

  it("deve calcular preço sugerido com margem e imposto corretamente", () => {
    const result = calculateBatchPricing({ items, totalOperationalCost });
    if (isBatchPricingError(result)) throw new Error("Erro inesperado");

    const iphone = result.items[0]!;
    // Fórmula: preco = custo_final / (1 - margem% - imposto%)
    // iPhone: margem=30%, imposto=6% → divisor = 1 - 0.30 - 0.06 = 0.64
    const expectedPrice = iphone.finalUnitCost / (1 - 0.30 - 0.06);
    expect(iphone.suggestedPrice).toBeCloseTo(expectedPrice, 2);
  });

  it("deve ter margem de contribuição positiva para todos os itens", () => {
    const result = calculateBatchPricing({ items, totalOperationalCost });
    if (isBatchPricingError(result)) throw new Error("Erro inesperado");

    for (const item of result.items) {
      expect(item.contributionMargin).toBeGreaterThan(0);
      expect(item.suggestedPrice).toBeGreaterThan(item.finalUnitCost);
    }
  });
});

// ─── Cenário: Custo operacional zero ─────────────────────────────────────────

describe("Motor de Rateio — Custo Operacional Zero", () => {
  it("deve funcionar com custo operacional = 0 (sem rateio)", () => {
    const items: BatchItemInput[] = [
      { productName: "Produto A", unitCostBrl: 100, quantity: 10, desiredMarginRate: 30 },
      { productName: "Produto B", unitCostBrl: 200, quantity: 5, desiredMarginRate: 25 },
    ];

    const result = calculateBatchPricing({ items, totalOperationalCost: 0 });
    if (isBatchPricingError(result)) throw new Error("Erro inesperado");

    // Com custo operacional zero, custo final = custo unitário
    expect(result.items[0]!.finalUnitCost).toBeCloseTo(100, 2);
    expect(result.items[1]!.finalUnitCost).toBeCloseTo(200, 2);
    expect(result.allocationCheck).toBeCloseTo(0, 2);
  });
});

// ─── Cenário: Todos os itens com custo zero (distribuição igual) ──────────────

describe("Motor de Rateio — Itens com Custo Zero", () => {
  it("deve distribuir igualmente quando todos os custos são zero", () => {
    const items: BatchItemInput[] = [
      { productName: "Produto A", unitCostBrl: 0, quantity: 10, desiredMarginRate: 30 },
      { productName: "Produto B", unitCostBrl: 0, quantity: 20, desiredMarginRate: 30 },
    ];

    const result = calculateBatchPricing({ items, totalOperationalCost: 1000 });
    if (isBatchPricingError(result)) throw new Error("Erro inesperado");

    // Distribuição igual: 50% para cada
    expect(result.items[0]!.costProportion).toBeCloseTo(0.5, 4);
    expect(result.items[1]!.costProportion).toBeCloseTo(0.5, 4);
    expect(result.items[0]!.allocatedOperationalCost).toBeCloseTo(500, 2);
    expect(result.items[1]!.allocatedOperationalCost).toBeCloseTo(500, 2);
  });
});

// ─── Cenário: Validações de entrada ──────────────────────────────────────────

describe("Validações de Entrada", () => {
  it("deve retornar erro para lote vazio", () => {
    const result = calculateBatchPricing({ items: [], totalOperationalCost: 100 });
    expect(isBatchPricingError(result)).toBe(true);
    if (isBatchPricingError(result)) {
      expect(result.code).toBe("EMPTY_BATCH");
    }
  });

  it("deve retornar erro para custo operacional negativo", () => {
    const result = calculateBatchPricing({
      items: [{ productName: "X", unitCostBrl: 100, quantity: 1, desiredMarginRate: 30 }],
      totalOperationalCost: -100,
    });
    expect(isBatchPricingError(result)).toBe(true);
    if (isBatchPricingError(result)) {
      expect(result.code).toBe("NEGATIVE_COST");
    }
  });

  it("deve retornar erro para item com quantidade < 1", () => {
    const result = calculateBatchPricing({
      items: [{ productName: "X", unitCostBrl: 100, quantity: 0, desiredMarginRate: 30 }],
      totalOperationalCost: 0,
    });
    expect(isBatchPricingError(result)).toBe(true);
    if (isBatchPricingError(result)) {
      expect(result.code).toBe("INVALID_ITEM");
    }
  });

  it("deve retornar erro para margem >= 100%", () => {
    const result = calculateBatchPricing({
      items: [{ productName: "X", unitCostBrl: 100, quantity: 1, desiredMarginRate: 100 }],
      totalOperationalCost: 0,
    });
    expect(isBatchPricingError(result)).toBe(true);
    if (isBatchPricingError(result)) {
      expect(result.code).toBe("INVALID_ITEM");
    }
  });
});
