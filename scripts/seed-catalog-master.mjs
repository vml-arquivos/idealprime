#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import * as XLSXModule from "xlsx";

const XLSX = XLSXModule.default ?? XLSXModule;
const { Pool } = pg;
const VALIDATE_ONLY = process.argv.includes("--validate-only");
const DATABASE_URL = process.env.DATABASE_URL;

const FILE = process.env.CATALOG_SEED_FILE || path.resolve("data/seed/IDEAL_PRIME_CATALOGO_MASTER_SEED.xlsx");
const STOCK_MODE = String(process.env.CATALOG_SEED_STOCK_MODE || "SKIP").toUpperCase(); // SKIP | SET_IF_EMPTY | FORCE
if (!["SKIP", "SET_IF_EMPTY", "FORCE"].includes(STOCK_MODE)) {
  console.error(`[Ideal Prime][seed] CATALOG_SEED_STOCK_MODE inválido: ${STOCK_MODE}`);
  process.exit(1);
}
const PROFILE_KEY = "ideal-prime-catalog-master-v1";

if (!fs.existsSync(FILE)) {
  console.error(`[Ideal Prime][seed] Arquivo não encontrado: ${FILE}`);
  process.exit(1);
}

function bool(v, fallback = false) {
  const s = String(v ?? "").trim().toUpperCase();
  if (["SIM", "S", "TRUE", "1"].includes(s)) return true;
  if (["NAO", "NÃO", "N", "FALSE", "0"].includes(s)) return false;
  return fallback;
}

const FORCE_ACTIVE = bool(process.env.CATALOG_SEED_FORCE_ACTIVE, false);
const FORCE_PUBLISH = bool(process.env.CATALOG_SEED_FORCE_PUBLISH, false);

function num(v) {
  const raw = String(v ?? "").trim();
  if (!raw) return 0;
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  const n = Number(normalized);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function text(v) {
  const s = String(v ?? "").trim();
  return s || null;
}

function optionalNum(v) {
  const raw = String(v ?? "").trim();
  return raw ? num(v) : null;
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

function readRows() {
  const workbook = XLSX.readFile(FILE, { cellFormula: false, cellHTML: false, cellStyles: false });
  if (!workbook.SheetNames.includes("PRODUTOS")) throw new Error("Seed deve conter a aba PRODUTOS.");
  const sheet = workbook.Sheets.PRODUTOS;
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false });
  return rows.filter((r) => String(r.sku ?? "").trim() && String(r.nome ?? "").trim());
}

async function ensureDefaultPriceList(client) {
  let result = await client.query(`select id from permupay_price_lists where active = true and is_default = true order by id limit 1`);
  if (result.rows[0]?.id) return Number(result.rows[0].id);
  result = await client.query(`insert into permupay_price_lists (name,is_default,active) values ('Tabela B2B padrão',true,true) returning id`);
  return Number(result.rows[0].id);
}

async function ensurePriceVersion(client, priceListId, hasRows) {
  if (!hasRows) return null;
  const current = await client.query(`select coalesce(max(version),0) as version from permupay_price_list_versions where price_list_id=$1`, [priceListId]);
  const version = Number(current.rows[0]?.version ?? 0) + 1;
  const inserted = await client.query(`insert into permupay_price_list_versions (price_list_id,version,effective_from,created_at) values ($1,$2,now(),now()) returning id`, [priceListId, version]);
  return Number(inserted.rows[0].id);
}

async function main() {
  const rows = readRows();
  if (VALIDATE_ONLY) {
    console.log(`[Ideal Prime][seed] validação concluída: ${rows.length} produto(s) na aba PRODUTOS.`);
    return;
  }
  if (!DATABASE_URL) {
    console.error("[Ideal Prime][seed] DATABASE_URL não configurada.");
    process.exitCode = 1;
    return;
  }

  const contentHash = crypto.createHash("sha256").update(fs.readFileSync(FILE)).digest("hex");
  const pool = new Pool({ connectionString: DATABASE_URL, max: 2 });
  const client = await pool.connect();
  const summary = { created: 0, updated: 0, categories: 0, prices: 0, stockSkipped: 0, rows: rows.length };

  try {
    await client.query("BEGIN");
    await client.query(`select pg_advisory_xact_lock(hashtext($1)::bigint)`, [PROFILE_KEY]);
    const previous = await client.query(
      `select id from permupay_import_jobs where content_hash=$1 and profile_key=$2 and status='COMPLETED' limit 1`,
      [contentHash, PROFILE_KEY],
    );
    if (previous.rows[0]) {
      await client.query("COMMIT");
      console.log(`[Ideal Prime][seed] arquivo já aplicado (${contentHash.slice(0, 12)}…); nenhuma alteração necessária.`);
      return;
    }

    const priceListId = await ensureDefaultPriceList(client);
    const versionId = await ensurePriceVersion(client, priceListId, rows.length > 0);

    const existingCategories = new Set((await client.query(`select slug from permupay_categories`)).rows.map((r) => r.slug));

    for (const row of rows) {
      const sku = String(row.sku).trim().toUpperCase();
      const name = String(row.nome).trim();
      const categoryLabel = String(row.categoria || "Outros").trim();
      const categorySlug = slugify(categoryLabel);
      const price = num(row.preco_venda);
      const incomingStock = num(row.estoque_fisico);
      const minimumStock = optionalNum(row.estoque_minimo);
      const active = FORCE_ACTIVE ? true : bool(row.ativo, true);
      const published = FORCE_PUBLISH ? true : bool(row.publicado, false);
      const b2bEnabled = bool(row.b2b_habilitado, true);
      const initialStock = STOCK_MODE === "SKIP" ? 0 : incomingStock;

      await client.query(`
        insert into permupay_categories (slug,label,emoji,sort_order,active,created_at,updated_at)
        values ($1,$2,$3,500,true,now(),now())
        on conflict (slug) do update set label=excluded.label, active=true, updated_at=now()
      `, [categorySlug, categoryLabel, categoryEmoji(categoryLabel)]);
      if (!existingCategories.has(categorySlug)) {
        existingCategories.add(categorySlug);
        summary.categories += 1;
      }

      const found = await client.query(`select id, stock_quantity from permupay_products where upper(sku)=upper($1) limit 1`, [sku]);
      let productId;

      if (found.rows[0]) {
        productId = Number(found.rows[0].id);
        let stockSql = "stock_quantity";
        if (STOCK_MODE === "SET_IF_EMPTY" && Number(found.rows[0].stock_quantity ?? 0) <= 0) stockSql = "$17";
        if (STOCK_MODE === "FORCE") {
          const waiting = await client.query(`select 1 from permupay_stock_queue where product_id=$1 and status in ('ATIVO','EM_ESPERA') limit 1`, [productId]);
          if (waiting.rows.length && incomingStock !== Number(found.rows[0].stock_quantity ?? 0)) {
            throw new Error(`SKU ${sku}: estoque não pode ser forçado porque há fila FIFO ativa/aguardando.`);
          }
          stockSql = "$17";
        } else if (STOCK_MODE === "SKIP") {
          summary.stockSkipped += 1;
        }

        await client.query(`
          update permupay_products set
            name=$2, unit=$3, sales_multiple=$4, b2b_enabled=$5,
            category_label=$6, subcategory=coalesce($7,subcategory), brand=coalesce($8,brand), ncm=coalesce($9,ncm),
            minimum_stock=coalesce($10,minimum_stock), short_description=coalesce($11,short_description), description=coalesce($12,description),
            image_url=coalesce($13,image_url), source_url=coalesce($14,source_url), search_term=coalesce($15,search_term),
            active=$16, stock_quantity=${stockSql}, published=case when $18 then true else published end,
            notes=coalesce($19,notes), updated_at=now()
          where id=$1
        `, [
          productId,
          name,
          text(row.unidade) || "UN",
          Math.max(1, Math.round(num(row.multiplo_venda) || 1)),
          b2bEnabled,
          categoryLabel,
          text(row.subcategoria),
          text(row.marca),
          text(row.ncm),
          minimumStock,
          text(row.descricao_curta),
          text(row.descricao),
          text(row.imagem_url),
          text(row.fonte_url),
          text(row.termo_busca),
          active,
          incomingStock,
          published,
          text(row.observacoes),
        ]);
        summary.updated += 1;
      } else {
        const inserted = await client.query(`
          insert into permupay_products (
            sku,name,category,category_label,subcategory,brand,unit,sales_multiple,b2b_enabled,ncm,
            stock_quantity,minimum_stock,image_url,short_description,description,source_url,search_term,
            suggested_price,suggested_price_pix,suggested_price_card,suggested_price_boleto,published,active,notes,created_at,updated_at
          ) values (
            $1,$2,'OUTRO',$3,$4,$5,$6,$7,$8,$9,
            $10,$11,$12,$13,$14,$15,$16,
            $17,$17,$17,$17,$18,$19,$20,now(),now()
          ) returning id
        `, [
          sku,
          name,
          categoryLabel,
          text(row.subcategoria),
          text(row.marca),
          text(row.unidade) || "UN",
          Math.max(1, Math.round(num(row.multiplo_venda) || 1)),
          b2bEnabled,
          text(row.ncm),
          initialStock,
          minimumStock ?? 0,
          text(row.imagem_url),
          text(row.descricao_curta),
          text(row.descricao),
          text(row.fonte_url),
          text(row.termo_busca),
          price,
          published,
          active,
          text(row.observacoes),
        ]);
        productId = Number(inserted.rows[0].id);
        summary.created += 1;
      }

      if (versionId) {
        await client.query(`insert into permupay_price_list_items (version_id,product_id,price_cents,active) values ($1,$2,$3,true) on conflict (version_id,product_id) do update set price_cents=excluded.price_cents, active=true`, [versionId, productId, Math.round(price * 100)]);
        summary.prices += 1;
      }
    }

    await client.query(`
      insert into permupay_import_jobs (content_hash,profile_key,mode,price_list_id,status,summary,created_at,completed_at)
      values ($1,$2,'PRICES',$3,'COMPLETED',$4::jsonb,now(),now())
      on conflict (content_hash,profile_key) do update set summary=excluded.summary, completed_at=now(), status='COMPLETED'
    `, [contentHash, PROFILE_KEY, priceListId, JSON.stringify(summary)]);

    await client.query("COMMIT");
    console.log(`[Ideal Prime][seed] concluído: ${JSON.stringify(summary)}`);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("[Ideal Prime][seed] falha:", error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
