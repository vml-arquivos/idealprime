/**
 * ProductForm.tsx — Cadastro e Edição de Produto (v3 — Design System Unificado)
 *
 * MUDANÇAS v3:
 * - Visual unificado com ConfiguracoesPagamento.tsx:
 *   tokens semânticos (bg-card, border-border, text-foreground, text-muted-foreground)
 *   em vez de cores hardcoded (#0F0F0E, #C8B99A etc.)
 * - SectionBlock → SectionCard + SectionHeader (mesmos componentes de Configurações)
 * - Inputs usam classes padrão do sistema (h-9 text-sm border-input bg-background)
 * - Botões primários: variant padrão do Button; secundários: variant="outline"
 * - Lógica de negócio 100% intacta.
 *
 * AJUSTE DE TRANSIÇÃO — Entrada de Produtos:
 * - Mantém produtos antigos editáveis.
 * - Marca custo operacional como campo legado.
 * - Permite selecionar produto existente vindo da Entrada de Produtos/lista de produtos.
 * - Carrega custo, categoria e estoque como fallback seguro.
 * - Adiciona modo de preço manual com cálculo de lucro/prejuízo sem alterar checkout.
 */

import { useEffect, useMemo, useState, useCallback, type ChangeEvent } from "react";
import { useLocation, useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import {
  calculatePricing,
  isPricingError,
  formatCurrency,
  formatPercent,
  type PricingInput,
  type PricingResult,
  type PaymentResult,
  type ProductCategory,
  type TaxRegime,
  type PaymentMethod,
} from "../../../shared/pricingCalculator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput, parseCurrencyValue } from "@/components/CurrencyInput";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertCircle, AlertTriangle, CheckCircle2, XCircle, Info, Calculator,
  DollarSign, CreditCard, Banknote, Sparkles, Tag, Eye, Save,
  ArrowLeft, TrendingUp, TrendingDown, RefreshCcw, Settings2,
  Package, Layers, BarChart2, StickyNote,
} from "lucide-react";
import ImageGallery from "@/components/ImageGallery";
import DashboardLayout from "@/components/DashboardLayout";
import { toast } from "sonner";

// ── Tipos ─────────────────────────────────────────────────────────────────────

type MarginMode = "PERCENT" | "VALUE" | "MANUAL";

interface FormState {
  name: string;
  shortDescription: string;
  description: string;
  category: ProductCategory;
  categoryLabel: string;
  ncm: string;
  promoTag: string;
  salesChannel: "SHOP" | "QUASE_ZERO" | "BOTH";
  productCondition: "NEW" | "SEMINOVO" | "USADO" | "MOSTRUARIO" | "OPEN_BOX" | "REEMBALADO";
  conditionNotes: string;
  isUniquePiece: boolean;
  published: boolean;
  active: boolean;
  notes: string;
  costCurrency: "BRL" | "USD";
  costPrice: string;
  costPriceUsd: string;
  usdExchangeRate: string;
  packagingCost: string;
  inboundShippingCost: string;
  operationalCost: string;
  stockQuantity: string;
  minimumStock: string;
  marginMode: MarginMode;
  desiredMarginRate: string;
  desiredMarginValue: string;
  manualSalePrice: string;
}

type AiSuggestion = {
  name: string;
  category: string;
  categoryLabel?: string;
  shortDescription: string;
  description: string;
};

type AiField = "name" | "category" | "categoryLabel" | "shortDescription" | "description";

const AI_FIELDS: AiField[] = ["name", "category", "categoryLabel", "shortDescription", "description"];
const AI_FIELD_LABELS: Record<AiField, string> = {
  name: "Nome",
  category: "Categoria",
  categoryLabel: "Label de categoria",
  shortDescription: "Descrição curta",
  description: "Descrição completa",
};

const defaultForm: FormState = {
  name: "",
  shortDescription: "",
  description: "",
  category: "CELULAR",
  categoryLabel: "",
  ncm: "",
  promoTag: "",
  salesChannel: "SHOP",
  productCondition: "NEW",
  conditionNotes: "",
  isUniquePiece: false,
  published: false,
  active: true,
  notes: "",
  costCurrency: "BRL",
  costPrice: "",
  costPriceUsd: "",
  usdExchangeRate: "5.50",
  packagingCost: "",
  inboundShippingCost: "",
  operationalCost: "",
  stockQuantity: "",
  minimumStock: "",
  marginMode: "PERCENT",
  desiredMarginRate: "30",
  desiredMarginValue: "",
  manualSalePrice: "",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function n(val: string | number | null | undefined): number {
  return parseCurrencyValue(val ?? "");
}

function diagnosticConfig(status: string) {
  switch (status) {
    case "EXCELENTE":  return { color: "text-emerald-500", icon: <CheckCircle2 className="w-3.5 h-3.5" /> };
    case "SAUDAVEL":   return { color: "text-green-500",   icon: <CheckCircle2 className="w-3.5 h-3.5" /> };
    case "ATENCAO":    return { color: "text-amber-500",   icon: <AlertCircle className="w-3.5 h-3.5" /> };
    case "RISCO":      return { color: "text-orange-500",  icon: <AlertTriangle className="w-3.5 h-3.5" /> };
    case "PREJUIZO":   return { color: "text-red-500",     icon: <XCircle className="w-3.5 h-3.5" /> };
    default:           return { color: "text-muted-foreground", icon: null };
  }
}

function methodIcon(method: PaymentMethod) {
  switch (method) {
    case "PIX":               return <Sparkles className="w-4 h-4" />;
    case "BOLETO":            return <Banknote className="w-4 h-4" />;
    case "DEBITO":            return <CreditCard className="w-4 h-4" />;
    case "CREDITO_A_VISTA":   return <CreditCard className="w-4 h-4" />;
    case "CREDITO_PARCELADO": return <Tag className="w-4 h-4" />;
  }
}

interface ManualPricingSummary {
  salePrice: number;
  profitValue: number;
  profitPercentOnSale: number;
  markupPercentOnCost: number;
  isLoss: boolean;
}

interface ProductCostContext {
  source: "ACTIVE_QUEUE" | "LATEST_ENTRY" | "LEGACY";
  productId: number;
  batchId: number | null;
  batchItemId: number | null;
  queueId: number | null;
  quantityAvailable: number;
  unitCostOriginal: number;
  costCurrency: "BRL" | "USD";
  exchangeRate: number;
  unitCostBrl: number;
  operationalCostPerUnit: number;
  taxCostPerUnit: number;
  otherCostPerUnit: number;
  realUnitCost: number;
  realTotalCost: number;
  suggestedPrice: number;
  warning?: string;
}

function costSourceLabel(source?: ProductCostContext["source"]): string {
  if (source === "ACTIVE_QUEUE") return "Custo da entrada ativa";
  if (source === "LATEST_ENTRY") return "Custo da última entrada";
  return "Custo legado";
}

function calculateManualPricing(realUnitCost: number, manualSalePrice: number): ManualPricingSummary | null {
  if (realUnitCost <= 0 || manualSalePrice <= 0) return null;
  const profitValue = manualSalePrice - realUnitCost;
  return {
    salePrice: manualSalePrice,
    profitValue,
    profitPercentOnSale: manualSalePrice > 0 ? (profitValue / manualSalePrice) * 100 : 0,
    markupPercentOnCost: realUnitCost > 0 ? (profitValue / realUnitCost) * 100 : 0,
    isLoss: profitValue < 0,
  };
}

// ── Sub-componentes (mesma estrutura de ConfiguracoesPagamento) ───────────────

function Field({ label, tooltip, required, hint, children }: {
  label: string; tooltip?: string; required?: boolean; hint?: string; children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <Label className="text-xs font-medium text-muted-foreground tracking-wider uppercase">
          {label}
          {required && <span className="text-rose-500 ml-0.5">*</span>}
        </Label>
        {tooltip && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="w-3 h-3 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs text-xs">
              {tooltip}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
      {children}
      {hint && <p className="text-xs text-muted-foreground leading-relaxed font-light">{hint}</p>}
    </div>
  );
}

function NI({ value, onChange, placeholder, prefix, suffix, disabled }: {
  value: string | number; onChange: (v: string) => void;
  placeholder?: string; prefix?: string; suffix?: string; disabled?: boolean;
}) {
  // Campos monetários (R$ ou US$) usam máscara automática
  const isCurrency = prefix === "R$" || prefix === "US$";
  if (isCurrency) {
    const numVal = n(value as any);
    return (
      <CurrencyInput
        value={numVal}
        onValueChange={(n) => onChange(String(n))}
        placeholder={placeholder ?? "0,00"}
        disabled={disabled}
      />
    );
  }
  // Campos não-monetários (cotação, percentuais, etc.) mantêm input normal
  return (
    <div className="relative flex items-center">
      {prefix && (
        <span className="absolute left-3 text-xs text-muted-foreground pointer-events-none font-mono">
          {prefix}
        </span>
      )}
      <Input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "0"}
        step="any"
        min={0}
        disabled={disabled}
        className={`h-9 text-sm ${prefix ? "pl-8" : ""} ${suffix ? "pr-8" : ""} ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      />
      {suffix && (
        <span className="absolute right-3 text-xs text-muted-foreground pointer-events-none font-mono">
          {suffix}
        </span>
      )}
    </div>
  );
}

/** Card de seção — idêntico ao de ConfiguracoesPagamento */
function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      {children}
    </div>
  );
}

/** Header de seção — idêntico ao de ConfiguracoesPagamento */
function SectionHeader({
  icon, title, subtitle,
}: {
  icon: React.ReactNode; title: string; subtitle: string;
}) {
  return (
    <div className="flex items-start gap-3 pb-4 border-b border-border mb-5">
      <div className="w-9 h-9 rounded-md border border-border bg-muted flex items-center justify-center text-muted-foreground shrink-0">
        {icon}
      </div>
      <div>
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
      </div>
    </div>
  );
}

/** Card de resultado de pagamento — usa tokens semânticos */
function ResultCard({ result, isBest }: { result: PaymentResult; isBest: boolean }) {
  const diag = diagnosticConfig(result.diagnostic);
  return (
    <div className={`p-3.5 rounded-md border transition-all ${isBest ? "border-primary/30 bg-primary/5" : "border-border bg-muted/20"}`}>
      {isBest && (
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary mb-2">
          <TrendingUp className="w-3 h-3" /> Melhor opção
        </span>
      )}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">{methodIcon(result.method)}</span>
          <div>
            <p className="text-xs font-semibold text-foreground">{result.methodLabel}</p>
            {result.installments > 1 && (
              <p className="text-[10px] text-muted-foreground">
                {result.installments}× {formatCurrency(result.installmentValue)}
              </p>
            )}
          </div>
        </div>
        <span className={`text-[10px] font-bold ${diag.color}`}>{result.diagnostic}</span>
      </div>
      <p className="text-xl font-bold text-foreground tracking-tight mb-2.5">
        {formatCurrency(result.suggestedPrice)}
      </p>
      <div className="space-y-1 text-[10px] border-t border-border pt-2.5">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Impostos:</span>
          <span className="text-muted-foreground">{formatCurrency(result.totalTax)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Taxas/Juros:</span>
          <span className="text-muted-foreground">{formatCurrency(result.totalFees + result.totalInterest)}</span>
        </div>
        <div className="flex justify-between border-t border-border pt-1">
          <span className="text-muted-foreground">Lucro líquido:</span>
          <span className={`font-semibold ${result.netProfit >= 0 ? "text-emerald-500" : "text-red-500"}`}>
            {formatCurrency(result.netProfit)} ({formatPercent(result.realMarginRate)})
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Preço psicológico:</span>
          <span className="text-muted-foreground">{formatCurrency(result.psychologicalPrice)}</span>
        </div>
      </div>
    </div>
  );
}

// ── Componente Principal ──────────────────────────────────────────────────────

export default function ProductForm() {
  const [, setLocation] = useLocation();
  const params = useParams<{ id?: string }>();
  const productId = params.id ? Number(params.id) : undefined;
  const isEditing = !!productId;

  const [form, setForm] = useState<FormState>(defaultForm);
  const [pricingResult, setPricingResult] = useState<PricingResult | null>(null);
  const [calcError, setCalcError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingImages, setPendingImages] = useState<File[]>([]);
  const [pendingPreviews, setPendingPreviews] = useState<string[]>([]);
  const [aiSuggestion, setAiSuggestion] = useState<AiSuggestion | null>(null);
  const [aiSelections, setAiSelections] = useState<Record<AiField, boolean>>({
    name: false,
    category: false,
    categoryLabel: false,
    shortDescription: false,
    description: false,
  });
  const [aiDialogOpen, setAiDialogOpen] = useState(false);

  const productQuery = trpc.products.byId.useQuery(
    { id: productId! },
    { enabled: isEditing }
  );
  // Pré-visualização do próximo ID ao criar um novo produto
  const nextIdQuery = trpc.products.nextId.useQuery(undefined, {
    enabled: !isEditing,
    staleTime: 0,
  });
  const productsQuery = trpc.products.list.useQuery(undefined, {
    enabled: !isEditing,
    staleTime: 60_000,
  });
  const [selectedExistingProductId, setSelectedExistingProductId] = useState<string>("");
  const costContextProductId = isEditing
    ? productId
    : selectedExistingProductId
      ? Number(selectedExistingProductId)
      : undefined;
  const productCostContextQuery = trpc.products.costContext.useQuery(
    { id: costContextProductId! },
    { enabled: !!costContextProductId && !Number.isNaN(costContextProductId) },
  );
  const costContext = productCostContextQuery.data as ProductCostContext | null | undefined;
  const utils = trpc.useUtils();
  const addImageMutation = trpc.products.addImage.useMutation();

  const uploadPendingImage = useCallback(async (file: File, targetProductId: number, persist = true) => {
    const uploadResp = await fetch(
      `/api/upload/image?productId=${targetProductId}&filename=${encodeURIComponent(file.name)}`,
      {
        method: "POST",
        body: file,
        headers: { "Content-Type": file.type || "application/octet-stream" },
      },
    );
    if (!uploadResp.ok) throw new Error(`Falha no upload: ${uploadResp.statusText}`);
    const { url } = await uploadResp.json() as { url: string };
    if (persist) {
      await addImageMutation.mutateAsync({
        productId: targetProductId,
        url,
        storageKey: url,
        altText: file.name,
      });
    }
    return url;
  }, [addImageMutation]);

  const globalSettings = trpc.paymentSettings.get.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });

  const suggestAiMutation = trpc.ai.suggestProductInfo.useMutation({
    onSuccess: (suggestion) => {
      setAiSuggestion(suggestion);
      setAiSelections({
        name: !form.name.trim(),
        category: false,
        categoryLabel: !form.categoryLabel.trim(),
        shortDescription: !form.shortDescription.trim(),
        description: !form.description.trim(),
      });
      setAiDialogOpen(true);
    },
    onError: (error) => toast.error(error.message),
  });

  const createProduct = trpc.products.create.useMutation({
    onSuccess: async (newProduct) => {
      if (pendingImages.length > 0) {
        for (const file of pendingImages) {
          try {
            await uploadPendingImage(file, newProduct.id);
          } catch {
            toast.warning(`Imagem "${file.name}" não pôde ser enviada. Produto criado normalmente.`);
          }
        }
      }
      utils.products.list.invalidate();
      setLocation("/produtos");
      toast.success("Produto criado!");
    },
    onError: (e) => { toast.error(e.message); setIsSaving(false); },
  });

  const updateProduct = trpc.products.update.useMutation({
    onSuccess: () => {
      utils.products.list.invalidate();
      setLocation("/produtos");
      toast.success("Produto atualizado!");
    },
    onError: (e) => { toast.error(e.message); setIsSaving(false); },
  });

  const handlePendingImageSelect = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).slice(0, 4);
    setPendingImages(files);
    setPendingPreviews(files.map((f) => URL.createObjectURL(f)));
    e.target.value = "";
  }, []);

  const handleSuggestWithAi = useCallback(async () => {
    const savedImageUrl = String((productQuery.data as any)?.imageUrl ?? "").trim();
    let imageUrl = savedImageUrl || undefined;
    if (pendingImages[0]) {
      try {
        imageUrl = await uploadPendingImage(pendingImages[0], 0, false);
      } catch {
        toast.error("Não foi possível preparar a imagem para a IA. Você ainda pode continuar o cadastro manualmente.");
        return;
      }
    }
    if (!imageUrl && !form.name.trim()) {
      toast.error("Informe um nome ou selecione uma imagem para usar a IA.");
      return;
    }
    suggestAiMutation.mutate({
      ...(imageUrl ? { imageUrl } : {}),
      ...(form.name.trim() ? { name: form.name.trim() } : {}),
    });
  }, [form.name, pendingImages, productQuery.data, suggestAiMutation, uploadPendingImage]);

  useEffect(() => {
    return () => { pendingPreviews.forEach((url) => URL.revokeObjectURL(url)); };
  }, [pendingPreviews]);

  const set = useCallback(
    (field: keyof FormState) => (value: string | boolean) =>
      setForm((prev) => ({ ...prev, [field]: value })),
    []
  );

  const applyAiSuggestion = useCallback(() => {
    if (!aiSuggestion) return;
    for (const field of AI_FIELDS) {
      if (!aiSelections[field]) continue;
      const value = String(aiSuggestion[field] ?? "");
      if (field === "category") {
        set("category")(value as ProductCategory);
      } else {
        set(field)(value);
      }
    }
    setAiDialogOpen(false);
    toast.success("Sugestões selecionadas aplicadas ao formulário.");
  }, [aiSelections, aiSuggestion, set]);

  useEffect(() => {
    if (productQuery.data) {
      const p = productQuery.data;
      setForm((prev) => ({
        ...prev,
        name: p.name || "",
        shortDescription: p.shortDescription || "",
        description: p.description || "",
        category: (p.category as ProductCategory) || "CELULAR",
        categoryLabel: p.categoryLabel || "",
        ncm: p.ncm || "",
        promoTag: p.promoTag || "",
        salesChannel: (p.salesChannel as any) || "SHOP",
        productCondition: (p.productCondition as any) || "NEW",
        conditionNotes: p.conditionNotes || "",
        isUniquePiece: p.isUniquePiece === true,
        published: p.published ?? false,
        active: p.active ?? true,
        notes: p.notes || "",
        costCurrency: (p.costCurrency as "BRL" | "USD") || "BRL",
        costPrice: p.costPrice ? String(p.costPrice) : "",
        costPriceUsd: p.costPriceUsd ? String(p.costPriceUsd) : "",
        usdExchangeRate: p.usdExchangeRate ? String(p.usdExchangeRate) : "5.50",
        packagingCost: p.packagingCost ? String(p.packagingCost) : "",
        inboundShippingCost: p.inboundShippingCost ? String(p.inboundShippingCost) : "",
        operationalCost: p.operationalCost ? String(p.operationalCost) : "",
        stockQuantity: p.stockQuantity ? String(p.stockQuantity) : "",
        minimumStock: p.minimumStock ? String(p.minimumStock) : "",
        marginMode: ((p as any).marginMode as MarginMode) || "PERCENT",
        desiredMarginRate: p.desiredMarginRate ? String(p.desiredMarginRate) : "30",
        desiredMarginValue: p.desiredMarginValue ? String(p.desiredMarginValue) : "",
        manualSalePrice: p.suggestedPricePix
          ? String(p.suggestedPricePix)
          : p.suggestedPrice
          ? String(p.suggestedPrice)
          : "",
      }));
    }
  }, [productQuery.data]);

  useEffect(() => {
    if (!costContext) return;

    const additionalCostPerUnit =
      n(costContext.operationalCostPerUnit) +
      n(costContext.taxCostPerUnit) +
      n(costContext.otherCostPerUnit);

    setForm((prev) => ({
      ...prev,
      costCurrency: "BRL",
      costPrice: costContext.unitCostBrl > 0
        ? String(costContext.unitCostBrl)
        : costContext.realUnitCost > 0
          ? String(costContext.realUnitCost)
          : prev.costPrice,
      costPriceUsd: costContext.costCurrency === "USD" && costContext.unitCostOriginal > 0
        ? String(costContext.unitCostOriginal)
        : prev.costPriceUsd,
      usdExchangeRate: costContext.exchangeRate > 0
        ? String(costContext.exchangeRate)
        : prev.usdExchangeRate,
      operationalCost: additionalCostPerUnit > 0
        ? String(additionalCostPerUnit)
        : costContext.source === "LEGACY" && costContext.operationalCostPerUnit > 0
          ? String(costContext.operationalCostPerUnit)
          : "",
      stockQuantity: costContext.quantityAvailable > 0
        ? String(Math.trunc(costContext.quantityAvailable))
        : prev.stockQuantity,
      manualSalePrice: costContext.suggestedPrice > 0
        ? String(costContext.suggestedPrice)
        : prev.manualSalePrice,
    }));
  }, [costContext]);

  const applyExistingProductToForm = useCallback((rawProductId: string) => {
    setSelectedExistingProductId(rawProductId);
    const selectedId = rawProductId ? Number(rawProductId) : undefined;
    const selected = productsQuery.data?.find((p: any) => p.id === selectedId) as any;
    if (!selected) return;

    const cost = Number(selected.finalUnitCostBrl ?? selected.averageCostBrl ?? selected.costPriceBrl ?? selected.costPrice ?? 0);

    setForm((prev) => ({
      ...prev,
      name: selected.name || prev.name,
      shortDescription: selected.shortDescription || prev.shortDescription,
      description: selected.description || prev.description,
      category: (selected.category as ProductCategory) || prev.category,
      categoryLabel: selected.categoryLabel || prev.categoryLabel,
      ncm: selected.ncm || prev.ncm,
      promoTag: selected.promoTag || prev.promoTag,
      salesChannel: (selected.salesChannel as any) || prev.salesChannel,
      productCondition: (selected.productCondition as any) || prev.productCondition,
      conditionNotes: selected.conditionNotes || prev.conditionNotes,
      isUniquePiece: selected.isUniquePiece === true || prev.isUniquePiece,
      published: selected.published ?? prev.published,
      active: selected.active ?? prev.active,
      notes: selected.notes || prev.notes,
      costCurrency: (selected.costCurrency as "BRL" | "USD") || "BRL",
      costPrice: cost > 0 ? String(cost) : selected.costPrice ? String(selected.costPrice) : prev.costPrice,
      costPriceUsd: selected.costPriceUsd ? String(selected.costPriceUsd) : prev.costPriceUsd,
      usdExchangeRate: selected.usdExchangeRate ? String(selected.usdExchangeRate) : prev.usdExchangeRate,
      packagingCost: selected.packagingCost ? String(selected.packagingCost) : prev.packagingCost,
      inboundShippingCost: selected.inboundShippingCost ? String(selected.inboundShippingCost) : prev.inboundShippingCost,
      operationalCost: selected.operationalCost ? String(selected.operationalCost) : prev.operationalCost,
      stockQuantity: selected.stockQuantity != null ? String(selected.stockQuantity) : prev.stockQuantity,
      minimumStock: selected.minimumStock != null ? String(selected.minimumStock) : prev.minimumStock,
      manualSalePrice: selected.suggestedPricePix
        ? String(selected.suggestedPricePix)
        : selected.suggestedPrice
        ? String(selected.suggestedPrice)
        : prev.manualSalePrice,
    }));

    toast.success(`Produto #${selected.id} carregado para publicação/edição comercial.`);
  }, [productsQuery.data]);

  const costPriceBrl = useMemo(() => {
    if (form.costCurrency === "USD") return n(form.costPriceUsd) * n(form.usdExchangeRate);
    return n(form.costPrice);
  }, [form.costCurrency, form.costPrice, form.costPriceUsd, form.usdExchangeRate]);

  const finalUnitCost = useMemo(
    () => costPriceBrl + n(form.packagingCost) + n(form.inboundShippingCost) + n(form.operationalCost),
    [costPriceBrl, form.packagingCost, form.inboundShippingCost, form.operationalCost]
  );

  const manualPricing = useMemo(
    () => calculateManualPricing(finalUnitCost, n(form.manualSalePrice)),
    [finalUnitCost, form.manualSalePrice]
  );

  const effectiveMarginRate = useMemo(() => {
    if (form.marginMode === "VALUE") {
      if (finalUnitCost <= 0) return 0;
      return (n(form.desiredMarginValue) / finalUnitCost) * 100;
    }
    if (form.marginMode === "MANUAL") {
      return manualPricing?.markupPercentOnCost ?? 0;
    }
    return n(form.desiredMarginRate);
  }, [form.marginMode, form.desiredMarginRate, form.desiredMarginValue, form.manualSalePrice, finalUnitCost, manualPricing]);

  const handleCalculate = useCallback(() => {
    setCalcError(null);
    if (!form.name.trim()) { setCalcError("Informe o nome do produto."); return; }
    if (costPriceBrl <= 0) { setCalcError("Informe o preço de custo."); return; }
    if (form.marginMode === "MANUAL") {
      if (n(form.manualSalePrice) <= 0) { setCalcError("Informe o preço manual de venda."); return; }
      setPricingResult(null);
      return;
    }

    if (!globalSettings.data) { setCalcError("Aguardando configurações globais de pagamento..."); return; }

    const gs = globalSettings.data;
    const input: PricingInput = {
      productName: form.name.trim(),
      category: form.category,
      ncm: form.ncm || undefined,
      costPrice: costPriceBrl,
      packagingCost: n(form.packagingCost),
      inboundShippingCost: n(form.inboundShippingCost),
      operationalCost: n(form.operationalCost),
      desiredMarginRate: effectiveMarginRate,
      taxRegime: (gs.taxRegime as TaxRegime) ?? "SIMPLES_NACIONAL",
      taxRates: {
        cash: 0,
        boleto: gs.taxBoleto ?? 6,
        debit: gs.taxDebit ?? 6,
        creditCash: gs.taxCreditCash ?? 6,
        creditInstallment: gs.taxCreditInstallment ?? 6,
      },
      boleto: {
        months: Math.max(1, Math.round(gs.boletoMonths ?? 3)),
        monthlyInterestRate: gs.boletoMonthlyRate ?? 1.99,
        fixedFee: gs.boletoFixedFee ?? 3.50,
        defaultRiskRate: gs.boletoDefaultRisk ?? 2,
        customerPaysInterest: gs.boletoCustomerPaysInterest ?? false,
      },
      card: {
        debitFeeRate: gs.cardDebitFee ?? 1.5,
        creditCashFeeRate: gs.cardCreditCashFee ?? 2.5,
        creditInstallmentFeeRate: gs.cardCreditInstallmentFee ?? 3.5,
        installments: Math.max(1, Math.round(gs.cardInstallments ?? 6)),
        anticipationRate: gs.cardAnticipationRate ?? 1.5,
        monthlyInterestRate: gs.cardMonthlyRate ?? 1.99,
        customerPaysInterest: gs.cardCustomerPaysInterest ?? false,
      },
    };

    const calc = calculatePricing(input);
    if (isPricingError(calc)) { setCalcError(calc.message); return; }
    setPricingResult(calc);
  }, [form, costPriceBrl, effectiveMarginRate, globalSettings.data]);

  const handleSave = useCallback(async () => {
    if (!form.name.trim()) { toast.error("Informe o nome do produto."); return; }
    setIsSaving(true);

    const gs = globalSettings.data;
    const manualPrice = form.marginMode === "MANUAL" ? n(form.manualSalePrice) : 0;
    const manualProfit = manualPrice > 0 ? manualPrice - finalUnitCost : 0;
    const pixResult    = pricingResult?.results.find((r) => r.method === "PIX");
    const cardResult   = pricingResult?.results.find((r) => r.method === "CREDITO_A_VISTA");
    const boletoResult = pricingResult?.results.find((r) => r.method === "BOLETO");
    const bestResult   = pricingResult?.results.find((r) => r.method === pricingResult.bestMethod);

    const payload = {
      name: form.name.trim(),
      shortDescription: form.shortDescription,
      description: form.description,
      category: form.category,
      categoryLabel: form.categoryLabel,
      ncm: form.ncm || undefined,
      promoTag: form.promoTag || undefined,
      salesChannel: form.salesChannel,
      productCondition: form.productCondition,
      conditionNotes: form.conditionNotes || undefined,
      isUniquePiece: form.isUniquePiece,
      published: form.published,
      active: form.active,
      notes: form.notes || undefined,
      costCurrency: form.costCurrency,
      costPrice: costPriceBrl,
      costPriceUsd: n(form.costPriceUsd),
      usdExchangeRate: n(form.usdExchangeRate),
      packagingCost: n(form.packagingCost),
      inboundShippingCost: n(form.inboundShippingCost),
      operationalCost: n(form.operationalCost),
      stockQuantity: n(form.stockQuantity),
      minimumStock: n(form.minimumStock),
      desiredMarginRate: Math.max(0, effectiveMarginRate),
      desiredMarginValue: form.marginMode === "MANUAL" ? Math.max(0, manualProfit) : n(form.desiredMarginValue),
      marginMode: form.marginMode === "MANUAL" ? "VALUE" : form.marginMode,
      taxRegime: (gs?.taxRegime as TaxRegime) ?? "SIMPLES_NACIONAL",
      estimatedTaxRate: 0,
      taxCash: 0,
      taxBoleto: gs?.taxBoleto ?? 6,
      taxDebit: gs?.taxDebit ?? 6,
      taxCreditCash: gs?.taxCreditCash ?? 6,
      taxCreditInstallment: gs?.taxCreditInstallment ?? 6,
      boletoMonths: gs?.boletoMonths ?? 3,
      boletoMonthlyRate: gs?.boletoMonthlyRate ?? 1.99,
      boletoFixedFee: gs?.boletoFixedFee ?? 3.5,
      boletoDefaultRisk: gs?.boletoDefaultRisk ?? 2,
      boletoCustomerPaysInterest: gs?.boletoCustomerPaysInterest ?? false,
      cardDebitFee: gs?.cardDebitFee ?? 1.5,
      cardCreditCashFee: gs?.cardCreditCashFee ?? 2.5,
      cardCreditInstallmentFee: gs?.cardCreditInstallmentFee ?? 3.5,
      cardInstallments: gs?.cardInstallments ?? 6,
      cardAnticipationRate: gs?.cardAnticipationRate ?? 1.5,
      cardMonthlyRate: gs?.cardMonthlyRate ?? 1.99,
      cardCustomerPaysInterest: gs?.cardCustomerPaysInterest ?? false,
      suggestedPrice: form.marginMode === "MANUAL" ? manualPrice : bestResult?.suggestedPrice ?? 0,
      suggestedPricePix: form.marginMode === "MANUAL" ? manualPrice : pixResult?.suggestedPrice ?? 0,
      suggestedPriceCard: form.marginMode === "MANUAL" ? manualPrice : cardResult?.suggestedPrice ?? 0,
      suggestedPriceBoleto: form.marginMode === "MANUAL" ? manualPrice : boletoResult?.suggestedPrice ?? 0,
    };

    if (isEditing) {
      updateProduct.mutate({ id: productId!, data: payload });
    } else if (selectedExistingProductId) {
      updateProduct.mutate({ id: Number(selectedExistingProductId), data: payload });
    } else {
      createProduct.mutate(payload);
    }
  }, [form, costPriceBrl, finalUnitCost, effectiveMarginRate, pricingResult, globalSettings.data, isEditing, productId, selectedExistingProductId, createProduct, updateProduct]);

  if (isEditing && productQuery.isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center space-y-3">
            <div className="w-5 h-5 border-2 border-border border-t-foreground rounded-full animate-spin mx-auto" />
            <p className="text-xs text-muted-foreground tracking-widest uppercase">Carregando produto...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-[1200px]">

        {/* ── Cabeçalho — mesmo padrão de ConfiguracoesPagamento ──────── */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setLocation("/produtos")}
              className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-sm"
            >
              <ArrowLeft className="w-4 h-4" /> Voltar
            </button>
            <div className="pl-4 border-l border-border">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-foreground">
                  {isEditing ? "Editar Produto" : "Novo Produto"}
                </h1>
                {isEditing && productId ? (
                  <span
                    className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-bold bg-muted text-muted-foreground border border-border cursor-pointer"
                    title="ID do produto — clique para copiar"
                    onClick={() => { navigator.clipboard.writeText(String(productId)); toast.success("ID copiado!"); }}
                  >
                    #{productId}
                  </span>
                ) : !isEditing && nextIdQuery.data ? (
                  <span
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-mono font-bold bg-primary/10 text-primary border border-primary/30"
                    title="ID que será atribuído automaticamente ao salvar este produto"
                  >
                    <span className="text-[9px] font-sans font-normal text-primary/60 uppercase tracking-wide">próximo ID</span>
                    #{nextIdQuery.data}
                  </span>
                ) : null}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Cadastro, precificação e publicação na vitrine
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isEditing && (
              <Button variant="outline" size="sm" asChild>
                <a href={`/vitrine/${productId}`} target="_blank" rel="noopener noreferrer" className="gap-2">
                  <Eye className="w-3.5 h-3.5" /> Ver na Vitrine
                </a>
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleCalculate}
              disabled={!form.name.trim() || costPriceBrl <= 0 || globalSettings.isLoading}
              className="gap-2"
            >
              <Calculator className="w-3.5 h-3.5" /> Calcular Preços
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isSaving}
              className="gap-2"
            >
              <Save className="w-3.5 h-3.5" />
              {isSaving ? "Salvando..." : isEditing || selectedExistingProductId ? "Salvar Alterações" : "Criar Produto"}
            </Button>
          </div>
        </div>

        {/* Alerta configurações globais */}
        {globalSettings.isError && (
          <div className="flex items-center gap-3 p-3 rounded-lg border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-950/20">
            <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
            <p className="text-sm text-amber-700 dark:text-amber-400">
              Não foi possível carregar as configurações globais de pagamento. Os preços calculados podem estar incorretos.
            </p>
          </div>
        )}

        {/* ── Grid: formulário + simulador ─────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">

          {/* ── FORMULÁRIO ─────────────────────────────────────────────── */}
          <div className="space-y-6">

            {/* 0. SELECIONAR PRODUTO EXISTENTE / ENTRADA */}
            {!isEditing && (
              <SectionCard>
                <SectionHeader
                  icon={<Layers className="w-4 h-4" />}
                  title="Selecionar Produto da Entrada de Produtos"
                  subtitle="Use um produto já cadastrado para publicar/configurar comercialmente sem duplicar"
                />

                <div className="space-y-3">
                  <Field
                    label="Produto existente"
                    hint="Opcional durante a transição. Produtos antigos continuam funcionando; produtos novos devem vir da Entrada de Produtos."
                  >
                    <select
                      value={selectedExistingProductId}
                      onChange={(e) => applyExistingProductToForm(e.target.value)}
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                      disabled={productsQuery.isLoading}
                    >
                      <option value="">{productsQuery.isLoading ? "Carregando produtos..." : "— Selecionar produto já cadastrado —"}</option>
                      {productsQuery.data?.map((product: any) => (
                        <option key={product.id} value={product.id}>
                          #{product.id} — {product.name} · Estoque: {product.stockQuantity ?? 0}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <div className="flex items-start gap-2.5 p-3 rounded-md border border-blue-200 dark:border-blue-900/40 bg-blue-50 dark:bg-blue-950/20">
                    <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-blue-800 dark:text-blue-300 leading-relaxed">
                      Selecione um produto que veio da Entrada de Produtos para carregar nome, categoria, estoque e custo.
                      Se for produto antigo sem entrada formal, ele continua editável usando o custo legado como fallback.
                    </p>
                  </div>
                </div>
              </SectionCard>
            )}

            {/* 1. IDENTIDADE DO PRODUTO */}
            <SectionCard>
              <SectionHeader
                icon={<Package className="w-4 h-4" />}
                title="Identidade do Produto"
                subtitle="Nome, categoria, descrição e visibilidade na vitrine"
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div className="sm:col-span-2">
                  <Field label="Nome do produto" required>
                    <Input
                      value={form.name}
                      onChange={(e) => set("name")(e.target.value)}
                      placeholder="Ex: Sauvage Eau de Parfum 100ml"
                      className="h-9 text-sm"
                    />
                  </Field>
                </div>

                <Field label="Categoria" required>
                  <Select value={form.category} onValueChange={(v) => set("category")(v)}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(["CELULAR", "ELETRONICO", "PERFUME", "BEBIDA", "OUTRO"]).map((c) => (
                        <SelectItem key={c} value={c as any} className="text-sm capitalize">
                          {c.charAt(0) + c.slice(1).toLowerCase()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="Label de categoria" tooltip="Exibida na vitrine. Ex: Perfumes Importados">
                  <Input
                    value={form.categoryLabel}
                    onChange={(e) => set("categoryLabel")(e.target.value)}
                    placeholder="Ex: Perfumes Importados"
                    className="h-9 text-sm"
                  />
                </Field>

                <Field label="NCM">
                  <Input
                    value={form.ncm}
                    onChange={(e) => set("ncm")(e.target.value)}
                    placeholder="Ex: 3303.00.10"
                    className="h-9 text-sm"
                  />
                </Field>

                <Field label="Tag de promoção" tooltip='Aparece como badge na vitrine. Ex: "OFERTA"'>
                  <Input
                    value={form.promoTag}
                    onChange={(e) => set("promoTag")(e.target.value)}
                    placeholder="Ex: OFERTA"
                    className="h-9 text-sm"
                  />
                </Field>

                <Field label="Canal de venda" tooltip="Escolha onde este produto deve aparecer.">
                  <Select value={form.salesChannel} onValueChange={(v) => set("salesChannel")(v as any)}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SHOP">Ideal Prime</SelectItem>
                      <SelectItem value="QUASE_ZERO">Quase Zero</SelectItem>
                      <SelectItem value="BOTH">Shop + Quase Zero</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="Condição" tooltip="Usado para organizar a página Quase Zero.">
                  <Select value={form.productCondition} onValueChange={(v) => set("productCondition")(v as any)}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NEW">Novo</SelectItem>
                      <SelectItem value="SEMINOVO">Seminovo</SelectItem>
                      <SelectItem value="USADO">Usado</SelectItem>
                      <SelectItem value="MOSTRUARIO">Mostruário</SelectItem>
                      <SelectItem value="OPEN_BOX">Open Box</SelectItem>
                      <SelectItem value="REEMBALADO">Reembalado</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>

                <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end">
                  <Field label="Observação da condição" tooltip="Ex: possui pequenas marcas, caixa aberta, peça de mostruário.">
                    <Input
                      value={form.conditionNotes}
                      onChange={(e) => set("conditionNotes")(e.target.value)}
                      placeholder="Ex: Seminovo em excelente estado, acompanha caixa"
                      className="h-9 text-sm"
                    />
                  </Field>
                  <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/20 px-3 py-2.5">
                    <div>
                      <p className="text-xs font-medium text-foreground">Peça única</p>
                      <p className="text-[10px] text-muted-foreground">Ideal para usados</p>
                    </div>
                    <Switch checked={form.isUniquePiece} onCheckedChange={(v) => set("isUniquePiece")(v)} />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <Field label="Descrição curta" tooltip="Aparece nos cards da vitrine (máx. 120 caracteres)">
                  <Input
                    value={form.shortDescription}
                    onChange={(e) => set("shortDescription")(e.target.value)}
                    placeholder="Breve descrição atrativa"
                    className="h-9 text-sm"
                    maxLength={120}
                  />
                </Field>

                <Field label="Descrição completa">
                  <Textarea
                    value={form.description}
                    onChange={(e) => set("description")(e.target.value)}
                    placeholder="Descrição detalhada do produto..."
                    rows={5}
                    className="text-sm resize-none"
                  />
                </Field>
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-md border border-border bg-muted/20 mt-4">
                <div>
                  <p className="text-sm font-medium text-foreground">Publicado na vitrine</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Produto visível ao público</p>
                </div>
                <Switch
                  checked={form.published}
                  onCheckedChange={(v) => set("published")(v)}
                />
              </div>

              {/* Galeria */}
              <div className="mt-4">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {isEditing ? "Galeria de imagens" : "Imagens pré-seleção (após criar)"}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={handleSuggestWithAi}
                    disabled={suggestAiMutation.isPending || (!form.name.trim() && pendingImages.length === 0 && !String((productQuery.data as any)?.imageUrl ?? "").trim())}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    {suggestAiMutation.isPending ? "Analisando..." : "Preencher com IA"}
                  </Button>
                </div>
                {isEditing && productId ? (
                  <ImageGallery productId={productId} />
                ) : pendingPreviews.length > 0 ? (
                  <div className="flex gap-2 flex-wrap">
                    {pendingPreviews.map((src, i) => (
                      <img key={i} src={src} alt="" className="w-16 h-16 object-cover rounded-md border border-border" />
                    ))}
                  </div>
                ) : (
                  <label className="flex items-center justify-center border border-dashed border-border rounded-md h-20 cursor-pointer hover:border-primary/40 transition-colors bg-muted/10">
                    <span className="text-xs text-muted-foreground">Clique para selecionar imagens</span>
                    <input type="file" accept="image/*" multiple className="hidden" onChange={handlePendingImageSelect} />
                  </label>
                )}
              </div>
            </SectionCard>

            {/* 2. CUSTOS & ESTOQUE */}
            <SectionCard>
              <SectionHeader
                icon={<DollarSign className="w-4 h-4" />}
                title="Custos & Estoque"
                subtitle="Preço de custo, compatibilidade com produtos antigos e controle de estoque"
              />

              <div className="flex items-start gap-2.5 p-3 rounded-md border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-950/20 mb-4">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                    Compatibilidade com produtos antigos
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                    Para novos produtos, cadastre custo, quantidade e custo operacional em
                    <strong> Entrada de Produtos</strong>. Estes campos continuam ativos aqui
                    para produtos antigos e para não quebrar edições já existentes.
                  </p>
                </div>
              </div>

              {costContext && (
                <div className="mb-4 rounded-md border border-primary/20 bg-primary/5 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                        {costSourceLabel(costContext.source)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {costContext.source === "LEGACY"
                          ? "Produto ainda sem entrada/lote vinculado. Use a regularização inicial para gerar custo real detalhado."
                          : `Entrada #${costContext.batchId ?? "—"} · item #${costContext.batchItemId ?? "—"}`}
                      </p>
                    </div>
                    <span className="rounded-full bg-background px-3 py-1 text-xs font-semibold text-primary border border-primary/20">
                      Custo real: {formatCurrency(costContext.realUnitCost)}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
                    <div className="rounded bg-background/70 p-2">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Base BRL</p>
                      <p className="text-sm font-semibold">{formatCurrency(costContext.unitCostBrl)}</p>
                    </div>
                    <div className="rounded bg-background/70 p-2">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Operacional un.</p>
                      <p className="text-sm font-semibold">{formatCurrency(costContext.operationalCostPerUnit)}</p>
                    </div>
                    <div className="rounded bg-background/70 p-2">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Imp./outros un.</p>
                      <p className="text-sm font-semibold">{formatCurrency(costContext.taxCostPerUnit + costContext.otherCostPerUnit)}</p>
                    </div>
                    <div className="rounded bg-background/70 p-2">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Qtd disponível</p>
                      <p className="text-sm font-semibold">{Math.trunc(costContext.quantityAvailable || 0)}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Seletor de moeda */}
              <div className="flex items-center gap-3 p-3 rounded-md border border-border bg-muted/20 mb-4">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Moeda:</span>
                <div className="flex gap-1.5">
                  {(["BRL", "USD"] as const).map((c) => (
                    <Button
                      key={c}
                      variant={form.costCurrency === c ? "default" : "outline"}
                      size="sm"
                      onClick={() => set("costCurrency")(c)}
                      className="h-7 px-3 text-xs"
                    >
                      {c}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                {form.costCurrency === "BRL" ? (
                  <Field label="Preço de custo (R$)" required>
                    <NI value={form.costPrice} onChange={set("costPrice") as any} prefix="R$" placeholder="0,00" />
                  </Field>
                ) : (
                  <>
                    <Field label="Preço em dólar (US$)" required>
                      <NI value={form.costPriceUsd} onChange={set("costPriceUsd") as any} prefix="US$" placeholder="0,00" />
                    </Field>
                    <Field label="Cotação do dólar">
                      <NI value={form.usdExchangeRate} onChange={set("usdExchangeRate") as any} prefix="R$" placeholder="5.50" />
                    </Field>
                    <Field label="Custo em R$ (calculado)">
                      <NI value={costPriceBrl > 0 ? costPriceBrl.toFixed(2) : ""} onChange={() => {}} prefix="R$" disabled />
                    </Field>
                  </>
                )}
                <Field label="Custo de embalagem">
                  <NI value={form.packagingCost} onChange={set("packagingCost") as any} prefix="R$" placeholder="0,00" />
                </Field>
                <Field label="Frete de entrada">
                  <NI value={form.inboundShippingCost} onChange={set("inboundShippingCost") as any} prefix="R$" placeholder="0,00" />
                </Field>
                <Field
                  label="Custo operacional legado"
                  tooltip="Campo mantido para produtos antigos. Para novas compras, informe o custo operacional na Entrada de Produtos."
                  hint="Para novos produtos, use Entrada de Produtos. Este campo permanece para compatibilidade."
                >
                  <NI value={form.operationalCost} onChange={set("operationalCost") as any} prefix="R$" placeholder="0,00" />
                </Field>
              </div>

              {finalUnitCost > 0 && (
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="p-3 rounded-md border border-border bg-muted/20">
                    <p className="text-xs text-muted-foreground mb-1">Custo em BRL</p>
                    <p className="text-base font-semibold text-foreground">{formatCurrency(costPriceBrl)}</p>
                  </div>
                  <div className="p-3 rounded-md border border-primary/20 bg-primary/5">
                    <p className="text-xs text-muted-foreground mb-1">Custo Final Unitário</p>
                    <p className="text-base font-semibold text-primary">{formatCurrency(finalUnitCost)}</p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
                <Field label="Estoque atual">
                  <NI value={form.stockQuantity} onChange={set("stockQuantity") as any} placeholder="0" />
                </Field>
                <Field label="Estoque mínimo" tooltip="Alerta de reposição">
                  <NI value={form.minimumStock} onChange={set("minimumStock") as any} placeholder="0" />
                </Field>
              </div>
            </SectionCard>

            {/* 3. MARGEM DE LUCRO */}
            <SectionCard>
              <SectionHeader
                icon={<BarChart2 className="w-4 h-4" />}
                title="Margem de Lucro Desejada"
                subtitle="Percentual ou valor absoluto de margem sobre o custo unitário"
              />

              <div className="flex gap-1.5 mb-4">
                {(["PERCENT", "VALUE", "MANUAL"] as const).map((m) => (
                  <Button
                    key={m}
                    variant={form.marginMode === m ? "default" : "outline"}
                    size="sm"
                    onClick={() => set("marginMode")(m)}
                    className="h-8 text-xs"
                  >
                    {m === "PERCENT" ? "Porcentagem (%)" : m === "VALUE" ? "Valor (R$)" : "Preço manual"}
                  </Button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                {form.marginMode === "PERCENT" ? (
                  <Field label="Margem desejada (%)" required>
                    <NI value={form.desiredMarginRate} onChange={set("desiredMarginRate") as any} suffix="%" placeholder="30" />
                  </Field>
                ) : form.marginMode === "VALUE" ? (
                  <Field label="Margem em valor (R$)" required>
                    <NI value={form.desiredMarginValue} onChange={set("desiredMarginValue") as any} prefix="R$" placeholder="0,00" />
                  </Field>
                ) : (
                  <Field label="Preço manual de venda (R$)" required>
                    <NI value={form.manualSalePrice} onChange={set("manualSalePrice") as any} prefix="R$" placeholder="0,00" />
                  </Field>
                )}
                <Field label={form.marginMode === "MANUAL" ? "Markup sobre custo" : "Margem efetiva"}>
                  <NI value={effectiveMarginRate.toFixed(2)} onChange={() => {}} suffix="%" disabled />
                </Field>
              </div>

              {form.marginMode === "MANUAL" && manualPricing && (
                <div className={`mb-4 flex items-start gap-2.5 p-3 rounded-md border ${manualPricing.isLoss ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300" : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300"}`}>
                  {manualPricing.isLoss ? <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> : <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />}
                  <div className="text-xs leading-relaxed">
                    <p className="font-semibold">
                      {manualPricing.isLoss
                        ? `Este preço gera prejuízo de ${formatCurrency(Math.abs(manualPricing.profitValue))} por unidade.`
                        : `Lucro estimado de ${formatCurrency(manualPricing.profitValue)} por unidade.`}
                    </p>
                    <p>
                      Margem sobre venda: {formatPercent(manualPricing.profitPercentOnSale)} · Markup sobre custo: {formatPercent(manualPricing.markupPercentOnCost)}
                    </p>
                  </div>
                </div>
              )}

              {/* Aviso fonte única de taxas */}
              <div className="flex items-start gap-2.5 p-3 rounded-md border border-border bg-muted/30">
                <Settings2 className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-foreground">Taxas & Impostos — Configurações Globais</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Fiscal, Boleto e Cartão são gerenciados em{" "}
                    <a href="/configuracoes-pagamento" className="text-primary hover:underline transition-colors">
                      Configurações → Pagamento
                    </a>
                    {globalSettings.data && (
                      <span className="text-muted-foreground ml-1">
                        · Regime atual: {globalSettings.data.taxRegime ?? "SIMPLES_NACIONAL"}
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </SectionCard>

            {/* 4. OBSERVAÇÕES INTERNAS */}
            <SectionCard>
              <SectionHeader
                icon={<StickyNote className="w-4 h-4" />}
                title="Observações Internas"
                subtitle="Notas privadas — não aparecem na vitrine"
              />
              <Textarea
                value={form.notes}
                onChange={(e) => set("notes")(e.target.value)}
                placeholder="Notas internas (não aparecem na vitrine)..."
                rows={3}
                className="text-sm resize-none"
              />
            </SectionCard>
          </div>

          {/* ── PAINEL DO SIMULADOR (coluna direita) ─────────────────────── */}
          <div className="lg:sticky lg:top-[60px] rounded-lg border border-border bg-card overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-0.5">Simulador de Lucro</p>
              <h2 className="text-sm font-semibold text-foreground">Painel de Precificação</h2>
            </div>

            <div className="px-5 py-4 space-y-4 overflow-y-auto" style={{ maxHeight: "calc(100vh - 120px)" }}>

              {/* Resumo de custo */}
              {finalUnitCost > 0 ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-3 rounded-md border border-border bg-muted/20">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Custo BRL</p>
                      <p className="text-sm font-semibold text-foreground">{formatCurrency(costPriceBrl)}</p>
                    </div>
                    <div className="p-3 rounded-md border border-primary/20 bg-primary/5">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Custo Final</p>
                      <p className="text-sm font-semibold text-primary">{formatCurrency(finalUnitCost)}</p>
                    </div>
                  </div>

                  {/* Margem no simulador */}
                  <div className="p-3 space-y-3 rounded-md border border-border bg-muted/10">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Margem Desejada</p>
                    <div className="flex gap-1.5">
                      {(["PERCENT", "VALUE", "MANUAL"] as const).map((m) => (
                        <Button
                          key={m}
                          variant={form.marginMode === m ? "default" : "outline"}
                          size="sm"
                          onClick={() => set("marginMode")(m)}
                          className="flex-1 h-7 text-xs"
                        >
                          {m === "PERCENT" ? "%" : m === "VALUE" ? "R$" : "Manual"}
                        </Button>
                      ))}
                    </div>
                    {form.marginMode === "PERCENT" ? (
                      <NI value={form.desiredMarginRate} onChange={set("desiredMarginRate") as any} suffix="%" placeholder="30" />
                    ) : form.marginMode === "VALUE" ? (
                      <NI value={form.desiredMarginValue} onChange={set("desiredMarginValue") as any} prefix="R$" placeholder="0,00" />
                    ) : (
                      <NI value={form.manualSalePrice} onChange={set("manualSalePrice") as any} prefix="R$" placeholder="0,00" />
                    )}
                    {form.marginMode !== "MANUAL" && effectiveMarginRate > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Margem efetiva:{" "}
                        <span className="text-emerald-500 font-semibold">{effectiveMarginRate.toFixed(1)}%</span>
                      </p>
                    )}
                    {form.marginMode === "MANUAL" && manualPricing && (
                      <div className="space-y-1 text-xs text-muted-foreground">
                        <p>Lucro/prejuízo: <span className={manualPricing.isLoss ? "text-red-500 font-semibold" : "text-emerald-500 font-semibold"}>{formatCurrency(manualPricing.profitValue)}</span></p>
                        <p>Margem venda: <span className={manualPricing.isLoss ? "text-red-500 font-semibold" : "text-emerald-500 font-semibold"}>{formatPercent(manualPricing.profitPercentOnSale)}</span></p>
                        <p>Markup custo: <span className={manualPricing.isLoss ? "text-red-500 font-semibold" : "text-emerald-500 font-semibold"}>{formatPercent(manualPricing.markupPercentOnCost)}</span></p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 space-y-3">
                  <Calculator className="w-8 h-8 text-muted-foreground/30 mx-auto" />
                  <p className="text-xs text-muted-foreground">
                    Informe o custo do produto para ativar o simulador
                  </p>
                </div>
              )}

              {/* Erro de cálculo */}
              {calcError && (
                <div className="flex items-start gap-2 p-3 rounded-md border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/20">
                  <AlertCircle className="w-3.5 h-3.5 text-red-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-red-600 dark:text-red-400">{calcError}</p>
                </div>
              )}

              {/* Botão calcular */}
              {finalUnitCost > 0 && (
                <Button
                  onClick={handleCalculate}
                  disabled={globalSettings.isLoading}
                  className="w-full gap-2"
                  size="sm"
                >
                  <RefreshCcw className="w-3.5 h-3.5" /> Calcular Preços
                </Button>
              )}

              {/* Resultado manual */}
              {form.marginMode === "MANUAL" && manualPricing && (
                <div className={`rounded-md border p-3.5 ${manualPricing.isLoss ? "border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/20" : "border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/20"}`}>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Preço Manual</p>
                  <p className="text-xl font-bold text-foreground mb-2">{formatCurrency(manualPricing.salePrice)}</p>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between"><span className="text-muted-foreground">Custo real:</span><span>{formatCurrency(finalUnitCost)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Lucro/prejuízo:</span><span className={manualPricing.isLoss ? "text-red-500 font-semibold" : "text-emerald-500 font-semibold"}>{formatCurrency(manualPricing.profitValue)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Margem sobre venda:</span><span>{formatPercent(manualPricing.profitPercentOnSale)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Markup sobre custo:</span><span>{formatPercent(manualPricing.markupPercentOnCost)}</span></div>
                  </div>
                </div>
              )}

              {/* Resultados */}
              {pricingResult && (
                <div className="space-y-2.5">
                  <div className="border-t border-border pt-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                      Preços Sugeridos
                    </p>
                  </div>
                  {pricingResult.results.map((r) => (
                    <ResultCard
                      key={r.method}
                      result={r}
                      isBest={r.method === pricingResult.bestMethod}
                    />
                  ))}
                  <div className="pt-2 border-t border-border">
                    <p className="text-xs text-muted-foreground">
                      Margem real (PIX):{" "}
                      <span className="text-emerald-500 font-semibold">
                        {formatPercent(pricingResult.results.find((r) => r.method === "PIX")?.realMarginRate ?? 0)}
                      </span>
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Footer: publicar */}
            <div className="px-5 py-4 border-t border-border space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Publicar na Vitrine</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Visível ao público</p>
                </div>
                <Switch
                  checked={form.published}
                  onCheckedChange={(v) => set("published")(v)}
                />
              </div>
              <Button
                onClick={handleSave}
                disabled={isSaving}
                className="w-full gap-2"
              >
                <Save className="w-4 h-4" />
                {isSaving ? "Salvando..." : isEditing || selectedExistingProductId ? "Salvar Alterações" : "Criar & Publicar"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={aiDialogOpen} onOpenChange={setAiDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Revisar sugestão da IA</DialogTitle>
            <DialogDescription>
              Compare os valores sugeridos com o formulário e marque apenas os campos que deseja aplicar.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {aiSuggestion && AI_FIELDS.map((field) => {
              const suggestedValue = String(aiSuggestion[field] ?? "");
              const currentValue = String(field === "category" ? form.category : form[field]);
              return (
                <div key={field} className="rounded-md border border-border p-3 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-foreground">{AI_FIELD_LABELS[field]}</p>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id={`ai-${field}`}
                        checked={aiSelections[field]}
                        onCheckedChange={(checked) => setAiSelections((prev) => ({ ...prev, [field]: checked === true }))}
                      />
                      <Label htmlFor={`ai-${field}`} className="text-xs text-muted-foreground cursor-pointer">
                        Usar esta sugestão
                      </Label>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="rounded-md bg-primary/5 border border-primary/15 p-3">
                      <p className="text-[10px] uppercase tracking-wider text-primary mb-1">Sugestão da IA</p>
                      <p className="text-sm text-foreground whitespace-pre-wrap break-words">{suggestedValue || "—"}</p>
                    </div>
                    <div className="rounded-md bg-muted/30 border border-border p-3">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Valor atual</p>
                      <p className="text-sm text-foreground whitespace-pre-wrap break-words">{currentValue || "—"}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setAiDialogOpen(false)}>Cancelar</Button>
            <Button type="button" onClick={applyAiSuggestion} disabled={!Object.values(aiSelections).some(Boolean)}>
              Aplicar selecionados
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
