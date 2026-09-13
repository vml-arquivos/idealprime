#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import pg from "pg";
import * as XLSXModule from "xlsx";

// xlsx@0.18.x é CommonJS. Em Node 22 + package.json type=module, o namespace
// ESM expõe as APIs no default; usar somente `import * as XLSX` quebra readFile.
const XLSX = XLSXModule.default ?? XLSXModule;
const { Pool } = pg;
const VALIDATE_ONLY = process.argv.includes("--validate-only");
const DATABASE_URL = process.env.DATABASE_URL;
const FILE = process.env.CATALOG_SEED_FILE || path.resolve("data/seed/IDEAL_PRIME_CATALOGO_MASTER_SEED.xlsx");
const STOCK_MODE = String(process.env.CATALOG_SEED_STOCK_MODE || "SKIP").toUpperCase(); // SKIP | SET_IF_EMPTY | FORCE
const PROFILE_KEY = "ideal-prime-catalog-master-v1";
const REQUIRED_HEADERS = ["sku", "nome", "categoria", "unidade", "multiplo_venda", "preco_venda", "estoque_fisico", "ativo", "publicado", "b2b_habilitado"];

if (!["SKIP", "SET_IF_EMPTY", "FORCE"].includes(STOCK_MODE)) {
  console.error(`[Ideal Prime][seed] CATALOG_SEED_STOCK_MODE inválido: ${STOCK_MODE}`);
  process.exit(1);
}

function failValidation(message) {
  throw new Error(`validação da planilha: ${message}`);
}

function text(value) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function normalizeSku(value) {
  const sku = String(value ?? "").trim().toUpperCase();
  if (!sku) failValidation("SKU obrigatório");
  if (sku.length > 80) failValidation(`SKU excede 80 caracteres: ${sku}`);
  return sku;
}

function bool(value, fallback = false) {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (["SIM", "S", "TRUE", "1"].includes(normalized)) return true;
  if (["NAO", "NÃO", "N", "FALSE", "0"].includes(normalized)) return false;
  return fallback;
}

function validatedBool(value, field, fallback) {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (!normalized) return fallback;
  if (["SIM", "S", "TRUE", "1"].includes(normalized)) return true;
  if (["NAO", "NÃO", "N", "FALSE", "0"].includes(normalized)) return false;
  failValidation(`${field} inválido: ${value}`);
}

function numericText(value) {
  return String(value ?? "")
    .trim()
    .replace(/^R\$\s*/i, "")
    .replace(/\s/g, "");
}

function num(value, field = "valor", { optional = false, integer = false } = {}) {
  const raw = numericText(value);
  if (!raw) {
    if (optional) return null;
    failValidation(`${field} obrigatório`);
  }
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) failValidation(`${field} inválido: ${value}`);
  if (integer && !Number.isInteger(parsed)) failValidation(`${field} deve ser inteiro: ${value}`);
  return parsed;
}

function categoryEmoji(label) {
  const value = String(label ?? "").toLowerCase();
  if (/limpeza|deterg|desinf|cera/.test(value)) return "🧽";
  if (/higiene|cuidado|fralda/.test(value)) return "🧴";
  if (/descart|embalag/.test(value)) return "🥤";
  if (/epi|seguran/.test(value)) return "🦺";
  if (/papel|dispenser/.test(value)) return "🧻";
  if (/eletr/.test(value)) return "💻";
  if (/brinqu/.test(value)) return "🧸";
  if (/papelaria|escrit/.test(value)) return "📎";
  if (/cozinha|copa|utilidade|equipamento/.test(value)) return "🧹";
  if (/alimento|bebida/.test(value)) return "🥫";
  return "📦";
}

function slugify(value) {
  return String(value ?? "OUTROS")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80) || "OUTROS";
}

function validateHeaders(headers) {
  const normalized = new Set(headers.map((header) => String(header ?? "").trim().toLowerCase()));
  const missing = REQUIRED_HEADERS.filter((header) => !normalized.has(header));
  if (missing.length) failValidation(`colunas obrigatórias ausentes: ${missing.join(", ")}`);
}

export function readCatalogRows(file = FILE) {
  if (!fs.existsSync(file)) throw new Error(`Arquivo não encontrado: ${file}`);
  const workbook = XLSX.readFile(file, { cellFormula: false, cellHTML: false, cellStyles: false });
  if (!workbook.SheetNames.includes("PRODUTOS")) throw new Error("Seed deve conter a aba PRODUTOS.");

  const sheet = workbook.Sheets.PRODUTOS;
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false });
  const headers = (matrix[0] || []).map((value) => String(value).trim().toLowerCase());
  validateHeaders(headers);

  const rows = [];
  const seenSkus = new Set();
  for (const [index, values] of matrix.slice(1).entries()) {
    const rowNumber = index + 2;
    const raw = Object.fromEntries(headers.map((header, column) => [header, values[column] ?? ""]));
    if (!Object.values(raw).some((value) => String(value ?? "").trim())) continue;

    let sku;
    try {
      sku = normalizeSku(raw.sku);
      const name = text(raw.nome);
      const category = text(raw.categoria);
      const unit = text(raw.unidade);
      if (!name) failValidation("nome obrigatório");
      if (!category) failValidation("categoria obrigatória");
      if (!unit) failValidation("unidade obrigatória");
      if (seenSkus.has(sku)) failValidation(`SKU duplicado (case-insensitive): ${sku}`);
      seenSkus.add(sku);

      rows.push({
        sku,
        nome: name,
        categoria: category,
        subcategoria: text(raw.subcategoria),
        marca: text(raw.marca),
        unidade: unit,
        multiplo_venda: num(raw.multiplo_venda, "multiplo_venda", { integer: true }),
        preco_venda: num(raw.preco_venda, "preco_venda"),
        estoque_fisico: num(raw.estoque_fisico, "estoque_fisico"),
        estoque_minimo: num(raw.estoque_minimo, "estoque_minimo", { optional: true }),
        ncm: text(raw.ncm),
        descricao_curta: text(raw.descricao_curta),
        descricao: text(raw.descricao),
        imagem_url: text(raw.imagem_url),
        fonte_url: text(raw.fonte_url),
        termo_busca: text(raw.termo_busca),
        publicado: validatedBool(raw.publicado, "publicado", false),
        b2b_habilitado: validatedBool(raw.b2b_habilitado, "b2b_habilitado", true),
        ativo: validatedBool(raw.ativo, "ativo", true),
        observacoes: text(raw.observacoes),
      });
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("validação da planilha:")) {
        throw new Error(`linha ${rowNumber}: ${error.message}`);
      }
      throw error;
    }
  }

  if (!rows.length) failValidation("aba PRODUTOS sem registros");
  return { rows, sheetNames: workbook.SheetNames, headers };
}

async function ensureDefaultPriceList(client) {
  let result = await client.query(`select id from permupay_price_lists where active = true and is_default = true order by id limit 1`);
  if (result.rows[0]?.id) return Number(result.rows[0].id);
  result = await client.query(`insert into permupay_price_lists (name,is_default,active) values ('Tabela B2B padrão',true,true) returning id`);
  return Number(result.rows[0].id);
}

async function ensurePriceVersion(client, priceListId, hasRows) {
  if (!hasRows) return null;
  const current = await client.query(
    `select id,version from permupay_price_list_versions where price_list_id=$1 and effective_from<=now() order by version desc limit 1`,
    [priceListId],
  );
  if (current.rows[0]) return { id: Number(current.rows[0].id), version: Number(current.rows[0].version), created: false };

  const next = await client.query(`select coalesce(max(version),0)+1 as version from permupay_price_list_versions where price_list_id=$1`, [priceListId]);
  const inserted = await client.query(
    `insert into permupay_price_list_versions (price_list_id,version,effective_from,created_at) values ($1,$2,now(),now()) returning id,version`,
    [priceListId, Number(next.rows[0].version)],
  );
  return { id: Number(inserted.rows[0].id), version: Number(inserted.rows[0].version), created: true };
}

async function upsertCommercialPrice(client, versionId, productId, incomingCents, summary) {
  const existing = await client.query(`select id,price_cents from permupay_price_list_items where version_id=$1 and product_id=$2 for update`, [versionId, productId]);
  if (!existing.rows[0]) {
    await client.query(
      `insert into permupay_price_list_items (version_id,product_id,price_cents,active) values ($1,$2,$3,true)`,
      [versionId, productId, incomingCents],
    );
    summary.priceItemsCreated += 1;
    return;
  }

  const currentCents = Number(existing.rows[0].price_cents || 0);
  if (currentCents === 0 && incomingCents > 0) {
    await client.query(`update permupay_price_list_items set price_cents=$3,active=true where id=$1 and version_id=$2`, [existing.rows[0].id, versionId, incomingCents]);
    summary.priceItemsUpdated += 1;
  } else {
    await client.query(`update permupay_price_list_items set active=true where id=$1 and version_id=$2`, [existing.rows[0].id, versionId]);
    summary.priceItemsPreserved += 1;
  }
}

function getSeedFlags() {
  return {
    forceActive: bool(process.env.CATALOG_SEED_FORCE_ACTIVE, false),
    forcePublish: bool(process.env.CATALOG_SEED_FORCE_PUBLISH, false),
  };
}

export async function runSeed({ file = FILE, databaseUrl = DATABASE_URL } = {}) {
  const { rows, sheetNames } = readCatalogRows(file);
  if (!databaseUrl) throw new Error("DATABASE_URL não configurada.");
  const { forceActive, forcePublish } = getSeedFlags();
  const contentHash = crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
  const pool = new Pool({
    connectionString: databaseUrl,
    max: 2,
    ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: true } : false,
  });
  const client = await pool.connect();
  const summary = {
    rows: rows.length,
    created: 0,
    updated: 0,
    categories: 0,
    stockSkipped: 0,
    priceItemsCreated: 0,
    priceItemsUpdated: 0,
    priceItemsPreserved: 0,
    versionCreated: false,
    version: null,
    stockMode: STOCK_MODE,
    sheets: sheetNames.length,
  };

  try {
    await client.query("BEGIN");
    await client.query(`select pg_advisory_xact_lock(hashtextextended($1, 0))`, [PROFILE_KEY]);
    const previous = await client.query(
      `select id,summary from permupay_import_jobs where content_hash=$1 and profile_key=$2 and status='COMPLETED' limit 1`,
      [contentHash, PROFILE_KEY],
    );
    if (previous.rows[0]) {
      await client.query("COMMIT");
      return { repeated: true, contentHash, rows: rows.length, previousSummary: previous.rows[0].summary };
    }

    const priceListId = await ensureDefaultPriceList(client);
    const version = await ensurePriceVersion(client, priceListId, rows.length > 0);
    summary.versionCreated = Boolean(version?.created);
    summary.version = version?.version ?? null;

    const existingCategories = new Set((await client.query(`select slug from permupay_categories`)).rows.map((row) => row.slug));
    for (const row of rows) {
      const categoryLabel = row.categoria;
      const categorySlug = slugify(categoryLabel);
      const incomingPrice = row.preco_venda;
      const incomingStock = row.estoque_fisico;
      const minimumStock = row.estoque_minimo;
      const active = forceActive ? true : row.ativo;
      const published = forcePublish ? true : row.publicado;
      const b2bEnabled = row.b2b_habilitado;
      const initialStock = STOCK_MODE === "SKIP" ? 0 : incomingStock;

      await client.query(
        `insert into permupay_categories (slug,label,emoji,sort_order,active,created_at,updated_at)
         values ($1,$2,$3,500,true,now(),now())
         on conflict (slug) do update set label=excluded.label, active=true, updated_at=now()`,
        [categorySlug, categoryLabel, categoryEmoji(categoryLabel)],
      );
      if (!existingCategories.has(categorySlug)) {
        existingCategories.add(categorySlug);
        summary.categories += 1;
      }

      const found = await client.query(`select id,stock_quantity from permupay_products where upper(trim(sku))=upper(trim($1)) limit 1`, [row.sku]);
      let productId;
      if (found.rows[0]) {
        productId = Number(found.rows[0].id);
        let stockSql = "stock_quantity";
        if (STOCK_MODE === "SET_IF_EMPTY" && Number(found.rows[0].stock_quantity ?? 0) <= 0) stockSql = "$17";
        if (STOCK_MODE === "FORCE") {
          const waiting = await client.query(`select 1 from permupay_stock_queue where product_id=$1 and status in ('ATIVO','EM_ESPERA') limit 1`, [productId]);
          if (waiting.rows.length && incomingStock !== Number(found.rows[0].stock_quantity ?? 0)) {
            throw new Error(`SKU ${row.sku}: estoque não pode ser forçado porque há fila FIFO ativa/aguardando.`);
          }
          stockSql = "$17";
        } else if (STOCK_MODE === "SKIP") {
          summary.stockSkipped += 1;
        }

        await client.query(
          `update permupay_products set
             name=$2, unit=$3, sales_multiple=$4, b2b_enabled=$5,
             category_label=$6, subcategory=coalesce($7,subcategory), brand=coalesce($8,brand), ncm=coalesce($9,ncm),
             minimum_stock=coalesce($10,minimum_stock), short_description=coalesce($11,short_description), description=coalesce($12,description),
             image_url=coalesce($13,image_url), source_url=coalesce($14,source_url), search_term=coalesce($15,search_term),
             active=$16, stock_quantity=${stockSql}, published=case when $18 then true else published end,
             notes=coalesce($19,notes), updated_at=now()
           where id=$1`,
          [
            productId,
            row.nome,
            row.unidade,
            row.multiplo_venda,
            b2bEnabled,
            categoryLabel,
            row.subcategoria,
            row.marca,
            row.ncm,
            minimumStock,
            row.descricao_curta,
            row.descricao,
            row.imagem_url,
            row.fonte_url,
            row.termo_busca,
            active,
            incomingStock,
            published,
            row.observacoes,
          ],
        );
        summary.updated += 1;
      } else {
        const inserted = await client.query(
          `insert into permupay_products (
             sku,name,category,category_label,subcategory,brand,unit,sales_multiple,b2b_enabled,ncm,
             stock_quantity,minimum_stock,image_url,short_description,description,source_url,search_term,
             suggested_price,suggested_price_pix,suggested_price_card,suggested_price_boleto,published,active,notes,created_at,updated_at
           ) values (
             $1,$2,'OUTRO',$3,$4,$5,$6,$7,$8,$9,
             $10,$11,$12,$13,$14,$15,$16,
             $17,$17,$17,$17,$18,$19,$20,now(),now()
           ) returning id`,
          [
            row.sku,
            row.nome,
            categoryLabel,
            row.subcategoria,
            row.marca,
            row.unidade,
            row.multiplo_venda,
            b2bEnabled,
            row.ncm,
            initialStock,
            minimumStock ?? 0,
            row.imagem_url,
            row.descricao_curta,
            row.descricao,
            row.fonte_url,
            row.termo_busca,
            incomingPrice,
            published,
            active,
            row.observacoes,
          ],
        );
        productId = Number(inserted.rows[0].id);
        summary.created += 1;
      }

      if (version) await upsertCommercialPrice(client, version.id, productId, Math.round(incomingPrice * 100), summary);
    }

    await client.query(
      `insert into permupay_import_jobs (content_hash,profile_key,mode,price_list_id,status,summary,created_at,completed_at)
       values ($1,$2,'PRICES',$3,'COMPLETED',$4::jsonb,now(),now())
       on conflict (content_hash,profile_key) do update set summary=excluded.summary, completed_at=now(), status='COMPLETED'`,
      [contentHash, PROFILE_KEY, priceListId, JSON.stringify(summary)],
    );
    await client.query("COMMIT");
    return { repeated: false, contentHash, summary };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

async function main() {
  const { rows, sheetNames } = readCatalogRows();
  const contentHash = crypto.createHash("sha256").update(fs.readFileSync(FILE)).digest("hex");
  if (VALIDATE_ONLY) {
    console.log(`[Ideal Prime][seed] validação concluída: ${rows.length} produto(s), ${new Set(rows.map((row) => row.categoria)).size} categoria(s), ${new Set(rows.map((row) => row.sku)).size} SKU(s) único(s), ${sheetNames.length} aba(s); sha256=${contentHash}.`);
    return;
  }

  const result = await runSeed();
  if (result.repeated) {
    console.log(`[Ideal Prime][seed] arquivo já aplicado (${result.contentHash.slice(0, 12)}…); nenhuma alteração necessária; ${result.rows} produto(s) ignorado(s) por idempotência.`);
    return;
  }
  console.log(`[Ideal Prime][seed] concluído: ${JSON.stringify(result.summary)}`);
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (import.meta.url === invokedPath) {
  main().catch((error) => {
    console.error("[Ideal Prime][seed] falha:", error);
    process.exitCode = 1;
  });
}
