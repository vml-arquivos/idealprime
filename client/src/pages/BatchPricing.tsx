/**
 * BatchPricing.tsx — Entrada de Produtos profissional, sem tabela espremida
 *
 * Esta tela registra entradas de produtos/lotes, calcula custo real com rateio
 * proporcional, permite produto existente ou novo, preserva FIFO e exporta
 * planilha .xlsx do preview atual.
 */

import { useMemo, useState, useCallback, type ReactNode } from "react";
import { CurrencyInput, parseCurrencyValue } from "@/components/CurrencyInput";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  PlusCircle,
  Trash2,
  Calculator,
  PackageCheck,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Clock,
  Zap,
  Info,
  CheckCircle2,
  AlertTriangle,
  PackagePlus,
  Download,
  WalletCards,
  Eye,
  Pencil,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  calculateBatchPricing,
  formatCurrency,
  formatPercent,
  isBatchPricingError,
  type BatchItemInput,
  type BatchPricingResult,
} from "@shared/pricing.batch";

// ─── Tipos locais ─────────────────────────────────────────────────────────────

type EntryMode = "EXISTING" | "NEW";
type AcquisitionCurrency = "BRL" | "USD";
type AcquisitionPaymentMethod =
  | "DINHEIRO"
  | "PIX"
  | "BOLETO"
  | "CARTAO"
  | "DOLAR"
  | "OUTRO";
type ProductCategory = "CELULAR" | "ELETRONICO" | "PERFUME" | "OUTRO";

type LocalItem = {
  _id: string;
  entryMode: EntryMode;
  productId?: number;
  productName: string;
  category: ProductCategory;
  currency: AcquisitionCurrency;
  unitCostOriginal: string;
  exchangeRate: string;
  quantity: string;
  acquisitionPaymentMethod: AcquisitionPaymentMethod;
  desiredMarginRate: string;
  estimatedTaxRate: string;
};

const CATEGORY_OPTIONS: { value: ProductCategory; label: string }[] = [
  { value: "CELULAR", label: "Celular" },
  { value: "ELETRONICO", label: "Eletrônico" },
  { value: "PERFUME", label: "Perfume" },
  { value: "OUTRO", label: "Outro" },
];

const PAYMENT_OPTIONS: { value: AcquisitionPaymentMethod; label: string }[] = [
  { value: "DINHEIRO", label: "Dinheiro" },
  { value: "PIX", label: "Pix" },
  { value: "BOLETO", label: "Boleto" },
  { value: "CARTAO", label: "Cartão" },
  { value: "DOLAR", label: "Dólar" },
  { value: "OUTRO", label: "Outro" },
];

const emptyItem = (): LocalItem => ({
  _id: crypto.randomUUID(),
  entryMode: "EXISTING",
  productName: "",
  productId: undefined,
  category: "OUTRO",
  currency: "BRL",
  unitCostOriginal: "",
  exchangeRate: "",
  quantity: "",
  desiredMarginRate: "",
  estimatedTaxRate: "",
  acquisitionPaymentMethod: "PIX",
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  return parseCurrencyValue(value ?? "");
}

function toMoney(value: string): number {
  return toNumber(value);
}

function cleanFileName(value: string): string {
  return (
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9-_]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "entrada-produtos"
  ).toLowerCase();
}

function resolveUnitCostBrl(item: LocalItem): number {
  const original = toMoney(item.unitCostOriginal);
  if (item.currency === "USD") return original * toNumber(item.exchangeRate);
  return original;
}

function normalizeItem(item: LocalItem) {
  const unitCostBrl = resolveUnitCostBrl(item);
  return {
    ...item,
    unitCostOriginalNumber: toMoney(item.unitCostOriginal),
    exchangeRateNumber:
      item.currency === "USD" ? toNumber(item.exchangeRate) : 0,
    unitCostBrl,
    quantityNumber: Math.trunc(toNumber(item.quantity)),
    desiredMarginRateNumber: toNumber(item.desiredMarginRate),
    estimatedTaxRateNumber: toNumber(item.estimatedTaxRate),
  };
}

function toBatchItem(item: LocalItem): BatchItemInput {
  const normalized = normalizeItem(item);
  return {
    productId: normalized.productId,
    productName: normalized.productName.trim(),
    unitCostOriginal: normalized.unitCostOriginalNumber,
    costCurrency: normalized.currency,
    exchangeRate: normalized.exchangeRateNumber,
    acquisitionPaymentMethod: normalized.acquisitionPaymentMethod,
    unitCostBrl: normalized.unitCostBrl,
    quantity: normalized.quantityNumber,
    desiredMarginRate: normalized.desiredMarginRateNumber,
    estimatedTaxRate: normalized.estimatedTaxRateNumber,
  };
}

function displayMoneyOrEmpty(value: number): string {
  return value > 0 ? formatCurrency(value) : "";
}

function Field({
  label,
  children,
  hint,
  required,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      {children}
      {hint && (
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}

function TextNumberInput({
  value,
  onChange,
  placeholder,
  integer = false,
  money = false,
  disabled = false,
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  integer?: boolean;
  money?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  if (money) {
    return (
      <CurrencyInput
        value={value}
        onValueChange={(nextValue) => onChange(nextValue > 0 ? String(nextValue) : "")}
        placeholder={placeholder}
        disabled={disabled}
        noPrefix
        className={className}
      />
    );
  }

  return (
    <Input
      type="text"
      inputMode={integer ? "numeric" : "decimal"}
      value={value}
      onChange={(event) => {
        const raw = event.target.value;
        if (integer) onChange(raw.replace(/\D/g, ""));
        else onChange(raw.replace(/[^0-9,.-]/g, ""));
      }}
      placeholder={placeholder}
      disabled={disabled}
      className={`h-9 text-sm ${className}`}
    />
  );
}

function ReadOnlyMoney({
  value,
  placeholder = "Calculado",
}: {
  value: number;
  placeholder?: string;
}) {
  return (
    <Input
      value={displayMoneyOrEmpty(value)}
      readOnly
      disabled
      placeholder={placeholder}
      className="h-9 bg-muted/40 text-sm font-semibold"
    />
  );
}

function SummaryBox({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground leading-tight">
        {label}
      </p>
      <p className="mt-1 text-base font-bold text-foreground leading-tight break-words">{value}</p>
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function MiniMetric({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "strong" | "success" | "warning";
}) {
  const toneClass =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-300"
      : tone === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-300"
        : tone === "strong"
          ? "border-primary/30 bg-primary/5 text-foreground"
          : "border-border bg-muted/20 text-foreground";

  return (
    <div className={`rounded-md border px-2.5 py-1.5 ${toneClass}`}>
      <span className="block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="block truncate text-xs font-bold">{value || "—"}</span>
    </div>
  );
}

function getBatchNumber(batch: any, keys: string[], fallback = 0): number {
  for (const key of keys) {
    const value = batch?.[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const parsed = toNumber(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return fallback;
}

function getBatchCount(batch: any, keys: string[]): string {
  for (const key of keys) {
    const value = batch?.[key];
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    if (typeof value === "string" && value.trim()) return value;
  }

  if (Array.isArray(batch?.items)) {
    if (keys.some((key) => key.toLowerCase().includes("unit") || key.toLowerCase().includes("quantity"))) {
      const total = batch.items.reduce((sum: number, item: any) => sum + Number(item?.quantity ?? 0), 0);
      return total > 0 ? String(total) : "—";
    }
    return String(batch.items.length);
  }

  return "—";
}

function formatBatchDate(value: unknown): string {
  if (!value) return "—";
  const date = new Date(value as any);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function statusLabel(status: unknown): string {
  switch (String(status ?? "").toUpperCase()) {
    case "CLOSED":
      return "Fechada";
    case "OPEN":
      return "Aberta";
    case "PROCESSING":
      return "Processando";
    default:
      return status ? String(status) : "—";
  }
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function BatchPricing() {
  const [, setLocation] = useLocation();

  // Cabeçalho — strings para não forçar zero visual no input
  const [batchName, setBatchName] = useState("");
  const [batchDescription, setBatchDescription] = useState("");
  const [totalOperationalCost, setTotalOperationalCost] = useState("");
  const [totalTaxCost, setTotalTaxCost] = useState("");
  const [totalOtherCost, setTotalOtherCost] = useState("");

  const [fifoMode, setFifoMode] = useState(true);
  const [regularizationMode, setRegularizationMode] = useState(false);
  const [items, setItems] = useState<LocalItem[]>([emptyItem()]);
  const [collapsedItemIds, setCollapsedItemIds] = useState<Set<string>>(
    () => new Set(),
  );

  const [preview, setPreview] = useState<BatchPricingResult | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [showCommitDialog, setShowCommitDialog] = useState(false);
  const [savedBatchId, setSavedBatchId] = useState<number | null>(null);
  const [fifoResult, setFifoResult] = useState<{
    queuedCount: number;
    activatedCount: number;
  } | null>(null);
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);
  const [deleteBatchTarget, setDeleteBatchTarget] = useState<any | null>(null);

  const utils = trpc.useUtils();

  const productsQuery = trpc.products.list.useQuery(undefined, {
    staleTime: 60_000,
  });

  const regularizationCandidatesQuery = trpc.batches.regularizationCandidates.useQuery(undefined, {
    staleTime: 60_000,
  });

  const batchesQuery = trpc.batches.list.useQuery(undefined, {
    staleTime: 60_000,
  });

  const selectedBatchQuery = trpc.batches.byId.useQuery(
    { id: selectedBatchId! },
    { enabled: !!selectedBatchId }
  );

  const latestBatches = useMemo(() => {
    return ((batchesQuery.data ?? []) as any[]).slice(0, 5);
  }, [batchesQuery.data]);

  const createProduct = trpc.products.create.useMutation();

  const createBatch = trpc.batches.create.useMutation({
    onSuccess: (batch) => setSavedBatchId(batch.id),
  });

  const deleteBatchMutation = trpc.batches.delete.useMutation({
    onSuccess: () => {
      utils.batches.list.invalidate();
      utils.products.list.invalidate();
      setSelectedBatchId(null);
      setDeleteBatchTarget(null);
      toast.success("Entrada apagada com segurança.");
    },
    onError: (err) => toast.error(err.message),
  });

  const processBatch = trpc.batches.process.useMutation({
    onSuccess: () => {
      utils.batches.list.invalidate();
      utils.products.list.invalidate();
      toast.success("Entrada processada! Estoque atualizado.");
      setLocation("/entrada-produtos");
    },
    onError: (err) => toast.error(err.message),
  });

  const processFIFO = trpc.batches.processFIFO.useMutation({
    onSuccess: (data) => {
      utils.batches.list.invalidate();
      utils.products.list.invalidate();
      setFifoResult(data);
      toast.success(
        `Entrada FIFO processada! ${data.activatedCount} ativado(s), ${data.queuedCount} na fila de espera.`,
      );
    },
    onError: (err) => toast.error(err.message),
  });

  const processInitialRegularization = trpc.batches.processInitialRegularization.useMutation({
    onSuccess: (data) => {
      utils.batches.list.invalidate();
      utils.products.list.invalidate();
      regularizationCandidatesQuery.refetch();
      setFifoResult({ activatedCount: data.regularizedCount, queuedCount: 0 });
      setRegularizationMode(false);
      toast.success(`Regularização inicial concluída! ${data.regularizedCount} produto(s) vinculados ao primeiro lote.`);
    },
    onError: (err) => toast.error(err.message),
  });

  const totals = useMemo(() => {
    const normalized = items.map(normalizeItem);
    const totalQuantity = normalized.reduce(
      (sum, item) => sum + item.quantityNumber,
      0,
    );
    const goodsTotal = normalized.reduce(
      (sum, item) => sum + item.unitCostBrl * item.quantityNumber,
      0,
    );
    const additionalTotal =
      toMoney(totalOperationalCost) +
      toMoney(totalTaxCost) +
      toMoney(totalOtherCost);
    return {
      totalQuantity,
      goodsTotal,
      additionalTotal,
      grandTotal: goodsTotal + additionalTotal,
      productTypes: items.length,
    };
  }, [items, totalOperationalCost, totalTaxCost, totalOtherCost]);

  const previewByItemId = useMemo(() => {
    const map = new Map<string, BatchPricingResult["items"][number]>();
    if (!preview) return map;

    let previewIndex = 0;
    for (const item of items) {
      if (item.productName.trim() || item.productId) {
        const calculated = preview.items[previewIndex];
        if (calculated) map.set(item._id, calculated);
        previewIndex += 1;
      }
    }

    return map;
  }, [items, preview]);

  const calculatedGeneralTotals = useMemo(() => {
    if (!preview) {
      return {
        totalSuggestedRevenue: 0,
        totalProjectedProfit: 0,
        allocationStatus: "—",
      };
    }

    const totalSuggestedRevenue = preview.items.reduce(
      (sum, item) => sum + item.suggestedPrice * item.quantity,
      0,
    );
    const totalProjectedProfit = preview.items.reduce(
      (sum, item) => sum + item.contributionMargin * item.quantity,
      0,
    );
    const allocationOk =
      Math.abs(preview.allocationCheck - preview.totalOperationalCost) < 0.01 &&
      Math.abs(preview.taxAllocationCheck - preview.totalTaxCost) < 0.01 &&
      Math.abs(preview.otherAllocationCheck - preview.totalOtherCost) < 0.01;

    return {
      totalSuggestedRevenue,
      totalProjectedProfit,
      allocationStatus: allocationOk ? "OK" : "Verificar",
    };
  }, [preview]);

  const addItem = () => {
    const newItem = emptyItem();
    setRegularizationMode(false);
    setItems((prev) => [...prev, newItem]);
    setCollapsedItemIds(() => new Set(items.map((item) => item._id)));
  };

  const loadRegularizationCandidates = () => {
    const candidates = (regularizationCandidatesQuery.data ?? []) as any[];
    if (candidates.length === 0) {
      toast.info("Nenhum produto sem entrada/lote foi encontrado para regularização.");
      return;
    }

    const loadedItems = candidates.map((product) => {
      const baseCost = Number(
        product.finalUnitCostBrl ??
          product.final_unit_cost_brl ??
          product.averageCostBrl ??
          product.average_cost_brl ??
          product.costPriceBrl ??
          product.cost_price_brl ??
          product.costPrice ??
          product.cost_price ??
          0,
      );
      const quantity = Math.max(1, Math.trunc(Number(product.stockQuantity ?? product.stock_quantity ?? 0)));

      return {
        _id: crypto.randomUUID(),
        entryMode: "EXISTING" as EntryMode,
        productId: Number(product.id),
        productName: product.name ?? `Produto #${product.id}`,
        category: (product.category ?? "OUTRO") as ProductCategory,
        currency: "BRL" as AcquisitionCurrency,
        unitCostOriginal: baseCost > 0 ? String(baseCost) : "",
        exchangeRate: "",
        quantity: String(quantity),
        acquisitionPaymentMethod: "OUTRO" as AcquisitionPaymentMethod,
        desiredMarginRate: product.desiredMarginRate ? String(product.desiredMarginRate) : "30",
        estimatedTaxRate: product.estimatedTaxRate ? String(product.estimatedTaxRate) : "6",
      };
    });

    setRegularizationMode(true);
    setFifoMode(true);
    setSavedBatchId(null);
    setPreview(null);
    setPreviewError(null);
    setBatchName((current) => current.trim() || "Regularização inicial de produtos cadastrados");
    setBatchDescription((current) => current.trim() || "Entrada inicial criada para vincular produtos legados já cadastrados ao histórico de lotes.");
    setItems(loadedItems);
    setCollapsedItemIds(new Set(loadedItems.slice(1).map((item) => item._id)));
    toast.success(`${loadedItems.length} produto(s) carregados para regularização inicial.`);
  };

  const removeItem = (id: string) => {
    setItems((prev) =>
      prev.length === 1 ? prev : prev.filter((item) => item._id !== id),
    );
    setCollapsedItemIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const toggleCollapsed = (id: string) => {
    setCollapsedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const updateItem = useCallback(
    <K extends keyof LocalItem>(id: string, field: K, value: LocalItem[K]) => {
      setItems((prev) =>
        prev.map((item) =>
          item._id === id ? { ...item, [field]: value } : item,
        ),
      );
    },
    [],
  );

  const loadBatchForEdit = useCallback((batch: any) => {
    if (!batch) return;

    if (String(batch.status ?? "").toUpperCase() === "CLOSED") {
      toast.info("Entrada fechada carregada para edição. Se já teve venda/movimentação crítica, o backend bloqueará ao salvar.");
    }

    setSavedBatchId(Number(batch.id));
    setBatchName(batch.name ?? "");
    setBatchDescription(batch.description ?? "");
    setTotalOperationalCost(String(batch.totalOperationalCost ?? 0));
    setTotalTaxCost(String((batch as any).totalTaxCost ?? 0));
    setTotalOtherCost(String((batch as any).totalOtherCost ?? 0));
    setFifoMode((batch as any).fifoMode ?? true);
    setRegularizationMode(String(batch.description ?? "").includes("REGULARIZACAO_INICIAL"));

    const loadedItems = Array.isArray(batch.items) && batch.items.length > 0
      ? batch.items.map((entry: any) => ({
          _id: crypto.randomUUID(),
          entryMode: entry.productId ? "EXISTING" : "NEW",
          productId: entry.productId ?? undefined,
          productName: entry.productName ?? "",
          category: "OUTRO" as ProductCategory,
          currency: (entry.costCurrency === "USD" ? "USD" : "BRL") as AcquisitionCurrency,
          unitCostOriginal: String(entry.unitCostOriginal ?? entry.unitCostBrl ?? ""),
          exchangeRate: entry.exchangeRate ? String(entry.exchangeRate) : "",
          quantity: String(entry.quantity ?? ""),
          acquisitionPaymentMethod: (entry.acquisitionPaymentMethod ?? "OUTRO") as AcquisitionPaymentMethod,
          desiredMarginRate: entry.desiredMarginRate ? String(entry.desiredMarginRate) : "",
          estimatedTaxRate: "",
        }))
      : [emptyItem()];

    setItems(loadedItems);
    setCollapsedItemIds(new Set());
    setPreview(null);
    setPreviewError(null);
    setSelectedBatchId(null);
    toast.success(`Entrada #${batch.id} carregada para edição.`);
  }, []);

  const applyExistingProduct = useCallback(
    (itemId: string, rawProductId: string) => {
      const selectedId = rawProductId ? Number(rawProductId) : undefined;
      const selected = productsQuery.data?.find(
        (product: any) => product.id === selectedId,
      ) as any;

      setItems((prev) =>
        prev.map((item) => {
          if (item._id !== itemId) return item;
          if (!selected)
            return { ...item, productId: undefined, entryMode: "EXISTING" };

          const fallbackCost = Number(
            selected.finalUnitCostBrl ??
              selected.averageCostBrl ??
              selected.costPrice ??
              0,
          );

          return {
            ...item,
            entryMode: "EXISTING",
            productId: selected.id,
            productName: selected.name ?? item.productName,
            category: (selected.category as ProductCategory) ?? item.category,
            currency: "BRL",
            unitCostOriginal:
              item.unitCostOriginal.trim() ||
              (fallbackCost > 0 ? String(fallbackCost) : ""),
          };
        }),
      );
    },
    [productsQuery.data],
  );

  function validateEntry(): BatchItemInput[] | null {
    setPreviewError(null);
    const validLocalItems = items
      .filter((item) => item.productName.trim() || item.productId)
      .map(normalizeItem);

    if (!batchName.trim()) {
      const message = "Informe o nome da entrada.";
      setPreviewError(message);
      toast.error(message);
      return null;
    }

    if (validLocalItems.length === 0) {
      const message = "Adicione pelo menos 1 produto na entrada.";
      setPreviewError(message);
      toast.error(message);
      return null;
    }

    const negativeAdditional = [
      ["custo operacional", totalOperationalCost],
      ["impostos/taxas", totalTaxCost],
      ["outros custos", totalOtherCost],
    ].find(([, value]) => toMoney(String(value)) < 0);

    if (negativeAdditional) {
      const message = `O campo ${negativeAdditional[0]} não pode ser negativo.`;
      setPreviewError(message);
      toast.error(message);
      return null;
    }

    for (const [index, item] of validLocalItems.entries()) {
      const position = index + 1;
      if (!item.productName.trim()) {
        const message = `Produto ${position}: informe o nome do produto.`;
        setPreviewError(message);
        toast.error(message);
        return null;
      }

      if (item.entryMode === "EXISTING" && !item.productId) {
        const message = `Produto ${position}: selecione um produto existente ou altere o tipo para Novo.`;
        setPreviewError(message);
        toast.error(message);
        return null;
      }

      if (item.quantityNumber <= 0) {
        const message = `Produto ${position}: informe uma quantidade maior que zero.`;
        setPreviewError(message);
        toast.error(message);
        return null;
      }

      if (item.unitCostBrl <= 0) {
        const message = `Produto ${position}: informe um custo unitário maior que zero.`;
        setPreviewError(message);
        toast.error(message);
        return null;
      }

      if (item.currency === "USD" && item.exchangeRateNumber <= 0) {
        const message = `Produto ${position}: informe a cotação do dólar.`;
        setPreviewError(message);
        toast.error(message);
        return null;
      }
    }

    const batchItems = validLocalItems.map((item) => toBatchItem(item));
    const goodsTotal = batchItems.reduce(
      (sum, item) => sum + item.unitCostBrl * item.quantity,
      0,
    );
    if (goodsTotal <= 0) {
      const message =
        "O custo total das mercadorias precisa ser maior que zero.";
      setPreviewError(message);
      toast.error(message);
      return null;
    }

    return batchItems;
  }

  const calculatePreview = useCallback(
    (showToast = false): BatchPricingResult | null => {
      const validItems = validateEntry();
      if (!validItems) return null;

      const result = calculateBatchPricing({
        items: validItems,
        totalOperationalCost: toMoney(totalOperationalCost),
        totalTaxCost: toMoney(totalTaxCost),
        totalOtherCost: toMoney(totalOtherCost),
      });

      if (isBatchPricingError(result)) {
        setPreview(null);
        setPreviewError(result.message);
        toast.error(result.message);
        return null;
      }

      setPreview(result);
      setPreviewError(null);
      if (showToast) toast.success("Custos calculados.");
      return result;
    },
    [items, totalOperationalCost, totalTaxCost, totalOtherCost, batchName],
  );

  const handlePreview = () => calculatePreview(true);

  const exportSpreadsheet = async () => {
    const currentPreview = preview ?? calculatePreview(false);
    if (!currentPreview) return;

    try {
      const XLSX = await import("xlsx");
      const now = new Date();
      const normalizedItems = items.map(normalizeItem);

      const summaryRows = [
        ["Nome da entrada", batchName.trim()],
        ["Data de exportação", now.toLocaleString("pt-BR")],
        ["Custo operacional total", currentPreview.totalOperationalCost],
        ["Impostos/taxas total", currentPreview.totalTaxCost],
        ["Outros custos total", currentPreview.totalOtherCost],
        ["Custo total das mercadorias", currentPreview.totalCostOfGoods],
        ["Custo total da entrada", currentPreview.grandTotal],
        [
          "Quantidade total de unidades",
          currentPreview.items.reduce((sum, item) => sum + item.quantity, 0),
        ],
        ["Quantidade de tipos de produto", currentPreview.items.length],
        ["Modo FIFO ativo", fifoMode ? "Sim" : "Não"],
        ["Status", "Preview exportado"],
        ["Descrição", batchDescription.trim()],
      ];

      const productsRows = currentPreview.items.map((item) => ({
        "ID do produto": item.productId ?? "Novo",
        Produto: item.productName,
        Categoria:
          normalizedItems.find(
            (localItem) => localItem.productName === item.productName,
          )?.category ?? "",
        Quantidade: item.quantity,
        Moeda: item.costCurrency ?? "BRL",
        "Custo original": item.unitCostOriginal ?? item.unitCostBrl,
        Cotação: item.exchangeRate ?? 0,
        "Custo unitário BRL": item.unitCostBrl,
        "Custo base total": item.totalItemCost,
        "Forma de pagamento da compra":
          item.acquisitionPaymentMethod ?? "OUTRO",
      }));

      const allocationRows = currentPreview.items.map((item) => ({
        "ID do produto": item.productId ?? "Novo",
        Produto: item.productName,
        Quantidade: item.quantity,
        "Proporção na entrada": item.costProportion,
        "Custo operacional rateado": item.allocatedOperationalCost,
        "Imposto rateado": item.allocatedTaxCost,
        "Outros custos rateados": item.allocatedOtherCost,
        "Custo operacional por unidade": item.operationalCostPerUnit,
        "Imposto por unidade": item.taxCostPerUnit,
        "Outros custos por unidade": item.otherCostPerUnit,
        "Custo real unitário": item.finalUnitCost,
        "Custo real total": item.realTotalCost,
      }));

      const projectionRows = currentPreview.items.map((item) => ({
        "ID do produto": item.productId ?? "Novo",
        Produto: item.productName,
        "Custo real unitário": item.finalUnitCost,
        "Margem tipo": "Percentual",
        "Margem valor": item.desiredMarginRate,
        "Preço sugerido": item.suggestedPrice,
        "Lucro unitário": item.contributionMargin,
        "Lucro total estimado": item.contributionMargin * item.quantity,
      }));

      const workbook = XLSX.utils.book_new();
      const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
      const productsSheet = XLSX.utils.json_to_sheet(productsRows);
      const allocationSheet = XLSX.utils.json_to_sheet(allocationRows);
      const projectionSheet = XLSX.utils.json_to_sheet(projectionRows);

      const setWidths = (sheet: any, widths: number[]) => {
        sheet["!cols"] = widths.map((wch) => ({ wch }));
      };

      setWidths(summarySheet, [32, 42]);
      setWidths(productsSheet, [14, 36, 18, 12, 10, 16, 10, 18, 18, 26]);
      setWidths(
        allocationSheet,
        [14, 36, 12, 18, 24, 18, 22, 26, 20, 24, 20, 18],
      );
      setWidths(projectionSheet, [14, 36, 20, 16, 14, 18, 16, 20]);

      XLSX.utils.book_append_sheet(workbook, summarySheet, "Resumo da Entrada");
      XLSX.utils.book_append_sheet(
        workbook,
        productsSheet,
        "Produtos da Entrada",
      );
      XLSX.utils.book_append_sheet(
        workbook,
        allocationSheet,
        "Rateio e Custos",
      );
      XLSX.utils.book_append_sheet(workbook, projectionSheet, "Margem e Lucro");

      XLSX.writeFile(
        workbook,
        `${cleanFileName(batchName)}-${Date.now()}.xlsx`,
      );
      toast.success("Planilha exportada com sucesso.");
    } catch (error: any) {
      toast.error(error?.message ?? "Não foi possível exportar a planilha.");
    }
  };

  const handleSaveAndProcess = async (commitToStock: boolean) => {
    const validItemsForPreview = validateEntry();
    if (!validItemsForPreview) return;

    const result = calculatePreview(false);
    if (!result) return;

    try {
      const validLocalItems = items
        .filter((item) => item.productName.trim() || item.productId)
        .map(normalizeItem);

      const preparedItems: LocalItem[] = [];

      for (const item of validLocalItems) {
        if (item.productId) {
          preparedItems.push(item);
          continue;
        }

        if (item.entryMode !== "NEW") {
          throw new Error(
            `Selecione um produto existente ou marque como produto novo: ${item.productName}.`,
          );
        }

        const newProduct = await createProduct.mutateAsync({
          name: item.productName.trim(),
          category: item.category,
          costPrice: item.unitCostBrl,
          packagingCost: 0,
          inboundShippingCost: 0,
          operationalCost: 0,
          desiredMarginRate: item.desiredMarginRateNumber,
          desiredMarginValue: 0,
          marginMode: "PERCENT",
          taxRegime: "SIMPLES_NACIONAL",
          estimatedTaxRate: item.estimatedTaxRateNumber,
          active: true,
          published: false,
          costCurrency: item.currency,
          costPriceUsd:
            item.currency === "USD" ? item.unitCostOriginalNumber : 0,
          usdExchangeRate:
            item.currency === "USD" ? item.exchangeRateNumber : 0,
          stockQuantity: 0,
          minimumStock: 0,
          shortDescription: "",
          description: "",
          categoryLabel: "",
          notes: `Produto criado pela Entrada de Produtos. Pagamento da aquisição: ${item.acquisitionPaymentMethod}.`,
        });

        preparedItems.push({ ...item, productId: newProduct.id });
      }

      setItems((prev) =>
        prev.map((current) => {
          const prepared = preparedItems.find(
            (item) => item._id === current._id,
          );
          return prepared
            ? {
                ...current,
                productId: prepared.productId,
                productName: prepared.productName,
              }
            : current;
        }),
      );

      const validItems = preparedItems.map(toBatchItem);

      let batchId = savedBatchId;
      if (!batchId) {
        const batch = await createBatch.mutateAsync({
          name: batchName.trim(),
          description: batchDescription.trim() || undefined,
          totalOperationalCost: toMoney(totalOperationalCost),
          totalTaxCost: toMoney(totalTaxCost),
          totalOtherCost: toMoney(totalOtherCost),
        });
        batchId = batch.id;
      }

      if (fifoMode) {
        if (regularizationMode) {
          await processInitialRegularization.mutateAsync({
            batchId,
            items: validItems,
            totalOperationalCost: toMoney(totalOperationalCost),
            totalTaxCost: toMoney(totalTaxCost),
            totalOtherCost: toMoney(totalOtherCost),
          });
        } else {
          await processFIFO.mutateAsync({
            batchId,
            items: validItems,
            totalOperationalCost: toMoney(totalOperationalCost),
            totalTaxCost: toMoney(totalTaxCost),
            totalOtherCost: toMoney(totalOtherCost),
          });
        }
      } else {
        await processBatch.mutateAsync({
          batchId,
          items: validItems,
          totalOperationalCost: toMoney(totalOperationalCost),
          totalTaxCost: toMoney(totalTaxCost),
          totalOtherCost: toMoney(totalOtherCost),
          commitToStock,
        });
      }
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao processar entrada.");
    }
  };

  const isLoading =
    createProduct.isPending ||
    createBatch.isPending ||
    processBatch.isPending ||
    processFIFO.isPending ||
    processInitialRegularization.isPending;

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8 space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/entrada-produtos")}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Nova Entrada de Produtos</h1>
            <p className="text-sm text-muted-foreground max-w-2xl">
              Registre produto novo ou existente, calcule custo real com rateio
              proporcional, alimente estoque e fila e exporte a planilha da
              entrada.
            </p>
          </div>
        </div>
      </div>

      {fifoResult && (
        <Card className="border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20">
          <CardContent className="pt-5">
            <div className="flex flex-wrap gap-6 items-center">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                <span className="font-semibold text-emerald-800 dark:text-emerald-300">
                  Entrada FIFO processada com sucesso
                </span>
              </div>
              <div className="flex gap-4 text-sm">
                <span className="flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5 text-emerald-600" />
                  <strong>{fifoResult.activatedCount}</strong> produto(s)
                  ativados
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-amber-600" />
                  <strong>{fifoResult.queuedCount}</strong> na fila de espera
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dados da Entrada */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados da Entrada</CardTitle>
          <CardDescription>
            Informe os custos totais da compra. Eles serão distribuídos
            proporcionalmente pelo valor financeiro de cada produto.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Field label="Nome da entrada" required>
              <Input
                value={batchName}
                onChange={(event) => setBatchName(event.target.value)}
                placeholder="Ex: Importação Maio/26"
                className="h-10"
              />
            </Field>
            <Field
              label="Custo operacional total"
              hint="Frete, despachante, armazenamento."
            >
              <CurrencyInput
                value={toMoney(totalOperationalCost)}
                onValueChange={(v) => setTotalOperationalCost(String(v))}
                placeholder="4.500,00"
              />
            </Field>
            <Field label="Impostos / taxas da entrada">
              <CurrencyInput
                value={toMoney(totalTaxCost)}
                onValueChange={(v) => setTotalTaxCost(String(v))}
                placeholder="1.200,00"
              />
            </Field>
            <Field label="Outros custos da entrada">
              <CurrencyInput
                value={toMoney(totalOtherCost)}
                onValueChange={(v) => setTotalOtherCost(String(v))}
                placeholder="300,00"
              />
            </Field>
          </div>

          <Field label="Descrição">
            <Textarea
              value={batchDescription}
              onChange={(event) => setBatchDescription(event.target.value)}
              placeholder="Observações, fornecedor, número de nota, origem da compra..."
              rows={2}
            />
          </Field>
        </CardContent>
      </Card>

      {/* FIFO */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4" />
            Fila de estoque
          </CardTitle>
          <CardDescription>
            Mantém histórico de entrada e coloca estoque novo em fila quando já
            houver saldo ativo do mesmo produto.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className={`rounded-xl border p-4 ${fifoMode ? "border-primary/40 bg-primary/5" : "border-border"}`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Label
                    className="text-sm font-semibold"
                    htmlFor="fifo-toggle"
                  >
                    Usar fila automática
                  </Label>
                  <Badge
                    variant="secondary"
                    className="text-[10px] uppercase tracking-wide"
                  >
                    Recomendado
                  </Badge>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground max-w-3xl">
                  Produto sem estoque entra como ativo. Produto com estoque
                  entra em espera e será promovido quando o estoque atual zerar.
                </p>
              </div>
              <Switch
                id="fifo-toggle"
                checked={fifoMode}
                onCheckedChange={setFifoMode}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Produtos */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle className="text-base">Produtos da Entrada</CardTitle>
              <CardDescription>
                Preencha cada item em linhas compactas. Use recolher para
                trabalhar com vários produtos sem perder espaço.
              </CardDescription>
              {regularizationMode && (
                <p className="mt-2 text-xs font-semibold text-primary">
                  Modo regularização inicial ativo: os produtos existentes serão vinculados ao primeiro lote sem recriar cadastro.
                </p>
              )}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={loadRegularizationCandidates}
              disabled={regularizationCandidatesQuery.isLoading}
              className="shrink-0"
            >
              <PackagePlus className="mr-2 h-4 w-4" />
              Carregar produtos sem entrada
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {items.map((item, index) => {
            const normalized = normalizeItem(item);
            const baseTotal =
              normalized.unitCostBrl * normalized.quantityNumber;
            const selectedProduct = productsQuery.data?.find(
              (product: any) => product.id === item.productId,
            ) as any;
            const previewItem = previewByItemId.get(item._id);
            const realUnitCost =
              previewItem?.finalUnitCost ?? normalized.unitCostBrl;
            const realTotalCost = previewItem
              ? ((previewItem as any).realTotalCost ??
                previewItem.finalUnitCost * previewItem.quantity)
              : baseTotal;
            const isCollapsed = collapsedItemIds.has(item._id);
            const isComplete =
              Boolean(item.productName.trim() || item.productId) &&
              normalized.quantityNumber > 0 &&
              normalized.unitCostBrl > 0 &&
              (item.currency !== "USD" || normalized.exchangeRateNumber > 0);

            return (
              <div
                key={item._id}
                className="rounded-xl border border-border bg-card shadow-sm"
              >
                <div className="flex flex-col gap-2 border-b border-border px-3 py-2 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">Item {index + 1}</Badge>
                      {item.productId && (
                        <Badge variant="secondary">#{item.productId}</Badge>
                      )}
                      <span className="truncate text-sm font-semibold text-foreground">
                        {item.productName.trim() ||
                          selectedProduct?.name ||
                          "Produto sem nome"}
                      </span>
                      <Badge
                        variant={isComplete ? "default" : "secondary"}
                        className="text-[10px]"
                      >
                        {isComplete ? "Completo" : "Incompleto"}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                      <span>
                        Qtd:{" "}
                        <strong className="text-foreground">
                          {normalized.quantityNumber || "—"}
                        </strong>
                      </span>
                      <span>
                        Custo unit.:{" "}
                        <strong className="text-foreground">
                          {displayMoneyOrEmpty(realUnitCost) || "—"}
                        </strong>
                      </span>
                      <span>
                        Total:{" "}
                        <strong className="text-foreground">
                          {displayMoneyOrEmpty(realTotalCost) || "—"}
                        </strong>
                      </span>
                      <span>
                        Moeda:{" "}
                        <strong className="text-foreground">
                          {item.currency}
                        </strong>
                      </span>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleCollapsed(item._id)}
                      className="h-8 px-2 text-xs"
                    >
                      {isCollapsed ? (
                        <ChevronDown className="mr-1 h-3.5 w-3.5" />
                      ) : (
                        <ChevronUp className="mr-1 h-3.5 w-3.5" />
                      )}
                      {isCollapsed ? "Expandir" : "Recolher"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-xs text-destructive hover:text-destructive"
                      onClick={() => removeItem(item._id)}
                      disabled={items.length === 1}
                    >
                      <Trash2 className="mr-1 h-3.5 w-3.5" />
                      Remover
                    </Button>
                  </div>
                </div>

                {!isCollapsed && (
                  <div className="space-y-3 p-3">
                    {/* Linha 1 — identificação */}
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-[160px_240px_minmax(240px,1fr)_160px]">
                      <Field label="Tipo" required>
                        <select
                          value={item.entryMode}
                          onChange={(event) => {
                            const mode = event.target.value as EntryMode;
                            updateItem(item._id, "entryMode", mode);
                            if (mode === "NEW")
                              updateItem(item._id, "productId", undefined);
                          }}
                          className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                        >
                          <option value="EXISTING">Existente</option>
                          <option value="NEW">Novo</option>
                        </select>
                      </Field>

                      <Field label="Produto existente">
                        <select
                          value={item.productId ?? ""}
                          onChange={(event) =>
                            applyExistingProduct(item._id, event.target.value)
                          }
                          disabled={
                            item.entryMode === "NEW" || productsQuery.isLoading
                          }
                          className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm disabled:opacity-50"
                        >
                          <option value="">
                            {productsQuery.isLoading
                              ? "Carregando..."
                              : "Selecionar produto"}
                          </option>
                          {productsQuery.data?.map((product: any) => (
                            <option key={product.id} value={product.id}>
                              #{product.id} — {product.name}
                            </option>
                          ))}
                        </select>
                      </Field>

                      <Field label="Nome do produto" required>
                        <Input
                          value={item.productName}
                          onChange={(event) =>
                            updateItem(
                              item._id,
                              "productName",
                              event.target.value,
                            )
                          }
                          placeholder={
                            item.entryMode === "NEW"
                              ? "Ex: ONE MILLION ELIXIR 100ML"
                              : "Produto selecionado"
                          }
                          className="h-9 text-sm"
                        />
                      </Field>

                      <Field label="Categoria" required>
                        <select
                          value={item.category}
                          onChange={(event) =>
                            updateItem(
                              item._id,
                              "category",
                              event.target.value as ProductCategory,
                            )
                          }
                          className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                        >
                          {CATEGORY_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </Field>
                    </div>

                    {/* Linha 2 — custo, moeda e quantidade */}
                    <div className="grid grid-cols-2 gap-2 md:grid-cols-[110px_130px_105px_135px_100px_135px_95px_105px]">
                      <Field label="Moeda" required>
                        <select
                          value={item.currency}
                          onChange={(event) =>
                            updateItem(
                              item._id,
                              "currency",
                              event.target.value as AcquisitionCurrency,
                            )
                          }
                          className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                        >
                          <option value="BRL">BRL</option>
                          <option value="USD">USD</option>
                        </select>
                      </Field>

                      <Field label="Custo orig." required>
                        <CurrencyInput
                          value={toMoney(item.unitCostOriginal)}
                          onValueChange={(v) =>
                            updateItem(item._id, "unitCostOriginal", String(v))
                          }
                          placeholder={item.currency === "USD" ? "20,00" : "110,00"}
                          noPrefix={item.currency === "USD"}
                        />
                      </Field>

                      <Field label="Cotação">
                        <TextNumberInput
                          value={
                            item.currency === "USD" ? item.exchangeRate : ""
                          }
                          onChange={(value) =>
                            updateItem(item._id, "exchangeRate", value)
                          }
                          placeholder="Ex: 5,50"
                          disabled={item.currency !== "USD"}
                        />
                      </Field>

                      <Field label="Custo BRL">
                        <ReadOnlyMoney value={normalized.unitCostBrl} />
                      </Field>

                      <Field label="Qtd" required>
                        <TextNumberInput
                          value={item.quantity}
                          onChange={(value) =>
                            updateItem(item._id, "quantity", value)
                          }
                          placeholder="Ex: 80"
                          integer
                          className="font-semibold"
                        />
                      </Field>

                      <Field label="Pagto compra">
                        <select
                          value={item.acquisitionPaymentMethod}
                          onChange={(event) =>
                            updateItem(
                              item._id,
                              "acquisitionPaymentMethod",
                              event.target.value as AcquisitionPaymentMethod,
                            )
                          }
                          className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                        >
                          {PAYMENT_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </Field>

                      <Field label="Margem %">
                        <TextNumberInput
                          value={item.desiredMarginRate}
                          onChange={(value) =>
                            updateItem(item._id, "desiredMarginRate", value)
                          }
                          placeholder="Ex: 30"
                        />
                      </Field>

                      <Field label="Imposto %">
                        <TextNumberInput
                          value={item.estimatedTaxRate}
                          onChange={(value) =>
                            updateItem(item._id, "estimatedTaxRate", value)
                          }
                          placeholder="Ex: 6"
                        />
                      </Field>
                    </div>

                    {/* Resumo compacto do item */}
                    <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-8">
                      <MiniMetric
                        label="Base"
                        value={formatCurrency(baseTotal)}
                      />
                      <MiniMetric
                        label="Unit. BRL"
                        value={
                          displayMoneyOrEmpty(normalized.unitCostBrl) || "—"
                        }
                      />
                      <MiniMetric
                        label="Qtd"
                        value={
                          normalized.quantityNumber > 0
                            ? String(normalized.quantityNumber)
                            : "—"
                        }
                      />
                      <MiniMetric
                        label="Pagto"
                        value={
                          PAYMENT_OPTIONS.find(
                            (option) =>
                              option.value === item.acquisitionPaymentMethod,
                          )?.label ?? "—"
                        }
                      />
                      <MiniMetric
                        label="Produto"
                        value={
                          selectedProduct
                            ? `#${selectedProduct.id}`
                            : item.entryMode === "NEW"
                              ? "Novo"
                              : "—"
                        }
                      />
                      <MiniMetric label="Moeda" value={item.currency} />
                      <MiniMetric
                        label="Custo real"
                        value={displayMoneyOrEmpty(realUnitCost) || "—"}
                        tone="strong"
                      />
                      <MiniMetric
                        label="Total real"
                        value={displayMoneyOrEmpty(realTotalCost) || "—"}
                        tone="success"
                      />
                    </div>

                    {previewItem && (
                      <div className="rounded-lg border border-primary/20 bg-primary/5 p-2.5">
                        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs font-semibold text-primary">
                            Custos calculados
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            Resultado do cálculo deste produto
                          </p>
                        </div>
                        {/* Linha 1: Custos rateados */}
                        <div className="mb-1.5">
                          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-1">Custos rateados deste produto</p>
                          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                            <MiniMetric
                              label="Proporção"
                              value={formatPercent(previewItem.costProportion * 100)}
                            />
                            <MiniMetric
                              label="Op. total (produto)"
                              value={formatCurrency(previewItem.allocatedOperationalCost)}
                              tone="warning"
                            />
                            <MiniMetric
                              label="Op. por unidade"
                              value={`${formatCurrency(previewItem.operationalCostPerUnit)}/un`}
                              tone="warning"
                            />
                            <MiniMetric
                              label="Imposto + Outros"
                              value={formatCurrency((previewItem.allocatedTaxCost ?? 0) + (previewItem.allocatedOtherCost ?? 0))}
                            />
                          </div>
                        </div>
                        {/* Linha 2: Resultados finais */}
                        <div>
                          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-1">Resultado final</p>
                          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                            <MiniMetric
                              label="Custo unit. real"
                              value={formatCurrency(previewItem.finalUnitCost)}
                              tone="strong"
                            />
                            <MiniMetric
                              label="Custo total real"
                              value={formatCurrency(previewItem.realTotalCost)}
                              tone="success"
                            />
                            <MiniMetric
                              label="Preço sugerido"
                              value={formatCurrency(previewItem.suggestedPrice)}
                            />
                            <MiniMetric
                              label="Lucro proj."
                              value={formatCurrency(previewItem.contributionMargin * previewItem.quantity)}
                              tone={previewItem.contributionMargin >= 0 ? "success" : "warning"}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          <div className="flex justify-start pt-1">
            <Button
              size="sm"
              variant="outline"
              onClick={addItem}
              className="h-9"
            >
              <PlusCircle className="mr-2 h-4 w-4" />
              Adicionar item
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Cálculos gerais — sem duplicar produtos */}
      <Card className={preview ? "border-primary/30" : undefined}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <WalletCards className="h-4 w-4" />
            Cálculos atualizados de custo e projeção
          </CardTitle>
          <CardDescription>
            Totais gerais da entrada. Os detalhes de cada produto ficam dentro do próprio card.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-8">
            <MiniMetric label="Tipos" value={String(totals.productTypes)} />
            <MiniMetric
              label="Unidades"
              value={String(totals.totalQuantity || "—")}
            />
            <MiniMetric
              label="Mercadorias"
              value={formatCurrency(preview?.totalCostOfGoods ?? totals.goodsTotal)}
            />
            <MiniMetric
              label="Custos adicionais"
              value={formatCurrency(
                preview
                  ? preview.totalOperationalCost + preview.totalTaxCost + preview.totalOtherCost
                  : totals.additionalTotal,
              )}
            />
            <MiniMetric
              label="Total entrada"
              value={formatCurrency(preview?.grandTotal ?? totals.grandTotal)}
              tone="strong"
            />
            <MiniMetric
              label="Receita proj."
              value={
                preview
                  ? formatCurrency(calculatedGeneralTotals.totalSuggestedRevenue)
                  : "—"
              }
            />
            <MiniMetric
              label="Lucro proj."
              value={
                preview
                  ? formatCurrency(calculatedGeneralTotals.totalProjectedProfit)
                  : "—"
              }
              tone={
                preview && calculatedGeneralTotals.totalProjectedProfit >= 0
                  ? "success"
                  : "default"
              }
            />
            <MiniMetric
              label="Conferência"
              value={calculatedGeneralTotals.allocationStatus}
              tone={calculatedGeneralTotals.allocationStatus === "OK" ? "success" : "default"}
            />
          </div>
        </CardContent>
      </Card>

      {previewError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {previewError}
        </div>
      )}

      <Separator />

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={exportSpreadsheet}>
          <Download className="mr-2 h-4 w-4" />
          Exportar planilha
        </Button>
        <Button variant="outline" onClick={() => calculatePreview(true)}>
          <Calculator className="mr-2 h-4 w-4" />
          Calcular custos
        </Button>
        {fifoMode ? (
          <Button
            onClick={() => setShowCommitDialog(true)}
            disabled={isLoading}
          >
            <Clock className="mr-2 h-4 w-4" />
            Enviar entrada para fila
          </Button>
        ) : (
          <>
            <Button
              variant="outline"
              onClick={() => handleSaveAndProcess(false)}
              disabled={isLoading}
            >
              Salvar entrada sem estoque
            </Button>
            <Button
              onClick={() => setShowCommitDialog(true)}
              disabled={isLoading}
            >
              <PackageCheck className="mr-2 h-4 w-4" />
              Processar entrada no estoque
            </Button>
          </>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4" />
            Últimas entradas de produtos
          </CardTitle>
          <CardDescription>
            Histórico dos últimos 5 lotes/entradas. Cada linha representa uma entrada inteira, não produtos separados.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {batchesQuery.isLoading ? (
            <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
              Carregando histórico de entradas...
            </div>
          ) : latestBatches.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
              Nenhuma entrada registrada ainda.
            </div>
          ) : (
            latestBatches.map((batch: any) => {
              const goodsTotal = getBatchNumber(batch, ["totalCostOfGoods", "total_cost_of_goods", "goodsTotal"]);
              const operationalTotal = getBatchNumber(batch, ["totalOperationalCost", "total_operational_cost", "operationalTotal"]);
              const taxTotal = getBatchNumber(batch, ["totalTaxCost", "total_tax_cost"]);
              const otherTotal = getBatchNumber(batch, ["totalOtherCost", "total_other_cost"]);
              const totalCost = getBatchNumber(
                batch,
                ["grandTotal", "grand_total", "totalCost", "total_cost"],
                goodsTotal + operationalTotal + taxTotal + otherTotal,
              );
              const productsCount = getBatchCount(batch, ["productCount", "productsCount", "productTypes", "itemsCount", "itemCount"]);
              const unitsCount = getBatchCount(batch, ["totalQuantity", "totalUnits", "unitsCount", "quantityTotal"]);

              return (
                <div
                  key={batch.id ?? `${batch.name}-${batch.createdAt}`}
                  className="rounded-lg border border-border bg-card px-3 py-2.5 text-xs"
                >
                  <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                    <button
                      type="button"
                      onClick={() => setSelectedBatchId(Number(batch.id))}
                      className="min-w-0 flex-1 text-left hover:underline"
                    >
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <span className="font-mono text-muted-foreground">#{batch.id ?? "—"}</span>
                        <p className="max-w-full truncate font-semibold text-foreground lg:max-w-[360px]">
                          {batch.name ?? "Entrada sem nome"}
                        </p>
                        <Badge
                          variant={String(batch.status ?? "").toUpperCase() === "CLOSED" ? "default" : "secondary"}
                          className="h-6 shrink-0"
                        >
                          {statusLabel(batch.status)}
                        </Badge>
                      </div>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        {formatBatchDate(batch.createdAt ?? batch.created_at)}
                      </p>
                    </button>

                    <div className="grid w-full grid-cols-3 gap-1.5 sm:grid-cols-3 lg:w-auto lg:min-w-[230px]">
                      <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={() => setSelectedBatchId(Number(batch.id))}>
                        <Eye className="mr-1 h-3.5 w-3.5" /> Ver
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-[11px]"
                        onClick={() => {
                          setSelectedBatchId(Number(batch.id));
                          toast.info("Abrindo detalhes. Use Editar entrada dentro do lote.");
                        }}
                      >
                        <Pencil className="mr-1 h-3.5 w-3.5" /> Editar
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px] text-destructive hover:text-destructive" onClick={() => setDeleteBatchTarget(batch)}>
                        <Trash2 className="mr-1 h-3.5 w-3.5" /> Apagar
                      </Button>
                    </div>
                  </div>

                  <div className="mt-2 grid grid-cols-3 gap-1.5 sm:grid-cols-6">
                    <div className="rounded-md bg-muted/25 px-2 py-1.5">
                      <span className="block text-[9px] uppercase tracking-wide text-muted-foreground">Produtos</span>
                      <strong className="text-xs">{productsCount}</strong>
                    </div>
                    <div className="rounded-md bg-muted/25 px-2 py-1.5">
                      <span className="block text-[9px] uppercase tracking-wide text-muted-foreground">Itens</span>
                      <strong className="text-xs">{unitsCount}</strong>
                    </div>
                    <div className="rounded-md bg-muted/25 px-2 py-1.5">
                      <span className="block text-[9px] uppercase tracking-wide text-muted-foreground">Mercadorias</span>
                      <strong className="text-xs">{formatCurrency(goodsTotal)}</strong>
                    </div>
                    <div className="rounded-md bg-muted/25 px-2 py-1.5">
                      <span className="block text-[9px] uppercase tracking-wide text-muted-foreground">Operacional</span>
                      <strong className="text-xs">{formatCurrency(operationalTotal)}</strong>
                    </div>
                    <div className="rounded-md bg-muted/25 px-2 py-1.5">
                      <span className="block text-[9px] uppercase tracking-wide text-muted-foreground">Imp./Outros</span>
                      <strong className="text-xs">{formatCurrency(taxTotal + otherTotal)}</strong>
                    </div>
                    <div className="rounded-md bg-primary/5 border border-primary/20 px-2 py-1.5">
                      <span className="block text-[9px] uppercase tracking-wide text-primary/70">Total lote</span>
                      <strong className="text-xs text-primary">{formatCurrency(totalCost)}</strong>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!selectedBatchId} onOpenChange={(open) => !open && setSelectedBatchId(null)}>
        <AlertDialogContent className="w-[calc(100vw-1.5rem)] max-w-5xl max-h-[90vh] overflow-hidden p-0">
          <div className="relative flex max-h-[90vh] flex-col bg-background">
            <button
              type="button"
              onClick={() => setSelectedBatchId(null)}
              className="absolute right-4 top-4 z-20 inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Fechar detalhes da entrada"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
              <AlertDialogHeader className="pr-12 text-left">
                <AlertDialogTitle>
                  {selectedBatchQuery.data ? `Entrada #${selectedBatchQuery.data.id} — ${selectedBatchQuery.data.name}` : "Detalhes da entrada"}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Visualização completa do lote com custos gerais e produtos, sem barra lateral para arrastar.
                </AlertDialogDescription>
              </AlertDialogHeader>

              <div className="mt-4">
                {selectedBatchQuery.isLoading ? (
                  <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
                    Carregando detalhes da entrada...
                  </div>
                ) : selectedBatchQuery.data ? (
                  <BatchDetailsContent batch={selectedBatchQuery.data as any} />
                ) : (
                  <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
                    Entrada não encontrada.
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-border px-4 py-3 sm:px-6">
              <AlertDialogFooter className="gap-2 sm:justify-between">
                <div className="flex flex-wrap gap-2">
                  {selectedBatchQuery.data && (
                    <>
                      <Button
                        variant="outline"
                        onClick={() => loadBatchForEdit(selectedBatchQuery.data as any)}
                      >
                        <Pencil className="mr-2 h-4 w-4" /> Editar entrada
                      </Button>
                      <Button
                        variant="outline"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleteBatchTarget(selectedBatchQuery.data as any)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> Apagar entrada
                      </Button>
                    </>
                  )}
                </div>
                <AlertDialogCancel>Fechar</AlertDialogCancel>
              </AlertDialogFooter>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteBatchTarget} onOpenChange={(open) => !open && setDeleteBatchTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar entrada?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  Tem certeza que deseja apagar a entrada <strong>#{deleteBatchTarget?.id} — {deleteBatchTarget?.name}</strong>?
                </p>
                <p>Os produtos base não serão apagados. A exclusão remove o lote/entrada e seus itens.</p>
                <p className="text-amber-700 dark:text-amber-400">
                  Se a entrada já teve venda ou movimentação crítica, o backend deve bloquear a exclusão por segurança.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteBatchTarget?.id && deleteBatchMutation.mutate({ id: Number(deleteBatchTarget.id) })}
            >
              Apagar entrada
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showCommitDialog} onOpenChange={setShowCommitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {regularizationMode
                ? "Confirmar regularização inicial"
                : fifoMode
                  ? "Confirmar envio para fila"
                  : "Confirmar entrada de estoque"}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-muted-foreground">
                {regularizationMode ? (
                  <>
                    <p>
                      Esta entrada será salva como <strong>regularização inicial</strong> dos produtos já cadastrados.
                      Os produtos base não serão recriados e os IDs serão preservados.
                    </p>
                    <p className="flex items-start gap-2 text-amber-700 dark:text-amber-400">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      Revise quantidades e custos antes de confirmar.
                    </p>
                  </>
                ) : fifoMode ? (
                  <>
                    <p>
                      A entrada será processada com <strong>Fila FIFO</strong>.
                      Produto com estoque atual entra na fila; produto sem
                      estoque entra ativo.
                    </p>
                    <p className="flex items-start gap-2 text-amber-700 dark:text-amber-400">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />A
                      entrada será fechada após o processamento.
                    </p>
                  </>
                ) : (
                  <p>
                    Isso atualiza estoque dos produtos vinculados e calcula
                    custo médio ponderado.
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowCommitDialog(false);
                handleSaveAndProcess(true);
              }}
            >
              {regularizationMode ? "Confirmar regularização" : fifoMode ? "Confirmar envio" : "Confirmar entrada"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Detalhes do lote/entrada ────────────────────────────────────────────────

function BatchDetailsContent({ batch }: { batch: any }) {
  const items = Array.isArray(batch.items) ? batch.items : [];
  const totalQuantity = items.reduce((sum: number, item: any) => sum + Number(item.quantity ?? 0), 0);
  const goodsTotal = Number(batch.totalCostOfGoods ?? 0);
  const operationalTotal = Number(batch.totalOperationalCost ?? 0);
  const taxTotal = Number(batch.totalTaxCost ?? 0);
  const otherTotal = Number(batch.totalOtherCost ?? 0);
  const grandTotal = goodsTotal + operationalTotal + taxTotal + otherTotal;
  const revenue = items.reduce((sum: number, item: any) => sum + Number(item.suggestedPrice ?? 0) * Number(item.quantity ?? 0), 0);
  const profit = items.reduce((sum: number, item: any) => sum + (Number(item.suggestedPrice ?? 0) - Number(item.finalUnitCost ?? 0)) * Number(item.quantity ?? 0), 0);

  return (
    <div className="space-y-5 overflow-x-hidden">
      {/* Resumo geral — 2 colunas no mobile, 3 no tablet, nunca ultrapassa o modal */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <SummaryBox label="Status" value={statusLabel(batch.status)} />
        <SummaryBox label="Data" value={formatBatchDate(batch.createdAt)} />
        <SummaryBox label="Produtos" value={String(items.length)} />
        <SummaryBox label="Unidades" value={String(totalQuantity || "—")} />
        <SummaryBox label="Mercadorias" value={formatCurrency(goodsTotal)} />
        <SummaryBox label="Custos adicionais" value={formatCurrency(operationalTotal + taxTotal + otherTotal)} />
      </div>
      {/* Total em destaque */}
      <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 flex items-center justify-between gap-4">
        <span className="text-xs font-semibold uppercase tracking-wide text-primary/70">Total da entrada</span>
        <span className="text-2xl font-bold text-primary">{formatCurrency(grandTotal)}</span>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-semibold text-foreground">Produtos desta entrada</h4>
            <p className="text-xs text-muted-foreground">Lista organizada em cards para visualizar tudo sem arrastar horizontalmente.</p>
          </div>
          <Badge variant="outline">{items.length} produto(s)</Badge>
        </div>

        {items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
            Nenhum produto encontrado nesta entrada.
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item: any, index: number) => {
              const qty = Number(item.quantity ?? 0);
              const unitBrl = Number(item.unitCostBrl ?? 0);
              const baseTotal = Number(item.totalItemCost ?? item.baseTotalCost ?? unitBrl * qty);
              const finalUnit = Number(item.finalUnitCost ?? 0);
              const realTotal = Number(item.realTotalCost ?? finalUnit * qty);
              const price = Number(item.suggestedPrice ?? 0);
              const profitUnit = price > 0 ? price - finalUnit : 0;
              const profitTotal = price > 0 ? profitUnit * qty : 0;
              const allocated = Number(item.allocatedOperationalCost ?? 0) + Number(item.allocatedTaxCost ?? 0) + Number(item.allocatedOtherCost ?? 0);
              const allocatedUnit = qty > 0 ? allocated / qty : 0;
              const operUnit = Number(item.operationalCostPerUnit ?? (qty > 0 ? Number(item.allocatedOperationalCost ?? 0) / qty : 0));
              return (
                <div key={item.id ?? `${item.productName}-${index}`} className="rounded-lg border border-border bg-background p-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{item.productName || `Produto ${index + 1}`}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.productId ? `Produto #${item.productId}` : 'Produto novo/sem vínculo'} · {item.costCurrency ?? 'BRL'}
                      </p>
                    </div>
                    <Badge variant="secondary">Qtd {qty || '—'}</Badge>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    <MiniInfoBox label="Custo unit. BRL" value={formatCurrency(unitBrl)} />
                    <MiniInfoBox label="Base total" value={formatCurrency(baseTotal)} />
                    <MiniInfoBox label="Rateio total" value={formatCurrency(allocated)} />
                    <MiniInfoBox label="Custo real unit." value={formatCurrency(finalUnit)} highlight />
                    <MiniInfoBox label="Custo real total" value={formatCurrency(realTotal)} />
                    <MiniInfoBox label="Preço final" value={price > 0 ? formatCurrency(price) : 'Sem preço'} />
                  </div>

                  {/* Custo operacional: total do produto e por unidade */}
                  {allocated > 0 && (
                    <div className="mt-2 rounded-md border border-amber-200/60 bg-amber-50/40 dark:border-amber-900/40 dark:bg-amber-950/10 px-3 py-2">
                      <span className="block text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400 mb-1">Custo operacional rateado</span>
                      <div className="flex flex-wrap items-center gap-3 text-xs">
                        <span className="text-muted-foreground">
                          <strong className="text-foreground">{qty} un</strong> → {formatCurrency(allocated)}
                        </span>
                        <span className="text-muted-foreground/60">|</span>
                        <span className="text-muted-foreground">
                          <strong className="text-amber-700 dark:text-amber-400">1 un = {formatCurrency(allocatedUnit)}</strong>
                        </span>
                        {operUnit > 0 && operUnit !== allocatedUnit && (
                          <>
                            <span className="text-muted-foreground/60">·</span>
                            <span className="text-[10px] text-muted-foreground">op: {formatCurrency(operUnit)}/un</span>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div className="rounded-md bg-muted/25 px-3 py-2 text-xs text-muted-foreground">
                      <span className="block text-[10px] uppercase tracking-wide">Lucro unitário</span>
                      <strong className={profitUnit >= 0 ? 'text-emerald-600' : 'text-destructive'}>
                        {price > 0 ? formatCurrency(profitUnit) : '—'}
                      </strong>
                    </div>
                    <div className="rounded-md bg-muted/25 px-3 py-2 text-xs text-muted-foreground">
                      <span className="block text-[10px] uppercase tracking-wide">Lucro total</span>
                      <strong className={profitTotal >= 0 ? 'text-emerald-600' : 'text-destructive'}>
                        {price > 0 ? formatCurrency(profitTotal) : '—'}
                      </strong>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
        <SummaryBox label="Receita projetada" value={formatCurrency(revenue)} />
        <SummaryBox label="Lucro projetado" value={revenue > 0 ? formatCurrency(profit) : "Sem preço final"} />
        <SummaryBox
          label="Conferência"
          value={Math.abs(items.reduce((sum: number, item: any) => sum + Number(item.allocatedOperationalCost ?? 0), 0) - operationalTotal) < 0.05 ? "OK" : "Verificar"}
        />
      </div>
    </div>
  );
}

function MiniInfoBox({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-md border px-3 py-2.5 ${
      highlight
        ? "border-primary/30 bg-primary/5"
        : "border-border bg-muted/20"
    }`}>
      <span className="block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-0.5">{label}</span>
      <strong className={`block text-sm font-bold ${highlight ? "text-primary" : "text-foreground"}`}>{value}</strong>
    </div>
  );
}

// ─── Resultado do rateio em cards ─────────────────────────────────────────────

function BatchPreviewCards({ preview }: { preview: BatchPricingResult }) {
  const totalSuggestedRevenue = preview.items.reduce(
    (sum, item) => sum + item.suggestedPrice * item.quantity,
    0,
  );
  const totalProjectedProfit = preview.items.reduce(
    (sum, item) => sum + item.contributionMargin * item.quantity,
    0,
  );

  return (
    <div className="space-y-6">
      <Card className="border-primary/30">
        <CardHeader>
          <CardTitle className="text-base text-primary">
            Resultado do Rateio Proporcional
          </CardTitle>
          <CardDescription>
            Custos adicionais de{" "}
            <strong>
              {formatCurrency(
                preview.totalOperationalCost +
                  preview.totalTaxCost +
                  preview.totalOtherCost,
              )}
            </strong>{" "}
            rateados sobre{" "}
            <strong>{formatCurrency(preview.totalCostOfGoods)}</strong> em
            mercadorias.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryBox
              label="Mercadorias"
              value={formatCurrency(preview.totalCostOfGoods)}
            />
            <SummaryBox
              label="Operacional"
              value={formatCurrency(preview.totalOperationalCost)}
            />
            <SummaryBox
              label="Impostos/taxas"
              value={formatCurrency(preview.totalTaxCost)}
            />
            <SummaryBox
              label="Outros custos"
              value={formatCurrency(preview.totalOtherCost)}
            />
            <SummaryBox
              label="Total da entrada"
              value={formatCurrency(preview.grandTotal)}
            />
            <SummaryBox
              label="Receita projetada"
              value={formatCurrency(totalSuggestedRevenue)}
            />
            <SummaryBox
              label="Lucro projetado"
              value={formatCurrency(totalProjectedProfit)}
            />
            <SummaryBox
              label="Conferência do rateio"
              value={
                Math.abs(
                  preview.allocationCheck - preview.totalOperationalCost,
                ) < 0.01 &&
                Math.abs(preview.taxAllocationCheck - preview.totalTaxCost) <
                  0.01 &&
                Math.abs(
                  preview.otherAllocationCheck - preview.totalOtherCost,
                ) < 0.01
                  ? "OK"
                  : "Verificar"
              }
            />
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {preview.items.map((item, index) => (
          <Card
            key={`${item.productId ?? "novo"}-${item.productName}-${index}`}
          >
            <CardHeader>
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                    <Badge variant="outline">#{index + 1}</Badge>
                    {item.productId && (
                      <Badge variant="secondary">ID {item.productId}</Badge>
                    )}
                    <span>{item.productName}</span>
                  </CardTitle>
                  <CardDescription>
                    Proporção na entrada:{" "}
                    <strong>{formatPercent(item.costProportion * 100)}</strong>
                  </CardDescription>
                </div>
                <div className="text-left md:text-right">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Custo real unitário
                  </p>
                  <p className="text-2xl font-bold text-primary">
                    {formatCurrency(item.finalUnitCost)}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
                <SummaryBox label="Quantidade" value={String(item.quantity)} />
                <SummaryBox label="Moeda" value={item.costCurrency ?? "BRL"} />
                <SummaryBox
                  label="Custo original"
                  value={formatCurrency(
                    item.unitCostOriginal ?? item.unitCostBrl,
                  )}
                />
                <SummaryBox
                  label="Cotação"
                  value={item.exchangeRate ? String(item.exchangeRate) : "—"}
                />
                <SummaryBox
                  label="Custo unit. BRL"
                  value={formatCurrency(item.unitCostBrl)}
                />
                <SummaryBox
                  label="Custo base total"
                  value={formatCurrency(
                    item.baseTotalCost ?? item.totalItemCost,
                  )}
                />
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <SummaryBox
                  label="Operacional rateado"
                  value={formatCurrency(item.allocatedOperationalCost)}
                  hint={`${formatCurrency(item.operationalCostPerUnit)} por unidade`}
                />
                <SummaryBox
                  label="Imposto rateado"
                  value={formatCurrency(item.allocatedTaxCost)}
                  hint={`${formatCurrency(item.taxCostPerUnit)} por unidade`}
                />
                <SummaryBox
                  label="Outros custos rateados"
                  value={formatCurrency(item.allocatedOtherCost)}
                  hint={`${formatCurrency(item.otherCostPerUnit)} por unidade`}
                />
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                <SummaryBox
                  label="Custo real total"
                  value={formatCurrency(item.realTotalCost)}
                />
                <SummaryBox
                  label="Preço sugerido"
                  value={formatCurrency(item.suggestedPrice)}
                />
                <SummaryBox
                  label="Lucro unitário proj."
                  value={formatCurrency(item.contributionMargin)}
                />
                <SummaryBox
                  label="Lucro total proj."
                  value={formatCurrency(
                    item.contributionMargin * item.quantity,
                  )}
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
