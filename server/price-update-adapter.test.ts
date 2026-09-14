import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import * as XLSXModule from "xlsx";

const XLSX = XLSXModule.default ?? XLSXModule;
const adapter = path.resolve("scripts/prepare-price-update.mjs");

function writeWorkbook(file: string, sheets: Record<string, unknown[][]>) {
  const workbook = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), name);
  }
  XLSX.writeFile(workbook, file);
}

describe("adaptador de preços legados", () => {
  it("consolida duplicidade idêntica, reconcilia por nome e preserva o estoque do modelo", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "ideal-prime-price-update-"));
    const legacy = path.join(directory, "legacy.xlsx");
    const master = path.join(directory, "master.xlsx");
    const output = path.join(directory, "output.xlsx");

    writeWorkbook(legacy, {
      Planilha1: [
        ["LIMPEZA", "VALOR", "HIGIENE", "VALOR"],
        ["ÁGUA TESTE 5L", "R$ 20,72", "CREME TESTE 1X1", "R$ 9.99"],
        ["ÁGUA TESTE 5L", "20,72", "", ""],
      ],
    });
    writeWorkbook(master, {
      PRODUTOS: [
        ["sku", "nome", "categoria", "unidade", "multiplo_venda", "preco_venda", "estoque_fisico", "ativo", "publicado", "b2b_habilitado"],
        ["IP-LIM-TESTE", "ÁGUA TESTE 5L", "Limpeza", "UN", 1, 0, 12, "SIM", "SIM", "SIM"],
        ["IP-HIG-TESTE", "CREME TESTE 1X1", "Higiene", "UN", 1, 0, 7, "SIM", "SIM", "SIM"],
      ],
      FONTES_WEB: [["produto", "fonte_url"]],
    });

    const outputText = execFileSync(process.execPath, [adapter, legacy, master, output], { encoding: "utf8" });
    expect(outputText).toContain('"matchedRows":2');
    expect(outputText).toContain('"duplicateNameGroups":1');

    const workbook = XLSX.readFile(output, { cellFormula: false, raw: true });
    const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets.PRODUTOS, { header: 1, defval: "", raw: true });
    expect(rows[1]).toEqual(["IP-LIM-TESTE", "ÁGUA TESTE 5L", "Limpeza", "UN", 1, 20.72, 12, "SIM", "SIM", "SIM"]);
    expect(rows[2]).toEqual(["IP-HIG-TESTE", "CREME TESTE 1X1", "Higiene", "UN", 1, 9.99, 7, "SIM", "SIM", "SIM"]);

    fs.rmSync(directory, { recursive: true, force: true });
  });

  it("rejeita produto legado sem correspondência exata", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "ideal-prime-price-update-missing-"));
    const legacy = path.join(directory, "legacy.xlsx");
    const master = path.join(directory, "master.xlsx");
    const output = path.join(directory, "output.xlsx");

    writeWorkbook(legacy, { Planilha1: [["LIMPEZA", "VALOR"], ["Produto inexistente", "10,00"]] });
    writeWorkbook(master, {
      PRODUTOS: [["sku", "nome", "categoria", "unidade", "multiplo_venda", "preco_venda", "estoque_fisico", "ativo", "publicado", "b2b_habilitado"]],
    });

    expect(() => execFileSync(process.execPath, [adapter, legacy, master, output], { encoding: "utf8", stdio: "pipe" })).toThrow(/Reconciliação incompleta/);
    fs.rmSync(directory, { recursive: true, force: true });
  });
});
