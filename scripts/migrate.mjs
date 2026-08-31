#!/usr/bin/env node
// migrate.mjs — v2
// Correções em relação à v1:
//   1. Advisory lock via pg_try_advisory_lock → apenas UMA instância migra por vez,
//      mesmo com múltiplos containers subindo simultaneamente (race condition fix).
//   2. Arquivo SQL não encontrado → ERRO FATAL em vez de registrar silenciosamente
//      como aplicado. Isso impede o bug onde a migration era "pulada" sem executar DDL.

import pg from "pg";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { readFileSync } from "fs";

const { Client, Pool } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("[migrate] ERRO: DATABASE_URL não definida.");
  process.exit(1);
}

// ── 1. Aguardar o banco ──────────────────────────────────────────────────────
const MAX_TRIES = 60;
let tries = 0;
let connected = false;

console.log("[migrate] Aguardando banco de dados...");
console.log("[migrate] DATABASE_URL:", DATABASE_URL.replace(/:([^:@]+)@/, ":***@"));

while (!connected && tries < MAX_TRIES) {
  tries++;
  try {
    const client = new Client({
      connectionString: DATABASE_URL,
      ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: true } : false,
      connectionTimeoutMillis: 3000,
    });
    await client.connect();
    await client.end();
    connected = true;
    console.log(`[migrate] Banco disponível após ${tries} tentativa(s).`);
  } catch (err) {
    console.log(`[migrate] Tentativa ${tries}/${MAX_TRIES} — ${err.message}`);
    await new Promise((r) => setTimeout(r, 3000));
  }
}

if (!connected) {
  console.error("[migrate] ERRO: Banco não respondeu. Abortando.");
  process.exit(1);
}

// ── 2. Conectar e adquirir advisory lock ────────────────────────────────────
// pg_advisory_lock(key) → lock exclusivo no nível de sessão.
// Apenas UM processo consegue o lock por vez; os demais aguardam.
// Número arbitrário, único por aplicação — não mude após produção.
const MIGRATE_LOCK_KEY = 987654321;

const pool = new Pool({ connectionString: DATABASE_URL, ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: true } : false });
const client = await pool.connect();

console.log("[migrate] Aguardando lock exclusivo de migrate (pg_advisory_lock)...");
// pg_advisory_lock bloqueia até conseguir — sem timeout, sem skip.
// Isso serializa múltiplos containers automaticamente.
await client.query(`SELECT pg_advisory_lock(${MIGRATE_LOCK_KEY})`);
console.log("[migrate] Lock adquirido. Executando migrations...");

try {
  // ── 3. Criar tabela de controle se não existir ─────────────────────────────
  await client.query(`
    CREATE TABLE IF NOT EXISTS drizzle_migrations (
      id         serial PRIMARY KEY,
      hash       text NOT NULL UNIQUE,
      created_at bigint
    );
  `);

  // ── 4. Ler journal e aplicar migrations pendentes ──────────────────────────
  const journalPath = join(process.cwd(), "drizzle", "meta", "_journal.json");
  const journal = JSON.parse(readFileSync(journalPath, "utf8"));

  const { rows: applied } = await client.query("SELECT hash FROM drizzle_migrations");
  const appliedSet = new Set(applied.map((r) => r.hash));

  console.log("[migrate] Aplicando migrations...");

  for (const entry of journal.entries) {
    if (appliedSet.has(entry.tag)) {
      console.log(`[migrate] Pulando (já aplicada): ${entry.tag}`);
      continue;
    }

    const sqlPath = join(process.cwd(), "drizzle", `${entry.tag}.sql`);
    let sql;
    try {
      sql = readFileSync(sqlPath, "utf8");
    } catch {
      // CORREÇÃO: arquivo ausente é ERRO FATAL — não registre como aplicado.
      // Na v1 isso causava o bug de migrations "fantasmas" no controle.
      console.error(
        `[migrate] ERRO FATAL: Arquivo de migration não encontrado: ${sqlPath}`
      );
      console.error(
        `[migrate] Verifique se o arquivo está incluído no build (COPY drizzle/ no Dockerfile).`
      );
      await client.query(`SELECT pg_advisory_unlock(${MIGRATE_LOCK_KEY})`);
      client.release();
      await pool.end();
      process.exit(1);
    }

    // Separar por breakpoints do Drizzle Kit
    const statements = sql
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    let success = true;
    for (const stmt of statements) {
      try {
        await client.query(stmt);
      } catch (err) {
        // Ignorar apenas erros de "já existe" — safe em migrações idempotentes
        if (
          err.code === "42701" || // column already exists
          err.code === "42P07" || // relation already exists
          err.code === "42710" || // duplicate_object (index, constraint)
          err.message.includes("already exists")
        ) {
          console.log(`[migrate] Aviso (já existe, ignorando): ${err.message.split("\n")[0]}`);
        } else {
          console.error(`[migrate] Erro em ${entry.tag}: ${err.message}`);
          success = false;
          break;
        }
      }
    }

    if (!success) {
      console.error(`[migrate] Migration ${entry.tag} falhou. Abortando.`);
      await client.query(`SELECT pg_advisory_unlock(${MIGRATE_LOCK_KEY})`);
      client.release();
      await pool.end();
      process.exit(1);
    }

    await client.query(
      "INSERT INTO drizzle_migrations (hash, created_at) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [entry.tag, entry.when]
    );
    console.log(`[migrate] ✓ ${entry.tag}`);
  }

  console.log("[migrate] Migrations aplicadas com sucesso!");
} catch (err) {
  console.error("[migrate] Erro fatal:", err.message);
  await client.query(`SELECT pg_advisory_unlock(${MIGRATE_LOCK_KEY})`).catch(() => {});
  client.release();
  await pool.end();
  process.exit(1);
}

// Libera o lock explicitamente (também é liberado automaticamente ao fechar conexão)
await client.query(`SELECT pg_advisory_unlock(${MIGRATE_LOCK_KEY})`);
client.release();
await pool.end();
process.exit(0);
