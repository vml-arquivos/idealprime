type QuoteItemDocument = {
  id?: number;
  sku?: string;
  name?: string;
  unit?: string;
  quantity?: number;
  unitPriceCents?: number;
  totalCents?: number;
  catalogUnitPriceCents?: number;
  quotedUnitPriceCents?: number;
  quotedTotalCents?: number;
};

export type QuoteDocument = {
  quote_number?: string;
  status?: string;
  created_at?: string | Date;
  updated_at?: string | Date;
  approved_at?: string | Date | null;
  legal_name?: string;
  trade_name?: string | null;
  cnpj?: string;
  business_email?: string;
  business_phone?: string | null;
  buyer_name?: string;
  customer_reference?: string | null;
  requested_delivery_date?: string | null;
  delivery_address?: string | null;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  notes?: string | null;
  subtotal_cents?: number;
  discount_cents?: number;
  freight_cents?: number;
  total_cents?: number;
  valid_until?: string | null;
  payment_terms_text?: string | null;
  delivery_terms_text?: string | null;
  commercial_notes?: string | null;
  items?: QuoteItemDocument[];
};

export type OrderDocument = {
  order_number?: string;
  created_at?: string | Date;
  legal_name?: string;
  trade_name?: string | null;
  commercial_status?: string;
  payment_status?: string;
  fulfillment_status?: string;
  payment_method?: string | null;
  total_cents?: number;
  delivery_snapshot?: Record<string, unknown> | null;
  terms_snapshot?: Record<string, unknown> | null;
  items?: Array<{
    sku_snapshot?: string;
    name_snapshot?: string;
    unit_snapshot?: string;
    quantity?: number;
    unit_price_cents?: number;
    total_cents?: number;
  }>;
};

const cents = (value: unknown) => Number(value || 0) / 100;
const money = (value: unknown) => cents(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dateTime = (value?: string | Date | null) => value ? new Date(value).toLocaleString("pt-BR") : "—";
const dateOnly = (value?: string | Date | null) => value ? new Date(`${String(value).slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR") : "—";
const fileName = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9-_]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
const esc = (value: unknown) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char] || char);

function quoteRows(quote: QuoteDocument) {
  return (quote.items || []).map((item) => {
    const catalog = Number(item.catalogUnitPriceCents ?? item.unitPriceCents ?? 0);
    const quoted = Number(item.quotedUnitPriceCents ?? item.unitPriceCents ?? 0);
    const quantity = Number(item.quantity || 0);
    return {
      SKU: item.sku || "",
      Produto: item.name || "",
      Unidade: item.unit || "UN",
      Quantidade: quantity,
      "Preço referência": cents(catalog),
      "Preço cotado": cents(quoted),
      "Economia unitária": cents(Math.max(0, catalog - quoted)),
      "Total referência": cents(Number(item.totalCents ?? quantity * catalog)),
      "Total cotado": cents(Number(item.quotedTotalCents ?? quantity * quoted)),
    };
  });
}

export async function exportQuoteSpreadsheet(quote: QuoteDocument) {
  const XLSX = await import("xlsx");
  const workbook = XLSX.utils.book_new();
  const summary = XLSX.utils.aoa_to_sheet([
    ["IDEAL PRIME — COTAÇÃO EMPRESARIAL"],
    ["Número", quote.quote_number || ""],
    ["Empresa", quote.trade_name || quote.legal_name || ""],
    ["Razão social", quote.legal_name || ""],
    ["CNPJ", quote.cnpj || ""],
    ["Referência do cliente", quote.customer_reference || ""],
    ["Solicitada em", dateTime(quote.created_at)],
    ["Validade", dateOnly(quote.valid_until)],
    ["Entrega desejada", dateOnly(quote.requested_delivery_date)],
    ["Contato", quote.contact_name || ""],
    ["E-mail", quote.contact_email || quote.business_email || ""],
    ["Telefone", quote.contact_phone || quote.business_phone || ""],
    ["Endereço/observação de entrega", quote.delivery_address || ""],
    ["Subtotal", cents(quote.subtotal_cents ?? quote.total_cents)],
    ["Desconto", cents(quote.discount_cents)],
    ["Frete", cents(quote.freight_cents)],
    ["TOTAL", cents(quote.total_cents)],
    ["Condição de pagamento", quote.payment_terms_text || ""],
    ["Condição de entrega", quote.delivery_terms_text || ""],
    ["Observações comerciais", quote.commercial_notes || ""],
    ["Observações do cliente", quote.notes || ""],
  ]);
  summary["!cols"] = [{ wch: 31 }, { wch: 70 }];
  summary["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }];
  ["B14", "B15", "B16", "B17"].forEach((cell) => {
    if (summary[cell]) summary[cell].z = 'R$ #,##0.00';
  });

  const items = XLSX.utils.json_to_sheet(quoteRows(quote));
  items["!cols"] = [
    { wch: 16 }, { wch: 46 }, { wch: 11 }, { wch: 12 },
    { wch: 18 }, { wch: 16 }, { wch: 18 }, { wch: 18 }, { wch: 16 },
  ];
  const range = XLSX.utils.decode_range(items["!ref"] || "A1:I1");
  items["!autofilter"] = { ref: items["!ref"] || "A1:I1" };
  for (let row = 1; row <= range.e.r; row++) {
    [4, 5, 6, 7, 8].forEach((col) => {
      const ref = XLSX.utils.encode_cell({ r: row, c: col });
      if (items[ref]) items[ref].z = 'R$ #,##0.00';
    });
  }

  XLSX.utils.book_append_sheet(workbook, summary, "Resumo");
  XLSX.utils.book_append_sheet(workbook, items, "Itens e comparativo");
  XLSX.writeFile(workbook, `${fileName(quote.quote_number || "cotacao-ideal-prime")}.xlsx`);
}

export async function exportOrderSpreadsheet(order: OrderDocument) {
  const XLSX = await import("xlsx");
  const workbook = XLSX.utils.book_new();
  const delivery = order.delivery_snapshot || {};
  const terms = order.terms_snapshot || {};
  const summary = XLSX.utils.aoa_to_sheet([
    ["IDEAL PRIME — PEDIDO EMPRESARIAL"],
    ["Número", order.order_number || ""],
    ["Empresa", order.trade_name || order.legal_name || ""],
    ["Criado em", dateTime(order.created_at)],
    ["Status comercial", order.commercial_status || ""],
    ["Pagamento", order.payment_status || ""],
    ["Expedição", order.fulfillment_status || ""],
    ["Origem", (terms as any).quoteNumber ? `Cotação ${(terms as any).quoteNumber}` : "Pedido direto"],
    ["Referência do cliente", (delivery as any).customerReference || ""],
    ["Entrega desejada", dateOnly((delivery as any).requestedDeliveryDate)],
    ["Endereço/observação de entrega", (delivery as any).deliveryAddress || ""],
    ["Subtotal da cotação", cents((delivery as any).subtotalCents || order.total_cents)],
    ["Desconto", cents((delivery as any).discountCents)],
    ["Frete", cents((delivery as any).freightCents)],
    ["TOTAL DO PEDIDO", cents(order.total_cents)],
    ["Condição de pagamento", (terms as any).paymentTermsText || ""],
    ["Condição de entrega", (delivery as any).deliveryTermsText || ""],
    ["Observações comerciais", (terms as any).commercialNotes || ""],
  ]);
  summary["!cols"] = [{ wch: 31 }, { wch: 70 }];
  summary["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }];
  ["B12", "B13", "B14", "B15"].forEach((cell) => {
    if (summary[cell]) summary[cell].z = 'R$ #,##0.00';
  });

  const itemsData = (order.items || []).map((item) => ({
    SKU: item.sku_snapshot || "",
    Produto: item.name_snapshot || "",
    Unidade: item.unit_snapshot || "UN",
    Quantidade: Number(item.quantity || 0),
    "Preço unitário": cents(item.unit_price_cents),
    "Total do item": cents(item.total_cents),
  }));
  const items = XLSX.utils.json_to_sheet(itemsData);
  items["!cols"] = [{ wch: 16 }, { wch: 48 }, { wch: 11 }, { wch: 12 }, { wch: 18 }, { wch: 18 }];
  const range = XLSX.utils.decode_range(items["!ref"] || "A1:F1");
  items["!autofilter"] = { ref: items["!ref"] || "A1:F1" };
  for (let row = 1; row <= range.e.r; row++) {
    [4, 5].forEach((col) => {
      const ref = XLSX.utils.encode_cell({ r: row, c: col });
      if (items[ref]) items[ref].z = 'R$ #,##0.00';
    });
  }
  XLSX.utils.book_append_sheet(workbook, summary, "Resumo do pedido");
  XLSX.utils.book_append_sheet(workbook, items, "Itens");
  XLSX.writeFile(workbook, `${fileName(order.order_number || "pedido-ideal-prime")}.xlsx`);
}

function openPrintDocument(title: string, body: string) {
  const popup = window.open("", "_blank", "width=1100,height=900");
  if (!popup) throw new Error("Permita pop-ups para imprimir ou salvar o documento em PDF.");
  try { popup.opener = null; } catch {}
  popup.document.open();
  popup.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(title)}</title><style>
    @page{size:A4;margin:14mm}*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#17352c;margin:0;font-size:12px;line-height:1.45}.header{display:flex;justify-content:space-between;gap:24px;border-bottom:3px solid #087a55;padding-bottom:16px;margin-bottom:20px}.brand{font-family:Georgia,serif;font-size:26px;color:#087a55}.eyebrow{font-size:9px;letter-spacing:.18em;text-transform:uppercase;color:#4c7568;font-weight:700}.doc-title{font-size:24px;font-weight:700;margin:4px 0}.muted{color:#62776f}.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px 24px;margin:16px 0}.field{border-bottom:1px solid #dce8e3;padding:7px 0}.field b{display:block;font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:#648176;margin-bottom:3px}.panel{border:1px solid #dce8e3;border-radius:12px;padding:14px;margin:14px 0}.panel h3{margin:0 0 8px;font-size:13px}table{width:100%;border-collapse:collapse;margin-top:15px}th{background:#eef6f2;color:#164c3b;text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:.05em;padding:9px;border-bottom:1px solid #bdd7cc}td{padding:9px;border-bottom:1px solid #e5eeea;vertical-align:top}.num{text-align:right;white-space:nowrap}.totals{margin:16px 0 0 auto;width:310px}.totals div{display:flex;justify-content:space-between;padding:5px 0}.totals .grand{font-size:16px;font-weight:700;border-top:2px solid #087a55;margin-top:5px;padding-top:10px}.footer{margin-top:28px;border-top:1px solid #dce8e3;padding-top:12px;font-size:10px;color:#6e8179}.status{display:inline-block;padding:5px 9px;border-radius:999px;background:#e5f6ee;color:#087a55;font-weight:700;font-size:10px}@media print{button{display:none}}
  </style></head><body>${body}<script>window.onload=()=>setTimeout(()=>window.print(),250)<\/script></body></html>`);
  popup.document.close();
}

export function printQuoteDocument(quote: QuoteDocument) {
  const rows = quoteRows(quote);
  const body = `
    <div class="header"><div><div class="brand">Ideal Prime</div><div class="eyebrow">Comércio e distribuição</div></div><div style="text-align:right"><div class="eyebrow">Cotação empresarial</div><div class="doc-title">${esc(quote.quote_number || "Cotação")}</div><span class="status">${esc(quote.status || "")}</span></div></div>
    <div class="grid"><div class="field"><b>Empresa</b>${esc(quote.trade_name || quote.legal_name || "")}</div><div class="field"><b>CNPJ</b>${esc(quote.cnpj || "")}</div><div class="field"><b>Referência do cliente</b>${esc(quote.customer_reference || "—")}</div><div class="field"><b>Solicitada em</b>${esc(dateTime(quote.created_at))}</div><div class="field"><b>Contato</b>${esc(quote.contact_name || "—")}</div><div class="field"><b>Validade</b>${esc(dateOnly(quote.valid_until))}</div><div class="field"><b>Entrega desejada</b>${esc(dateOnly(quote.requested_delivery_date))}</div><div class="field"><b>Endereço/observação de entrega</b>${esc(quote.delivery_address || "—")}</div></div>
    <table><thead><tr><th>SKU</th><th>Produto</th><th>Un.</th><th class="num">Qtd.</th><th class="num">Referência</th><th class="num">Cotado</th><th class="num">Total</th></tr></thead><tbody>${rows.map((row) => `<tr><td>${esc(row.SKU)}</td><td>${esc(row.Produto)}</td><td>${esc(row.Unidade)}</td><td class="num">${esc(row.Quantidade)}</td><td class="num">${esc(money(Number(row["Preço referência"]) * 100))}</td><td class="num">${esc(money(Number(row["Preço cotado"]) * 100))}</td><td class="num"><b>${esc(money(Number(row["Total cotado"]) * 100))}</b></td></tr>`).join("")}</tbody></table>
    <div class="totals"><div><span>Subtotal</span><b>${esc(money(quote.subtotal_cents ?? quote.total_cents))}</b></div><div><span>Desconto</span><b>− ${esc(money(quote.discount_cents))}</b></div><div><span>Frete</span><b>${esc(money(quote.freight_cents))}</b></div><div class="grand"><span>Total</span><span>${esc(money(quote.total_cents))}</span></div></div>
    <div class="panel"><h3>Condições comerciais</h3><div><b>Pagamento:</b> ${esc(quote.payment_terms_text || "A confirmar")}</div><div><b>Entrega:</b> ${esc(quote.delivery_terms_text || "A confirmar")}</div>${quote.commercial_notes ? `<div style="margin-top:6px"><b>Observações comerciais:</b> ${esc(quote.commercial_notes)}</div>` : ""}${quote.notes ? `<div style="margin-top:6px"><b>Observações do cliente:</b> ${esc(quote.notes)}</div>` : ""}</div>
    <div class="footer">Ideal Prime · Documento gerado pela Área da Empresa. Preços e condições válidos conforme data indicada nesta cotação.</div>`;
  openPrintDocument(quote.quote_number || "Cotação Ideal Prime", body);
}

export function printOrderDocument(order: OrderDocument) {
  const delivery = order.delivery_snapshot || {};
  const terms = order.terms_snapshot || {};
  const body = `
    <div class="header"><div><div class="brand">Ideal Prime</div><div class="eyebrow">Comércio e distribuição</div></div><div style="text-align:right"><div class="eyebrow">Pedido empresarial</div><div class="doc-title">${esc(order.order_number || "Pedido")}</div><span class="status">${esc(order.commercial_status || "")}</span></div></div>
    <div class="grid"><div class="field"><b>Empresa</b>${esc(order.trade_name || order.legal_name || "")}</div><div class="field"><b>Criado em</b>${esc(dateTime(order.created_at))}</div><div class="field"><b>Referência do cliente</b>${esc((delivery as any).customerReference || "—")}</div><div class="field"><b>Origem</b>${esc((terms as any).quoteNumber ? `Cotação ${(terms as any).quoteNumber}` : "Pedido direto")}</div><div class="field"><b>Pagamento</b>${esc(order.payment_status || "")}</div><div class="field"><b>Expedição</b>${esc(order.fulfillment_status || "")}</div><div class="field"><b>Entrega desejada</b>${esc(dateOnly((delivery as any).requestedDeliveryDate))}</div><div class="field"><b>Endereço/observação de entrega</b>${esc((delivery as any).deliveryAddress || "—")}</div></div>
    <table><thead><tr><th>SKU</th><th>Produto</th><th>Un.</th><th class="num">Qtd.</th><th class="num">Preço unit.</th><th class="num">Total</th></tr></thead><tbody>${(order.items || []).map((item) => `<tr><td>${esc(item.sku_snapshot || "")}</td><td>${esc(item.name_snapshot || "")}</td><td>${esc(item.unit_snapshot || "")}</td><td class="num">${esc(item.quantity || 0)}</td><td class="num">${esc(money(item.unit_price_cents))}</td><td class="num"><b>${esc(money(item.total_cents))}</b></td></tr>`).join("")}</tbody></table>
    <div class="totals"><div><span>Subtotal</span><b>${esc(money((delivery as any).subtotalCents || order.total_cents))}</b></div><div><span>Desconto</span><b>− ${esc(money((delivery as any).discountCents))}</b></div><div><span>Frete</span><b>${esc(money((delivery as any).freightCents))}</b></div><div class="grand"><span>Total do pedido</span><span>${esc(money(order.total_cents))}</span></div></div>
    <div class="panel"><h3>Condições</h3><div><b>Pagamento:</b> ${esc((terms as any).paymentTermsText || "Conforme cadastro comercial")}</div><div><b>Entrega:</b> ${esc((delivery as any).deliveryTermsText || "Conforme confirmação operacional")}</div>${(terms as any).commercialNotes ? `<div style="margin-top:6px"><b>Observações:</b> ${esc((terms as any).commercialNotes)}</div>` : ""}</div>
    <div class="footer">Ideal Prime · Documento gerado pela Área da Empresa.</div>`;
  openPrintDocument(order.order_number || "Pedido Ideal Prime", body);
}
