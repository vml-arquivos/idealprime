import { describe, expect, it } from "vitest";
import * as XLSXModule from "xlsx";
import { parseImportBuffer } from "./b2b.import";

const XLSX = XLSXModule.default ?? XLSXModule;

describe("importação do Catálogo Mestre", () => {
  it("aceita preço sob consulta e preserva destaque/imagem do modelo", () => {
    const headers = [
      "sku", "nome", "categoria", "unidade", "multiplo_venda", "preco_venda", "estoque_fisico", "ativo",
      "descricao", "imagem_url", "fonte_url", "destaque", "ordem_destaque",
    ];
    const worksheet = XLSX.utils.aoa_to_sheet([
      headers,
      ["IP-TEST-001", "Produto de teste", "Limpeza", "UN", "1", "", "", "SIM", "Descrição legível", "https://example.com/produto.webp", "https://example.com/fonte", "SIM", "3"],
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "PRODUTOS");
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    const parsed = parseImportBuffer(buffer, "catalogo.xlsx");
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0]).toMatchObject({
      sku: "IP-TEST-001",
      preco_venda: "",
      destaque: true,
      ordem_destaque: 3,
      imagem_url: "https://example.com/produto.webp",
    });
  });
});
