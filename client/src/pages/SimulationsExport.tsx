import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { formatCurrency, formatPercent } from "../../../shared/pricingCalculator";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Download, Plus, Trash2, AlertCircle, FileText,
  CheckSquare, Square, Star, TrendingDown,
  CheckCircle, XCircle, AlertTriangle,
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import * as XLSX from "xlsx";
import { toast } from "sonner";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (v: unknown): string => {
  const n = Number(v);
  return isNaN(n) ? "—" : n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

const fmtPct = (v: unknown): string => {
  const n = Number(v);
  return isNaN(n) ? "—" : `${n.toFixed(2)}%`;
};

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

// ─── Extrai dados de uma simulação ───────────────────────────────────────────
function extractSimRow(sim: any) {
  const product = sim.productSnapshot || {};
  const result  = sim.resultSnapshot  || {};
  const results: any[] = result.results || [];
  const byMethod = (method: string) => results.find((r: any) => r.method === method) || null;
  const pix      = byMethod("PIX");
  const boletoRes = byMethod("BOLETO");
  const cardRes  = byMethod("CREDITO_PARCELADO") || byMethod("CREDITO_A_VISTA") || byMethod("DEBITO");
  const bestResult = results.find((r: any) => r.method === sim.bestPaymentMethod) || pix || results[0];

  return {
    nome:               sim.name,
    produto:            product.productName || product.name || "—",
    categoria:          product.category || "—",
    precoCusto:         product.costPrice ?? product.finalUnitCostBrl ?? 0,
    precoVenda:         sim.recommendedPrice ?? 0,
    margemLucro:        (sim.desiredMarginRate ?? 0) * 100,
    margemRate:         sim.desiredMarginRate ?? 0,
    lucroLiquido:       sim.netProfit ?? bestResult?.netProfit ?? 0,
    impostos:           bestResult?.totalTax ?? 0,
    valorAVista:        pix?.suggestedPrice ?? 0,
    jurosCartao:        cardRes?.totalFees ?? cardRes?.totalInterest ?? 0,
    valorParcelaCartao: cardRes?.installmentValue ?? cardRes?.suggestedPrice ?? 0,
    jurosBoleto:        boletoRes?.totalFees ?? boletoRes?.totalInterest ?? 0,
    valorParcelaBoleto: boletoRes?.installmentValue ?? boletoRes?.suggestedPrice ?? 0,
    diagnosis:          sim.diagnosis || "—",
    bestMethod:         sim.bestPaymentMethod || "—",
    worstMethod:        sim.worstPaymentMethod || "—",
    minPrice:           sim.minimumBreakEvenPrice ?? 0,
    createdAt:          new Date(sim.createdAt).toLocaleDateString("pt-BR"),
    id:                 sim.id,
    resultados:         results,
    frete:              product.freight ?? 0,
    custoOp:            product.operationalCost ?? 0,
    embalagem:          product.packaging ?? 0,
    regimeTrib:         product.taxRegime ?? "",
  };
}

// ─── Gerador de PDF ───────────────────────────────────────────────────────────
function exportToPDF(
  rows: ReturnType<typeof extractSimRow>[],
  selectedMethods: string[],
  companyName = "Ideal Prime",
) {
  if (rows.length === 0) { toast.error("Nenhuma simulação para exportar"); return; }

  const now = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  const totalLucro   = rows.reduce((s, r) => s + r.lucroLiquido, 0);
  const margemMedia  = rows.reduce((s, r) => s + r.margemLucro,  0) / rows.length;
  const precoMedio   = rows.reduce((s, r) => s + r.precoVenda,   0) / rows.length;

  const diagBadge = (d: string) => {
    const color = DIAGNOSIS_COLOR[d] ?? "#555";
    const bg    = DIAGNOSIS_BG[d]    ?? "#f5f5f5";
    return `<span style="display:inline-block;padding:2px 10px;border-radius:20px;font-size:10px;font-weight:700;letter-spacing:0.05em;background:${bg};color:${color};border:1px solid ${color}40">${d}</span>`;
  };

  // Tabela resumo — colunas de métodos selecionados
  const methodCols = ALL_METHODS.filter(m => selectedMethods.includes(m));
  const methodHeaders = methodCols.map(m =>
    `<th style="padding:10px 12px;text-align:right;font-size:10px;font-weight:600;letter-spacing:0.04em">${METHOD_LABEL[m]}</th>`
  ).join("");

  const tableRows = rows.map((r, i) => {
    const methodCells = methodCols.map(m => {
      const res = r.resultados.find((x: any) => x.method === m);
      return `<td style="padding:10px 12px;text-align:right;border-bottom:1px solid #eee;font-size:11px;color:#555">
        ${res ? fmt(res.suggestedPrice) : "—"}
        ${res && res.installments > 1 ? `<div style="font-size:9px;color:#aaa">${res.installments}× ${fmt(res.installmentValue)}</div>` : ""}
      </td>`;
    }).join("");

    return `<tr style="background:${i % 2 === 0 ? "#ffffff" : "#f9f9f9"}">
      <td style="padding:10px 12px;border-bottom:1px solid #eee">
        <div style="font-weight:600;font-size:12px;color:#111">${r.nome}</div>
        <div style="font-size:10px;color:#888;margin-top:2px">${r.produto}</div>
        <div style="font-size:9px;color:#bbb;margin-top:1px">${r.createdAt}</div>
      </td>
      <td style="padding:10px 12px;text-align:right;border-bottom:1px solid #eee;font-size:11px;color:#555">${fmt(r.precoCusto)}</td>
      <td style="padding:10px 12px;text-align:right;border-bottom:1px solid #eee;font-size:12px;font-weight:700;color:#111">${fmt(r.precoVenda)}</td>
      <td style="padding:10px 12px;text-align:right;border-bottom:1px solid #eee;font-size:11px;color:#555">${fmtPct(r.margemLucro)}</td>
      <td style="padding:10px 12px;text-align:right;border-bottom:1px solid #eee;font-size:12px;font-weight:600;color:${r.lucroLiquido >= 0 ? "#16a34a" : "#dc2626"}">${fmt(r.lucroLiquido)}</td>
      ${methodCells}
      <td style="padding:10px 12px;text-align:center;border-bottom:1px solid #eee">${diagBadge(r.diagnosis)}</td>
    </tr>`;
  }).join("");

  // Cards detalhados
  const detailCards = rows.map((r) => {
    const methodsToShow = r.resultados.filter((res: any) =>
      selectedMethods.length === 0 || selectedMethods.includes(res.method)
    );

    const metodosHtml = methodsToShow.map((res: any) => {
      const isBest  = res.method === r.bestMethod;
      const isWorst = res.method === r.worstMethod;
      return `
        <div style="flex:1;min-width:185px;border:1px solid ${isBest ? "#16a34a40" : "#eee"};border-radius:10px;padding:14px;background:${isBest ? "#f0fdf4" : "#fafafa"};position:relative">
          ${isBest  ? `<div style="position:absolute;top:-10px;left:12px;background:#16a34a;color:#fff;font-size:9px;font-weight:700;padding:2px 8px;border-radius:20px">★ MELHOR OPÇÃO</div>` : ""}
          ${isWorst ? `<div style="position:absolute;top:-10px;left:12px;background:#9ca3af;color:#fff;font-size:9px;font-weight:700;padding:2px 8px;border-radius:20px">↓ MENOR MARGEM</div>` : ""}
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
            <tr><td style="padding:2px 0;color:#aaa">Margem real</td><td style="text-align:right;color:#555">${fmtPct((res.realMarginRate ?? 0) * 100)}</td></tr>
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
            <div style="font-size:11px;color:#888;margin-top:3px">${r.produto} · ${r.categoria} · ${r.createdAt}</div>
          </div>
          ${diagBadge(r.diagnosis)}
        </div>
        <div style="padding:16px 22px;background:#fafafa;border-bottom:1px solid #eee;display:flex;flex-wrap:wrap;gap:24px">
          <div><div style="font-size:9px;color:#aaa;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:3px">Preço de Custo</div><div style="font-size:16px;font-weight:700;color:#111">${fmt(r.precoCusto)}</div></div>
          <div><div style="font-size:9px;color:#aaa;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:3px">Preço Recomendado</div><div style="font-size:16px;font-weight:700;color:#111">${fmt(r.precoVenda)}</div></div>
          <div><div style="font-size:9px;color:#aaa;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:3px">Margem Desejada</div><div style="font-size:16px;font-weight:700;color:#111">${fmtPct(r.margemLucro)}</div></div>
          <div><div style="font-size:9px;color:#aaa;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:3px">Lucro Líquido</div><div style="font-size:16px;font-weight:700;color:${r.lucroLiquido >= 0 ? "#16a34a" : "#dc2626"}">${fmt(r.lucroLiquido)}</div></div>
          <div><div style="font-size:9px;color:#aaa;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:3px">Preço Mínimo</div><div style="font-size:16px;font-weight:700;color:#555">${fmt(r.minPrice)}</div></div>
          ${r.frete > 0 ? `<div><div style="font-size:9px;color:#aaa;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:3px">Frete</div><div style="font-size:16px;font-weight:700;color:#111">${fmt(r.frete)}</div></div>` : ""}
          ${r.custoOp > 0 ? `<div><div style="font-size:9px;color:#aaa;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:3px">Custo Operac.</div><div style="font-size:16px;font-weight:700;color:#111">${fmt(r.custoOp)}</div></div>` : ""}
          ${r.regimeTrib ? `<div><div style="font-size:9px;color:#aaa;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:3px">Regime Tributário</div><div style="font-size:16px;font-weight:700;color:#111">${r.regimeTrib}</div></div>` : ""}
        </div>
        <div style="padding:18px 22px">
          <div style="font-size:9px;font-weight:700;color:#aaa;text-transform:uppercase;letter-spacing:0.12em;margin-bottom:14px">
            Formas de Pagamento ${selectedMethods.length < ALL_METHODS.length ? `(${methodsToShow.length} de ${ALL_METHODS.length})` : "— Todas"}
          </div>
          ${methodsToShow.length > 0
            ? `<div style="display:flex;flex-wrap:wrap;gap:12px">${metodosHtml}</div>`
            : `<div style="color:#aaa;font-size:11px;font-style:italic">Nenhuma forma de pagamento para os filtros selecionados.</div>`}
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
  table { border-collapse: collapse; }
</style>
</head>
<body>

<div style="padding-bottom:36px;border-bottom:3px solid #111;margin-bottom:36px;display:flex;justify-content:space-between;align-items:flex-end">
  <div>
    <div style="font-size:26px;font-weight:800;letter-spacing:-0.03em;color:#111">${companyName}</div>
    <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.07em;margin-top:4px">Relatório de Precificação</div>
  </div>
  <div style="text-align:right">
    <div style="font-size:10px;color:#aaa">Emitido em</div>
    <div style="font-size:13px;font-weight:600;color:#111">${now}</div>
    <div style="font-size:10px;color:#aaa;margin-top:4px">
      ${rows.length} simulação${rows.length !== 1 ? "ões" : ""} ·
      ${selectedMethods.length === ALL_METHODS.length ? "Todos os métodos" : selectedMethods.map(m => METHOD_LABEL[m] ?? m).join(", ")}
    </div>
  </div>
</div>

<div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:40px">
  ${[
    { label: "Simulações",   value: String(rows.length), color: "#111" },
    { label: "Preço Médio",  value: fmt(precoMedio),     color: "#111" },
    { label: "Margem Média", value: fmtPct(margemMedia), color: "#111" },
    { label: "Lucro Total",  value: fmt(totalLucro),     color: totalLucro >= 0 ? "#16a34a" : "#dc2626" },
  ].map(k => `
    <div style="flex:1;min-width:130px;border:1px solid #e5e5e5;border-radius:10px;padding:18px 20px">
      <div style="font-size:9px;font-weight:700;color:#aaa;text-transform:uppercase;letter-spacing:0.12em;margin-bottom:6px">${k.label}</div>
      <div style="font-size:20px;font-weight:800;color:${k.color};letter-spacing:-0.03em">${k.value}</div>
    </div>
  `).join("")}
</div>

<div style="margin-bottom:40px">
  <div style="font-size:9px;font-weight:700;color:#aaa;text-transform:uppercase;letter-spacing:0.12em;margin-bottom:12px">Resumo das Simulações</div>
  <div style="border:1px solid #e5e5e5;border-radius:10px;overflow:hidden">
    <table style="width:100%">
      <thead>
        <tr style="background:#111;color:#fff">
          <th style="padding:10px 12px;text-align:left;font-size:10px;font-weight:600;letter-spacing:0.04em">Simulação / Produto</th>
          <th style="padding:10px 12px;text-align:right;font-size:10px;font-weight:600;letter-spacing:0.04em">Custo</th>
          <th style="padding:10px 12px;text-align:right;font-size:10px;font-weight:600;letter-spacing:0.04em">Venda</th>
          <th style="padding:10px 12px;text-align:right;font-size:10px;font-weight:600;letter-spacing:0.04em">Margem</th>
          <th style="padding:10px 12px;text-align:right;font-size:10px;font-weight:600;letter-spacing:0.04em">Lucro Líq.</th>
          ${methodHeaders}
          <th style="padding:10px 12px;text-align:center;font-size:10px;font-weight:600;letter-spacing:0.04em">Status</th>
        </tr>
      </thead>
      <tbody>${tableRows}</tbody>
      <tfoot>
        <tr style="background:#f5f5f5;border-top:2px solid #e5e5e5">
          <td style="padding:10px 12px;font-weight:700;font-size:11px;color:#111">TOTAIS / MÉDIAS</td>
          <td style="padding:10px 12px;text-align:right;font-size:11px;font-weight:600;color:#555">${fmt(rows.reduce((s, r) => s + r.precoCusto, 0) / rows.length)} (méd.)</td>
          <td style="padding:10px 12px;text-align:right;font-size:11px;font-weight:700;color:#111">${fmt(precoMedio)} (méd.)</td>
          <td style="padding:10px 12px;text-align:right;font-size:11px;font-weight:600;color:#555">${fmtPct(margemMedia)} (méd.)</td>
          <td style="padding:10px 12px;text-align:right;font-size:11px;font-weight:700;color:${totalLucro >= 0 ? "#16a34a" : "#dc2626"}">${fmt(totalLucro)}</td>
          <td colspan="${methodCols.length + 1}" style="padding:10px 12px;text-align:right;font-size:10px;color:#aaa">${rows.length} simulação(ões)</td>
        </tr>
      </tfoot>
    </table>
  </div>
</div>

<div style="page-break-before:always">
  <div style="font-size:9px;font-weight:700;color:#aaa;text-transform:uppercase;letter-spacing:0.12em;margin-bottom:20px;padding-top:10px">Detalhamento por Simulação</div>
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

// ─── Modal de seleção de métodos e simulações ─────────────────────────────────
function ExportModal({
  rows,
  selectedIds,
  onClose,
}: {
  rows: ReturnType<typeof extractSimRow>[];
  selectedIds: Set<number>;
  onClose: () => void;
}) {
  const [selectedMethods, setSelectedMethods] = useState<string[]>([...ALL_METHODS]);
  const [exportScope, setExportScope] = useState<"selected" | "all">(
    selectedIds.size > 0 ? "selected" : "all"
  );

  const toggleMethod = (m: string) =>
    setSelectedMethods((prev) => prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]);

  const toggleAllMethods = () =>
    setSelectedMethods(selectedMethods.length === ALL_METHODS.length ? [] : [...ALL_METHODS]);

  const rowsToExport = exportScope === "selected" && selectedIds.size > 0
    ? rows.filter((r) => selectedIds.has(r.id))
    : rows;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100">
          <div>
            <h3 className="font-semibold text-neutral-900 text-sm">Exportar PDF</h3>
            <p className="text-xs text-neutral-500 mt-0.5">Configure o relatório</p>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700">
            <XCircle className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-5">
          {/* Escopo */}
          {selectedIds.size > 0 && (
            <div>
              <p className="text-xs text-neutral-600 font-medium mb-2">Simulações a exportar:</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setExportScope("selected")}
                  className={`py-2 px-3 rounded-lg border text-xs font-medium transition-colors ${
                    exportScope === "selected"
                      ? "border-neutral-900 bg-neutral-900 text-white"
                      : "border-neutral-200 text-neutral-600"
                  }`}
                >
                  Selecionadas ({selectedIds.size})
                </button>
                <button
                  onClick={() => setExportScope("all")}
                  className={`py-2 px-3 rounded-lg border text-xs font-medium transition-colors ${
                    exportScope === "all"
                      ? "border-neutral-900 bg-neutral-900 text-white"
                      : "border-neutral-200 text-neutral-600"
                  }`}
                >
                  Todas ({rows.length})
                </button>
              </div>
            </div>
          )}

          {/* Métodos */}
          <div>
            <p className="text-xs text-neutral-600 font-medium mb-2">Formas de pagamento no relatório:</p>
            <button
              onClick={toggleAllMethods}
              className="flex items-center gap-2 text-xs font-medium text-neutral-700 hover:text-neutral-900 mb-2"
            >
              {selectedMethods.length === ALL_METHODS.length
                ? <CheckSquare className="w-4 h-4 text-neutral-900" />
                : <Square className="w-4 h-4 text-neutral-400" />}
              Selecionar todas
            </button>
            <div className="space-y-1.5 pl-1">
              {ALL_METHODS.map((m) => (
                <button
                  key={m}
                  onClick={() => toggleMethod(m)}
                  className="flex items-center gap-2 text-xs text-neutral-700 hover:text-neutral-900 w-full"
                >
                  {selectedMethods.includes(m)
                    ? <CheckSquare className="w-4 h-4 text-neutral-900" />
                    : <Square className="w-4 h-4 text-neutral-400" />}
                  {METHOD_LABEL[m] ?? m}
                </button>
              ))}
            </div>
          </div>

          <p className="text-xs text-neutral-400">
            {rowsToExport.length} simulação{rowsToExport.length !== 1 ? "ões" : ""} ·{" "}
            {selectedMethods.length} método{selectedMethods.length !== 1 ? "s" : ""}
          </p>
        </div>

        <div className="px-5 py-4 border-t border-neutral-100 flex gap-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            size="sm"
            className="flex-1 gap-1.5"
            disabled={selectedMethods.length === 0 || rowsToExport.length === 0}
            onClick={() => { exportToPDF(rowsToExport, selectedMethods); onClose(); }}
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
export default function SimulationsExport() {
  const utils = trpc.useUtils();
  const { data: simulations = [], isLoading } = trpc.simulations.list.useQuery();

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showExportModal, setShowExportModal] = useState(false);

  const deleteSimulation = trpc.simulations.delete.useMutation({
    onSuccess: () => { utils.simulations.list.invalidate(); toast.success("Simulação deletada."); },
  });

  const rows = (simulations as any[]).map(extractSimRow);

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const toggleAll = () => {
    setSelectedIds(selectedIds.size === rows.length ? new Set() : new Set(rows.map((r) => r.id)));
  };

  const exportToExcel = () => {
    if (rows.length === 0) { toast.error("Nenhuma simulação para exportar"); return; }

    const rowsToExport = selectedIds.size > 0 ? rows.filter((r) => selectedIds.has(r.id)) : rows;
    const sheetRows = rowsToExport.map((r) => ({
      "Nome da Simulação":          r.nome,
      "Produto":                    r.produto,
      "Preço de Custo (R$)":        r.precoCusto,
      "Preço de Venda (R$)":        r.precoVenda,
      "Margem de Lucro (%)":        r.margemLucro,
      "Lucro Líquido (R$)":         r.lucroLiquido,
      "Impostos (R$)":              r.impostos,
      "Valor à Vista / PIX (R$)":   r.valorAVista,
      "Custos/Juros Cartão (R$)":   r.jurosCartao,
      "Valor da Parcela Cartão (R$)": r.valorParcelaCartao,
      "Custos/Juros Boleto (R$)":   r.jurosBoleto,
      "Valor da Parcela Boleto (R$)": r.valorParcelaBoleto,
      "Diagnóstico":                r.diagnosis,
      "Melhor Pagamento":           METHOD_LABEL[r.bestMethod] || r.bestMethod,
      "Data":                       r.createdAt,
    }));

    const ws = XLSX.utils.json_to_sheet(sheetRows);
    ws["!cols"] = [
      { wch: 28 }, { wch: 25 }, { wch: 18 }, { wch: 18 }, { wch: 18 },
      { wch: 18 }, { wch: 16 }, { wch: 22 }, { wch: 22 }, { wch: 24 },
      { wch: 22 }, { wch: 24 }, { wch: 14 }, { wch: 22 }, { wch: 14 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Simulações");
    XLSX.writeFile(wb, `simulacoes-${new Date().toISOString().split("T")[0]}.xlsx`);
    toast.success(`Planilha exportada com ${rowsToExport.length} simulação(ões)!`);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">

        {/* Cabeçalho */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Simulações Salvas</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Relatório completo de precificação por produto
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              onClick={() => setShowExportModal(true)}
              disabled={rows.length === 0}
              variant="outline"
              className="gap-2"
            >
              <FileText className="w-4 h-4" />
              Exportar PDF{selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}
            </Button>
            <Button
              onClick={exportToExcel}
              disabled={rows.length === 0}
              variant="outline"
              className="gap-2"
            >
              <Download className="w-4 h-4" />
              Excel{selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}
            </Button>
            <Link href="/simulador">
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                Nova Simulação
              </Button>
            </Link>
          </div>
        </div>

        {/* Estado vazio */}
        {!isLoading && rows.length === 0 && (
          <div className="rounded-xl border border-border bg-card p-12 text-center">
            <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">Nenhuma simulação salva</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Crie uma simulação de precificação para ela aparecer aqui
            </p>
            <Link href="/simulador"><Button>Criar Simulação</Button></Link>
          </div>
        )}

        {/* Tabela */}
        {rows.length > 0 && (
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/60 border-b border-border">
                    <th className="px-4 py-3 w-10">
                      <button onClick={toggleAll} className="text-muted-foreground hover:text-foreground">
                        {selectedIds.size === rows.length
                          ? <CheckSquare className="w-4 h-4 text-foreground" />
                          : <Square className="w-4 h-4" />}
                      </button>
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Simulação / Produto</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Preço Custo</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Preço Venda</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Margem %</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Lucro Líq.</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Impostos</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">PIX</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Parcela Cartão</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Parcela Boleto</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Diagnóstico</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, idx) => (
                    <tr
                      key={r.id}
                      className={`border-b border-border/60 transition-colors hover:bg-muted/30 ${
                        selectedIds.has(r.id) ? "bg-primary/5" :
                        idx % 2 === 0 ? "bg-background" : "bg-muted/10"
                      }`}
                    >
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => toggleSelect(r.id)} className="text-muted-foreground hover:text-foreground">
                          {selectedIds.has(r.id)
                            ? <CheckSquare className="w-4 h-4 text-primary" />
                            : <Square className="w-4 h-4" />}
                        </button>
                      </td>
                      <td className="px-4 py-3 min-w-[200px]">
                        <p className="font-medium text-foreground leading-tight">{r.nome}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[180px]">{r.produto}</p>
                        <p className="text-xs text-muted-foreground/60 mt-0.5">{r.createdAt}</p>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap text-foreground">{fmt(r.precoCusto)}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap font-medium text-foreground">{fmt(r.precoVenda)}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap text-foreground">{fmtPct(r.margemLucro)}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <span className={r.lucroLiquido < 0 ? "text-red-600 font-medium" : "text-green-600 font-medium"}>
                          {fmt(r.lucroLiquido)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap text-foreground">{fmt(r.impostos)}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap text-foreground">{r.valorAVista > 0 ? fmt(r.valorAVista) : "—"}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap text-foreground">{r.valorParcelaCartao > 0 ? fmt(r.valorParcelaCartao) : "—"}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap text-foreground">{r.valorParcelaBoleto > 0 ? fmt(r.valorParcelaBoleto) : "—"}</td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <Badge variant="outline" className={`text-xs font-medium ${DIAGNOSIS_STYLES[r.diagnosis] || "bg-gray-100 text-gray-600 border-gray-200"}`}>
                          {r.diagnosis}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost" size="sm"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                            title="Exportar este PDF"
                            onClick={() => { setSelectedIds(new Set([r.id])); setShowExportModal(true); }}
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost" size="sm"
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                            title="Deletar"
                            onClick={() => { if (confirm("Deletar esta simulação?")) deleteSimulation.mutate({ id: r.id }); }}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Rodapé */}
            <div className="bg-muted/40 border-t border-border px-4 py-3 flex flex-wrap gap-6 text-xs text-muted-foreground">
              <span>
                <strong className="text-foreground">{rows.length}</strong> simulação(ões)
                {selectedIds.size > 0 && (
                  <span className="text-primary"> · {selectedIds.size} selecionada{selectedIds.size !== 1 ? "s" : ""}</span>
                )}
              </span>
              <span>Preço médio: <strong className="text-foreground">{fmt(rows.reduce((s, r) => s + r.precoVenda, 0) / rows.length)}</strong></span>
              <span>Margem média: <strong className="text-foreground">{fmtPct(rows.reduce((s, r) => s + r.margemLucro, 0) / rows.length)}</strong></span>
              <span>Lucro total: <strong className={rows.reduce((s, r) => s + r.lucroLiquido, 0) >= 0 ? "text-green-600" : "text-red-600"}>
                {fmt(rows.reduce((s, r) => s + r.lucroLiquido, 0))}
              </strong></span>
            </div>
          </div>
        )}
      </div>

      {showExportModal && (
        <ExportModal
          rows={rows}
          selectedIds={selectedIds}
          onClose={() => setShowExportModal(false)}
        />
      )}
    </DashboardLayout>
  );
}
