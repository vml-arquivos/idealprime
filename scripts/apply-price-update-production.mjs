#!/usr/bin/env node
import * as XLSXModule from "xlsx";
import crypto from "node:crypto";
import fs from "node:fs";
import { Pool } from "pg";

const XLSX = XLSXModule.default ?? XLSXModule;
const file = process.env.PRICE_UPDATE_FILE || "/tmp/price-update-official.xlsx";
const contentHash = process.env.PRICE_UPDATE_HASH || "6f2cd1e97d79c32cdfef51c89d0a156df365966c48fcff842efc46a563a37b64";
const profileKey = process.env.PRICE_UPDATE_PROFILE || "catalog-master-prices-2026-09-14";
const expectedCount = 277;

if (!fs.existsSync(file)) throw new Error(`Arquivo não encontrado: ${file}`);
const workbook = XLSX.readFile(file, { raw: true, cellFormula: false });
if (!workbook.SheetNames.includes("PRODUTOS")) throw new Error("Aba PRODUTOS não encontrada");
const rows = XLSX.utils.sheet_to_json(workbook.Sheets.PRODUTOS, { defval: "", raw: true });
const prices = rows.map((row, index) => {
  const sku = String(row.sku ?? "").trim();
  const price = Number(row.preco_venda);
  if (!sku || !Number.isFinite(price) || price < 0) throw new Error(`Linha ${index + 2}: SKU/preço inválido`);
  return { rowNumber: index + 2, sku, priceCents: Math.round(price * 100) };
});
if (prices.length !== expectedCount) throw new Error(`Quantidade inesperada: ${prices.length}/${expectedCount}`);
if (new Set(prices.map((item) => item.sku)).size !== expectedCount) throw new Error("SKUs duplicados na planilha oficial");
const actualHash = crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();
try {
  const existing = await client.query("select id,status,summary from permupay_import_jobs where content_hash=$1 and profile_key=$2", [contentHash, profileKey]);
  if (existing.rows[0]?.status === "COMPLETED") {
    console.log(JSON.stringify({ repeated: true, job: existing.rows[0], fileHash: actualHash }));
    process.exit(0);
  }
  await client.query("begin");
  await client.query("select pg_advisory_xact_lock(1938142026)");
  const priceList = (await client.query("select id,name from permupay_price_lists where is_default=true and active=true limit 1")).rows[0];
  if (!priceList) throw new Error("Tabela de preços padrão não encontrada");
  const skus = prices.map((item) => item.sku);
  const products = await client.query("select id,sku from permupay_products where sku=any($1::text[]) and active=true", [skus]);
  if (products.rows.length !== expectedCount) throw new Error(`Produtos ativos correspondentes: ${products.rows.length}/${expectedCount}`);
  const productBySku = new Map(products.rows.map((row) => [row.sku, row.id]));
  const current = (await client.query("select max(version) as version from permupay_price_list_versions where price_list_id=$1", [priceList.id])).rows[0];
  const previousVersion = current.version ? Number(current.version) : null;
  const nextVersion = Number(current.version || 0) + 1;
  let changed = 0;
  if (previousVersion) {
    const old = await client.query("select p.sku,pli.price_cents from permupay_price_list_items pli join permupay_price_list_versions v on v.id=pli.version_id join permupay_products p on p.id=pli.product_id where v.price_list_id=$1 and v.version=$2 and pli.active=true", [priceList.id, previousVersion]);
    const oldBySku = new Map(old.rows.map((row) => [row.sku, Number(row.price_cents)]));
    changed = prices.filter((item) => oldBySku.get(item.sku) !== item.priceCents).length;
  }
  const job = (await client.query("insert into permupay_import_jobs(content_hash,profile_key,mode,price_list_id,reference_at,actor_user_id,status,summary) values($1,$2,'PRICES',$3,now(),null,'RUNNING',$4::jsonb) returning id", [contentHash, profileKey, priceList.id, JSON.stringify({ source: "PRODUTOSPRIME(1).xlsx", expected: expectedCount, fileHash: actualHash, changed, stockChanged: false })])).rows[0];
  const version = (await client.query("insert into permupay_price_list_versions(price_list_id,version,effective_from,created_by) values($1,$2,now(),null) returning id,version", [priceList.id, nextVersion])).rows[0];
  for (const item of prices) {
    await client.query("insert into permupay_price_list_items(version_id,product_id,price_cents,active) values($1,$2,$3,true)", [version.id, productBySku.get(item.sku), item.priceCents]);
  }
  for (const item of prices) {
    await client.query("insert into permupay_import_rows(job_id,row_number,sku,status,before_data,after_data) values($1,$2,$3,'UPDATED',null,$4::jsonb)", [job.id, item.rowNumber, item.sku, JSON.stringify({ price_cents: item.priceCents })]);
  }
  const summary = { source: "PRODUTOSPRIME(1).xlsx", expected: expectedCount, matched: products.rows.length, updated: expectedCount, changed, created: 0, stockChanged: false, version: Number(version.version), priceListId: priceList.id, fileHash: actualHash };
  await client.query("update permupay_import_jobs set status='COMPLETED',summary=$2::jsonb,completed_at=now() where id=$1", [job.id, JSON.stringify(summary)]);
  await client.query("commit");
  console.log(JSON.stringify({ repeated: false, jobId: job.id, priceListId: priceList.id, version: Number(version.version), matched: products.rows.length, updated: expectedCount, changed, stockChanged: false, fileHash: actualHash }));
} catch (error) {
  try { await client.query("rollback"); } catch {}
  console.error(error?.stack || error?.message || error);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
