import { useState } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { formatCurrency, formatPercent } from "../../../shared/pricingCalculator";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Copy, Trash2, Eye, Plus, AlertCircle, FileText,
  CheckSquare, Square, Download, Pencil, ChevronDown,
  ChevronUp, Star, TrendingDown, CheckCircle, XCircle, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtPct = (v: number) => `${(v * 100).toFixed(2)}%`;

const DIAGNOSIS_STYLES: Record<string, string> = {
  EXCELENTE: "bg-emerald-100 text-emerald-700 border-emerald-200",
  SAUDAVEL:  "bg-green-100 text-green-700 border-green-200",
  ATENCAO:   "bg-yellow-100 text-yellow-700 border-yellow-200",
  RISCO:     "bg-orange-100 text-orange-700 border-orange-200",
  PREJUIZO:  "bg-red-100 text-red-700 border-red-200",
};

const DIAGNOSIS_COLOR: Record<string, string> = {
  EXCELENTE: "#059669", SAUDAVEL: "#16a34a",
  ATENCAO: "#ca8a04", RISCO: "#ea580c", PREJUIZO: "#dc2626",
};
const DIAGNOSIS_BG: Record<string, string> = {
  EXCELENTE: "#ecfdf5", SAUDAVEL: "#f0fdf4",
  ATENCAO: "#fefce8", RISCO: "#fff7ed", PREJUIZO: "#fef2f2",
};

const METHOD_LABEL: Record<string, string> = {
  PIX: "PIX", BOLETO: "Boleto", DEBITO: "Débito",
  CREDITO_A_VISTA: "Crédito à Vista", CREDITO_PARCELADO: "Crédito Parcelado",
};

const ALL_METHODS = ["PIX", "BOLETO", "DEBITO", "CREDITO_A_VISTA", "CREDITO_PARCELADO"];

function diagIcon(d: string) {
  if (d === "SAUDAVEL" || d === "EXCELENTE") return <CheckCircle className="w-3.5 h-3.5" />;
  if (d === "ATENCAO" || d === "RISCO") return <AlertTriangle className="w-3.5 h-3.5" />;
  return <XCircle className="w-3.5 h-3.5" />;
}

// ─── Extrai dados de uma simulação ───────────────────────────────────────────
function extractRow(sim: any) {
  const product = sim.productSnapshot || {};
  const result  = sim.resultSnapshot  || {};
  const results: any[] = result.results || [];
  const byMethod = (m: string) => results.find((r: any) => r.method === m) || null;
  const pix     = byMethod("PIX");
  const bestRes = results.find((r: any) => r.method === sim.bestPaymentMethod) || pix || results[0];
  return {
    id:           sim.id,
    nome:         sim.name,
    produto:      product.productName || product.name || "—",
    categoria:    product.category || "—",
    precoCusto:   product.costPrice ?? product.finalUnitCostBrl ?? 0,
    precoVenda:   sim.recommendedPrice ?? 0,
    margemRate:   sim.desiredMarginRate ?? 0,
    lucroLiquido: sim.netProfit ?? bestRes?.netProfit ?? 0,
    impostos:     bestRes?.totalTax ?? 0,
    diagnosis:    sim.diagnosis || "—",
    bestMethod:   sim.bestPaymentMethod || "—",
    worstMethod:  sim.worstPaymentMethod || "—",
    createdAt:    new Date(sim.createdAt).toLocaleDateString("pt-BR"),
    resultados:   results,
    frete:        product.freight ?? 0,
    custoOp:      product.operationalCost ?? 0,
    embalagem:    product.packaging ?? 0,
    regimeTrib:   product.taxRegime ?? "",
    productId:    product.productId ?? null,
    minPrice:     sim.minimumBreakEvenPrice ?? 0,
  };
}

// ─── Gerador de PDF para uma ou mais simulações ───────────────────────────────
function exportPDF(rows: ReturnType<typeof extractRow>[], selectedMethods: string[], companyName = "Ideal Prime") {
  if (rows.length === 0) { toast.error("Nenhuma simulação selecionada"); return; }

  const now = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

  const diagBadge = (d: string) => {
    const color = DIAGNOSIS_COLOR[d] ?? "#555";
    const bg    = DIAGNOSIS_BG[d]    ?? "#f5f5f5";
    return `<span style="display:inline-block;padding:2px 10px;border-radius:20px;font-size:10px;font-weight:700;letter-spacing:0.05em;background:${bg};color:${color};border:1px solid ${color}40">${d}</span>`;
  };

  const detailCards = rows.map((r) => {
    const methodsToShow = r.resultados.filter((res: any) =>
      selectedMethods.length === 0 || selectedMethods.includes(res.method)
    );

    const metodosHtml = methodsToShow.map((res: any) => {
      const isBest  = res.method === r.bestMethod;
      const isWorst = res.method === r.worstMethod;
      return `
        <div style="flex:1;min-width:185px;border:1px solid ${isBest ? "#16a34a40" : "#eee"};border-radius:10px;padding:14px;background:${isBest ? "#f0fdf4" : "#fafafa"};position:relative">
          ${isBest  ? `<div style="position:absolute;top:-10px;left:12px;background:#16a34a;color:#fff;font-size:9px;font-weight:700;padding:2px 8px;border-radius:20px;letter-spacing:0.05em">★ MELHOR OPÇÃO</div>` : ""}
          ${isWorst ? `<div style="position:absolute;top:-10px;left:12px;background:#9ca3af;color:#fff;font-size:9px;font-weight:700;padding:2px 8px;border-radius:20px;letter-spacing:0.05em">↓ MENOR MARGEM</div>` : ""}
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;margin-top:${isBest || isWorst ? "6px" : "0"}">
            <span style="font-size:12px;font-weight:700;color:#111">${METHOD_LABEL[res.method] ?? res.method}</span>
            ${diagBadge(res.diagnostic ?? "—")}
          </div>
          <div style="font-size:20px;font-weight:800;color:#111;margin-bottom:6px">${fmt(res.suggestedPrice)}</div>
          ${res.installments > 1 ? `<div style="font-size:10px;color:#888;margin-bottom:8px">${res.installments}× de ${fmt(res.installmentValue)}</div>` : ""}
          <table style="width:100%;font-size:10px;color:#666;border-collapse:collapse">
            <tr><td style="padding:2px 0">Custo base</td><td style="text-align:right;color:#111;font-weight:500">${fmt(res.baseCost)}</td></tr>
            <tr><td style="padding:2px 0">Margem</td><td style="text-align:right;color:#16a34a;font-weight:500">+${fmt(res.marginValue)}</td></tr>
            <tr><td style="padding:2px 0">Impostos</td><td style="text-align:right">${fmt(res.totalTax)}</td></tr>
            <tr><td style="padding:2px 0">Taxas/Juros</td><td style="text-align:right">${fmt((res.totalFees ?? 0) + (res.totalInterest ?? 0))}</td></tr>
            <tr style="border-top:1px dashed #ddd">
              <td style="padding-top:5px;font-weight:700;color:#111">Lucro líquido</td>
              <td style="padding-top:5px;text-align:right;font-weight:700;color:${(res.netProfit ?? 0) >= 0 ? "#16a34a" : "#dc2626"}">${fmt(res.netProfit)}</td>
            </tr>
            <tr><td style="padding:2px 0;color:#aaa">Margem real</td><td style="text-align:right;color:#555">${fmtPct(res.realMarginRate ?? 0)}</td></tr>
            <tr><td style="padding:2px 0;color:#aaa">Mín. sem prejuízo</td><td style="text-align:right;color:#555">${fmt(res.minPriceNoLoss ?? 0)}</td></tr>
          </table>
        </div>
      `;
    }).join("");

    return `
      <div style="page-break-inside:avoid;margin-bottom:36px;border:1px solid #e5e5e5;border-radius:14px;overflow:hidden;box-shadow:0 1px 4px #0000000a">
        <div style="background:#111;padding:18px 22px;display:flex;justify-content:space-between;align-items:flex-start">
          <div>
            <div style="font-size:15px;font-weight:700;color:#fff">${r.nome}</div>
            <div style="font-size:11px;color:#888;margin-top:3px">${r.produto} · ${r.categoria} · Criado em ${r.createdAt}</div>
          </div>
          ${diagBadge(r.diagnosis)}
        </div>

        <div style="padding:16px 22px;background:#fafafa;border-bottom:1px solid #eee;display:flex;flex-wrap:wrap;gap:24px">
          <div><div style="font-size:9px;color:#aaa;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:3px">Preço de Custo</div><div style="font-size:16px;font-weight:700;color:#111">${fmt(r.precoCusto)}</div></div>
          <div><div style="font-size:9px;color:#aaa;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:3px">Preço Recomendado</div><div style="font-size:16px;font-weight:700;color:#111">${fmt(r.precoVenda)}</div></div>
          <div><div style="font-size:9px;color:#aaa;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:3px">Margem Desejada</div><div style="font-size:16px;font-weight:700;color:#111">${fmtPct(r.margemRate)}</div></div>
          <div><div style="font-size:9px;color:#aaa;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:3px">Lucro Líquido</div><div style="font-size:16px;font-weight:700;color:${r.lucroLiquido >= 0 ? "#16a34a" : "#dc2626"}">${fmt(r.lucroLiquido)}</div></div>
          <div><div style="font-size:9px;color:#aaa;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:3px">Preço Mínimo</div><div style="font-size:16px;font-weight:700;color:#555">${fmt(r.minPrice)}</div></div>
          ${r.frete > 0 ? `<div><div style="font-size:9px;color:#aaa;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:3px">Frete</div><div style="font-size:16px;font-weight:700;color:#111">${fmt(r.frete)}</div></div>` : ""}
          ${r.custoOp > 0 ? `<div><div style="font-size:9px;color:#aaa;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:3px">Custo Operac.</div><div style="font-size:16px;font-weight:700;color:#111">${fmt(r.custoOp)}</div></div>` : ""}
          ${r.regimeTrib ? `<div><div style="font-size:9px;color:#aaa;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:3px">Regime Tributário</div><div style="font-size:16px;font-weight:700;color:#111">${r.regimeTrib}</div></div>` : ""}
        </div>

        <div style="padding:18px 22px">
          <div style="font-size:9px;font-weight:700;color:#aaa;text-transform:uppercase;letter-spacing:0.12em;margin-bottom:14px">
            Formas de Pagamento ${selectedMethods.length > 0 && selectedMethods.length < ALL_METHODS.length ? `(${methodsToShow.length} selecionada${methodsToShow.length !== 1 ? "s" : ""})` : "— Todas"}
          </div>
          ${methodsToShow.length > 0
            ? `<div style="display:flex;flex-wrap:wrap;gap:12px">${metodosHtml}</div>`
            : `<div style="color:#aaa;font-size:11px;font-style:italic">Nenhuma forma de pagamento disponível para os filtros selecionados.</div>`}
        </div>
      </div>
    `;
  }).join("");

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Simulações — ${companyName}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', Arial, sans-serif; color: #111; background: #fff; font-size: 12px; }
  @page { size: A4; margin: 18mm 15mm; }
  @media print {
    .no-print { display: none !important; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>

<div style="padding-bottom:40px;border-bottom:3px solid #111;margin-bottom:36px;display:flex;justify-content:space-between;align-items:flex-end">
  <div>
    <div style="font-size:26px;font-weight:800;letter-spacing:-0.03em;color:#111">${companyName}</div>
    <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.07em;margin-top:4px">Relatório de Precificação</div>
  </div>
  <div style="text-align:right">
    <div style="font-size:10px;color:#aaa">Emitido em</div>
    <div style="font-size:13px;font-weight:600;color:#111">${now}</div>
    <div style="font-size:10px;color:#aaa;margin-top:4px">${rows.length} simulação${rows.length !== 1 ? "ões" : ""} · ${selectedMethods.length === 0 || selectedMethods.length === ALL_METHODS.length ? "Todos os métodos" : selectedMethods.map(m => METHOD_LABEL[m] ?? m).join(", ")}</div>
  </div>
</div>

${rows.length > 1 ? `
<div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:36px">
  ${[
    { label: "Simulações", value: String(rows.length), color: "#111" },
    { label: "Preço Médio", value: fmt(rows.reduce((s, r) => s + r.precoVenda, 0) / rows.length), color: "#111" },
    { label: "Margem Média", value: fmtPct(rows.reduce((s, r) => s + r.margemRate, 0) / rows.length), color: "#111" },
    { label: "Lucro Total", value: fmt(rows.reduce((s, r) => s + r.lucroLiquido, 0)), color: rows.reduce((s, r) => s + r.lucroLiquido, 0) >= 0 ? "#16a34a" : "#dc2626" },
  ].map(k => `
    <div style="flex:1;min-width:130px;border:1px solid #e5e5e5;border-radius:10px;padding:18px 20px">
      <div style="font-size:9px;font-weight:700;color:#aaa;text-transform:uppercase;letter-spacing:0.12em;margin-bottom:6px">${k.label}</div>
      <div style="font-size:20px;font-weight:800;color:${k.color};letter-spacing:-0.03em">${k.value}</div>
    </div>
  `).join("")}
</div>` : ""}

<div>
  <div style="font-size:9px;font-weight:700;color:#aaa;text-transform:uppercase;letter-spacing:0.12em;margin-bottom:16px">Detalhamento por Simulação</div>
  ${detailCards}
</div>

<div style="margin-top:32px;padding-top:14px;border-top:1px solid #e5e5e5;display:flex;justify-content:space-between;font-size:9px;color:#bbb">
  <span>${companyName} · Relatório gerado em ${now}</span>
  <span>Valores estimados — confirme com seu contador</span>
</div>

<div class="no-print" style="position:fixed;bottom:20px;right:20px;display:flex;gap:8px">
  <button onclick="window.print()" style="background:#111;color:#fff;border:none;padding:11px 22px;font-size:13px;font-weight:600;cursor:pointer;border-radius:8px">
    🖨️ Imprimir / Salvar PDF
  </button>
  <button onclick="window.close()" style="background:#f0f0f0;color:#555;border:none;padding:11px 18px;font-size:13px;cursor:pointer;border-radius:8px">
    Fechar
  </button>
</div>
</body>
</html>`;

  const win = window.open("", "_blank", "width=960,height=720,scrollbars=yes");
  if (!win) { toast.error("Permita popups para gerar o PDF"); return; }
  win.document.write(html);
  win.document.close();
  toast.success("PDF gerado! Clique em 'Imprimir / Salvar PDF' na nova janela.");
}

// ─── Modal de seleção de formas de pagamento ──────────────────────────────────
function PaymentMethodModal({
  onConfirm,
  onClose,
  count,
}: {
  onConfirm: (methods: string[]) => void;
  onClose: () => void;
  count: number;
}) {
  const [selected, setSelected] = useState<string[]>([...ALL_METHODS]);

  const toggle = (m: string) =>
    setSelected((prev: string[]) => prev.includes(m) ? prev.filter((x: string) => x !== m) : [...prev, m]);

  const toggleAll = () =>
    setSelected(selected.length === ALL_METHODS.length ? [] : [...ALL_METHODS]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100">
          <div>
            <h3 className="font-semibold text-neutral-900 text-sm">Exportar PDF</h3>
            <p className="text-xs text-neutral-500 mt-0.5">
              {count} simulação{count !== 1 ? "ões" : ""} selecionada{count !== 1 ? "s" : ""}
            </p>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700">
            <XCircle className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <p className="text-xs text-neutral-600 font-medium">Formas de pagamento no relatório:</p>

          <button
            onClick={toggleAll}
            className="flex items-center gap-2 text-xs font-medium text-neutral-700 hover:text-neutral-900"
          >
            {selected.length === ALL_METHODS.length
              ? <CheckSquare className="w-4 h-4 text-neutral-900" />
              : <Square className="w-4 h-4 text-neutral-400" />}
            Selecionar todas
          </button>

          <div className="space-y-1.5 pl-1">
            {ALL_METHODS.map((m) => (
              <button
                key={m}
                onClick={() => toggle(m)}
                className="flex items-center gap-2 text-xs text-neutral-700 hover:text-neutral-900 w-full"
              >
                {selected.includes(m)
                  ? <CheckSquare className="w-4 h-4 text-neutral-900" />
                  : <Square className="w-4 h-4 text-neutral-400" />}
                {METHOD_LABEL[m] ?? m}
              </button>
            ))}
          </div>
        </div>
        <div className="px-5 py-4 border-t border-neutral-100 flex gap-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            size="sm"
            className="flex-1 gap-1.5"
            disabled={selected.length === 0}
            onClick={() => { onConfirm(selected); onClose(); }}
          >
            <FileText className="w-3.5 h-3.5" />
            Gerar PDF
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function Simulations() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const { data: simulations = [] } = trpc.simulations.list.useQuery();

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [expandedId, setExpandedId]   = useState<number | null>(null);
  const [showPdfModal, setShowPdfModal] = useState(false);

  const deleteMutation = trpc.simulations.delete.useMutation({
    onSuccess: () => {
      utils.simulations.list.invalidate();
      toast.success("Simulação deletada.");
    },
  });

  const duplicateMutation = trpc.simulations.duplicate.useMutation({
    onSuccess: () => {
      utils.simulations.list.invalidate();
      toast.success("Simulação duplicada.");
    },
  });

  const rows = (simulations as any[]).map(extractRow);

  const toggleSelect = (id: number) => {
    setSelectedIds((prev: Set<number>) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === rows.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(rows.map((r) => r.id)));
  };

  const selectedRows = rows.filter((r) => selectedIds.has(r.id));
  const hasSelection = selectedIds.size > 0;

  return (
    <div className="min-h-screen bg-background">
      <main className="container py-8">
        <div className="space-y-6">

          {/* Cabeçalho */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Simulações</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Gerencie e exporte suas simulações de precificação
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              {hasSelection && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => setShowPdfModal(true)}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Exportar PDF ({selectedIds.size})
                  </Button>
                </>
              )}
              <Link href="/simulador">
                <Button className="gap-2">
                  <Plus className="w-4 h-4" />
                  Nova Simulação
                </Button>
              </Link>
            </div>
          </div>

          {/* Estado vazio */}
          {rows.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-12 text-center">
              <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Nenhuma simulação salva
              </h3>
              <p className="text-sm text-muted-foreground mb-6">
                Crie sua primeira simulação de precificação
              </p>
              <Link href="/simulador">
                <Button>Criar Simulação</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-2">

              {/* Barra de seleção */}
              <div className="flex items-center gap-3 px-1 pb-1">
                <button
                  onClick={toggleSelectAll}
                  className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {selectedIds.size === rows.length
                    ? <CheckSquare className="w-4 h-4 text-foreground" />
                    : <Square className="w-4 h-4" />}
                  {selectedIds.size === rows.length ? "Desmarcar todos" : "Selecionar todos"}
                </button>
                {hasSelection && (
                  <span className="text-xs text-muted-foreground">
                    {selectedIds.size} de {rows.length} selecionada{selectedIds.size !== 1 ? "s" : ""}
                  </span>
                )}
              </div>

              {/* Lista */}
              {rows.map((r) => {
                const isSelected = selectedIds.has(r.id);
                const isExpanded = expandedId === r.id;

                return (
                  <div
                    key={r.id}
                    className={`rounded-xl border bg-card transition-all duration-150 ${
                      isSelected
                        ? "border-primary/50 ring-1 ring-primary/20"
                        : "border-border hover:border-border/80"
                    }`}
                  >
                    {/* Linha principal */}
                    <div className="flex items-center gap-3 p-4">
                      {/* Checkbox */}
                      <button
                        onClick={() => toggleSelect(r.id)}
                        className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {isSelected
                          ? <CheckSquare className="w-4 h-4 text-primary" />
                          : <Square className="w-4 h-4" />}
                      </button>

                      {/* Info principal */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-foreground text-sm leading-tight">
                            {r.nome}
                          </span>
                          <Badge
                            variant="outline"
                            className={`text-[10px] font-semibold px-2 py-0.5 ${DIAGNOSIS_STYLES[r.diagnosis] || "bg-gray-100 text-gray-600 border-gray-200"}`}
                          >
                            {diagIcon(r.diagnosis)}
                            <span className="ml-1">{r.diagnosis}</span>
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {r.produto} · {r.createdAt}
                        </p>
                      </div>

                      {/* Métricas resumidas */}
                      <div className="hidden sm:flex items-center gap-6 shrink-0 text-right">
                        <div>
                          <p className="text-[10px] text-muted-foreground">Preço</p>
                          <p className="text-sm font-bold text-foreground">{fmt(r.precoVenda)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground">Margem</p>
                          <p className="text-sm font-semibold text-foreground">{fmtPct(r.margemRate)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground">Lucro</p>
                          <p className={`text-sm font-semibold ${r.lucroLiquido >= 0 ? "text-green-600" : "text-red-600"}`}>
                            {fmt(r.lucroLiquido)}
                          </p>
                        </div>
                      </div>

                      {/* Ações */}
                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        <Link href={`/simulacoes/${r.id}`}>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Ver detalhes">
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                        </Link>
                        {r.productId ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            title="Editar / Recalcular"
                            onClick={() => setLocation(`/simulador?productId=${r.productId}`)}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                        ) : null}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          title="Exportar este PDF"
                          onClick={() => {
                            setSelectedIds(new Set([r.id]));
                            setShowPdfModal(true);
                          }}
                        >
                          <FileText className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          title="Duplicar"
                          onClick={() => duplicateMutation.mutate({ id: r.id })}
                          disabled={duplicateMutation.isPending}
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                          title="Deletar"
                          onClick={() => {
                            if (confirm("Deletar esta simulação?")) deleteMutation.mutate({ id: r.id });
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-muted-foreground"
                          onClick={() => setExpandedId(isExpanded ? null : r.id)}
                          title={isExpanded ? "Recolher" : "Expandir resumo"}
                        >
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </Button>
                      </div>
                    </div>

                    {/* Métricas móvel */}
                    <div className="sm:hidden flex gap-4 px-4 pb-3 text-xs border-t border-border/40 pt-3">
                      <div>
                        <p className="text-muted-foreground">Preço</p>
                        <p className="font-bold text-foreground">{fmt(r.precoVenda)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Margem</p>
                        <p className="font-semibold text-foreground">{fmtPct(r.margemRate)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Lucro</p>
                        <p className={`font-semibold ${r.lucroLiquido >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {fmt(r.lucroLiquido)}
                        </p>
                      </div>
                    </div>

                    {/* Detalhe expandido */}
                    {isExpanded && (
                      <div className="border-t border-border/40 px-4 py-4 bg-muted/20">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {r.resultados.map((res: any) => {
                            const isBest  = res.method === r.bestMethod;
                            const isWorst = res.method === r.worstMethod;
                            return (
                              <div
                                key={res.method}
                                className={`rounded-lg border p-3 bg-card text-xs ${
                                  isBest  ? "border-green-400/50 ring-1 ring-green-400/20" :
                                  isWorst ? "border-red-300/30 opacity-75" : "border-border"
                                }`}
                              >
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-semibold text-foreground text-sm">
                                      {METHOD_LABEL[res.method] ?? res.method}
                                    </span>
                                    {isBest && (
                                      <span className="inline-flex items-center gap-0.5 text-[9px] font-bold bg-green-500 text-white px-1.5 py-0.5 rounded-full">
                                        <Star className="w-2.5 h-2.5 fill-current" /> Melhor
                                      </span>
                                    )}
                                    {isWorst && (
                                      <span className="inline-flex items-center gap-0.5 text-[9px] font-bold bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">
                                        <TrendingDown className="w-2.5 h-2.5" /> Menor
                                      </span>
                                    )}
                                  </div>
                                  <span className="font-bold text-foreground text-sm">{fmt(res.suggestedPrice)}</span>
                                </div>
                                {res.installments > 1 && (
                                  <p className="text-muted-foreground mb-1.5">
                                    {res.installments}× de {fmt(res.installmentValue)}
                                  </p>
                                )}
                                <div className="space-y-0.5 text-muted-foreground">
                                  <div className="flex justify-between">
                                    <span>Lucro líquido</span>
                                    <span className={`font-medium ${(res.netProfit ?? 0) >= 0 ? "text-green-600" : "text-red-600"}`}>
                                      {fmt(res.netProfit)}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>Margem real</span>
                                    <span className="text-foreground">{fmtPct(res.realMarginRate ?? 0)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>Impostos</span>
                                    <span>{fmt(res.totalTax)}</span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <div className="mt-3 flex gap-2 flex-wrap">
                          <Link href={`/simulacoes/${r.id}`}>
                            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                              <Eye className="w-3 h-3" /> Ver completo
                            </Button>
                          </Link>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5 text-xs"
                            onClick={() => {
                              setSelectedIds(new Set([r.id]));
                              setShowPdfModal(true);
                            }}
                          >
                            <FileText className="w-3 h-3" /> Exportar PDF
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Modal de seleção de métodos para PDF */}
      {showPdfModal && (
        <PaymentMethodModal
          count={selectedIds.size}
          onClose={() => setShowPdfModal(false)}
          onConfirm={(methods) => {
            exportPDF(selectedRows.length > 0 ? selectedRows : rows, methods);
          }}
        />
      )}
    </div>
  );
}
