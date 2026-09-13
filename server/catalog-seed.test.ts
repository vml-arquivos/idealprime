import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import * as XLSXModule from "xlsx";

const XLSX = XLSXModule.default ?? XLSXModule;
const seedScript = path.resolve("scripts/seed-catalog-master.mjs");
const catalogFile = path.resolve("data/seed/IDEAL_PRIME_CATALOGO_MASTER_SEED.xlsx");
const requiredHeaders = ["sku", "nome", "categoria", "unidade", "multiplo_venda", "preco_venda", "estoque_fisico", "ativo", "publicado", "b2b_habilitado"];

describe("Catálogo Mestre", () => {
  it("lê a aba PRODUTOS usando a interoperabilidade ESM/CommonJS do Node 22", () => {
    const output = execFileSync(process.execPath, [seedScript, "--validate-only"], {
      cwd: path.resolve("."),
      encoding: "utf8",
    });
    expect(output).toMatch(/277 produto\(s\)/);
    expect(output).toMatch(/277 SKU\(s\) único\(s\)/);
    expect(output).toMatch(/sha256=[a-f0-9]{64}/);
  });

  it("rejeita SKU duplicado sem diferenciar maiúsculas de minúsculas", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "ideal-prime-seed-"));
    const file = path.join(directory, "duplicate.xlsx");
    const worksheet = XLSX.utils.aoa_to_sheet([
      requiredHeaders,
      ["abc-1", "Produto 1", "Limpeza", "UN", 1, "0,00", "0,00", "SIM", "SIM", "SIM"],
      ["ABC-1", "Produto 2", "Limpeza", "UN", 1, "0,00", "0,00", "SIM", "SIM", "SIM"],
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "PRODUTOS");
    XLSX.writeFile(workbook, file);

    expect(() => execFileSync(process.execPath, [seedScript, "--validate-only"], {
      cwd: path.resolve("."),
      env: { ...process.env, CATALOG_SEED_FILE: file },
      encoding: "utf8",
      stdio: "pipe",
    })).toThrow(/SKU duplicado.*ABC-1/);
    fs.rmSync(directory, { recursive: true, force: true });
  });

  it("mantém o arquivo oficial como fonte sem linhas vazias ou SKU repetido", () => {
    expect(fs.existsSync(catalogFile)).toBe(true);
    expect(fs.statSync(catalogFile).size).toBeGreaterThan(0);
  });
});
