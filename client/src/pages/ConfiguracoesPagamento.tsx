/**
 * ConfiguracoesPagamento.tsx — Configurações Globais de Pagamento
 *
 * REGRAS DE NEGÓCIO:
 * 1. PIX = sempre isento de imposto (taxCash = 0, campo bloqueado, UI explica).
 * 2. Descontos universais independentes por forma de pagamento.
 * 3. Lucro líquido real: impostos e taxas embutidos de forma retroativa no preço
 *    final — nunca descontados da margem do lojista.
 * 4. Modo view/edit: campos travados até clicar em "Editar".
 * 5. Links e plataforma globais: defaults para novos produtos (podem ser
 *    sobrescritos individualmente por produto).
 *
 * Seções:
 *  A. Regime & Alíquotas Fiscais
 *  B. Descontos Universais por Forma de Pagamento
 *  C. Configuração de Cartão (Débito / Crédito)
 *  D. Configuração de Boleto
 *  E. Pagamentos Externos (plataforma, links globais)
 */

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  Lock, Unlock, Save, Loader2, Info, CreditCard,
  FileText, Zap, Banknote, Percent, ShieldCheck,
  AlertCircle, Link2,
} from "lucide-react";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";

// ── Helpers ───────────────────────────────────────────────────────────────────

function n(v: string): number {
  const p = parseFloat(v.replace(",", "."));
  return isNaN(p) ? 0 : p;
}

const TAX_REGIME_LABELS: Record<string, string> = {
  SIMPLES_NACIONAL: "Simples Nacional",
  LUCRO_PRESUMIDO: "Lucro Presumido",
  LUCRO_REAL: "Lucro Real",
  MANUAL: "Manual (alíquotas livres)",
};

const PAYMENT_PLATFORM_LABELS: Record<string, string> = {
  MERCADO_PAGO: "Mercado Pago",
  PAGSEGURO: "PagSeguro",
  OUTRO: "Outro",
};

// ── Sub-componentes ───────────────────────────────────────────────────────────

function Field({
  label, hint, required, tooltip, children,
}: {
  label: string; hint?: string; required?: boolean;
  tooltip?: string; children: React.ReactNode;
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

function NumInput({
  value, onChange, suffix, prefix, disabled, placeholder, locked,
}: {
  value: string; onChange: (v: string) => void;
  suffix?: string; prefix?: string; disabled?: boolean;
  placeholder?: string; locked?: boolean;
}) {
  const isDisabled = disabled || locked;
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
        disabled={isDisabled}
        className={`h-9 text-sm ${prefix ? "pl-8" : ""} ${suffix ? "pr-8" : ""} ${isDisabled ? "opacity-50 cursor-not-allowed" : ""}`}
      />
      {suffix && (
        <span className="absolute right-3 text-xs text-muted-foreground pointer-events-none font-mono">
          {suffix}
        </span>
      )}
    </div>
  );
}

function TextInput({
  value, onChange, disabled, placeholder,
}: {
  value: string; onChange: (v: string) => void;
  disabled?: boolean; placeholder?: string;
}) {
  return (
    <Input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder ?? ""}
      disabled={disabled}
      className={`h-9 text-sm ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
    />
  );
}

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      {children}
    </div>
  );
}

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

// ── Estado do formulário ──────────────────────────────────────────────────────

interface FormState {
  // Fiscal
  taxRegime: string;
  taxBoleto: string;
  taxDebit: string;
  taxCreditCash: string;
  taxCreditInstallment: string;
  // Cartão
  cardDebitFee: string;
  cardCreditCashFee: string;
  cardCreditInstallmentFee: string;
  cardInstallments: string;
  cardAnticipationRate: string;
  cardMonthlyRate: string;
  cardCustomerPaysInterest: boolean;
  // Boleto
  boletoMonths: string;
  boletoMonthlyRate: string;
  boletoFixedFee: string;
  boletoDefaultRisk: string;
  boletoCustomerPaysInterest: boolean;
  // Descontos universais
  discountPix: string;
  discountCash: string;
  discountBoleto: string;
  discountDebit: string;
  discountCredit: string;
  // Links e plataforma globais
  paymentPlatform: string;
  pixKey: string;
  pixLink: string;
  cardPaymentUrl: string;
  boletoUrl: string;
}

const EMPTY_FORM: FormState = {
  taxRegime: "SIMPLES_NACIONAL",
  taxBoleto: "6",
  taxDebit: "6",
  taxCreditCash: "6",
  taxCreditInstallment: "6",
  cardDebitFee: "1.5",
  cardCreditCashFee: "2.5",
  cardCreditInstallmentFee: "3.5",
  cardInstallments: "6",
  cardAnticipationRate: "1.5",
  cardMonthlyRate: "1.99",
  cardCustomerPaysInterest: false,
  boletoMonths: "3",
  boletoMonthlyRate: "1.99",
  boletoFixedFee: "3.50",
  boletoDefaultRisk: "2",
  boletoCustomerPaysInterest: false,
  discountPix: "0",
  discountCash: "0",
  discountBoleto: "0",
  discountDebit: "0",
  discountCredit: "0",
  paymentPlatform: "MERCADO_PAGO",
  pixKey: "",
  pixLink: "",
  cardPaymentUrl: "",
  boletoUrl: "",
};

function dataToForm(data: Record<string, unknown>): FormState {
  const s = (k: string, fallback: string) =>
    data[k] != null ? String(data[k]) : fallback;
  const b = (k: string) => Boolean(data[k]);
  return {
    taxRegime: s("taxRegime", "SIMPLES_NACIONAL"),
    taxBoleto: s("taxBoleto", "6"),
    taxDebit: s("taxDebit", "6"),
    taxCreditCash: s("taxCreditCash", "6"),
    taxCreditInstallment: s("taxCreditInstallment", "6"),
    cardDebitFee: s("cardDebitFee", "1.5"),
    cardCreditCashFee: s("cardCreditCashFee", "2.5"),
    cardCreditInstallmentFee: s("cardCreditInstallmentFee", "3.5"),
    cardInstallments: s("cardInstallments", "6"),
    cardAnticipationRate: s("cardAnticipationRate", "1.5"),
    cardMonthlyRate: s("cardMonthlyRate", "1.99"),
    cardCustomerPaysInterest: b("cardCustomerPaysInterest"),
    boletoMonths: s("boletoMonths", "3"),
    boletoMonthlyRate: s("boletoMonthlyRate", "1.99"),
    boletoFixedFee: s("boletoFixedFee", "3.50"),
    boletoDefaultRisk: s("boletoDefaultRisk", "2"),
    boletoCustomerPaysInterest: b("boletoCustomerPaysInterest"),
    discountPix: s("discountPix", "0"),
    discountCash: s("discountCash", data["cashDiscountPercent"] != null ? String(data["cashDiscountPercent"]) : "0"),
    discountBoleto: s("discountBoleto", "0"),
    discountDebit: s("discountDebit", "0"),
    discountCredit: s("discountCredit", "0"),
    paymentPlatform: s("paymentPlatform", "MERCADO_PAGO"),
    pixKey: data["pixKey"] != null && data["pixKey"] !== "null" ? String(data["pixKey"]) : "",
    pixLink: data["pixLink"] != null && data["pixLink"] !== "null" ? String(data["pixLink"]) : "",
    cardPaymentUrl: data["cardPaymentUrl"] != null && data["cardPaymentUrl"] !== "null" ? String(data["cardPaymentUrl"]) : "",
    boletoUrl: data["boletoUrl"] != null && data["boletoUrl"] !== "null" ? String(data["boletoUrl"]) : "",
  };
}

// ── Componente Principal ──────────────────────────────────────────────────────

export default function ConfiguracoesPagamento() {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const query = trpc.paymentSettings.get.useQuery();

  useEffect(() => {
    if (query.data && !editing) {
      setForm(dataToForm(query.data as unknown as Record<string, unknown>));
    }
  }, [query.data, editing]);

  const updateMutation = trpc.paymentSettings.update.useMutation({
    onSuccess: () => {
      toast.success("Configurações de pagamento salvas com sucesso!");
      setEditing(false);
      query.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const set = (field: keyof FormState) => (value: string | boolean) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleCancelEdit = () => {
    setEditing(false);
    if (query.data) {
      setForm(dataToForm(query.data as unknown as Record<string, unknown>));
    }
  };

  const handleSave = () => {
    updateMutation.mutate({
      // Fiscal (taxCash/PIX não é enviado — forçado 0 no servidor)
      taxRegime: form.taxRegime as any,
      taxBoleto: n(form.taxBoleto),
      taxDebit: n(form.taxDebit),
      taxCreditCash: n(form.taxCreditCash),
      taxCreditInstallment: n(form.taxCreditInstallment),
      // Cartão
      cardDebitFee: n(form.cardDebitFee),
      cardCreditCashFee: n(form.cardCreditCashFee),
      cardCreditInstallmentFee: n(form.cardCreditInstallmentFee),
      cardInstallments: n(form.cardInstallments),
      cardAnticipationRate: n(form.cardAnticipationRate),
      cardMonthlyRate: n(form.cardMonthlyRate),
      cardCustomerPaysInterest: form.cardCustomerPaysInterest,
      // Boleto
      boletoMonths: n(form.boletoMonths),
      boletoMonthlyRate: n(form.boletoMonthlyRate),
      boletoFixedFee: n(form.boletoFixedFee),
      boletoDefaultRisk: n(form.boletoDefaultRisk),
      boletoCustomerPaysInterest: form.boletoCustomerPaysInterest,
      // Descontos universais
      discountPix: n(form.discountPix),
      discountCash: n(form.discountCash),
      discountBoleto: n(form.discountBoleto),
      discountDebit: n(form.discountDebit),
      discountCredit: n(form.discountCredit),
      // Links e plataforma globais
      paymentPlatform: form.paymentPlatform as any,
      pixKey: form.pixKey || null,
      pixLink: form.pixLink || null,
      cardPaymentUrl: form.cardPaymentUrl || null,
      boletoUrl: form.boletoUrl || null,
    });
  };

  const locked = !editing;

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-3xl">

        {/* ── Cabeçalho da página ──────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Configurações de Pagamento
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Taxas fiscais, tarifas de gateway, descontos globais e links de pagamento padrão.
              Aplicados automaticamente em todos os cálculos de precificação.
            </p>
          </div>

          <div className="shrink-0 flex items-center gap-2">
            {editing && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancelEdit}
              >
                Cancelar
              </Button>
            )}
            {!editing ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditing(true)}
                className="gap-2"
              >
                <Unlock className="w-3.5 h-3.5" />
                Editar
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={handleSave}
                disabled={updateMutation.isPending}
                className="gap-2"
              >
                {updateMutation.isPending
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <Save className="w-3.5 h-3.5" />
                }
                Salvar
              </Button>
            )}
          </div>
        </div>

        {/* Aviso de bloqueio */}
        {locked && (
          <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30">
            <Lock className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="text-sm text-muted-foreground">
              Configurações travadas. Clique em{" "}
              <span className="text-foreground font-medium">Editar</span>{" "}
              para modificar.
            </span>
          </div>
        )}

        {/* ── A. REGIME & ALÍQUOTAS FISCAIS ───────────────────────────── */}
        <SectionCard>
          <SectionHeader
            icon={<ShieldCheck className="w-4 h-4" />}
            title="Configuração Fiscal"
            subtitle="Regime tributário e alíquotas por forma de pagamento"
          />

          {/* PIX isento — aviso fixo */}
          <div className="flex items-start gap-2.5 p-3 rounded-md border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-950/20 mb-5">
            <Zap className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                PIX — ISENTO FISCAL
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                O imposto sobre pagamentos via PIX é sempre{" "}
                <strong className="text-emerald-600 dark:text-emerald-500">zero (0%)</strong>.
                Regra de negócio inegociável — forçada no motor de cálculo.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <Field label="Regime tributário" tooltip="Regime fiscal da empresa. Determina as alíquotas sugeridas.">
              <Select
                value={form.taxRegime}
                onValueChange={set("taxRegime") as (v: string) => void}
                disabled={locked}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TAX_REGIME_LABELS).map(([v, l]) => (
                    <SelectItem key={v} value={v} className="text-sm">
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {/* PIX — bloqueado em 0 */}
            <Field label="PIX (isento)" tooltip="Sempre 0% — isento fiscal por regra de negócio.">
              <div className="relative">
                <Input
                  value="0"
                  disabled
                  className="h-9 text-sm pr-8 opacity-50 cursor-not-allowed text-emerald-600 dark:text-emerald-500"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none font-mono">%</span>
              </div>
            </Field>

            <Field label="Boleto (%)" tooltip="Alíquota de imposto para pagamento via boleto.">
              <NumInput value={form.taxBoleto} onChange={set("taxBoleto") as any} suffix="%" locked={locked} />
            </Field>

            <Field label="Débito (%)" tooltip="Alíquota para cartão de débito.">
              <NumInput value={form.taxDebit} onChange={set("taxDebit") as any} suffix="%" locked={locked} />
            </Field>

            <Field label="Crédito à vista (%)" tooltip="Alíquota para crédito à vista.">
              <NumInput value={form.taxCreditCash} onChange={set("taxCreditCash") as any} suffix="%" locked={locked} />
            </Field>

            <Field label="Crédito parcelado (%)" tooltip="Alíquota para crédito parcelado.">
              <NumInput value={form.taxCreditInstallment} onChange={set("taxCreditInstallment") as any} suffix="%" locked={locked} />
            </Field>
          </div>
        </SectionCard>

        {/* ── B. DESCONTOS UNIVERSAIS ──────────────────────────────────── */}
        <SectionCard>
          <SectionHeader
            icon={<Percent className="w-4 h-4" />}
            title="Descontos Universais por Forma de Pagamento"
            subtitle="Percentual de desconto aplicado no preço final ao cliente por modalidade"
          />

          <div className="flex items-start gap-2.5 p-3 rounded-md border border-border bg-muted/30 mb-5">
            <AlertCircle className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              Os descontos são aplicados{" "}
              <strong className="text-foreground">sobre o preço final calculado</strong>,
              nunca sobre a margem do lojista. Ex: desconto PIX 5% → preço final × 0,95.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            <Field label="PIX (%)" tooltip="Desconto para pagamentos via PIX.">
              <NumInput value={form.discountPix} onChange={set("discountPix") as any} suffix="%" locked={locked} placeholder="0" />
            </Field>
            <Field label="Dinheiro (%)" tooltip="Desconto para pagamento em dinheiro.">
              <NumInput value={form.discountCash} onChange={set("discountCash") as any} suffix="%" locked={locked} placeholder="0" />
            </Field>
            <Field label="Boleto (%)" tooltip="Desconto para pagamento via boleto.">
              <NumInput value={form.discountBoleto} onChange={set("discountBoleto") as any} suffix="%" locked={locked} placeholder="0" />
            </Field>
            <Field label="Débito (%)" tooltip="Desconto para cartão de débito.">
              <NumInput value={form.discountDebit} onChange={set("discountDebit") as any} suffix="%" locked={locked} placeholder="0" />
            </Field>
            <Field label="Crédito (%)" tooltip="Desconto para cartão de crédito.">
              <NumInput value={form.discountCredit} onChange={set("discountCredit") as any} suffix="%" locked={locked} placeholder="0" />
            </Field>
          </div>

          {/* Preview dos descontos ativos */}
          {[
            { label: "PIX", val: n(form.discountPix) },
            { label: "Dinheiro", val: n(form.discountCash) },
            { label: "Boleto", val: n(form.discountBoleto) },
            { label: "Débito", val: n(form.discountDebit) },
            { label: "Crédito", val: n(form.discountCredit) },
          ].filter((d) => d.val > 0).length > 0 && (
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-xs text-muted-foreground mb-2">Descontos ativos</p>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: "PIX", val: n(form.discountPix) },
                  { label: "Dinheiro", val: n(form.discountCash) },
                  { label: "Boleto", val: n(form.discountBoleto) },
                  { label: "Débito", val: n(form.discountDebit) },
                  { label: "Crédito", val: n(form.discountCredit) },
                ]
                  .filter((d) => d.val > 0)
                  .map((d) => (
                    <span
                      key={d.label}
                      className="inline-flex items-center gap-1 rounded-md border border-border bg-muted px-2.5 py-1 text-xs font-medium text-foreground"
                    >
                      {d.label}: −{d.val}%
                    </span>
                  ))}
              </div>
            </div>
          )}
        </SectionCard>

        {/* ── C. CARTÃO ────────────────────────────────────────────────── */}
        <SectionCard>
          <SectionHeader
            icon={<CreditCard className="w-4 h-4" />}
            title="Configuração de Cartão"
            subtitle="Taxas de débito, crédito, parcelamento e antecipação"
          />

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
            <Field label="Taxa débito (%)" tooltip="Taxa cobrada pela adquirente em transações de débito.">
              <NumInput value={form.cardDebitFee} onChange={set("cardDebitFee") as any} suffix="%" locked={locked} />
            </Field>
            <Field label="Taxa crédito à vista (%)" tooltip="Taxa para crédito pago à vista.">
              <NumInput value={form.cardCreditCashFee} onChange={set("cardCreditCashFee") as any} suffix="%" locked={locked} />
            </Field>
            <Field label="Taxa crédito parcelado (%)" tooltip="Taxa para crédito parcelado.">
              <NumInput value={form.cardCreditInstallmentFee} onChange={set("cardCreditInstallmentFee") as any} suffix="%" locked={locked} />
            </Field>
            <Field label="Parcelas" tooltip="Número máximo de parcelas oferecidas ao cliente.">
              <NumInput value={form.cardInstallments} onChange={set("cardInstallments") as any} locked={locked} placeholder="6" />
            </Field>
            <Field label="Taxa antecipação (%)" tooltip="Taxa cobrada pela antecipação dos recebíveis.">
              <NumInput value={form.cardAnticipationRate} onChange={set("cardAnticipationRate") as any} suffix="%" locked={locked} />
            </Field>
            <Field label="Juros mensal (%)" tooltip="Taxa de juros mensais no parcelamento.">
              <NumInput value={form.cardMonthlyRate} onChange={set("cardMonthlyRate") as any} suffix="%" locked={locked} />
            </Field>
          </div>

          <div className="flex items-center justify-between p-3.5 rounded-md border border-border bg-muted/20">
            <div>
              <p className="text-sm font-medium text-foreground">Juros repassado ao cliente</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Se ativado, o cliente absorve os juros do parcelamento
              </p>
            </div>
            <Switch
              checked={form.cardCustomerPaysInterest}
              onCheckedChange={(v) => !locked && set("cardCustomerPaysInterest")(v)}
              disabled={locked}
            />
          </div>
        </SectionCard>

        {/* ── D. BOLETO ────────────────────────────────────────────────── */}
        <SectionCard>
          <SectionHeader
            icon={<FileText className="w-4 h-4" />}
            title="Configuração de Boleto"
            subtitle="Parcelamento, juros, taxa fixa de emissão e risco de inadimplência"
          />

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
            <Field label="Parcelas" tooltip="Número de parcelas do boleto parcelado.">
              <NumInput value={form.boletoMonths} onChange={set("boletoMonths") as any} locked={locked} placeholder="3" />
            </Field>
            <Field label="Juros mensal (%)" tooltip="Taxa de juros mensais sobre o saldo devedor.">
              <NumInput value={form.boletoMonthlyRate} onChange={set("boletoMonthlyRate") as any} suffix="%" locked={locked} />
            </Field>
            <Field label="Taxa fixa emissão (R$)" tooltip="Valor fixo cobrado por emissão de boleto.">
              <NumInput value={form.boletoFixedFee} onChange={set("boletoFixedFee") as any} prefix="R$" locked={locked} />
            </Field>
            <Field label="Risco inadimplência (%)" tooltip="Percentual de estimativa de calote — embutido no preço.">
              <NumInput value={form.boletoDefaultRisk} onChange={set("boletoDefaultRisk") as any} suffix="%" locked={locked} />
            </Field>
          </div>

          <div className="flex items-center justify-between p-3.5 rounded-md border border-border bg-muted/20">
            <div>
              <p className="text-sm font-medium text-foreground">Juros repassado ao cliente</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Se desligado, a empresa absorve os juros no preço final
              </p>
            </div>
            <Switch
              checked={form.boletoCustomerPaysInterest}
              onCheckedChange={(v) => !locked && set("boletoCustomerPaysInterest")(v)}
              disabled={locked}
            />
          </div>
        </SectionCard>

        {/* ── E. PAGAMENTOS EXTERNOS ───────────────────────────────────── */}
        <SectionCard>
          <SectionHeader
            icon={<Link2 className="w-4 h-4" />}
            title="Pagamentos Externos"
            subtitle="Plataforma e links globais padrão — usados automaticamente em novos produtos"
          />

          <div className="flex items-start gap-2.5 p-3 rounded-md border border-border bg-muted/30 mb-5">
            <AlertCircle className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              Estes links são os <strong className="text-foreground">defaults globais</strong> para novos produtos.
              Cada produto pode sobrescrever individualmente seus próprios links na tela de edição.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field
              label="Plataforma de pagamento"
              tooltip="Plataforma padrão usada para processar pagamentos."
            >
              <Select
                value={form.paymentPlatform}
                onValueChange={set("paymentPlatform") as (v: string) => void}
                disabled={locked}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PAYMENT_PLATFORM_LABELS).map(([v, l]) => (
                    <SelectItem key={v} value={v} className="text-sm">
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field
              label="Chave Pix global"
              tooltip="Chave Pix padrão para recebimento. Pode ser CPF, CNPJ, e-mail, telefone ou chave aleatória."
            >
              <TextInput
                value={form.pixKey}
                onChange={set("pixKey") as any}
                disabled={locked}
                placeholder="Ex: contato@empresa.com"
              />
            </Field>

            <Field
              label="Link de pagamento Pix"
              tooltip="URL do link de pagamento Pix gerado pela plataforma."
              hint="Ex: https://mpago.la/..."
            >
              <TextInput
                value={form.pixLink}
                onChange={set("pixLink") as any}
                disabled={locked}
                placeholder="https://"
              />
            </Field>

            <Field
              label="Link de pagamento cartão"
              tooltip="URL do link de pagamento via cartão gerado pela plataforma."
              hint="Ex: https://mpago.la/..."
            >
              <TextInput
                value={form.cardPaymentUrl}
                onChange={set("cardPaymentUrl") as any}
                disabled={locked}
                placeholder="https://"
              />
            </Field>

            <Field
              label="Link de boleto"
              tooltip="URL do link de boleto gerado pela plataforma."
              hint="Ex: https://mpago.la/..."
            >
              <TextInput
                value={form.boletoUrl}
                onChange={set("boletoUrl") as any}
                disabled={locked}
                placeholder="https://"
              />
            </Field>
          </div>
        </SectionCard>

        {/* ── Resumo atual (view mode) ─────────────────────────────────── */}
        {locked && query.data && (
          <div className="rounded-lg border border-border bg-muted/20 p-5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
              Resumo da configuração atual
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "Regime", value: TAX_REGIME_LABELS[form.taxRegime] ?? form.taxRegime },
                { label: "Imposto PIX", value: "0% (isento)" },
                { label: "Imposto Boleto", value: `${form.taxBoleto}%` },
                { label: "Imposto Débito", value: `${form.taxDebit}%` },
                { label: "Imposto Crédito à vista", value: `${form.taxCreditCash}%` },
                { label: "Imposto Crédito parc.", value: `${form.taxCreditInstallment}%` },
                { label: "Taxa débito", value: `${form.cardDebitFee}%` },
                { label: "Taxa crédito à vista", value: `${form.cardCreditCashFee}%` },
                { label: "Taxa crédito parc.", value: `${form.cardCreditInstallmentFee}%` },
                { label: "Parcelas cartão", value: `${form.cardInstallments}×` },
                { label: "Parcelas boleto", value: `${form.boletoMonths}×` },
                { label: "Risco inadimpl.", value: `${form.boletoDefaultRisk}%` },
                { label: "Desconto PIX", value: n(form.discountPix) > 0 ? `−${form.discountPix}%` : "—" },
                { label: "Desconto Dinheiro", value: n(form.discountCash) > 0 ? `−${form.discountCash}%` : "—" },
                { label: "Desconto Boleto", value: n(form.discountBoleto) > 0 ? `−${form.discountBoleto}%` : "—" },
                { label: "Desconto Crédito", value: n(form.discountCredit) > 0 ? `−${form.discountCredit}%` : "—" },
                { label: "Plataforma", value: PAYMENT_PLATFORM_LABELS[form.paymentPlatform] ?? form.paymentPlatform },
                { label: "Chave Pix", value: form.pixKey || "—" },
              ].map((item) => (
                <div key={item.label}>
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p className="text-sm font-semibold text-foreground mt-0.5 truncate">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Botão salvar sticky bottom (modo edit) */}
        {editing && (
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={handleCancelEdit}>
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={updateMutation.isPending}
              className="gap-2"
            >
              {updateMutation.isPending
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <Save className="w-3.5 h-3.5" />
              }
              Salvar Configurações
            </Button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
