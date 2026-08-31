import { useState, useCallback, useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  calculatePricing,
  isPricingError,
  SUGGESTED_TAX_RATES,
  TAX_REGIME_LABELS,
  PAYMENT_METHOD_LABELS,
  formatCurrency,
  formatPercent,
  type PricingInput,
  type PricingResult,
  type ProductCategory,
  type TaxRegime,
  type PaymentMethod,
  type PaymentResult,
} from "../../../shared/pricingCalculator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertTriangle,
  Calculator,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Info,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Tag,
  CreditCard,
  Banknote,
  Smartphone,
  Star,
  RefreshCcw,
  Save,
  FileDown,
  Minus,
  Plus,
} from "lucide-react";

// ─── Tipos auxiliares ─────────────────────────────────────────────────────────

interface FormState {
  productName: string;
  category: ProductCategory;
  ncm: string;
  costCurrency: "BRL" | "USD";
  costPrice: string; // Preço em BRL
  costPriceUsd: string; // Preço em USD
  usdExchangeRate: string; // Cotação
  packagingCost: string;
  inboundShippingCost: string;
  operationalCost: string;
  desiredMarginRate: string;
  taxRegime: TaxRegime;
  taxCash: string;
  taxBoleto: string;
  taxDebit: string;
  taxCreditCash: string;
  taxCreditInstallment: string;
  boletoMonths: string;
  boletoMonthlyRate: string;
  boletoFixedFee: string;
  boletoDefaultRisk: string;
  boletoCustomerPaysInterest: boolean;
  cardDebitFee: string;
  cardCreditCashFee: string;
  cardCreditInstallmentFee: string;
  cardInstallments: string;
  cardAnticipationRate: string;
  cardMonthlyRate: string;
  cardCustomerPaysInterest: boolean;
  stockQuantity: string;
  minimumStock: string;
}

const defaultForm: FormState = {
  productName: "",
  category: "CELULAR",
  ncm: "",
  costCurrency: "BRL",
  costPrice: "",
  costPriceUsd: "",
  usdExchangeRate: "5.50",
  packagingCost: "0",
  inboundShippingCost: "0",
  operationalCost: "0",
  desiredMarginRate: "30",
  taxRegime: "SIMPLES_NACIONAL",
  taxCash: "6",
  taxBoleto: "6",
  taxDebit: "6",
  taxCreditCash: "6",
  taxCreditInstallment: "6",
  boletoMonths: "3",
  boletoMonthlyRate: "2",
  boletoFixedFee: "3.50",
  boletoDefaultRisk: "3",
  boletoCustomerPaysInterest: false,
  cardDebitFee: "1.5",
  cardCreditCashFee: "2.5",
  cardCreditInstallmentFee: "3.5",
  cardInstallments: "6",
  cardAnticipationRate: "1.5",
  cardMonthlyRate: "1.99",
  cardCustomerPaysInterest: false,
  stockQuantity: "0",
  minimumStock: "0",
};

const pricingDefaultFields = [
  "taxRegime",
  "taxCash",
  "taxBoleto",
  "taxDebit",
  "taxCreditCash",
  "taxCreditInstallment",
  "boletoMonths",
  "boletoMonthlyRate",
  "boletoFixedFee",
  "boletoDefaultRisk",
  "boletoCustomerPaysInterest",
  "cardDebitFee",
  "cardCreditCashFee",
  "cardCreditInstallmentFee",
  "cardInstallments",
  "cardAnticipationRate",
  "cardMonthlyRate",
  "cardCustomerPaysInterest",
] as const;

type PricingDefaultsPayload = Pick<FormState, (typeof pricingDefaultFields)[number]>;

function pickPricingDefaults(form: FormState): PricingDefaultsPayload {
  return {
    taxRegime: form.taxRegime,
    taxCash: form.taxCash,
    taxBoleto: form.taxBoleto,
    taxDebit: form.taxDebit,
    taxCreditCash: form.taxCreditCash,
    taxCreditInstallment: form.taxCreditInstallment,
    boletoMonths: form.boletoMonths,
    boletoMonthlyRate: form.boletoMonthlyRate,
    boletoFixedFee: form.boletoFixedFee,
    boletoDefaultRisk: form.boletoDefaultRisk,
    boletoCustomerPaysInterest: form.boletoCustomerPaysInterest,
    cardDebitFee: form.cardDebitFee,
    cardCreditCashFee: form.cardCreditCashFee,
    cardCreditInstallmentFee: form.cardCreditInstallmentFee,
    cardInstallments: form.cardInstallments,
    cardAnticipationRate: form.cardAnticipationRate,
    cardMonthlyRate: form.cardMonthlyRate,
    cardCustomerPaysInterest: form.cardCustomerPaysInterest,
  };
}

function normalizePricingDefaults(value: unknown): Partial<PricingDefaultsPayload> {
  if (!value || typeof value !== "object") return {};
  const source = value as Partial<Record<keyof PricingDefaultsPayload, unknown>>;
  const out: Partial<PricingDefaultsPayload> = {};

  for (const field of pricingDefaultFields) {
    const raw = source[field];
    if (raw === undefined || raw === null) continue;
    if (field === "boletoCustomerPaysInterest" || field === "cardCustomerPaysInterest") {
      out[field] = Boolean(raw) as never;
    } else {
      out[field] = String(raw) as never;
    }
  }

  if (
    out.taxRegime &&
    !["SIMPLES_NACIONAL", "LUCRO_PRESUMIDO", "LUCRO_REAL", "MANUAL"].includes(out.taxRegime)
  ) {
    delete out.taxRegime;
  }

  return out;
}


// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseNum(val: string): number {
  if (!val) return 0;
  const n = parseFloat(val.replace(",", "."));
  return isNaN(n) ? 0 : n;
}

function diagnosticConfig(status: string) {
  switch (status) {
    case "SAUDAVEL":
      return {
        color: "bg-success/10 text-success border-success/30",
        icon: <CheckCircle2 className="w-3.5 h-3.5" />,
        dot: "bg-success",
      };
    case "ATENCAO":
      return {
        color: "bg-warning/10 text-warning-foreground border-warning/30",
        icon: <AlertCircle className="w-3.5 h-3.5" />,
        dot: "bg-warning",
      };
    case "RISCO":
      return {
        color: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/20 dark:text-orange-400 dark:border-orange-800/30",
        icon: <AlertTriangle className="w-3.5 h-3.5" />,
        dot: "bg-orange-500",
      };
    case "PREJUIZO":
      return {
        color: "bg-danger/10 text-danger border-danger/30",
        icon: <XCircle className="w-3.5 h-3.5" />,
        dot: "bg-danger",
      };
    default:
      return {
        color: "bg-muted text-muted-foreground border-border",
        icon: null,
        dot: "bg-muted-foreground",
      };
  }
}

function methodIcon(method: PaymentMethod) {
  switch (method) {
    case "PIX":
      return <Sparkles className="w-4 h-4" />;
    case "BOLETO":
      return <Banknote className="w-4 h-4" />;
    case "DEBITO":
      return <CreditCard className="w-4 h-4" />;
    case "CREDITO_A_VISTA":
      return <CreditCard className="w-4 h-4" />;
    case "CREDITO_PARCELADO":
      return <Tag className="w-4 h-4" />;
  }
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function SectionTitle({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex items-start gap-3 mb-5">
      <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
        {icon}
      </div>
      <div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
        )}
      </div>
    </div>
  );
}

function FormField({
  label,
  tooltip,
  children,
  required,
}: {
  label: string;
  tooltip?: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Label className="text-xs font-medium text-foreground/80">
          {label}
          {required && <span className="text-danger ml-0.5">*</span>}
        </Label>
        {tooltip && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="w-3 h-3 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs text-xs">{tooltip}</TooltipContent>
          </Tooltip>
        )}
      </div>
      {children}
    </div>
  );
}

function NumericInput({
  value,
  onChange,
  placeholder,
  prefix,
  suffix,
  min,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  prefix?: string;
  suffix?: string;
  min?: number;
}) {
  return (
    <div className="relative flex items-center">
      {prefix && (
        <span className="absolute left-3 text-xs text-muted-foreground font-medium pointer-events-none">
          {prefix}
        </span>
      )}
      <Input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "0"}
        min={min}
        step="any"
        className={`h-9 text-sm ${prefix ? "pl-8" : ""} ${suffix ? "pr-8" : ""}`}
      />
      {suffix && (
        <span className="absolute right-3 text-xs text-muted-foreground font-medium pointer-events-none">
          {suffix}
        </span>
      )}
    </div>
  );
}

function ResultCard({
  result,
  isBest,
  isWorst,
}: {
  result: PaymentResult;
  isBest: boolean;
  isWorst: boolean;
}) {
  const diag = diagnosticConfig(result.diagnostic);

  return (
    <div
      className={`relative rounded-xl border bg-card p-5 transition-all duration-200 ${
        isBest
          ? "border-success/50 shadow-md shadow-success/10 ring-1 ring-success/20"
          : isWorst
          ? "border-danger/30 opacity-80"
          : "border-border hover:border-primary/30 hover:shadow-sm"
      }`}
    >
      {isBest && (
        <div className="absolute -top-2.5 left-4">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-success text-success-foreground shadow-sm">
            <Star className="w-3 h-3 fill-current" /> Melhor opção
          </span>
        </div>
      )}
      {isWorst && (
        <div className="absolute -top-2.5 left-4">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
            Menor margem
          </span>
        </div>
      )}

      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            {methodIcon(result.method)}
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{result.methodLabel}</p>
            {result.installments > 1 && (
              <p className="text-xs text-muted-foreground">
                {result.installments}x de {formatCurrency(result.installmentValue)}
              </p>
            )}
          </div>
        </div>
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${diag.color}`}
        >
          {diag.icon}
          {result.diagnostic}
        </span>
      </div>

      <div className="space-y-1">
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold text-foreground tracking-tight">
            {formatCurrency(result.suggestedPrice)}
          </span>
        </div>

      </div>

      <div className="mt-4 pt-4 border-t border-border space-y-2">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Preço de Custo:</span>
          <span className="font-medium">{formatCurrency(result.baseCost)}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Margem de Lucro:</span>
          <span className="font-medium text-success">+{formatCurrency(result.marginValue)}</span>
        </div>
        <div className="flex justify-between text-xs border-t border-dashed pt-1">
          <span className="font-semibold">Subtotal (Custo + Margem):</span>
          <span className="font-semibold">{formatCurrency(result.subtotalWithMargin)}</span>
        </div>
        
        <div className="pt-2 space-y-1">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Despesas Adicionais</p>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Impostos:</span>
            <span className="font-medium">{formatCurrency(result.totalTax)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Taxas/Juros:</span>
            <span className="font-medium">{formatCurrency(result.totalFees + result.totalInterest)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Outros Custos:</span>
            <span className="font-medium">{formatCurrency(result.otherCosts)}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
          <div>
            <p className="text-xs text-muted-foreground">Lucro líquido</p>
            <p className={`text-sm font-semibold ${result.netProfit >= 0 ? "text-success" : "text-danger"}`}>
              {formatCurrency(result.netProfit)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Lucro Bruto</p>
            <p className="text-sm font-semibold text-foreground">
              {formatPercent(result.realMarginRate)}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-border">
        <p className="text-xs text-muted-foreground">
          Mín. sem prejuízo:{" "}
          <span className="font-medium text-foreground">
            {formatCurrency(result.minPriceNoLoss)}
          </span>
        </p>
      </div>
    </div>
  );
}

// ─── Componente Principal ─────────────────────────────────────────────────────

export default function PricingSimulator() {
  const [form, setForm] = useState<FormState>(defaultForm);
  const [result, setResult] = useState<PricingResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showBoleto, setShowBoleto] = useState(true);
  const [showCard, setShowCard] = useState(true);
  const [simulationName, setSimulationName] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [pdfQty, setPdfQty] = useState(1); // quantidade para o PDF/orçamento
  const [defaultsApplied, setDefaultsApplied] = useState(false);
  const [location, setLocation] = useLocation();
  const { user } = useAuth();
  const searchParams = new URLSearchParams(location.split("?")[1] || "");
  const productId = searchParams.get("productId");

  const productsQuery = trpc.products.list.useQuery(undefined, {
    enabled: !!user,
    retry: false,
  });
  const productByIdQuery = trpc.products.byId.useQuery(
    { id: Number(productId) },
    { enabled: !!productId && !!user }
  );

  const pricingDefaultsQuery = trpc.settings.getPricingDefaults.useQuery(undefined, {
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });
  const updatePricingDefaults = trpc.settings.updatePricingDefaults.useMutation();

  const utils = trpc.useUtils();
  const saveSimulation = trpc.simulations.create.useMutation({
    onSuccess: () => {
      utils.simulations.list.invalidate();
      setSimulationName("");
      setIsSaving(false);
    },
  });

  const applyPricingDefaultsToForm = useCallback((defaults: unknown) => {
    const normalized = normalizePricingDefaults(defaults);
    setForm((prev) => ({ ...prev, ...normalized }));
  }, []);

  useEffect(() => {
    if (!productId && !defaultsApplied && pricingDefaultsQuery.data) {
      applyPricingDefaultsToForm(pricingDefaultsQuery.data);
      setDefaultsApplied(true);
    }
  }, [productId, defaultsApplied, pricingDefaultsQuery.data, applyPricingDefaultsToForm]);

  const handleSavePricingDefaults = useCallback(async () => {
    try {
      await updatePricingDefaults.mutateAsync(pickPricingDefaults(form));
      await utils.settings.getPricingDefaults.invalidate();
      setError(null);
    } catch (err: any) {
      setError(err?.message || "Não foi possível salvar os padrões de taxa.");
    }
  }, [form, updatePricingDefaults, utils.settings.getPricingDefaults]);

  const handleRestorePricingDefaults = useCallback(async () => {
    try {
      const restored = pickPricingDefaults(defaultForm);
      setForm((prev) => ({ ...prev, ...restored }));
      await updatePricingDefaults.mutateAsync(restored);
      await utils.settings.getPricingDefaults.invalidate();
      setError(null);
    } catch (err: any) {
      setError(err?.message || "Não foi possível restaurar os padrões.");
    }
  }, [updatePricingDefaults, utils.settings.getPricingDefaults]);

  const handleApplySuggestedTaxes = useCallback(() => {
    const rates = SUGGESTED_TAX_RATES[form.taxRegime];
    setForm((prev) => ({
      ...prev,
      taxCash: String(rates.cash),
      taxBoleto: String(rates.boleto),
      taxDebit: String(rates.debit),
      taxCreditCash: String(rates.creditCash),
      taxCreditInstallment: String(rates.creditInstallment),
    }));
  }, [form.taxRegime]);

  // Preencher formulário se houver um produto selecionado via URL
  useEffect(() => {
    if (productByIdQuery.data) {
      const p = productByIdQuery.data;
      setForm((prev) => ({
        ...prev,
        productName: p.name,
        category: p.category as ProductCategory,
        ncm: p.ncm || "",
        costCurrency: (p.costCurrency as "BRL" | "USD") || "BRL",
        costPrice: String(p.costPrice || ""),
        costPriceUsd: String(p.costPriceUsd || ""),
        usdExchangeRate: String(p.usdExchangeRate || "5.50"),
        packagingCost: String(p.packagingCost || "0"),
        inboundShippingCost: String(p.inboundShippingCost || "0"),
        operationalCost: String(p.operationalCost || "0"),
        desiredMarginRate: String(p.desiredMarginRate || "30"),
        taxRegime: (p.taxRegime as TaxRegime) || prev.taxRegime,
        taxCash: (p as any).taxCash != null ? String((p as any).taxCash) : prev.taxCash,
        taxBoleto: (p as any).taxBoleto != null ? String((p as any).taxBoleto) : prev.taxBoleto,
        taxDebit: (p as any).taxDebit != null ? String((p as any).taxDebit) : prev.taxDebit,
        taxCreditCash: (p as any).taxCreditCash != null ? String((p as any).taxCreditCash) : prev.taxCreditCash,
        taxCreditInstallment: (p as any).taxCreditInstallment != null ? String((p as any).taxCreditInstallment) : prev.taxCreditInstallment,
        boletoMonths: (p as any).boletoMonths != null ? String((p as any).boletoMonths) : prev.boletoMonths,
        boletoMonthlyRate: (p as any).boletoMonthlyRate != null ? String((p as any).boletoMonthlyRate) : prev.boletoMonthlyRate,
        boletoFixedFee: (p as any).boletoFixedFee != null ? String((p as any).boletoFixedFee) : prev.boletoFixedFee,
        boletoDefaultRisk: (p as any).boletoDefaultRisk != null ? String((p as any).boletoDefaultRisk) : prev.boletoDefaultRisk,
        boletoCustomerPaysInterest: (p as any).boletoCustomerPaysInterest ?? prev.boletoCustomerPaysInterest,
        cardDebitFee: (p as any).cardDebitFee != null ? String((p as any).cardDebitFee) : prev.cardDebitFee,
        cardCreditCashFee: (p as any).cardCreditCashFee != null ? String((p as any).cardCreditCashFee) : prev.cardCreditCashFee,
        cardCreditInstallmentFee: (p as any).cardCreditInstallmentFee != null ? String((p as any).cardCreditInstallmentFee) : prev.cardCreditInstallmentFee,
        cardInstallments: (p as any).cardInstallments != null ? String((p as any).cardInstallments) : prev.cardInstallments,
        cardAnticipationRate: (p as any).cardAnticipationRate != null ? String((p as any).cardAnticipationRate) : prev.cardAnticipationRate,
        cardMonthlyRate: (p as any).cardMonthlyRate != null ? String((p as any).cardMonthlyRate) : prev.cardMonthlyRate,
        cardCustomerPaysInterest: (p as any).cardCustomerPaysInterest ?? prev.cardCustomerPaysInterest,
        stockQuantity: String(p.stockQuantity || "0"),
        minimumStock: String(p.minimumStock || "0"),
      }));
    }
  }, [productByIdQuery.data]);

  const set = useCallback(
    (field: keyof FormState) => (value: string | boolean) => {
      setForm((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const handleTaxRegimeChange = useCallback(
    (regime: TaxRegime) => {
      // Não sobrescreve taxas configuradas; use o botão explícito para aplicar sugestões.
      setForm((prev) => ({ ...prev, taxRegime: regime }));
    },
    []
  );

  // Calcular custo em BRL derivado
  const derivedCostPriceBrl = useMemo(() => {
    if (form.costCurrency === "USD") {
      return parseNum(form.costPriceUsd) * parseNum(form.usdExchangeRate);
    }
    return parseNum(form.costPrice);
  }, [form.costCurrency, form.costPrice, form.costPriceUsd, form.usdExchangeRate]);

  // Calcular custo final unitário
  const derivedFinalUnitCostBrl = useMemo(() => {
    return derivedCostPriceBrl + 
           parseNum(form.packagingCost) + 
           parseNum(form.inboundShippingCost) + 
           parseNum(form.operationalCost);
  }, [derivedCostPriceBrl, form.packagingCost, form.inboundShippingCost, form.operationalCost]);

  const handleCalculate = useCallback(() => {
    setError(null);
    setResult(null);

    if (!form.productName.trim()) {
      setError("Informe o nome do produto.");
      return;
    }

    if (form.costCurrency === "USD") {
      if (parseNum(form.costPriceUsd) < 0) {
        setError("O preço em dólar não pode ser negativo.");
        return;
      }
      if (parseNum(form.usdExchangeRate) <= 0) {
        setError("A cotação do dólar deve ser maior que zero.");
        return;
      }
    } else {
      if (parseNum(form.costPrice) < 0) {
        setError("O preço de custo não pode ser negativo.");
        return;
      }
    }

    if (parseNum(form.stockQuantity) < 0 || parseNum(form.minimumStock) < 0) {
      setError("Os valores de estoque não podem ser negativos.");
      return;
    }

    const input: PricingInput = {
      productName: form.productName.trim(),
      category: form.category,
      ncm: form.ncm.trim() || undefined,
      costPrice: derivedCostPriceBrl,
      packagingCost: parseNum(form.packagingCost),
      inboundShippingCost: parseNum(form.inboundShippingCost),
      operationalCost: parseNum(form.operationalCost),
      desiredMarginRate: parseNum(form.desiredMarginRate),
      taxRegime: form.taxRegime,
      taxRates: {
        cash: parseNum(form.taxCash),
        boleto: parseNum(form.taxBoleto),
        debit: parseNum(form.taxDebit),
        creditCash: parseNum(form.taxCreditCash),
        creditInstallment: parseNum(form.taxCreditInstallment),
      },
      boleto: {
        months: Math.max(1, Math.round(parseNum(form.boletoMonths))),
        monthlyInterestRate: parseNum(form.boletoMonthlyRate),
        fixedFee: parseNum(form.boletoFixedFee),
        defaultRiskRate: parseNum(form.boletoDefaultRisk),
        customerPaysInterest: form.boletoCustomerPaysInterest,
      },
      card: {
        debitFeeRate: parseNum(form.cardDebitFee),
        creditCashFeeRate: parseNum(form.cardCreditCashFee),
        creditInstallmentFeeRate: parseNum(form.cardCreditInstallmentFee),
        installments: Math.max(1, Math.round(parseNum(form.cardInstallments))),
        anticipationRate: parseNum(form.cardAnticipationRate),
        monthlyInterestRate: parseNum(form.cardMonthlyRate),
        customerPaysInterest: form.cardCustomerPaysInterest,
      },
    };

    const calc = calculatePricing(input);

    if (isPricingError(calc)) {
      setError(calc.message);
      return;
    }

    setResult(calc);
    setTimeout(() => {
      document.getElementById("results-section")?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  }, [form, derivedCostPriceBrl]);

  const handleReset = useCallback(() => {
    setForm({
      ...defaultForm,
      ...normalizePricingDefaults(pricingDefaultsQuery.data),
    });
    setResult(null);
    setError(null);
  }, [pricingDefaultsQuery.data]);

  // ─── Exportar PDF da simulação atual ───────────────────────────────────────
  const exportSimulationPDF = useCallback(() => {
    if (!result) return;

    const qty = Math.max(1, pdfQty);
    const fmt = (v: number) => (v * qty).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    const fmtU = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    const fmtPct = (v: number) => `${(v * 100).toFixed(2)}%`;
    const now = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

    const DIAG_COLOR: Record<string, string> = {
      EXCELENTE: "#059669", SAUDAVEL: "#16a34a", ATENCAO: "#ca8a04",
      RISCO: "#ea580c", PREJUIZO: "#dc2626",
    };
    const DIAG_BG: Record<string, string> = {
      EXCELENTE: "#ecfdf5", SAUDAVEL: "#f0fdf4", ATENCAO: "#fefce8",
      RISCO: "#fff7ed", PREJUIZO: "#fef2f2",
    };

    const diagBadge = (d: string) => {
      const c = DIAG_COLOR[d] ?? "#555"; const bg = DIAG_BG[d] ?? "#f5f5f5";
      return `<span style="padding:2px 10px;border-radius:20px;font-size:10px;font-weight:700;background:${bg};color:${c};border:1px solid ${c}40">${d}</span>`;
    };

    const METHOD_ICON: Record<string, string> = {
      PIX: "⚡", BOLETO: "📄", DEBITO: "💳", CREDITO_A_VISTA: "💳", CREDITO_PARCELADO: "💳",
    };

    const cardsHtml = result.results.map((r) => {
      const isBest  = r.method === result.bestMethod;
      const isWorst = r.method === result.worstMethod;
      return `
      <div style="flex:1;min-width:200px;border:2px solid ${isBest ? "#16a34a" : isWorst ? "#e5e5e5" : "#e5e5e5"};border-radius:12px;padding:18px;background:${isBest ? "#f0fdf4" : "#fafafa"};position:relative;page-break-inside:avoid">
        ${isBest ? `<div style="position:absolute;top:-12px;left:12px;background:#16a34a;color:#fff;font-size:10px;font-weight:700;padding:3px 10px;border-radius:20px">★ Melhor opção</div>` : ""}
        ${isWorst ? `<div style="position:absolute;top:-12px;left:12px;background:#e5e5e5;color:#555;font-size:10px;padding:3px 10px;border-radius:20px">Menor margem</div>` : ""}

        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <div>
            <div style="font-size:13px;font-weight:700;color:#111">${METHOD_ICON[r.method] ?? ""} ${r.methodLabel}</div>
            ${r.installments > 1 ? `<div style="font-size:10px;color:#888">${r.installments}x de ${fmtU(r.installmentValue)}</div>` : ""}
          </div>
          ${diagBadge(r.diagnostic)}
        </div>

        <!-- Preço unitário -->
        <div style="margin-bottom:4px">
          <div style="font-size:10px;color:#aaa;text-transform:uppercase;letter-spacing:0.08em">Preço unitário</div>
          <div style="font-size:22px;font-weight:800;color:#111;letter-spacing:-0.03em">${fmtU(r.suggestedPrice)}</div>
        </div>

        <!-- Preço total se qty > 1 -->
        ${qty > 1 ? `
        <div style="margin-bottom:10px;background:#fff;border:1px solid #e5e5e5;border-radius:6px;padding:6px 10px">
          <div style="font-size:10px;color:#aaa">Total × ${qty} unidades</div>
          <div style="font-size:16px;font-weight:700;color:#111">${fmt(r.suggestedPrice)}</div>
        </div>` : "<div style='margin-bottom:10px'></div>"}

        <table style="width:100%;font-size:10px;color:#666;border-collapse:collapse">
          <tr><td style="padding:2px 0">Preço de Custo</td><td style="text-align:right;color:#111;font-weight:600">${fmtU(r.baseCost)}</td></tr>
          <tr><td style="padding:2px 0">Margem de Lucro</td><td style="text-align:right;color:#16a34a;font-weight:600">+${fmtU(r.marginValue)}</td></tr>
          <tr style="border-top:1px dashed #eee"><td style="padding:4px 0;font-weight:700;color:#111">Subtotal</td><td style="text-align:right;font-weight:700;color:#111">${fmtU(r.subtotalWithMargin)}</td></tr>
          <tr><td style="padding-top:6px;font-size:9px;font-weight:700;color:#aaa;text-transform:uppercase;letter-spacing:0.08em" colspan="2">Despesas Adicionais</td></tr>
          <tr><td style="padding:2px 0">Impostos</td><td style="text-align:right">${fmtU(r.totalTax)}</td></tr>
          <tr><td style="padding:2px 0">Taxas/Juros</td><td style="text-align:right">${fmtU(r.totalFees + r.totalInterest)}</td></tr>
          ${r.otherCosts > 0 ? `<tr><td style="padding:2px 0">Outros Custos</td><td style="text-align:right">${fmtU(r.otherCosts)}</td></tr>` : ""}
          <tr style="border-top:1px solid #e5e5e5">
            <td style="padding:6px 0;font-weight:700;color:${r.netProfit >= 0 ? "#16a34a" : "#dc2626"}">Lucro Líquido</td>
            <td style="text-align:right;font-weight:700;color:${r.netProfit >= 0 ? "#16a34a" : "#dc2626"}">${fmtU(r.netProfit)}</td>
          </tr>
          <tr>
            <td style="padding:2px 0;color:#666">Lucro Bruto</td>
            <td style="text-align:right;font-weight:600">${fmtPct(r.realMarginRate)}</td>
          </tr>
          <tr style="border-top:1px dashed #eee"><td style="padding:4px 0;color:#888">Mín. sem prejuízo</td><td style="text-align:right;color:#555">${fmtU(r.minPriceNoLoss)}</td></tr>
        </table>
      </div>`;
    }).join("");

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Simulação — ${result.input.productName}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', Arial, sans-serif; color: #111; background: #fff; font-size: 12px; }
  @page { size: A4 landscape; margin: 14mm 14mm 14mm 14mm; }
  @media print {
    .no-print { display: none !important; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>

<!-- HEADER -->
<div style="display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:16px;border-bottom:3px solid #111;margin-bottom:20px">
  <div>
    <div style="font-size:10px;font-weight:700;color:#aaa;text-transform:uppercase;letter-spacing:0.12em;margin-bottom:4px">Simulação de Precificação</div>
    <div style="font-size:24px;font-weight:800;color:#111;letter-spacing:-0.03em">${result.input.productName}</div>
    <div style="font-size:11px;color:#888;margin-top:4px">
      Categoria: ${result.input.category} · Regime: ${result.input.taxRegime}
    </div>
  </div>
  <div style="text-align:right">
    <div style="font-size:10px;color:#aaa">Emitido em</div>
    <div style="font-size:13px;font-weight:600">${now}</div>
  </div>
</div>

<!-- KPIs -->
<div style="display:flex;gap:14px;margin-bottom:20px;flex-wrap:wrap">
  ${[
    { label: "Preço de Custo (unit.)", value: fmtU(result.totalCost) },
    { label: "Margem Desejada",        value: fmtPct(result.input.desiredMarginRate) },
    { label: "Melhor Forma",           value: PAYMENT_METHOD_LABELS[result.bestMethod] ?? result.bestMethod },
    qty > 1 ? { label: `Custo Total (×${qty})`, value: fmt(result.totalCost) } : null,
    qty > 1 ? { label: `Preço Venda Total (×${qty})`, value: fmt(result.results.find(r => r.method === result.bestMethod)?.suggestedPrice ?? 0) } : null,
  ].filter(Boolean).map((k: any) => `
    <div style="flex:1;min-width:130px;border:1px solid #e5e5e5;border-radius:8px;padding:12px 16px">
      <div style="font-size:9px;font-weight:700;color:#aaa;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px">${k.label}</div>
      <div style="font-size:16px;font-weight:800;color:#111;letter-spacing:-0.02em">${k.value}</div>
    </div>
  `).join("")}
</div>

<!-- CARDS DE PAGAMENTO -->
<div style="font-size:9px;font-weight:700;color:#aaa;text-transform:uppercase;letter-spacing:0.12em;margin-bottom:10px">Formas de Pagamento</div>
<div style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-start">
  ${cardsHtml}
</div>

<!-- NOTA FISCAL -->
<div style="margin-top:20px;padding:10px 14px;border:1px solid #e5e5e5;border-radius:8px;font-size:9px;color:#aaa">
  <strong style="color:#888">Nota:</strong> Cálculo estimativo. Confirme NCM, CST/CSOSN, CFOP, ICMS-ST, PIS/COFINS e regime tributário com seu contador.
  ${qty > 1 ? ` · Valores "Total" calculados para ${qty} unidades.` : ""}
</div>

<!-- BOTÃO IMPRIMIR -->
<div class="no-print" style="position:fixed;bottom:20px;right:20px;display:flex;gap:8px">
  <button onclick="window.print()" style="background:#111;color:#fff;border:none;padding:10px 22px;font-size:13px;font-weight:600;cursor:pointer;border-radius:8px">
    🖨️ Salvar / Imprimir PDF
  </button>
  <button onclick="window.close()" style="background:#f0f0f0;color:#555;border:none;padding:10px 16px;font-size:13px;cursor:pointer;border-radius:8px">
    Fechar
  </button>
</div>

</body>
</html>`;

    const win = window.open("", "_blank", "width=1100,height=720,scrollbars=yes");
    if (!win) { alert("Permita popups para gerar o PDF"); return; }
    win.document.write(html);
    win.document.close();
  }, [result, pdfQty]);

  const handleSaveSimulation = useCallback(async () => {
    if (!result) return;
    
    // Verificar se usuário está logado
    if (!user) {
      setError("Faça login para salvar produtos e simulações.");
      return;
    }
    
    if (!simulationName.trim()) {
      setError("Informe um nome para a simulação.");
      return;
    }
    setIsSaving(true);
    try {
      const bestResult = result.results.find((r) => r.method === result.bestMethod);
      await saveSimulation.mutateAsync({
        name: simulationName.trim(),
        productSnapshot: {
          ...result.input,
          costCurrency: form.costCurrency,
          costPriceUsd: parseNum(form.costPriceUsd),
          usdExchangeRate: parseNum(form.usdExchangeRate),
          stockQuantity: parseNum(form.stockQuantity),
          minimumStock: parseNum(form.minimumStock),
          finalUnitCostBrl: derivedFinalUnitCostBrl,
        },
        taxSnapshot: result.input.taxRates,
        paymentSnapshot: result.input.card,
        resultSnapshot: result,
        bestPaymentMethod: result.bestMethod,
        worstPaymentMethod: result.worstMethod,
        recommendedPrice: bestResult?.suggestedPrice || 0,
        minimumBreakEvenPrice: result.promotionMinPrice,
        promotionFloorPrice: result.promotionMinPrice,
        desiredMarginRate: result.input.desiredMarginRate,
        diagnosis: bestResult?.diagnostic || "SAUDAVEL",
      });
      setError(null);
    } catch (err: any) {
      setError(err.message || "Erro ao salvar simulação.");
      setIsSaving(false);
    }
  }, [result, simulationName, saveSimulation, form, derivedFinalUnitCostBrl, user]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur-sm">
        <div className="container">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <Calculator className="w-4 h-4 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-sm font-bold text-foreground tracking-tight">
                  Ideal Prime
                </h1>
                <p className="text-xs text-muted-foreground hidden sm:block">
                  Simulador de Precificação — Distrito Federal
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs hidden sm:flex">
                <Smartphone className="w-3 h-3 mr-1" />
                DF · 2026
              </Badge>
            </div>
          </div>
        </div>
      </header>

      <main className="container py-8">
        <div className="max-w-7xl mx-auto">
          {/* Título da página */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-foreground tracking-tight">
              Simulador de Precificação
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Calcule o preço ideal por forma de pagamento, suportando custos em dólar e controle de estoque.
            </p>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-8">
            {/* ─── Coluna esquerda: Formulário ─── */}
            <div className="space-y-6">
              {/* Dados do Produto */}
              <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
                <SectionTitle
                  icon={<Tag className="w-4 h-4" />}
                  title="Dados do Produto"
                  subtitle="Informações básicas e custos de aquisição"
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <FormField label="Nome do produto" required>
                      <Input
                        value={form.productName}
                        onChange={(e) => set("productName")(e.target.value)}
                        placeholder="Ex: iPhone 15 Pro 256GB"
                        className="h-9 text-sm"
                      />
                    </FormField>
                  </div>
                  <FormField label="Categoria" required>
                    <Select
                      value={form.category}
                      onValueChange={(v) => set("category")(v as ProductCategory)}
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CELULAR">Celular</SelectItem>
                        <SelectItem value="ELETRONICO">Eletrônico</SelectItem>
                        <SelectItem value="PERFUME">Perfume</SelectItem>
                        <SelectItem value="OUTRO">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormField>
                  <FormField
                    label="NCM (opcional)"
                    tooltip="Nomenclatura Comum do Mercosul. Consulte seu contador para confirmar."
                  >
                    <Input
                      value={form.ncm}
                      onChange={(e) => set("ncm")(e.target.value)}
                      placeholder="Ex: 8517.12.31"
                      className="h-9 text-sm font-mono"
                    />
                  </FormField>

                  {/* Moeda e Custos */}
                  <FormField label="Moeda de Custo" required>
                    <Select
                      value={form.costCurrency}
                      onValueChange={(v) => set("costCurrency")(v as "BRL" | "USD")}
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="BRL">Real (BRL)</SelectItem>
                        <SelectItem value="USD">Dólar (USD)</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormField>

                  {form.costCurrency === "BRL" ? (
                    <FormField label="Preço de custo (BRL)" required>
                      <NumericInput
                        value={form.costPrice}
                        onChange={set("costPrice")}
                        prefix="R$"
                        placeholder="0,00"
                        min={0}
                      />
                    </FormField>
                  ) : (
                    <>
                      <FormField label="Preço de custo (USD)" required>
                        <NumericInput
                          value={form.costPriceUsd}
                          onChange={set("costPriceUsd")}
                          prefix="$"
                          placeholder="0,00"
                          min={0}
                        />
                      </FormField>
                      <FormField label="Cotação do Dólar (Manual)" required>
                        <NumericInput
                          value={form.usdExchangeRate}
                          onChange={set("usdExchangeRate")}
                          prefix="R$"
                          placeholder="5,50"
                          min={0.01}
                        />
                      </FormField>
                    </>
                  )}

                  {/* Custos adicionais */}
                  <FormField
                    label="Custo de embalagem"
                    tooltip="Caixas, plástico bolha, fita, etc."
                  >
                    <NumericInput
                      value={form.packagingCost}
                      onChange={set("packagingCost")}
                      prefix="R$"
                      placeholder="0,00"
                      min={0}
                    />
                  </FormField>
                  <FormField
                    label="Frete de compra"
                    tooltip="Custo de frete para adquirir o produto."
                  >
                    <NumericInput
                      value={form.inboundShippingCost}
                      onChange={set("inboundShippingCost")}
                      prefix="R$"
                      placeholder="0,00"
                      min={0}
                    />
                  </FormField>
                  <FormField
                    label="Custo operacional"
                    tooltip="Custo fixo rateado por venda (aluguel, energia, mão de obra, etc.)."
                  >
                    <NumericInput
                      value={form.operationalCost}
                      onChange={set("operationalCost")}
                      prefix="R$"
                      placeholder="0,00"
                      min={0}
                    />
                  </FormField>
                  <FormField
                    label="Margem líquida desejada"
                    required
                    tooltip="Percentual de lucro líquido sobre o preço de venda que você deseja obter."
                  >
                    <NumericInput
                      value={form.desiredMarginRate}
                      onChange={set("desiredMarginRate")}
                      suffix="%"
                      placeholder="30"
                      min={0}
                    />
                  </FormField>

                  {/* Estoque */}
                  <FormField label="Estoque Atual">
                    <NumericInput
                      value={form.stockQuantity}
                      onChange={set("stockQuantity")}
                      placeholder="0"
                      min={0}
                    />
                  </FormField>
                  <FormField label="Estoque Mínimo">
                    <NumericInput
                      value={form.minimumStock}
                      onChange={set("minimumStock")}
                      placeholder="0"
                      min={0}
                    />
                  </FormField>
                </div>

                {/* Resumo de Custo Convertido e Final */}
                <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className='bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800/30'>
                    <p className='text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider'>Custo em Real (BRL)</p>
                    <p className='text-lg font-bold text-blue-900 dark:text-blue-100 tabular-nums'>{formatCurrency(derivedCostPriceBrl)}</p>
                  </div>
                  <div className='bg-green-50 dark:bg-green-950/20 p-3 rounded-lg border border-green-200 dark:border-green-800/30'>
                    <p className='text-[10px] font-bold text-green-600 dark:text-green-400 uppercase tracking-wider'>Custo Final Unitário (BRL)</p>
                    <p className='text-lg font-bold text-green-900 dark:text-green-100 tabular-nums'>{formatCurrency(derivedFinalUnitCostBrl)}</p>
                  </div>
                </div>
              </div>

              {/* Campos Fiscais */}
              <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
                <SectionTitle
                  icon={<AlertTriangle className="w-4 h-4" />}
                  title="Configuração Fiscal"
                  subtitle="Regime tributário e alíquotas por forma de pagamento"
                />

                <div className="mb-5 flex gap-3 p-3.5 rounded-lg bg-warning/10 border border-warning/30">
                  <AlertTriangle className="w-4 h-4 text-warning mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-warning-foreground leading-relaxed">
                    <strong>Aviso fiscal:</strong> Alíquotas sugeridas automaticamente. Confirme com seu contador antes de usar em operações reais.
                  </p>
                </div>

                <div className="space-y-4">
                  <FormField label="Regime tributário">
                    <Select
                      value={form.taxRegime}
                      onValueChange={(v) => handleTaxRegimeChange(v as TaxRegime)}
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(TAX_REGIME_LABELS) as TaxRegime[]).map((key) => (
                          <SelectItem key={key} value={key}>
                            {TAX_REGIME_LABELS[key]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormField>

                  <div className="flex flex-col sm:flex-row gap-2 rounded-lg border bg-muted/20 p-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleSavePricingDefaults}
                      disabled={updatePricingDefaults.isPending}
                      className="h-8 text-xs"
                    >
                      <Save className="w-3.5 h-3.5 mr-1.5" />
                      Salvar estes valores como padrão
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleRestorePricingDefaults}
                      disabled={updatePricingDefaults.isPending}
                      className="h-8 text-xs"
                    >
                      <RefreshCcw className="w-3.5 h-3.5 mr-1.5" />
                      Restaurar padrão
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleApplySuggestedTaxes}
                      className="h-8 text-xs"
                    >
                      Aplicar taxas sugeridas do regime
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    {[
                      { label: "Pix / À Vista", field: "taxCash" as const },
                      { label: "Boleto", field: "taxBoleto" as const },
                      { label: "Débito", field: "taxDebit" as const },
                      { label: "Crédito à Vista", field: "taxCreditCash" as const },
                      { label: "Crédito Parcelado", field: "taxCreditInstallment" as const },
                    ].map(({ label, field }) => (
                      <FormField key={field} label={label}>
                        <NumericInput
                          value={form[field]}
                          onChange={set(field)}
                          suffix="%"
                          min={0}
                        />
                      </FormField>
                    ))}
                  </div>
                </div>
              </div>

              {/* Configurações Avançadas */}
              <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="w-full flex items-center justify-between p-6 text-left hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                      <CreditCard className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        Configurações de Boleto e Cartão
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Taxas, juros, parcelas e opções de repasse
                      </p>
                    </div>
                  </div>
                  {showAdvanced ? (
                    <ChevronUp className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  )}
                </button>

                {showAdvanced && (
                  <div className="px-6 pb-6 space-y-6 border-t border-border">
                    {/* Boleto */}
                    <div className="pt-5">
                      <button
                        type="button"
                        onClick={() => setShowBoleto(!showBoleto)}
                        className="flex items-center gap-2 mb-4 text-sm font-semibold text-foreground hover:text-primary transition-colors"
                      >
                        <Banknote className="w-4 h-4" />
                        Boleto Bancário
                        {showBoleto ? (
                          <ChevronUp className="w-3.5 h-3.5 ml-auto" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 ml-auto" />
                        )}
                      </button>
                      {showBoleto && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                          <FormField label="Meses">
                            <NumericInput
                              value={form.boletoMonths}
                              onChange={set("boletoMonths")}
                              min={1}
                            />
                          </FormField>
                          <FormField label="Juros mensal">
                            <NumericInput
                              value={form.boletoMonthlyRate}
                              onChange={set("boletoMonthlyRate")}
                              suffix="%"
                            />
                          </FormField>
                          <FormField label="Taxa fixa">
                            <NumericInput
                              value={form.boletoFixedFee}
                              onChange={set("boletoFixedFee")}
                              prefix="R$"
                              min={0}
                            />
                          </FormField>
                          <FormField label="Inadimplência">
                            <NumericInput
                              value={form.boletoDefaultRisk}
                              onChange={set("boletoDefaultRisk")}
                              suffix="%"
                              min={0}
                            />
                          </FormField>
                          <div className="col-span-2 sm:col-span-3">
                            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border">
                              <div>
                                <p className="text-xs font-medium text-foreground">Juros repassado ao cliente</p>
                              </div>
                              <Switch
                                checked={form.boletoCustomerPaysInterest}
                                onCheckedChange={(v) => set("boletoCustomerPaysInterest")(v)}
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Cartão */}
                    <div className="pt-2 border-t border-border">
                      <button
                        type="button"
                        onClick={() => setShowCard(!showCard)}
                        className="flex items-center gap-2 mb-4 mt-4 text-sm font-semibold text-foreground hover:text-primary transition-colors"
                      >
                        <CreditCard className="w-4 h-4" />
                        Cartão de Crédito e Débito
                        {showCard ? (
                          <ChevronUp className="w-3.5 h-3.5 ml-auto" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 ml-auto" />
                        )}
                      </button>
                      {showCard && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                          <FormField label="Taxa débito">
                            <NumericInput
                              value={form.cardDebitFee}
                              onChange={set("cardDebitFee")}
                              suffix="%"
                              min={0}
                            />
                          </FormField>
                          <FormField label="Taxa crédito vista">
                            <NumericInput
                              value={form.cardCreditCashFee}
                              onChange={set("cardCreditCashFee")}
                              suffix="%"
                              min={0}
                            />
                          </FormField>
                          <FormField label="Taxa parcelado">
                            <NumericInput
                              value={form.cardCreditInstallmentFee}
                              onChange={set("cardCreditInstallmentFee")}
                              suffix="%"
                              min={0}
                            />
                          </FormField>
                          <FormField label="Parcelas">
                            <NumericInput
                              value={form.cardInstallments}
                              onChange={set("cardInstallments")}
                              min={1}
                            />
                          </FormField>
                          <FormField label="Antecipação">
                            <NumericInput
                              value={form.cardAnticipationRate}
                              onChange={set("cardAnticipationRate")}
                              suffix="%"
                              min={0}
                            />
                          </FormField>
                          <FormField label="Juros mensal">
                            <NumericInput
                              value={form.cardMonthlyRate}
                              onChange={set("cardMonthlyRate")}
                              suffix="%"
                              min={0}
                            />
                          </FormField>
                          <div className="col-span-2 sm:col-span-3">
                            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border">
                              <div>
                                <p className="text-xs font-medium text-foreground">Empresa absorve juros</p>
                              </div>
                              <Switch
                                checked={form.cardCustomerPaysInterest}
                                onCheckedChange={(v) => set("cardCustomerPaysInterest")(v)}
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Botões de ação */}
              <div className="flex gap-3">
                <Button
                  onClick={handleCalculate}
                  className="flex-1 h-11 text-sm font-semibold shadow-sm"
                >
                  <Calculator className="w-4 h-4 mr-2" />
                  Calcular Preços
                </Button>
                <Button
                  variant="outline"
                  onClick={handleReset}
                  className="h-11 px-5 text-sm"
                >
                  Limpar
                </Button>
              </div>

              {/* Erro de validação */}
              {error && (
                <div className="flex gap-3 p-4 rounded-lg bg-danger/10 border border-danger/30">
                  <XCircle className="w-4 h-4 text-danger mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-danger">{error}</p>
                </div>
              )}
            </div>

            {/* ─── Coluna direita: Resumo de custos ─── */}
            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-card p-5 shadow-sm sticky top-20">
                <h3 className="text-sm font-semibold text-foreground mb-4">
                  Resumo de Custos (BRL)
                </h3>
                <div className="space-y-2.5">
                  {[
                    { label: "Preço de custo", value: derivedCostPriceBrl },
                    { label: "Embalagem", value: parseNum(form.packagingCost) },
                    { label: "Frete de compra", value: parseNum(form.inboundShippingCost) },
                    { label: "Custo operacional", value: parseNum(form.operationalCost) },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{label}</span>
                      <span className="text-xs font-medium text-foreground tabular-nums">
                        {formatCurrency(value)}
                      </span>
                    </div>
                  ))}
                  <div className="pt-2 mt-2 border-t border-border flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground">
                      Custo total
                    </span>
                    <span className="text-sm font-bold text-primary tabular-nums">
                      {formatCurrency(derivedFinalUnitCostBrl)}
                    </span>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-border">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Margem desejada</span>
                    <span className="text-xs font-semibold text-foreground">{form.desiredMarginRate || "0"}%</span>
                  </div>
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-xs text-muted-foreground">Estoque Atual</span>
                    <span className={`text-xs font-medium tabular-nums ${parseNum(form.stockQuantity) <= parseNum(form.minimumStock) ? "text-danger" : "text-foreground"}`}>
                      {form.stockQuantity || "0"}
                    </span>
                  </div>
                </div>

                <div className="mt-4 p-3 rounded-lg bg-muted/50 border border-border">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Clique em <strong className="text-foreground">Calcular Preços</strong> para ver a simulação completa.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ─── Resultados ─── */}
          {result && (
            <div id="results-section" className="mt-10 space-y-8">
              {/* Alerta de produto não saudável */}
              {result.hasUnhealthyProduct && result.unhealthyAlert && (
                <div className="flex gap-3 p-4 rounded-xl bg-danger/10 border border-danger/30">
                  <AlertTriangle className="w-5 h-5 text-danger mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-danger">Produto com margem crítica</p>
                    <p className="text-sm text-danger/80 mt-0.5">{result.unhealthyAlert}</p>
                  </div>
                </div>
              )}

              {/* Cabeçalho dos resultados */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-foreground tracking-tight">
                    Resultados — {result.input.productName}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Custo total: <strong className="text-foreground">{formatCurrency(result.totalCost)}</strong> · 
                    Margem desejada: <strong className="text-foreground">{formatPercent(result.input.desiredMarginRate)}</strong>
                  </p>
                </div>
                <div className="flex gap-2">
                   <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5 text-success" />
                      Melhor: {PAYMENT_METHOD_LABELS[result.bestMethod]}
                    </div>
                  </div>
                </div>
              </div>

              {/* Cards de resultado */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                {result.results.map((r) => (
                  <ResultCard
                    key={r.method}
                    result={r}
                    isBest={r.method === result.bestMethod}
                    isWorst={r.method === result.worstMethod}
                  />
                ))}
              </div>

              {/* Salvar Simulação */}
              <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
                {!user ? (
                  <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">Faça login para salvar simulações</p>
                      <p className="text-xs text-muted-foreground mt-1">Crie uma conta ou entre para salvar suas simulações e acessar o histórico.</p>
                    </div>
                    <Button
                      onClick={() => setLocation(`/login?redirect=${encodeURIComponent(location)}`)}
                      className="w-full sm:w-auto h-10 px-8"
                    >
                      Entrar agora
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row gap-4 items-end">
                    <div className="flex-1 w-full space-y-1.5">
                      <Label className="text-xs font-medium">Nome da simulação para salvar</Label>
                      <Input
                        value={simulationName}
                        onChange={(e) => setSimulationName(e.target.value)}
                        placeholder="Ex: iPhone 15 Pro - Lote Março"
                        className="h-10"
                      />
                    </div>
                    <Button
                      onClick={handleSaveSimulation}
                      disabled={isSaving}
                      className="w-full sm:w-auto h-10 px-8"
                  >
                    {isSaving ? (
                      <RefreshCcw className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Sparkles className="w-4 h-4 mr-2" />
                      )}
                      Salvar Simulação
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
