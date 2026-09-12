import crypto from "node:crypto";
import * as XLSX from "xlsx";
import type { ImportRow } from "./db.b2b";

// O modelo oficial pode crescer sem invalidar planilhas antigas. Estas são as
// colunas mínimas necessárias para preservar compatibilidade com o importador B2B.
const REQUIRED_HEADERS = [
  "sku",
  "nome",
  "categoria",
  "unidade",
  "multiplo_venda",
  "preco_venda",
  "estoque_fisico",
  "ativo",
] as const;

const OPTIONAL_HEADERS = [
  "subcategoria",
  "marca",
  "estoque_minimo",
  "ncm",
  "descricao_curta",
  "descricao",
  "imagem_url",
  "fonte_url",
  "termo_busca",
  "publicado",
  "b2b_habilitado",
  "observacoes",
] as const;

const MAX_ROWS = 5000;
const MAX_FILE_SIZE = 10 * 1024 * 1024;

function text(v: unknown) {
  const value = String(v ?? "").trim();
  return value || undefined;
}

function bool(v: unknown, field: string) {
  const value = String(v ?? "").trim().toUpperCase();
  if (["SIM", "S", "TRUE", "1"].includes(value)) return true;
  if (["NAO", "NÃO", "N", "FALSE", "0"].includes(value)) return false;
  if (!value) return undefined;
  throw new Error(`${field} inválido: ${v}`);
}

function number(v: unknown, field: string, optional = false) {
  if (v == null || String(v).trim() === "") return optional ? null : undefined;
  const raw = String(v).trim();
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`${field} inválido: ${v}`);
  return parsed;
}

function normalizeRow(row: Record<string, unknown>): ImportRow {
  return {
    sku: String(row.sku ?? "").trim(),
    nome: text(row.nome),
    categoria: text(row.categoria),
    subcategoria: text(row.subcategoria),
    marca: text(row.marca),
    unidade: text(row.unidade),
    multiplo_venda: number(row.multiplo_venda, "múltiplo de venda") as number | undefined,
    preco_venda: row.preco_venda,
    estoque_fisico: number(row.estoque_fisico, "estoque físico", true) as number | null,
    estoque_minimo: number(row.estoque_minimo, "estoque mínimo", true) as number | null,
    ncm: text(row.ncm),
    descricao_curta: text(row.descricao_curta),
    descricao: text(row.descricao),
    imagem_url: text(row.imagem_url),
    fonte_url: text(row.fonte_url),
    termo_busca: text(row.termo_busca),
    publicado: bool(row.publicado, "publicado"),
    b2b_habilitado: bool(row.b2b_habilitado, "b2b_habilitado"),
    ativo: bool(row.ativo, "ativo"),
    observacoes: text(row.observacoes),
  };
}

function validateHeaders(headers: string[]) {
  const normalized = new Set(headers.map((header) => header.trim().toLowerCase()));
  for (const header of REQUIRED_HEADERS) {
    if (!normalized.has(header)) throw new Error(`Coluna ausente: ${header}`);
  }
}

/**
 * Lê planilhas legadas e o Catálogo Mestre Ideal Prime. Colunas extras são
 * ignoradas de forma deliberada para permitir evolução aditiva do template.
 */
export function parseImportBuffer(buffer: Buffer, filename: string) {
  if (buffer.length > MAX_FILE_SIZE) throw new Error("Arquivo excede 10MB");

  const ext = filename.toLowerCase().split(".").pop();
  let rows: Record<string, unknown>[] = [];

  if (ext === "csv") {
    const fileText = buffer.toString("utf8").replace(/^\uFEFF/, "");
    const lines = fileText.split(/\r?\n/).filter((line) => line.trim());
    if (!lines.length) throw new Error("CSV vazio");

    const headers = lines[0].split(";").map((header) => header.trim().toLowerCase());
    validateHeaders(headers);
    rows = lines.slice(1).map((line) => {
      const values = line.split(";");
      return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
    });
  } else if (ext === "xlsx") {
    const workbook = XLSX.read(buffer, {
      type: "buffer",
      cellFormula: false,
      cellHTML: false,
      cellNF: false,
      cellStyles: false,
    });
    if (!workbook.SheetNames.includes("PRODUTOS")) {
      throw new Error("XLSX deve conter a aba PRODUTOS");
    }

    const worksheet = workbook.Sheets.PRODUTOS;
    for (const key of Object.keys(worksheet)) {
      if (key.startsWith("!")) continue;
      const cell = (worksheet as any)[key];
      if (cell?.f) throw new Error(`Fórmula proibida na célula ${key}`);
    }

    const matrix = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, defval: "", raw: false });
    const headers = ((matrix[0] as unknown[]) ?? []).map((value) => String(value).trim().toLowerCase());
    validateHeaders(headers);
    rows = matrix.slice(1).map((values) =>
      Object.fromEntries(headers.map((header, index) => [header, (values as unknown[])[index] ?? ""])),
    );
  } else {
    throw new Error("Formato aceito: CSV ou XLSX");
  }

  const normalized = rows
    .filter((row) => Object.values(row).some((value) => String(value).trim()))
    .map(normalizeRow);

  if (normalized.length > MAX_ROWS) {
    throw new Error(`Arquivo excede o limite de ${MAX_ROWS} linhas por importação`);
  }

  return {
    rows: normalized,
    hash: crypto.createHash("sha256").update(buffer).digest("hex"),
    template: {
      required: [...REQUIRED_HEADERS],
      optional: [...OPTIONAL_HEADERS],
    },
  };
}
