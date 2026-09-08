/**
 * shared/batchImport.ts — parsing puro da planilha (.xlsx/.csv) de "Entrada de
 * Produtos" (client/src/pages/BatchPricing.tsx).
 *
 * Extraído para `shared/` (em vez de ficar só dentro da página) para poder ser
 * testado sem precisar de DOM/React — mesma convenção já usada para
 * `shared/pricing.batch.ts`. A leitura do arquivo em si (FileReader, biblioteca
 * `xlsx`) continua no componente, que só chama `parseImportRow` linha a linha
 * depois de converter a planilha em objetos simples (`sheet_to_json`).
 *
 * Pedido explícito do cliente: poder subir a planilha atualizada de produtos e
 * já alimentar automaticamente os itens da entrada, em vez de digitar um por
 * um. O formato aceito espelha as colunas já exportadas pela própria tela
 * ("Produtos da Entrada" em `exportSpreadsheet`), então exportar → editar no
 * Excel → reimportar funciona sem exigir um layout à parte.
 */

export type ImportCurrency = "BRL" | "USD";
export type ImportEntryMode = "EXISTING" | "NEW";

export type ImportOption = { value: string; label: string };

export type ExistingProductForImport = {
  id: number;
  name: string;
  sku?: string | null;
  category?: string | null;
};

export type ParsedImportItem = {
  entryMode: ImportEntryMode;
  productId?: number;
  productName: string;
  category: string;
  currency: ImportCurrency;
  unitCostOriginal: number;
  exchangeRate: number;
  quantity: number;
  acquisitionPaymentMethod: string;
  desiredMarginRate: number | null;
  estimatedTaxRate: number | null;
};

export type ImportRowResult =
  | { ok: true; item: ParsedImportItem }
  | { ok: false; error: string };

/** Mesma lógica de `parseCurrencyValue` (client/src/components/CurrencyInput.tsx),
 * duplicada aqui deliberadamente: `shared/` não deve importar de `client/`. */
export function toImportNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const raw = String(value ?? "").trim();
  if (!raw) return 0;

  const cleaned = raw.replace(/[R$US$\s]/g, "").replace(/[^\d,.-]/g, "");
  if (!cleaned) return 0;

  if (cleaned.includes(",")) {
    const parsed = Number.parseFloat(cleaned.replace(/\./g, "").replace(",", "."));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function normalizeHeaderKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export const IMPORT_FIELD_ALIASES = {
  productName: ["produto", "nome", "nome do produto", "item", "descricao"],
  sku: ["sku", "codigo", "codigo sku", "cod"],
  category: ["categoria"],
  quantity: ["quantidade", "qtd", "qtde"],
  currency: ["moeda"],
  unitCostOriginal: [
    "custo original",
    "custo unitario",
    "custo unitario original",
    "custo",
    "valor unitario",
    "preco de custo",
  ],
  exchangeRate: ["cotacao", "cotacao dolar", "cotacao do dolar"],
  paymentMethod: [
    "forma de pagamento da compra",
    "forma de pagamento",
    "pagamento",
  ],
  desiredMarginRate: ["margem desejada", "margem", "margem %"],
  estimatedTaxRate: ["imposto estimado", "imposto", "taxa estimada"],
} as const satisfies Record<string, readonly string[]>;

export type ImportField = keyof typeof IMPORT_FIELD_ALIASES;

export function readImportField(
  row: Record<string, unknown>,
  field: ImportField,
): string {
  const normalizedRow = new Map<string, unknown>();
  for (const [key, value] of Object.entries(row)) {
    normalizedRow.set(normalizeHeaderKey(key), value);
  }
  for (const alias of IMPORT_FIELD_ALIASES[field]) {
    if (normalizedRow.has(alias)) {
      const value = normalizedRow.get(alias);
      if (value !== undefined && value !== null && String(value).trim() !== "") {
        return String(value).trim();
      }
    }
  }
  return "";
}

export function matchImportOption(
  raw: string,
  options: ImportOption[],
  fallback: string,
): string {
  const needle = normalizeHeaderKey(raw);
  if (!needle) return fallback;
  const match = options.find(
    (option) =>
      normalizeHeaderKey(option.value) === needle ||
      normalizeHeaderKey(option.label) === needle,
  );
  return match?.value ?? fallback;
}

export function matchImportCurrency(raw: string): ImportCurrency {
  const needle = normalizeHeaderKey(raw);
  if (["usd", "dolar", "us$", "dollar"].includes(needle)) return "USD";
  return "BRL";
}

/**
 * Converte UMA linha já lida da planilha (objeto simples, chaves = cabeçalhos
 * originais) em um item de entrada, ou num erro descritivo com o número da
 * linha (para o usuário corrigir na própria planilha).
 *
 * `rowNumber` deve já vir contando a linha de cabeçalho (linha 1) — ou seja, a
 * primeira linha de dados é a 2.
 */
export function parseImportRow(
  raw: Record<string, unknown>,
  rowNumber: number,
  existingProducts: ExistingProductForImport[],
  categoryOptions: ImportOption[],
  paymentOptions: ImportOption[],
): ImportRowResult {
  const productName = readImportField(raw, "productName");
  if (!productName) {
    return { ok: false, error: `Linha ${rowNumber}: nome do produto obrigatório.` };
  }

  const quantityRaw = readImportField(raw, "quantity");
  const quantity = Math.trunc(toImportNumber(quantityRaw));
  if (!quantityRaw || !Number.isFinite(quantity) || quantity <= 0) {
    return {
      ok: false,
      error: `Linha ${rowNumber}: quantidade inválida para "${productName}".`,
    };
  }

  const costRaw = readImportField(raw, "unitCostOriginal");
  const unitCostOriginal = toImportNumber(costRaw);
  if (!costRaw || !Number.isFinite(unitCostOriginal) || unitCostOriginal <= 0) {
    return {
      ok: false,
      error: `Linha ${rowNumber}: custo unitário inválido para "${productName}".`,
    };
  }

  const currency = matchImportCurrency(readImportField(raw, "currency"));
  const exchangeRateRaw = readImportField(raw, "exchangeRate");
  const exchangeRate = toImportNumber(exchangeRateRaw);
  if (currency === "USD" && (!exchangeRateRaw || exchangeRate <= 0)) {
    return {
      ok: false,
      error: `Linha ${rowNumber}: cotação do dólar obrigatória para "${productName}" (moeda USD).`,
    };
  }

  const sku = readImportField(raw, "sku");
  const skuLower = sku.toLowerCase();
  const nameLower = productName.toLowerCase();
  const matchedProduct = existingProducts.find((product) => {
    if (skuLower && String(product.sku ?? "").toLowerCase() === skuLower) return true;
    return String(product.name ?? "").toLowerCase().trim() === nameLower;
  });

  const categoryRaw = readImportField(raw, "category");
  const category = categoryRaw
    ? matchImportOption(categoryRaw, categoryOptions, "OUTRO")
    : matchedProduct?.category ?? "OUTRO";

  const paymentRaw = readImportField(raw, "paymentMethod");
  const acquisitionPaymentMethod = paymentRaw
    ? matchImportOption(paymentRaw, paymentOptions, "OUTRO")
    : "OUTRO";

  const desiredMarginRateRaw = readImportField(raw, "desiredMarginRate");
  const estimatedTaxRateRaw = readImportField(raw, "estimatedTaxRate");

  const item: ParsedImportItem = {
    entryMode: matchedProduct ? "EXISTING" : "NEW",
    productId: matchedProduct?.id,
    productName,
    category,
    currency,
    unitCostOriginal,
    exchangeRate: currency === "USD" ? exchangeRate : 0,
    quantity,
    acquisitionPaymentMethod,
    desiredMarginRate: desiredMarginRateRaw ? toImportNumber(desiredMarginRateRaw) : null,
    estimatedTaxRate: estimatedTaxRateRaw ? toImportNumber(estimatedTaxRateRaw) : null,
  };

  return { ok: true, item };
}
