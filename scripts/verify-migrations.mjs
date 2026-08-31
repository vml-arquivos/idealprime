import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const drizzleDir = join(root, "drizzle");
const journalPath = join(drizzleDir, "meta", "_journal.json");

function fail(message) {
  console.error(`[migrate:verify] ERRO: ${message}`);
  process.exitCode = 1;
}

if (!existsSync(journalPath)) {
  fail(`journal não encontrado: ${journalPath}`);
  process.exit();
}

const journal = JSON.parse(readFileSync(journalPath, "utf8"));
const entries = Array.isArray(journal.entries) ? journal.entries : [];
const journalTags = entries.map((entry) => entry.tag);
const sqlTags = readdirSync(drizzleDir)
  .filter((file) => file.endsWith(".sql"))
  .map((file) => file.slice(0, -4));

const duplicateTags = journalTags.filter((tag, index) => journalTags.indexOf(tag) !== index);
const missingFromJournal = sqlTags.filter((tag) => !journalTags.includes(tag));
const missingFiles = journalTags.filter((tag) => !sqlTags.includes(tag));

if (duplicateTags.length > 0) {
  fail(`tags duplicadas no journal: ${[...new Set(duplicateTags)].join(", ")}`);
}

if (missingFromJournal.length > 0) {
  fail(`arquivos SQL sem entrada no journal: ${missingFromJournal.join(", ")}`);
}

if (missingFiles.length > 0) {
  fail(`entradas do journal sem arquivo SQL: ${missingFiles.join(", ")}`);
}

const expectedOrder = [...sqlTags].sort((a, b) => {
  const numberA = Number.parseInt(a.match(/^\\d+/)?.[0] ?? "-1", 10);
  const numberB = Number.parseInt(b.match(/^\\d+/)?.[0] ?? "-1", 10);
  return numberA - numberB || a.localeCompare(b);
});

if (journalTags.length === expectedOrder.length && journalTags.some((tag, index) => tag !== expectedOrder[index])) {
  fail(
    `ordem incorreta. Esperado: ${expectedOrder.join(" -> ")}; encontrado: ${journalTags.join(" -> ")}`
  );
}

if (!process.exitCode) {
  console.log(`[migrate:verify] OK: ${sqlTags.length} migration(s) SQL conferida(s) 1:1 com o journal.`);
}
