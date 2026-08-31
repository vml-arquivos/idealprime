/**
 * PermuPay Vendas — Motor de Precificação
 *
 * Motor de cálculo isolado para simulação de preços por forma de pagamento.
 * Implementa cálculo reverso de margem, juros compostos e diagnóstico financeiro.
 *
 * AVISO FISCAL: Alíquotas sugeridas. Confirme NCM, regime tributário,
 * CST/CSOSN e eventual substituição tributária com seu contador.
 */

// ─── Tipos e Interfaces ────────────────────────────────────────────────────────

export type ProductCategory = "CELULAR" | "ELETRONICO" | "PERFUME" | "OUTRO";

export type TaxRegime =
  | "SIMPLES_NACIONAL"
  | "LUCRO_PRESUMIDO"
  | "LUCRO_REAL"
  | "MANUAL";

export type PaymentMethod =
  | "PIX"
  | "BOLETO"
  | "DEBITO"
  | "CREDITO_A_VISTA"
  | "CREDITO_PARCELADO";

export type DiagnosticStatus = "EXCELENTE" | "SAUDAVEL" | "ATENCAO" | "RISCO" | "PREJUIZO";

export interface TaxRates {
  cash: number;        // Pix/à vista
  boleto: number;      // Boleto
  debit: number;       // Débito
  creditCash: number;  // Crédito à vista
  creditInstallment: number; // Crédito parcelado
}

export interface BoletoConfig {
  months: number;
  monthlyInterestRate: number;   // % ao mês
  fixedFee: number;              // Taxa fixa de emissão (R$)
  defaultRiskRate: number;       // Risco de inadimplência %
  customerPaysInterest: boolean; // Juros repassado ao cliente?
}

export interface CardConfig {
  debitFeeRate: number;            // Taxa débito %
  creditCashFeeRate: number;       // Taxa crédito à vista %
  creditInstallmentFeeRate: number;// Taxa crédito parcelado %
  installments: number;            // Número de parcelas
  anticipationRate: number;        // Taxa de antecipação %
  monthlyInterestRate: number;     // Juros mensal parcelamento %
  customerPaysInterest: boolean;   // Juros absorvido pela empresa?
}

export interface PricingInput {
  productName: string;
  category: ProductCategory;
  ncm?: string;
  costPrice: number;
  packagingCost: number;
  inboundShippingCost: number;
  operationalCost: number;
  desiredMarginRate: number; // % ex: 30 = 30%
  taxRegime: TaxRegime;
  taxRates: TaxRates;
  boleto: BoletoConfig;
  card: CardConfig;
}

export interface PaymentResult {
  method: PaymentMethod;
  methodLabel: string;
  suggestedPrice: number;
  psychologicalPrice: number;
  installmentValue: number;
  installments: number;
  totalTax: number;
  totalFees: number;
  totalInterest: number;
  netProfit: number;
  realMarginRate: number;   // % real sobre o preço final
  marginPercentageOnCost: number; // % de margem sobre preço de custo (antes era "markup")
  markup: number;
  diagnostic: DiagnosticStatus;
  minPriceNoLoss: number;
  minPriceWithMargin: number;
  
  // Campos de detalhamento
  baseCost: number;         // Preço de custo original
  marginValue: number;      // Valor da margem de lucro (costPrice * margin%)
  subtotalWithMargin: number; // costPrice + marginValue
  otherCosts: number;       // packaging + shipping + operational
}

export interface PricingResult {
  input: PricingInput;
  totalCost: number;
  results: PaymentResult[];
  bestMethod: PaymentMethod;
  worstMethod: PaymentMethod;
  promotionMinPrice: number;
  hasUnhealthyProduct: boolean;
  unhealthyAlert?: string;
}

export interface PricingError {
  code: "INVALID_PERCENTAGES" | "NEGATIVE_COST" | "NEGATIVE_MARGIN" | "INVALID_PERIODS" | "CALCULATION_ERROR";
  message: string;
}

// ─── Alíquotas sugeridas por regime tributário ────────────────────────────────

export const SUGGESTED_TAX_RATES: Record<TaxRegime, TaxRates> = {
  SIMPLES_NACIONAL: {
    cash: 6.0,
    boleto: 6.0,
    debit: 6.0,
    creditCash: 6.0,
    creditInstallment: 6.0,
  },
  LUCRO_PRESUMIDO: {
    cash: 11.33,
    boleto: 11.33,
    debit: 11.33,
    creditCash: 11.33,
    creditInstallment: 11.33,
  },
  LUCRO_REAL: {
    cash: 13.25,
    boleto: 13.25,
    debit: 13.25,
    creditCash: 13.25,
    creditInstallment: 13.25,
  },
  MANUAL: {
    cash: 0,
    boleto: 0,
    debit: 0,
    creditCash: 0,
    creditInstallment: 0,
  },
};

export const TAX_REGIME_LABELS: Record<TaxRegime, string> = {
  SIMPLES_NACIONAL: "Simples Nacional",
  LUCRO_PRESUMIDO: "Lucro Presumido",
  LUCRO_REAL: "Lucro Real",
  MANUAL: "Manual",
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  PIX: "Pix / À Vista",
  BOLETO: "Boleto Bancário",
  DEBITO: "Cartão de Débito",
  CREDITO_A_VISTA: "Crédito à Vista",
  CREDITO_PARCELADO: "Crédito Parcelado",
};

// ─── Funções Auxiliares ───────────────────────────────────────────────────────

/**
 * Formata valor como moeda brasileira (R$)
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Formata percentual com 2 casas decimais
 */
export function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`;
}

/**
 * Calcula preço psicológico terminando em ,90
 * Sempre retorna o menor valor X,90 que seja >= price
 */
export function psychologicalPrice(price: number): number {
  // Parte inteira do preço
  const whole = Math.floor(price);
  // Candidato: parte inteira + 0,90
  const candidate = whole + 0.90;
  // Se o candidato já cobre o preço, usa ele; senão avança para o próximo
  return candidate >= price ? candidate : candidate + 1;
}

/**
 * Calcula juros compostos
 * valor_final = valor_base * (1 + taxa_mensal/100) ^ periodos
 */
export function compoundInterest(base: number, monthlyRate: number, periods: number): number {
  if (monthlyRate === 0 || periods <= 1) return base;
  return base * Math.pow(1 + monthlyRate / 100, periods);
}

/**
 * Determina diagnóstico com base na margem real e lucro
 *
 * EXCELENTE — margem real >= margem desejada + 10%
 * SAUDÁVEL  — margem real >= margem desejada (mas < desejada + 10%)
 * ATENÇÃO  — margem real abaixo da desejada, mas acima de 10%
 * RISCO    — margem real menor que 10% (mas lucro positivo)
 * PREJUÍZO — lucro líquido negativo
 */
export function getDiagnostic(
  realMarginRate: number,
  netProfit: number,
  desiredMarginRate?: number
): DiagnosticStatus {
  if (netProfit < 0) return "PREJUIZO";
  if (realMarginRate < 10) return "RISCO";
  const desired = desiredMarginRate ?? 10;
  if (realMarginRate < desired) return "ATENCAO";
  if (realMarginRate >= desired + 10) return "EXCELENTE";
  return "SAUDAVEL";
}

// ─── Validações ───────────────────────────────────────────────────────────────

export function validatePricingInput(input: PricingInput): PricingError | null {
  const totalCost =
    input.costPrice +
    input.packagingCost +
    input.inboundShippingCost +
    input.operationalCost;

  if (totalCost < 0) {
    return {
      code: "NEGATIVE_COST",
      message: "O custo total do produto não pode ser negativo.",
    };
  }

  if (input.costPrice < 0) {
    return {
      code: "NEGATIVE_COST",
      message: "O preço de custo não pode ser negativo.",
    };
  }

  if (input.desiredMarginRate < 0) {
    return {
      code: "NEGATIVE_MARGIN",
      message: "A margem líquida desejada não pode ser negativa.",
    };
  }

  if (input.boleto.months < 1) {
    return {
      code: "INVALID_PERIODS",
      message: "A quantidade de meses do boleto deve ser no mínimo 1.",
    };
  }

  if (input.card.installments < 1) {
    return {
      code: "INVALID_PERIODS",
      message: "O número de parcelas deve ser no mínimo 1.",
    };
  }

  // Validar que nenhuma soma de percentuais variáveis atinge 100%
  const methods: Array<{ method: string; sum: number }> = [
    {
      method: "Pix",
      sum: input.taxRates.cash + input.desiredMarginRate,
    },
    {
      method: "Boleto",
      sum:
        input.taxRates.boleto +
        input.boleto.defaultRiskRate +
        input.desiredMarginRate,
    },
    {
      method: "Débito",
      sum:
        input.taxRates.debit +
        input.card.debitFeeRate +
        input.desiredMarginRate,
    },
    {
      method: "Crédito à Vista",
      sum:
        input.taxRates.creditCash +
        input.card.creditCashFeeRate +
        input.desiredMarginRate,
    },
    {
      method: "Crédito Parcelado",
      sum:
        input.taxRates.creditInstallment +
        input.card.creditInstallmentFeeRate +
        input.card.anticipationRate +
        input.desiredMarginRate,
    },
  ];

  for (const { method, sum } of methods) {
    if (sum >= 100) {
      return {
        code: "INVALID_PERCENTAGES",
        message: `A soma dos percentuais variáveis para "${method}" atingiu ${sum.toFixed(2)}%, o que tornaria o cálculo inviável. Reduza as alíquotas ou a margem desejada.`,
      };
    }
  }

  return null;
}

// ─── Motor de Cálculo Principal ───────────────────────────────────────────────

/**
 * Calcula o preço para Pix / À Vista
 */
function calculatePix(input: PricingInput, costPrice: number, totalCost: number): PaymentResult {
  const { taxRates, desiredMarginRate } = input;
  const marginValue = costPrice * (desiredMarginRate / 100);
  const priceBase = costPrice + marginValue;
  const taxRate = taxRates.cash / 100;
  const suggestedPrice = priceBase / (1 - taxRate);
  
  const totalTax = suggestedPrice * taxRate;
  const otherCosts = totalCost - costPrice;
  const totalCosts = totalCost + totalTax;
  const netProfit = suggestedPrice - totalCosts;
  const realMarginRate = (netProfit / suggestedPrice) * 100;
  const marginPercentageOnCost = ((suggestedPrice - costPrice) / costPrice) * 100;
  
  return {
    method: "PIX",
    methodLabel: PAYMENT_METHOD_LABELS.PIX,
    suggestedPrice,
    installmentValue: suggestedPrice,
    installments: 1,
    totalTax,
    totalFees: 0,
    totalInterest: 0,
    netProfit,
    realMarginRate,
    marginPercentageOnCost,
    markup: marginPercentageOnCost,
    diagnostic: getDiagnostic(realMarginRate, netProfit, desiredMarginRate),
    psychologicalPrice: psychologicalPrice(suggestedPrice),
    minPriceNoLoss: totalCost / (1 - taxRate),
    minPriceWithMargin: suggestedPrice,
    baseCost: costPrice,
    marginValue,
    subtotalWithMargin: priceBase,
    otherCosts,
  };
}

/**
 * Calcula o preço para Boleto Bancário
 */
function calculateBoleto(input: PricingInput, costPrice: number, totalCost: number): PaymentResult {
  const { boleto, taxRates, desiredMarginRate } = input;
  const marginValue = costPrice * (desiredMarginRate / 100);
  const priceBase = costPrice + marginValue;
  const taxRate = taxRates.boleto / 100;
  const riskRate = boleto.defaultRiskRate / 100;
  
  const priceWithoutInterest = (priceBase + boleto.fixedFee) / (1 - taxRate - riskRate);
  
  let suggestedPrice: number;
  let totalInterest: number;

  if (boleto.customerPaysInterest) {
    suggestedPrice = priceWithoutInterest;
    totalInterest = compoundInterest(priceWithoutInterest, boleto.monthlyInterestRate, boleto.months) - priceWithoutInterest;
  } else {
    suggestedPrice = compoundInterest(priceWithoutInterest, boleto.monthlyInterestRate, boleto.months);
    totalInterest = suggestedPrice - priceWithoutInterest;
  }

  const totalTax = suggestedPrice * taxRate;
  const totalFees = boleto.fixedFee + suggestedPrice * riskRate;
  const otherCosts = totalCost - costPrice;
  const totalCosts = totalCost + totalTax + totalFees + (boleto.customerPaysInterest ? 0 : totalInterest);
  const netProfit = suggestedPrice - totalCosts;
  const realMarginRate = (netProfit / suggestedPrice) * 100;
  const marginPercentageOnCost = ((suggestedPrice - costPrice) / costPrice) * 100;
  
  return {
    method: "BOLETO",
    methodLabel: PAYMENT_METHOD_LABELS.BOLETO,
    suggestedPrice,
    installmentValue: suggestedPrice / boleto.months,
    installments: boleto.months,
    totalTax,
    totalFees,
    totalInterest,
    netProfit,
    realMarginRate,
    marginPercentageOnCost,
    markup: marginPercentageOnCost,
    diagnostic: getDiagnostic(realMarginRate, netProfit, desiredMarginRate),
    psychologicalPrice: psychologicalPrice(suggestedPrice),
    minPriceNoLoss: totalCost / (1 - taxRate - riskRate),
    minPriceWithMargin: suggestedPrice,
    baseCost: costPrice,
    marginValue,
    subtotalWithMargin: priceBase,
    otherCosts,
  };
}

/**
 * Calcula o preço para Cartão de Débito
 */
function calculateDebit(input: PricingInput, costPrice: number, totalCost: number): PaymentResult {
  const { card, taxRates, desiredMarginRate } = input;
  const marginValue = costPrice * (desiredMarginRate / 100);
  const priceBase = costPrice + marginValue;
  const taxRate = taxRates.debit / 100;
  const feeRate = card.debitFeeRate / 100;
  const suggestedPrice = priceBase / (1 - taxRate - feeRate);
  
  const totalTax = suggestedPrice * taxRate;
  const totalFees = suggestedPrice * feeRate;
  const otherCosts = totalCost - costPrice;
  const totalCosts = totalCost + totalTax + totalFees;
  const netProfit = suggestedPrice - totalCosts;
  const realMarginRate = (netProfit / suggestedPrice) * 100;
  const marginPercentageOnCost = ((suggestedPrice - costPrice) / costPrice) * 100;
  
  return {
    method: "DEBITO",
    methodLabel: PAYMENT_METHOD_LABELS.DEBITO,
    suggestedPrice,
    installmentValue: suggestedPrice,
    installments: 1,
    totalTax,
    totalFees,
    totalInterest: 0,
    netProfit,
    realMarginRate,
    marginPercentageOnCost,
    markup: marginPercentageOnCost,
    diagnostic: getDiagnostic(realMarginRate, netProfit, desiredMarginRate),
    psychologicalPrice: psychologicalPrice(suggestedPrice),
    minPriceNoLoss: totalCost / (1 - (taxRate + feeRate)),
    minPriceWithMargin: suggestedPrice,
    baseCost: costPrice,
    marginValue,
    subtotalWithMargin: priceBase,
    otherCosts,
  };
}

/**
 * Calcula o preço para Crédito à Vista
 */
function calculateCreditCash(input: PricingInput, costPrice: number, totalCost: number): PaymentResult {
  const { card, taxRates, desiredMarginRate } = input;
  const marginValue = costPrice * (desiredMarginRate / 100);
  const priceBase = costPrice + marginValue;
  const taxRate = taxRates.creditCash / 100;
  const feeRate = card.creditCashFeeRate / 100;
  const suggestedPrice = priceBase / (1 - taxRate - feeRate);
  
  const totalTax = suggestedPrice * taxRate;
  const totalFees = suggestedPrice * feeRate;
  const otherCosts = totalCost - costPrice;
  const totalCosts = totalCost + totalTax + totalFees;
  const netProfit = suggestedPrice - totalCosts;
  const realMarginRate = (netProfit / suggestedPrice) * 100;
  const marginPercentageOnCost = ((suggestedPrice - costPrice) / costPrice) * 100;
  
  return {
    method: "CREDITO_A_VISTA",
    methodLabel: PAYMENT_METHOD_LABELS.CREDITO_A_VISTA,
    suggestedPrice,
    installmentValue: suggestedPrice,
    installments: 1,
    totalTax,
    totalFees,
    totalInterest: 0,
    netProfit,
    realMarginRate,
    marginPercentageOnCost,
    markup: marginPercentageOnCost,
    diagnostic: getDiagnostic(realMarginRate, netProfit, desiredMarginRate),
    psychologicalPrice: psychologicalPrice(suggestedPrice),
    minPriceNoLoss: totalCost / (1 - (taxRate + feeRate)),
    minPriceWithMargin: suggestedPrice,
    baseCost: costPrice,
    marginValue,
    subtotalWithMargin: priceBase,
    otherCosts,
  };
}

/**
 * Calcula o preço para Crédito Parcelado
 */
function calculateCreditInstallment(input: PricingInput, costPrice: number, totalCost: number): PaymentResult {
  const { card, taxRates, desiredMarginRate } = input;
  const marginValue = costPrice * (desiredMarginRate / 100);
  const priceBase = costPrice + marginValue;
  const taxRate = taxRates.creditInstallment / 100;
  const feeRate = card.creditInstallmentFeeRate / 100;
  const anticipationRate = card.anticipationRate / 100;
  
  const priceWithoutInterest = priceBase / (1 - taxRate - feeRate - anticipationRate);
  
  let suggestedPrice: number;
  let totalInterest: number;

  if (card.customerPaysInterest) {
    suggestedPrice = priceWithoutInterest;
    totalInterest = compoundInterest(priceWithoutInterest, card.monthlyInterestRate, card.installments) - priceWithoutInterest;
  } else {
    suggestedPrice = compoundInterest(priceWithoutInterest, card.monthlyInterestRate, card.installments);
    totalInterest = suggestedPrice - priceWithoutInterest;
  }

  const totalTax = suggestedPrice * taxRate;
  const totalFees = suggestedPrice * (feeRate + anticipationRate);
  const otherCosts = totalCost - costPrice;
  const totalCosts = totalCost + totalTax + totalFees + (card.customerPaysInterest ? 0 : totalInterest);
  const netProfit = suggestedPrice - totalCosts;
  const realMarginRate = (netProfit / suggestedPrice) * 100;
  const marginPercentageOnCost = ((suggestedPrice - costPrice) / costPrice) * 100;
  
  return {
    method: "CREDITO_PARCELADO",
    methodLabel: PAYMENT_METHOD_LABELS.CREDITO_PARCELADO,
    suggestedPrice,
    installmentValue: suggestedPrice / card.installments,
    installments: card.installments,
    totalTax,
    totalFees,
    totalInterest,
    netProfit,
    realMarginRate,
    marginPercentageOnCost,
    markup: marginPercentageOnCost,
    diagnostic: getDiagnostic(realMarginRate, netProfit, desiredMarginRate),
    psychologicalPrice: psychologicalPrice(suggestedPrice),
    minPriceNoLoss: totalCost / (1 - (taxRate + feeRate + anticipationRate)),
    minPriceWithMargin: suggestedPrice,
    baseCost: costPrice,
    marginValue,
    subtotalWithMargin: priceBase,
    otherCosts,
  };
}

// ─── Função Principal de Cálculo ───────────────────────────────────────────────

/**
 * Calcula a precificação completa para um produto
 */
export function calculatePricing(
  input: PricingInput
): PricingResult | PricingError {
  const validationError = validatePricingInput(input);
  if (validationError) return validationError;

  const costPrice = input.costPrice;
  const totalCost =
    input.costPrice +
    input.packagingCost +
    input.inboundShippingCost +
    input.operationalCost;

  const results: PaymentResult[] = [
    calculatePix(input, costPrice, totalCost),
    calculateBoleto(input, costPrice, totalCost),
    calculateDebit(input, costPrice, totalCost),
    calculateCreditCash(input, costPrice, totalCost),
    calculateCreditInstallment(input, costPrice, totalCost),
  ];

  const sorted = [...results].sort((a, b) => b.realMarginRate - a.realMarginRate);
  const bestMethod = sorted[0]!.method;
  const worstMethod = sorted[sorted.length - 1]!.method;

  return {
    input,
    totalCost,
    results,
    bestMethod,
    worstMethod,
    promotionMinPrice: Math.min(...results.map((r) => r.minPriceNoLoss)),
    hasUnhealthyProduct: results.every((r) => r.diagnostic === "PREJUIZO" || r.diagnostic === "RISCO"),
    unhealthyAlert: results.every((r) => r.diagnostic === "PREJUIZO" || r.diagnostic === "RISCO")
      ? "Atenção: este produto apresenta margem crítica ou prejuízo em todas as formas de pagamento. Revise os custos, taxas financeiras e margem desejada."
      : undefined,
  };
}

/**
 * Verifica se o resultado é um erro de precificação
 */
export function isPricingError(
  result: PricingResult | PricingError
): result is PricingError {
  return "code" in result && "message" in result;
}
