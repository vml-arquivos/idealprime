#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import * as XLSXModule from "xlsx";

const XLSX = XLSXModule.default ?? XLSXModule;

const inputFile = process.env.PRICE_UPDATE_INPUT || process.argv[2] || path.resolve("/home/ubuntu/upload/PRODUTOSPRIME(1).xlsx");
const masterFile = process.env.PRICE_UPDATE_MASTER || process.argv[3] || path.resolve("data/seed/IDEAL_PRIME_CATALOGO_MASTER_SEED.xlsx");
const outputFile = process.env.PRICE_UPDATE_OUTPUT || process.argv[4] || path.resolve("/tmp/ideal-prime-price-update.xlsx");
const reportFile = process.env.PRICE_UPDATE_REPORT || `${outputFile}.json`;

function normalize(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/&/g, " E ")
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parsePrice(value, context) {
  const raw = String(value ?? "").trim().replace(/^R\$\s*/i, "").replace(/\s/g, "");
  if (!raw) throw new Error(`${context}: preço vazio`);
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount < 0) throw new Error(`${context}: preço inválido (${value})`);
  return Math.round(amount * 100) / 100;
}

function readRows(file, sheetName) {
  if (!fs.existsSync(file)) throw new Error(`Arquivo não encontrado: ${file}`);
  const workbook = XLSX.readFile(file, { cellFormula: false, cellHTML: false, cellStyles: true, raw: false });
  const selectedSheet = sheetName ?? workbook.SheetNames[0];
  if (!selectedSheet || !workbook.SheetNames.includes(selectedSheet)) throw new Error(`${file}: aba ${selectedSheet ?? "principal"} não encontrada`);
  const matrix = XLSX.utils.sheet_to_json(workbook.Sheets[selectedSheet], { header: 1, defval: "", raw: false });
  return { workbook, sheet: workbook.Sheets[selectedSheet], matrix };
}

function extractLegacyPrices(file) {
  const { matrix } = readRows(file);
  const headers = (matrix[0] ?? []).map((value) => String(value ?? "").trim().toUpperCase());
  const blocks = [];
  for (let column = 0; column + 1 < headers.length; column += 2) {
    const category = headers[column];
    const priceHeader = headers[column + 1];
    if (!category) continue;
    if (!priceHeader.includes("VALOR")) throw new Error(`Bloco ${category}: coluna de valor inválida`);
    blocks.push({ column, category });
  }
  if (!blocks.length) throw new Error("A planilha legada não contém blocos produto/valor");

  const byName = new Map();
  const sourceRows = [];
  for (let rowIndex = 1; rowIndex < matrix.length; rowIndex += 1) {
    const row = matrix[rowIndex];
    for (const block of blocks) {
      const name = String(row[block.column] ?? "").trim();
      const rawPrice = row[block.column + 1];
      if (!name && !String(rawPrice ?? "").trim()) continue;
      if (!name) throw new Error(`Linha ${rowIndex + 1}, ${block.category}: produto vazio`);
      const normalized = normalize(name);
      const price = parsePrice(rawPrice, `Linha ${rowIndex + 1}, ${name}`);
      const item = { row: rowIndex + 1, category: block.category, name, normalized, price };
      const previous = byName.get(normalized);
      if (previous && previous.price !== price) {
        throw new Error(`Preço conflitante para ${name}: ${previous.price} e ${price}`);
      }
      if (!previous) {
        byName.set(normalized, item);
        sourceRows.push(item);
      }
    }
  }
  return { rows: sourceRows, duplicateCount: sourceRows.length ? countDuplicates(matrix, blocks) : 0, blocks };
}

function countDuplicates(matrix, blocks) {
  const counts = new Map();
  for (let rowIndex = 1; rowIndex < matrix.length; rowIndex += 1) {
    const row = matrix[rowIndex];
    for (const block of blocks) {
      const name = String(row[block.column] ?? "").trim();
      if (name) counts.set(normalize(name), (counts.get(normalize(name)) ?? 0) + 1);
    }
  }
  return [...counts.values()].filter((count) => count > 1).length;
}

function loadMaster(file) {
  const { workbook, sheet, matrix } = readRows(file, "PRODUTOS");
  const headers = (matrix[0] ?? []).map((value) => String(value ?? "").trim().toLowerCase());
  const skuColumn = headers.indexOf("sku");
  const nameColumn = headers.indexOf("nome");
  const priceColumn = headers.indexOf("preco_venda");
  if (skuColumn < 0 || nameColumn < 0 || priceColumn < 0) {
    throw new Error("Catálogo mestre precisa das colunas sku, nome e preco_venda");
  }
  const rows = [];
  const byName = new Map();
  for (let rowIndex = 1; rowIndex < matrix.length; rowIndex += 1) {
    const values = matrix[rowIndex] ?? [];
    const sku = String(values[skuColumn] ?? "").trim();
    const name = String(values[nameColumn] ?? "").trim();
    if (!sku && !name) continue;
    if (!sku || !name) throw new Error(`Catálogo mestre: linha ${rowIndex + 1} sem SKU ou nome`);
    const normalized = normalize(name);
    if (byName.has(normalized)) throw new Error(`Catálogo mestre: nome duplicado ${name}`);
    const item = { row: rowIndex + 1, sku, name, normalized, priceColumn };
    byName.set(normalized, item);
    rows.push(item);
  }
  return { workbook, sheet, matrix, headers, rows, byName, priceColumn };
}

function main() {
  const legacy = extractLegacyPrices(inputFile);
  const master = loadMaster(masterFile);
  const matched = [];
  const missing = [];
  for (const incoming of legacy.rows) {
    const product = master.byName.get(incoming.normalized);
    if (!product) {
      missing.push(incoming);
      continue;
    }
    matched.push({ ...incoming, sku: product.sku, masterName: product.name, masterRow: product.row });
  }
  if (missing.length) {
    throw new Error(`Reconciliação incompleta: ${missing.length} produto(s) sem correspondência exata: ${missing.map((item) => item.name).join("; ")}`);
  }
  if (matched.length !== master.rows.length) {
    throw new Error(`Reconciliação incompleta: ${matched.length} preços encontrados para ${master.rows.length} produtos do catálogo mestre`);
  }

  const priceBySku = new Map(matched.map((item) => [item.sku, item.price]));
  const priceHeaderIndex = master.headers.indexOf("preco_venda");
  const headerCells = master.sheet["!ref"] ? XLSX.utils.decode_range(master.sheet["!ref"]) : null;
  if (!headerCells) throw new Error("Catálogo mestre sem intervalo de dados");
  for (const product of master.rows) {
    const cellAddress = XLSX.utils.encode_cell({ r: product.row - 1, c: priceHeaderIndex });
    const cell = master.sheet[cellAddress] ?? {};
    const price = priceBySku.get(product.sku);
    cell.t = "n";
    cell.v = price;
    cell.z = '[$R$-pt-BR] #,##0.00';
    master.sheet[cellAddress] = cell;
  }
  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  XLSX.writeFile(master.workbook, outputFile, { bookType: "xlsx", compression: true });

  const report = {
    inputFile,
    masterFile,
    outputFile,
    inputSha256: crypto.createHash("sha256").update(fs.readFileSync(inputFile)).digest("hex"),
    outputSha256: crypto.createHash("sha256").update(fs.readFileSync(outputFile)).digest("hex"),
    blocks: legacy.blocks.map((block) => block.category),
    inputRows: legacy.rows.length,
    duplicateNameGroups: legacy.duplicateCount,
    masterRows: master.rows.length,
    matchedRows: matched.length,
    missingRows: missing.length,
    stockChanged: false,
    matched,
  };
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({
    inputRows: report.inputRows,
    duplicateNameGroups: report.duplicateNameGroups,
    masterRows: report.masterRows,
    matchedRows: report.matchedRows,
    missingRows: report.missingRows,
    stockChanged: report.stockChanged,
    outputFile,
    reportFile,
  }));
}

main();
