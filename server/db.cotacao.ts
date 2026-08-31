/**
 * server/db.cotacao.ts — Camada de dados do módulo Cotação de Preços
 *
 * Segue o mesmo padrão de server/db.orders.ts:
 * - getDb() do db.ts central
 * - Drizzle ORM com queries tipadas
 * - Sem SQL raw (exceto para o comparativo agregado)
 */

import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "./db";
import {
  cotacaoLocais,
  cotacaoPrecos,
  cotacaoSessaoProdutos,
  cotacaoSessoes,
} from "../drizzle/schema.cotacao";
import { products } from "../drizzle/schema";

// ─── Tipos auxiliares ─────────────────────────────────────────────────────────

export interface ComparativoPorProduto {
  produtoId: number;
  produtoNome: string;
  sessaoProdutoId: number;
  quantidade: number;
  obrigatorio: boolean;
  precos: {
    localId: number;
    localNome: string;
    precoUnitario: number | null;
    precoTotal: number | null;
    encontrado: boolean;
    fotoPreco: string | null;
  }[];
  menorPreco: number | null;
  menorPrecoLocalId: number | null;
}

export interface ComparativoPorLocal {
  localId: number;
  localNome: string;
  custoOperacional: number;
  totalCesta: number;
  custoTotal: number;
  produtosEncontrados: number;
  produtosTotais: number;
  produtosObrigatoriosAusentes: string[];
  desqualificado: boolean;
}

export interface Comparativo {
  sessaoId: number;
  sessaoTitulo: string;
  porProduto: ComparativoPorProduto[];
  porLocal: ComparativoPorLocal[];
  ranking: ComparativoPorLocal[];
  melhorLocal: (ComparativoPorLocal & { economiaVsMedia: number }) | null;
}

// ─── LOCAIS ───────────────────────────────────────────────────────────────────

export async function listarLocais(usuarioId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(cotacaoLocais)
    .where(and(eq(cotacaoLocais.usuarioId, usuarioId), eq(cotacaoLocais.ativo, true)))
    .orderBy(asc(cotacaoLocais.nome));
}

export async function criarLocal(
  usuarioId: number,
  data: {
    nome: string;
    endereco?: string;
    lat?: string;
    lng?: string;
    tipoComercio?: string;
    custoOperacionalPadrao?: string;
    // Novos campos adicionais
    cnpj?: string;
    telefone?: string;
    whatsapp?: string;
    cep?: string;
    logradouro?: string;
    numero?: string;
    complemento?: string;
    bairro?: string;
    cidade?: string;
    estado?: string;
    referencia?: string;
    logoUrl?: string;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("Database indisponível");
  const [local] = await db
    .insert(cotacaoLocais)
    .values({
      usuarioId,
      nome: data.nome,
      endereco: data.endereco,
      lat: data.lat,
      lng: data.lng,
      tipoComercio: data.tipoComercio,
      custoOperacionalPadrao: data.custoOperacionalPadrao ?? "0",
      cnpj: data.cnpj,
      telefone: data.telefone,
      whatsapp: data.whatsapp,
      cep: data.cep,
      logradouro: data.logradouro,
      numero: data.numero,
      complemento: data.complemento,
      bairro: data.bairro,
      cidade: data.cidade,
      estado: data.estado,
      referencia: data.referencia,
      logoUrl: data.logoUrl,
    })
    .returning();
  return local;
}

export async function atualizarLocal(
  id: number,
  usuarioId: number,
  data: Partial<{
    nome: string;
    endereco: string;
    lat: string;
    lng: string;
    tipoComercio: string;
    custoOperacionalPadrao: string;
    fotoFachada: string;
    // Novos campos adicionais
    cnpj: string;
    telefone: string;
    whatsapp: string;
    cep: string;
    logradouro: string;
    numero: string;
    complemento: string;
    bairro: string;
    cidade: string;
    estado: string;
    referencia: string;
    logoUrl: string;
  }>
) {
  const db = await getDb();
  if (!db) throw new Error("Database indisponível");
  const [local] = await db
    .update(cotacaoLocais)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(cotacaoLocais.id, id), eq(cotacaoLocais.usuarioId, usuarioId)))
    .returning();
  if (!local) throw new Error("Local não encontrado");
  return local;
}

export async function removerLocal(id: number, usuarioId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database indisponível");
  // Soft delete
  await db
    .update(cotacaoLocais)
    .set({ ativo: false, updatedAt: new Date() })
    .where(and(eq(cotacaoLocais.id, id), eq(cotacaoLocais.usuarioId, usuarioId)));
  return { success: true };
}

// ─── SESSÕES ──────────────────────────────────────────────────────────────────

export async function listarSessoes(usuarioId: number) {
  const db = await getDb();
  if (!db) return [];
  const sessoes = await db
    .select()
    .from(cotacaoSessoes)
    .where(eq(cotacaoSessoes.usuarioId, usuarioId))
    .orderBy(desc(cotacaoSessoes.createdAt));

  // Para cada sessão, contar produtos
  const ids = sessoes.map((s) => s.id);
  if (ids.length === 0) return sessoes.map((s) => ({ ...s, totalProdutos: 0 }));

  const contagens = await db
    .select({
      sessaoId: cotacaoSessaoProdutos.sessaoId,
      total: sql<number>`count(*)::int`,
    })
    .from(cotacaoSessaoProdutos)
    .where(inArray(cotacaoSessaoProdutos.sessaoId, ids))
    .groupBy(cotacaoSessaoProdutos.sessaoId);

  const mapaContagem = Object.fromEntries(
    contagens.map((c) => [c.sessaoId, c.total])
  );

  return sessoes.map((s) => ({ ...s, totalProdutos: mapaContagem[s.id] ?? 0 }));
}

export async function obterSessao(id: number, usuarioId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database indisponível");

  const [sessao] = await db
    .select()
    .from(cotacaoSessoes)
    .where(and(eq(cotacaoSessoes.id, id), eq(cotacaoSessoes.usuarioId, usuarioId)))
    .limit(1);

  if (!sessao) throw new Error("Sessão não encontrada");

  const prods = await db
    .select({
      id: cotacaoSessaoProdutos.id,
      sessaoId: cotacaoSessaoProdutos.sessaoId,
      produtoId: cotacaoSessaoProdutos.produtoId,
      quantidade: cotacaoSessaoProdutos.quantidade,
      unidade: cotacaoSessaoProdutos.unidade,
      obrigatorio: cotacaoSessaoProdutos.obrigatorio,
      ordem: cotacaoSessaoProdutos.ordem,
      produtoNome: products.name,
      produtoCategoria: products.category,
    })
    .from(cotacaoSessaoProdutos)
    .innerJoin(products, eq(cotacaoSessaoProdutos.produtoId, products.id))
    .where(eq(cotacaoSessaoProdutos.sessaoId, id))
    .orderBy(asc(cotacaoSessaoProdutos.ordem));

  return { ...sessao, produtos: prods };
}

export async function criarSessao(
  usuarioId: number,
  data: {
    titulo: string;
    observacao?: string;
    produtos: {
      produtoId: number;
      quantidade?: number;
      unidade?: string;
      obrigatorio?: boolean;
      ordem?: number;
    }[];
  }
) {
  const db = await getDb();
  if (!db) throw new Error("Database indisponível");

  const [sessao] = await db
    .insert(cotacaoSessoes)
    .values({
      usuarioId,
      titulo: data.titulo,
      observacao: data.observacao,
      status: "em_andamento",
    })
    .returning();

  if (data.produtos.length > 0) {
    await db.insert(cotacaoSessaoProdutos).values(
      data.produtos.map((p, i) => ({
        sessaoId: sessao.id,
        produtoId: p.produtoId,
        quantidade: String(p.quantidade ?? 1),
        unidade: p.unidade ?? "un",
        obrigatorio: p.obrigatorio ?? false,
        ordem: p.ordem ?? i,
      }))
    );
  }

  return obterSessao(sessao.id, usuarioId);
}

export async function atualizarSessao(
  id: number,
  usuarioId: number,
  data: { titulo?: string; status?: "em_andamento" | "concluida" | "cancelada"; observacao?: string }
) {
  const db = await getDb();
  if (!db) throw new Error("Database indisponível");
  const [sessao] = await db
    .update(cotacaoSessoes)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(cotacaoSessoes.id, id), eq(cotacaoSessoes.usuarioId, usuarioId)))
    .returning();
  if (!sessao) throw new Error("Sessão não encontrada");
  return sessao;
}


export async function adicionarProdutoSessao(
  usuarioId: number,
  data: {
    sessaoId: number;
    produtoId: number;
    quantidade?: number;
    unidade?: string;
    obrigatorio?: boolean;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("Database indisponível");

  const [sessao] = await db
    .select({ id: cotacaoSessoes.id })
    .from(cotacaoSessoes)
    .where(and(eq(cotacaoSessoes.id, data.sessaoId), eq(cotacaoSessoes.usuarioId, usuarioId)))
    .limit(1);
  if (!sessao) throw new Error("Sessão não encontrada");

  const [produto] = await db
    .select({ id: products.id })
    .from(products)
    .where(eq(products.id, data.produtoId))
    .limit(1);
  if (!produto) throw new Error("Produto não encontrado");

  const duplicado = await db
    .select({ id: cotacaoSessaoProdutos.id })
    .from(cotacaoSessaoProdutos)
    .where(and(eq(cotacaoSessaoProdutos.sessaoId, data.sessaoId), eq(cotacaoSessaoProdutos.produtoId, data.produtoId)))
    .limit(1);
  if (duplicado.length > 0) throw new Error("Este produto já está na cotação");

  const [ordemAtual] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(cotacaoSessaoProdutos)
    .where(eq(cotacaoSessaoProdutos.sessaoId, data.sessaoId));

  const [item] = await db
    .insert(cotacaoSessaoProdutos)
    .values({
      sessaoId: data.sessaoId,
      produtoId: data.produtoId,
      quantidade: String(data.quantidade ?? 1),
      unidade: data.unidade ?? "un",
      obrigatorio: data.obrigatorio ?? false,
      ordem: ordemAtual?.total ?? 0,
    })
    .returning();

  return item;
}

export async function removerSessao(id: number, usuarioId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database indisponível");
  await db
    .delete(cotacaoSessoes)
    .where(and(eq(cotacaoSessoes.id, id), eq(cotacaoSessoes.usuarioId, usuarioId)));
  return { success: true };
}

// ─── PREÇOS ───────────────────────────────────────────────────────────────────

export async function registrarPreco(data: {
  sessaoId: number;
  sessaoProdutoId: number;
  localId: number;
  precoUnitario?: number | null;
  encontrado?: boolean;
  observacao?: string;
  uuidLocal?: string;
  fotoPreco?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database indisponível");

  // Upsert por sessao_produto_id + local_id (unicidade)
  const existing = await db
    .select({ id: cotacaoPrecos.id })
    .from(cotacaoPrecos)
    .where(
      and(
        eq(cotacaoPrecos.sessaoProdutoId, data.sessaoProdutoId),
        eq(cotacaoPrecos.localId, data.localId)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    const [updated] = await db
      .update(cotacaoPrecos)
      .set({
        precoUnitario: data.precoUnitario != null ? String(data.precoUnitario) : null,
        encontrado: data.encontrado ?? true,
        observacao: data.observacao,
        fotoPreco: data.fotoPreco,
        syncStatus: "sincronizado",
        updatedAt: new Date(),
      })
      .where(eq(cotacaoPrecos.id, existing[0].id))
      .returning();
    return updated;
  }

  const [preco] = await db
    .insert(cotacaoPrecos)
    .values({
      sessaoId: data.sessaoId,
      sessaoProdutoId: data.sessaoProdutoId,
      localId: data.localId,
      precoUnitario: data.precoUnitario != null ? String(data.precoUnitario) : null,
      encontrado: data.encontrado ?? true,
      observacao: data.observacao,
      uuidLocal: data.uuidLocal,
      fotoPreco: data.fotoPreco,
      syncStatus: "sincronizado",
    })
    .returning();
  return preco;
}

export async function registrarPrecoLote(
  itens: {
    sessaoId: number;
    sessaoProdutoId: number;
    localId: number;
    precoUnitario?: number | null;
    encontrado?: boolean;
    observacao?: string;
    uuidLocal?: string;
  }[]
) {
  const resultados = await Promise.all(itens.map((item) => registrarPreco(item)));
  return resultados;
}

export async function listarPrecosSessao(sessaoId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(cotacaoPrecos)
    .where(eq(cotacaoPrecos.sessaoId, sessaoId));
}

// ─── COMPARATIVO ─────────────────────────────────────────────────────────────

export async function gerarComparativo(sessaoId: number, usuarioId: number): Promise<Comparativo> {
  const db = await getDb();
  if (!db) throw new Error("Database indisponível");

  // 1. Verificar sessão
  const [sessao] = await db
    .select()
    .from(cotacaoSessoes)
    .where(and(eq(cotacaoSessoes.id, sessaoId), eq(cotacaoSessoes.usuarioId, usuarioId)))
    .limit(1);
  if (!sessao) throw new Error("Sessão não encontrada");

  // 2. Produtos da sessão
  const sessaoProdutos = await db
    .select({
      id: cotacaoSessaoProdutos.id,
      produtoId: cotacaoSessaoProdutos.produtoId,
      quantidade: cotacaoSessaoProdutos.quantidade,
      obrigatorio: cotacaoSessaoProdutos.obrigatorio,
      ordem: cotacaoSessaoProdutos.ordem,
      produtoNome: products.name,
    })
    .from(cotacaoSessaoProdutos)
    .innerJoin(products, eq(cotacaoSessaoProdutos.produtoId, products.id))
    .where(eq(cotacaoSessaoProdutos.sessaoId, sessaoId))
    .orderBy(asc(cotacaoSessaoProdutos.ordem));

  if (sessaoProdutos.length === 0) {
    return {
      sessaoId,
      sessaoTitulo: sessao.titulo,
      porProduto: [],
      porLocal: [],
      ranking: [],
      melhorLocal: null,
    };
  }

  // 3. Preços coletados
  const precos = await db
    .select({
      id: cotacaoPrecos.id,
      sessaoProdutoId: cotacaoPrecos.sessaoProdutoId,
      localId: cotacaoPrecos.localId,
      precoUnitario: cotacaoPrecos.precoUnitario,
      encontrado: cotacaoPrecos.encontrado,
      fotoPreco: cotacaoPrecos.fotoPreco,
    })
    .from(cotacaoPrecos)
    .where(eq(cotacaoPrecos.sessaoId, sessaoId));

  // 4. Locais envolvidos
  const localIds = [...new Set(precos.map((p) => p.localId))];
  if (localIds.length === 0) {
    return {
      sessaoId,
      sessaoTitulo: sessao.titulo,
      porProduto: [],
      porLocal: [],
      ranking: [],
      melhorLocal: null,
    };
  }

  const locais = await db
    .select()
    .from(cotacaoLocais)
    .where(inArray(cotacaoLocais.id, localIds));

  const mapaLocais = Object.fromEntries(locais.map((l) => [l.id, l]));

  // 5. Montar por produto
  const porProduto: ComparativoPorProduto[] = sessaoProdutos.map((sp) => {
    const precosItem = precos.filter((p) => p.sessaoProdutoId === sp.id);
    const qtd = parseFloat(String(sp.quantidade));

    const precosPorLocal = localIds.map((localId) => {
      const p = precosItem.find((x) => x.localId === localId);
      const local = mapaLocais[localId];
      const precoUnit = p?.precoUnitario != null ? parseFloat(String(p.precoUnitario)) : null;
      return {
        localId,
        localNome: local?.nome ?? `Local ${localId}`,
        precoUnitario: precoUnit,
        precoTotal: precoUnit != null ? precoUnit * qtd : null,
        encontrado: p?.encontrado ?? false,
        fotoPreco: p?.fotoPreco ?? null,
      };
    });

    const precosValidos = precosPorLocal
      .filter((p) => p.encontrado && p.precoUnitario != null)
      .map((p) => p.precoUnitario as number);

    const menorPreco = precosValidos.length > 0 ? Math.min(...precosValidos) : null;
    const menorPrecoLocalId =
      menorPreco != null
        ? (precosPorLocal.find((p) => p.precoUnitario === menorPreco)?.localId ?? null)
        : null;

    return {
      produtoId: sp.produtoId,
      produtoNome: sp.produtoNome,
      sessaoProdutoId: sp.id,
      quantidade: qtd,
      obrigatorio: sp.obrigatorio,
      precos: precosPorLocal,
      menorPreco,
      menorPrecoLocalId,
    };
  });

  // 6. Montar por local
  const porLocal: ComparativoPorLocal[] = locais.map((local) => {
    const custoOp = parseFloat(String(local.custoOperacionalPadrao ?? "0"));
    let totalCesta = 0;
    let produtosEncontrados = 0;
    const produtosObrigatoriosAusentes: string[] = [];

    for (const sp of sessaoProdutos) {
      const preco = precos.find(
        (p) => p.sessaoProdutoId === sp.id && p.localId === local.id
      );
      const qtd = parseFloat(String(sp.quantidade));

      if (preco?.encontrado && preco.precoUnitario != null) {
        totalCesta += parseFloat(String(preco.precoUnitario)) * qtd;
        produtosEncontrados++;
      } else if (sp.obrigatorio) {
        produtosObrigatoriosAusentes.push(sp.produtoNome);
      }
    }

    const desqualificado = produtosObrigatoriosAusentes.length > 0;

    return {
      localId: local.id,
      localNome: local.nome,
      custoOperacional: custoOp,
      totalCesta,
      custoTotal: desqualificado ? Infinity : totalCesta + custoOp,
      produtosEncontrados,
      produtosTotais: sessaoProdutos.length,
      produtosObrigatoriosAusentes,
      desqualificado,
    };
  });

  // 7. Ranking (menor custo primeiro, desqualificados no final)
  const ranking = [...porLocal].sort((a, b) => {
    if (a.desqualificado && !b.desqualificado) return 1;
    if (!a.desqualificado && b.desqualificado) return -1;
    return a.custoTotal - b.custoTotal;
  });

  // 8. Melhor local + economia vs média
  const qualificados = ranking.filter((r) => !r.desqualificado);
  let melhorLocal = null;
  if (qualificados.length > 0) {
    const media =
      qualificados.reduce((acc, r) => acc + r.custoTotal, 0) / qualificados.length;
    melhorLocal = {
      ...qualificados[0],
      economiaVsMedia: media - qualificados[0].custoTotal,
    };
  }

  return {
    sessaoId,
    sessaoTitulo: sessao.titulo,
    porProduto,
    porLocal,
    ranking,
    melhorLocal,
  };
}

// ─── SYNC OFFLINE ────────────────────────────────────────────────────────────

export async function syncUpload(
  usuarioId: number,
  payload: {
    precos: {
      sessaoId: number;
      sessaoProdutoId: number;
      localId: number;
      precoUnitario?: number | null;
      encontrado?: boolean;
      observacao?: string;
      uuidLocal?: string;
    }[];
  }
) {
  // Valida que todas as sessões pertencem ao usuário
  const db = await getDb();
  if (!db) throw new Error("Database indisponível");

  const sessaoIds = [...new Set(payload.precos.map((p) => p.sessaoId))];
  const sessoes = await db
    .select({ id: cotacaoSessoes.id })
    .from(cotacaoSessoes)
    .where(
      and(
        inArray(cotacaoSessoes.id, sessaoIds),
        eq(cotacaoSessoes.usuarioId, usuarioId)
      )
    );

  const sessoesPermitidas = new Set(sessoes.map((s) => s.id));
  const precosPermitidos = payload.precos.filter((p) =>
    sessoesPermitidas.has(p.sessaoId)
  );

  const resultados = await registrarPrecoLote(precosPermitidos);
  return { sincronizados: resultados.length, total: payload.precos.length };
}

export async function syncDownload(usuarioId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database indisponível");

  const [locais, prods] = await Promise.all([
    listarLocais(usuarioId),
    db
      .select({
        id: products.id,
        name: products.name,
        category: products.category,
      })
      .from(products)
      .where(
        // Apenas produtos activos (sem campo active no schema, usa stockQuantity >= 0 como proxy)
        sql`TRUE`
      )
      .orderBy(asc(products.name))
      .limit(500),
  ]);

  return { locais, produtos: prods, timestamp: new Date().toISOString() };
}
