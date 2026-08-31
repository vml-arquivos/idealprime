/**
 * pricing.batch.ts — Motor de Rateio Proporcional por Entrada/Lote
 *
 * REGRA CENTRAL:
 *   Os custos da entrada (operacional, imposto e outros custos) pertencem à
 *   compra inteira. Eles são rateados proporcionalmente pelo peso financeiro
 *   de cada produto dentro da entrada.
 *
 * Compatibilidade:
 * - Mantém `totalOperationalCost` e os campos antigos.
 * - Novos campos são opcionais para não quebrar chamadas antigas.
 */

// ─── Tipos ─────────────────────────────────────────────────────────────────────

export type AcquisitionCurrency = "BRL" | "USD";
export type AcquisitionPaymentMethod =
  | "DINHEIRO"
  | "PIX"
  | "BOLETO"
  | "CARTAO"
  | "DOLAR"
  | "OUTRO";

export interface BatchItemInput {
  /** ID do produto vinculado (opcional — pode ser um produto novo ainda não salvo) */
  productId?: number;
  productName: string;

  /** Custo unitário já convertido para BRL. Continua sendo o campo principal usado no cálculo. */
  unitCostBrl: number;

  /** Campos de aquisição — opcionais para compatibilidade com produtos/entradas antigas. */
  unitCostOriginal?: number;
  costCurrency?: AcquisitionCurrency;
  exchangeRate?: number;
  acquisitionPaymentMethod?: AcquisitionPaymentMethod;

  quantity: number;
  /** Margem desejada em % (ex: 30 = 30%) */
  desiredMarginRate: number;
  /** Alíquota de imposto em % para o preço sugerido simplificado */
  estimatedTaxRate?: number;
}

export interface BatchItemResult extends BatchItemInput {
  /** unitCostBrl * quantity */
  totalItemCost: number;
  /** Alias semântico para relatórios: custo base total do produto */
  baseTotalCost: number;
  /** Proporção deste item no custo total da entrada (0..1) */
  costProportion: number;

  /** Custo operacional absorvido por este item = proporção * custo_operacional_total */
  allocatedOperationalCost: number;
  operationalCostPerUnit: number;

  /** Imposto/custo fiscal alocado ao item, quando informado no cabeçalho da entrada */
  allocatedTaxCost: number;
  taxCostPerUnit: number;

  /** Outros custos alocados ao item, quando informado no cabeçalho da entrada */
  allocatedOtherCost: number;
  otherCostPerUnit: number;

  /** unitCostBrl + custos proporcionais por unidade */
  finalUnitCost: number;
  /** Custo real total do item = finalUnitCost * quantity */
  realTotalCost: number;

  /** Preço sugerido com margem e imposto (cálculo reverso) */
  suggestedPrice: number;
  /** Margem de contribuição unitária = preço_sugerido - finalUnitCost */
  contributionMargin: number;
}

export interface BatchPricingInput {
  items: BatchItemInput[];
  /** Custo operacional TOTAL da entrada (frete, despachante, armazenagem etc.) */
  totalOperationalCost: number;
  /** Imposto/taxa total da entrada, se houver. Opcional para compatibilidade. */
  totalTaxCost?: number;
  /** Outros custos totais da entrada, se houver. Opcional para compatibilidade. */
  totalOtherCost?: number;
}

export interface BatchPricingResult {
  items: BatchItemResult[];
  /** Custo total das mercadorias (soma de unitCostBrl * quantity) */
  totalCostOfGoods: number;
  totalOperationalCost: number;
  totalTaxCost: number;
  totalOtherCost: number;
  /** Custo total da entrada = mercadorias + operacional + imposto + outros */
  grandTotal: number;
  /** Verificação: soma dos allocatedOperationalCost deve ≈ totalOperationalCost */
  allocationCheck: number;
  taxAllocationCheck: number;
  otherAllocationCheck: number;
}

export interface BatchPricingError {
  code: "EMPTY_BATCH" | "ZERO_COST" | "INVALID_ITEM" | "NEGATIVE_COST";
  message: string;
  itemIndex?: number;
}

// ─── Coerção Segura de Tipos ───────────────────────────────────────────────────

function toNumber(value: unknown): number {
  if (typeof value === "number") return isNaN(value) ? 0 : value;
  if (typeof value === "string") {
    const cleaned = value
      .replace(/[R$US$\s]/g, "")
      .replace(/\./g, "")
      .replace(",", ".");
    const n = parseFloat(cleaned);
    return isNaN(n) ? 0 : n;
  }
  return 0;
}

function roundMoney(value: number): number {
  return Number(value.toFixed(4));
}

// ─── Validação ─────────────────────────────────────────────────────────────────

export function validateBatchInput(
  input: BatchPricingInput
): BatchPricingError | null {
  if (!input.items || input.items.length === 0) {
    return { code: "EMPTY_BATCH", message: "A entrada deve ter pelo menos 1 item." };
  }

  const opCost = toNumber(input.totalOperationalCost);
  const taxCost = toNumber(input.totalTaxCost ?? 0);
  const otherCost = toNumber(input.totalOtherCost ?? 0);

  if (opCost < 0 || taxCost < 0 || otherCost < 0) {
    return {
      code: "NEGATIVE_COST",
      message: "Custos totais da entrada não podem ser negativos.",
    };
  }

  for (let i = 0; i < input.items.length; i++) {
    const item = input.items[i]!;

    if (!item.productName?.trim()) {
      return {
        code: "INVALID_ITEM",
        message: `Item ${i + 1}: nome do produto é obrigatório.`,
        itemIndex: i,
      };
    }

    const unitCost = toNumber(item.unitCostBrl);
    if (unitCost < 0) {
      return {
        code: "NEGATIVE_COST",
        message: `Item ${i + 1} (${item.productName}): custo unitário não pode ser negativo.`,
        itemIndex: i,
      };
    }

    const qty = toNumber(item.quantity);
    if (qty < 1) {
      return {
        code: "INVALID_ITEM",
        message: `Item ${i + 1} (${item.productName}): quantidade mínima é 1.`,
        itemIndex: i,
      };
    }

    const margin = toNumber(item.desiredMarginRate);
    if (margin < 0 || margin >= 100) {
      return {
        code: "INVALID_ITEM",
        message: `Item ${i + 1} (${item.productName}): margem desejada deve estar entre 0% e 99.9%.`,
        itemIndex: i,
      };
    }
  }

  return null;
}

// ─── Motor Principal de Rateio ────────────────────────────────────────────────

export function calculateBatchPricing(
  input: BatchPricingInput
): BatchPricingResult | BatchPricingError {
  const validationError = validateBatchInput(input);
  if (validationError) return validationError;

  const totalOperationalCost = toNumber(input.totalOperationalCost);
  const totalTaxCost = toNumber(input.totalTaxCost ?? 0);
  const totalOtherCost = toNumber(input.totalOtherCost ?? 0);

  const items = input.items.map((item) => ({
    ...item,
    unitCostBrl: toNumber(item.unitCostBrl),
    unitCostOriginal: toNumber(item.unitCostOriginal ?? item.unitCostBrl),
    exchangeRate: toNumber(item.exchangeRate ?? 0),
    costCurrency: (item.costCurrency ?? "BRL") as AcquisitionCurrency,
    acquisitionPaymentMethod: (item.acquisitionPaymentMethod ?? "OUTRO") as AcquisitionPaymentMethod,
    quantity: toNumber(item.quantity),
    desiredMarginRate: toNumber(item.desiredMarginRate),
    estimatedTaxRate: toNumber(item.estimatedTaxRate ?? 0),
  }));

  const itemsWithTotalCost = items.map((item) => ({
    ...item,
    totalItemCost: roundMoney(item.unitCostBrl * item.quantity),
  }));

  const totalCostOfGoods = roundMoney(
    itemsWithTotalCost.reduce((sum, item) => sum + item.totalItemCost, 0)
  );

  const grandTotal = roundMoney(
    totalCostOfGoods + totalOperationalCost + totalTaxCost + totalOtherCost
  );

  const resultItems: BatchItemResult[] = itemsWithTotalCost.map((item) => {
    const costProportion =
      totalCostOfGoods > 0
        ? item.totalItemCost / totalCostOfGoods
        : 1 / items.length;

    const allocatedOperationalCost = roundMoney(costProportion * totalOperationalCost);
    const allocatedTaxCost = roundMoney(costProportion * totalTaxCost);
    const allocatedOtherCost = roundMoney(costProportion * totalOtherCost);

    const operationalCostPerUnit = roundMoney(allocatedOperationalCost / item.quantity);
    const taxCostPerUnit = roundMoney(allocatedTaxCost / item.quantity);
    const otherCostPerUnit = roundMoney(allocatedOtherCost / item.quantity);

    const finalUnitCost = roundMoney(
      item.unitCostBrl + operationalCostPerUnit + taxCostPerUnit + otherCostPerUnit
    );

    const realTotalCost = roundMoney(finalUnitCost * item.quantity);

    const taxRate = item.estimatedTaxRate / 100;
    const marginRate = item.desiredMarginRate / 100;
    const divisor = 1 - marginRate - taxRate;
    const suggestedPrice = roundMoney(divisor > 0.001 ? finalUnitCost / divisor : finalUnitCost);
    const contributionMargin = roundMoney(suggestedPrice - finalUnitCost);

    return {
      ...item,
      totalItemCost: item.totalItemCost,
      baseTotalCost: item.totalItemCost,
      costProportion,
      allocatedOperationalCost,
      operationalCostPerUnit,
      allocatedTaxCost,
      taxCostPerUnit,
      allocatedOtherCost,
      otherCostPerUnit,
      finalUnitCost,
      realTotalCost,
      suggestedPrice,
      contributionMargin,
    };
  });

  const allocationCheck = roundMoney(
    resultItems.reduce((sum, item) => sum + item.allocatedOperationalCost, 0)
  );
  const taxAllocationCheck = roundMoney(
    resultItems.reduce((sum, item) => sum + item.allocatedTaxCost, 0)
  );
  const otherAllocationCheck = roundMoney(
    resultItems.reduce((sum, item) => sum + item.allocatedOtherCost, 0)
  );

  return {
    items: resultItems,
    totalCostOfGoods,
    totalOperationalCost,
    totalTaxCost,
    totalOtherCost,
    grandTotal,
    allocationCheck,
    taxAllocationCheck,
    otherAllocationCheck,
  };
}

export function isBatchPricingError(
  result: BatchPricingResult | BatchPricingError
): result is BatchPricingError {
  return "code" in result && "message" in result;
}

// ─── Utilitários de Formatação ─────────────────────────────────────────────────

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatPercent(value: number, decimals = 2): string {
  return `${value.toFixed(decimals)}%`;
}
