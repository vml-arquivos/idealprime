/**
 * CotacaoComparativo.tsx — Comparativo completo
 * 
 * 3 abas:
 *  1. Melhor Local — vencedor com economia em R$ e %
 *  2. Por Local (Lote) — ranking geral com breakdown e % de diferença entre locais
 *  3. Por Produto — cada item com menor preço, % de economia e foto
 */

import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Trophy, TrendingDown, BarChart3, Package, MapPin, AlertTriangle, CheckCircle2, Camera } from "lucide-react";
import { useState } from "react";

// ─── Helpers ────────────────────────────────────────────────────────────────

const BRL = (v: number) =>
  v === Infinity || isNaN(v) ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const PCT = (v: number) =>
  v === Infinity || isNaN(v) ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(1)}%`;

/** Diferença percentual de `val` em relação a `base` */
function diffPct(val: number, base: number): number {
  if (base === 0) return 0;
  return ((val - base) / base) * 100;
}

type Tab = "melhor" | "lote" | "produto";

// ─── Subcomponentes ────────────────────────────────────────────────────────

function StatBox({ label, value, sub, green }: { label: string; value: string; sub?: string; green?: boolean }) {
  return (
    <div className={`rounded-2xl p-4 text-center border shadow-sm ${green ? "bg-emerald-50 border-emerald-200" : "bg-white border-gray-100"}`}>
      <p className={`text-xl font-bold ${green ? "text-emerald-700" : ""}`}>{value}</p>
      {sub && <p className={`text-xs font-medium ${green ? "text-emerald-600" : "text-muted-foreground"}`}>{sub}</p>}
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}

function BarraRelativa({ valor, min, max, isMelhor }: { valor: number; min: number; max: number; isMelhor: boolean }) {
  const range = max - min || 1;
  const pct = Math.max(5, ((valor - min) / range) * 100);
  return (
    <div className="w-24 bg-gray-100 rounded-full h-2 overflow-hidden">
      <div className={`h-full rounded-full ${isMelhor ? "bg-emerald-500" : "bg-primary/60"}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function EmptyState({ onColetar }: { onColetar: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center gap-4 px-8">
      <BarChart3 className="h-12 w-12 text-muted-foreground/30" />
      <div>
        <p className="font-semibold">Nenhum preço coletado</p>
        <p className="text-sm text-muted-foreground mt-1">Vá a campo e registre os preços</p>
      </div>
      <button onClick={onColetar} className="mt-2 px-6 py-3 rounded-2xl bg-[oklch(0.30_0.13_240)] text-white font-semibold text-sm active:scale-95">
        Ir para coleta →
      </button>
    </div>
  );
}

// ─── Componente principal ────────────────────────────────────────────────────

export default function CotacaoComparativo() {
  const { id } = useParams<{ id: string }>();
  const sessaoId = Number(id);
  const [, nav] = useLocation();
  const [tab, setTab] = useState<Tab>("melhor");
  const [fotoAmpliada, setFotoAmpliada] = useState<string | null>(null);

  const { data, isLoading, error } = trpc.cotacao.comparativo.useQuery({ sessaoId });

  if (isLoading) return (
    <div className="min-h-svh bg-gray-50 max-w-md mx-auto p-4 space-y-3">
      <Skeleton className="h-48 rounded-3xl" />
      <Skeleton className="h-32 rounded-2xl" />
      <Skeleton className="h-32 rounded-2xl" />
    </div>
  );

  if (error || !data) return (
    <div className="min-h-svh flex flex-col items-center justify-center gap-3 text-muted-foreground p-8">
      <AlertTriangle className="h-10 w-10" />
      <p className="text-center">{error?.message ?? "Erro ao carregar comparativo"}</p>
    </div>
  );

  const qualif   = data.ranking.filter(r => !r.desqualificado);
  const minCusto = qualif.length > 0 ? Math.min(...qualif.map(r => r.custoTotal)) : 0;
  const maxCusto = qualif.length > 0 ? Math.max(...qualif.map(r => r.custoTotal)) : 0;

  return (
    <>
      <div className="min-h-svh bg-gray-50 flex flex-col max-w-md mx-auto">
        {/* Header + tabs */}
        <div className="bg-[oklch(0.30_0.13_240)] text-white px-4 pt-10 pb-0 sticky top-0 z-20">
          <div className="flex items-center gap-2 mb-4">
            <button onClick={() => nav("/cotacoes")} className="h-9 w-9 rounded-full flex items-center justify-center hover:bg-white/10 shrink-0">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate">{data.sessaoTitulo}</p>
              <p className="text-xs opacity-60">
                {data.porProduto.length} prod. · {data.porLocal.length} locais
              </p>
            </div>
            <button onClick={() => nav(`/cotacoes/${sessaoId}/coletar`)} className="text-xs bg-white/10 px-3 py-1.5 rounded-full hover:bg-white/20">
              Editar
            </button>
          </div>
          <div className="flex">
            {([
              { key: "melhor",  label: "🏆 Melhor" },
              { key: "lote",    label: "📦 Por lote" },
              { key: "produto", label: "🔍 Por produto" },
            ] as const).map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex-1 text-xs font-semibold py-2.5 rounded-t-xl transition-colors ${tab === t.key ? "bg-gray-50 text-[oklch(0.30_0.13_240)]" : "text-white/70 hover:text-white"}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pb-6">

          {/* ── ABA: Melhor local ── */}
          {tab === "melhor" && (
            <div className="px-4 py-4 space-y-3">
              {data.melhorLocal ? (
                <>
                  {/* Card vencedor */}
                  <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-3xl p-5 text-white text-center shadow-xl">
                    <p className="text-4xl mb-2">🏆</p>
                    <p className="text-sm font-medium opacity-80">Melhor opção para seu bolso</p>
                    <p className="text-2xl font-bold mt-1">{data.melhorLocal.localNome}</p>
                    <p className="text-4xl font-black mt-3 tracking-tight">{BRL(data.melhorLocal.custoTotal)}</p>
                    <p className="text-xs opacity-70 mt-1">cesta de produtos + deslocamento</p>
                    {data.melhorLocal.economiaVsMedia > 0.01 && (
                      <div className="mt-4 flex flex-col gap-1 items-center">
                        <div className="inline-flex items-center gap-1.5 bg-white/20 rounded-full px-4 py-1.5 text-sm font-semibold">
                          <TrendingDown className="h-4 w-4" />
                          {BRL(data.melhorLocal.economiaVsMedia)} de economia
                        </div>
                        <span className="text-xs opacity-70">
                          {Math.abs(diffPct(data.melhorLocal.custoTotal, (data.melhorLocal.custoTotal + data.melhorLocal.economiaVsMedia))).toFixed(1)}% abaixo da média
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-2">
                    <StatBox label="Cesta de produtos" value={BRL(data.melhorLocal.totalCesta)} />
                    <StatBox label="Deslocamento" value={BRL(data.melhorLocal.custoOperacional)} />
                    <StatBox label="Produtos encontrados" value={`${data.melhorLocal.produtosEncontrados}/${data.melhorLocal.produtosTotais}`} />
                    <StatBox label="Posição no ranking" value="#1" sub={`de ${qualif.length}`} green />
                  </div>

                  {/* Ranking resumido */}
                  {qualif.length > 1 && (
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                      <div className="px-4 py-2.5 border-b border-gray-100">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ranking completo</p>
                      </div>
                      {data.ranking.map((r, i) => {
                        const difPct = i > 0 && !r.desqualificado && minCusto > 0
                          ? diffPct(r.custoTotal, minCusto)
                          : null;
                        return (
                          <div key={r.localId} className={`flex items-center gap-3 px-4 py-3 ${i < data.ranking.length - 1 ? "border-b border-gray-50" : ""} ${i === 0 ? "bg-emerald-50/50" : ""}`}>
                            <span className={`text-sm font-bold w-6 text-center shrink-0 ${r.desqualificado ? "text-gray-300" : i === 0 ? "text-emerald-600" : "text-gray-400"}`}>
                              {r.desqualificado ? "✗" : `#${i + 1}`}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{r.localNome}</p>
                              {r.desqualificado && <p className="text-xs text-red-400">produto obrigatório ausente</p>}
                            </div>
                            <div className="text-right shrink-0">
                              <p className={`text-sm font-bold ${i === 0 && !r.desqualificado ? "text-emerald-600" : ""}`}>
                                {r.desqualificado ? "—" : BRL(r.custoTotal)}
                              </p>
                              {difPct !== null && (
                                <p className="text-xs text-red-500 font-medium">+{difPct.toFixed(1)}%</p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              ) : (
                <EmptyState onColetar={() => nav(`/cotacoes/${sessaoId}/coletar`)} />
              )}
            </div>
          )}

          {/* ── ABA: Por lote ── */}
          {tab === "lote" && (
            <div className="px-4 py-4 space-y-3">
              {data.ranking.length === 0 ? (
                <EmptyState onColetar={() => nav(`/cotacoes/${sessaoId}/coletar`)} />
              ) : (
                <>
                  {/* Legenda */}
                  <div className="bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3 text-xs text-blue-700">
                    <p className="font-semibold mb-0.5">Comparativo de lote completo</p>
                    <p>Custo total = soma de todos os produtos encontrados + deslocamento. O % mostra a diferença em relação ao local mais barato.</p>
                  </div>

                  {data.ranking.map((local, i) => {
                    const difPct = i > 0 && !local.desqualificado && minCusto > 0
                      ? diffPct(local.custoTotal, minCusto)
                      : null;
                    const porcEncontrado = local.produtosTotais > 0
                      ? Math.round((local.produtosEncontrados / local.produtosTotais) * 100)
                      : 0;

                    return (
                      <div key={local.localId} className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${local.desqualificado ? "opacity-60 border-dashed border-gray-200" : i === 0 ? "border-emerald-300 ring-1 ring-emerald-200" : "border-gray-100"}`}>
                        <div className="p-4">
                          {/* Cabeçalho */}
                          <div className="flex items-center gap-3 mb-3">
                            <div className={`h-10 w-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 ${local.desqualificado ? "bg-gray-100 text-gray-400" : i === 0 ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"}`}>
                              {local.desqualificado ? "✗" : `#${i + 1}`}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-sm truncate">{local.localNome}</p>
                              <p className="text-xs text-muted-foreground">
                                {local.produtosEncontrados}/{local.produtosTotais} produtos ({porcEncontrado}%)
                                {local.desqualificado && <span className="text-red-500 ml-1">· desqualificado</span>}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className={`font-bold text-lg ${!local.desqualificado && i === 0 ? "text-emerald-600" : ""}`}>
                                {local.desqualificado ? "—" : BRL(local.custoTotal)}
                              </p>
                              {difPct !== null && (
                                <p className="text-xs text-red-500 font-semibold">{PCT(difPct)} vs melhor</p>
                              )}
                              {i === 0 && !local.desqualificado && (
                                <p className="text-xs text-emerald-600 font-semibold">★ melhor preço</p>
                              )}
                            </div>
                          </div>

                          {!local.desqualificado && (
                            <>
                              {/* Breakdown */}
                              <div className="space-y-1 text-xs mb-3 bg-gray-50 rounded-xl p-3">
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Cesta de produtos</span>
                                  <span className="font-semibold">{BRL(local.totalCesta)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Custo de deslocamento</span>
                                  <span className="font-semibold">{BRL(local.custoOperacional)}</span>
                                </div>
                                <div className="flex justify-between border-t border-gray-200 pt-1 mt-1">
                                  <span className="font-semibold">Total</span>
                                  <span className={`font-bold ${i === 0 ? "text-emerald-600" : ""}`}>{BRL(local.custoTotal)}</span>
                                </div>
                              </div>

                              {/* Barra proporcional */}
                              <div className="flex items-center gap-2">
                                <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all ${i === 0 ? "bg-emerald-500" : "bg-primary/70"}`}
                                    style={{ width: `${maxCusto > 0 ? (local.custoTotal / maxCusto) * 100 : 0}%` }}
                                  />
                                </div>
                                {difPct !== null && (
                                  <span className="text-xs text-red-500 font-semibold shrink-0 w-16 text-right">+{difPct.toFixed(1)}%</span>
                                )}
                                {i === 0 && (
                                  <span className="text-xs text-emerald-600 font-semibold shrink-0 w-16 text-right">base</span>
                                )}
                              </div>
                            </>
                          )}

                          {local.produtosObrigatoriosAusentes.length > 0 && (
                            <div className="mt-2 bg-red-50 rounded-xl px-3 py-2 text-xs text-red-600">
                              <span className="font-semibold">Faltam: </span>{local.produtosObrigatoriosAusentes.join(", ")}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          )}

          {/* ── ABA: Por produto ── */}
          {tab === "produto" && (
            <div className="px-4 py-4 space-y-3">
              {data.porProduto.length === 0 ? (
                <EmptyState onColetar={() => nav(`/cotacoes/${sessaoId}/coletar`)} />
              ) : (
                <>
                  {/* Legenda */}
                  <div className="bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3 text-xs text-blue-700">
                    <p className="font-semibold mb-0.5">Comparativo por produto</p>
                    <p>O % mostra a diferença de cada local em relação ao menor preço encontrado para aquele produto.</p>
                  </div>

                  {data.porProduto.map(prod => {
                    const validos = prod.precos.filter(p => p.encontrado && p.precoUnitario != null);
                    const minPreco = validos.length > 0 ? Math.min(...validos.map(p => p.precoUnitario!)) : 0;
                    const maxPreco = validos.length > 0 ? Math.max(...validos.map(p => p.precoUnitario!)) : 0;
                    const diferencaTotal = minPreco > 0 ? diffPct(maxPreco, minPreco) : 0;

                    return (
                      <div key={prod.sessaoProdutoId} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                        {/* Header do produto */}
                        <div className="px-4 pt-4 pb-3 border-b border-gray-50">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-sm leading-tight">{prod.produtoNome}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                Qtd: {prod.quantidade}
                                {prod.obrigatorio && <span className="ml-2 text-amber-600 font-medium">★ obrigatório</span>}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              {prod.menorPreco != null && (
                                <>
                                  <p className="text-sm font-bold text-emerald-600">{BRL(prod.menorPreco)}</p>
                                  <p className="text-xs text-muted-foreground">menor preço</p>
                                </>
                              )}
                              {diferencaTotal > 0.5 && (
                                <p className="text-xs text-orange-500 font-semibold mt-0.5">
                                  Variação: {diferencaTotal.toFixed(1)}%
                                </p>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Preços por local */}
                        <div className="divide-y divide-gray-50">
                          {prod.precos.map(p => {
                            const isMelhor = p.localId === prod.menorPrecoLocalId;
                            const dif = p.precoUnitario != null && minPreco > 0 && !isMelhor
                              ? diffPct(p.precoUnitario, minPreco)
                              : null;

                            return (
                              <div key={p.localId} className={`flex items-center gap-3 px-4 py-3 ${isMelhor ? "bg-emerald-50/60" : ""}`}>
                                <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${isMelhor ? "bg-emerald-500" : "bg-gray-300"}`} />
                                <p className="text-sm flex-1 truncate">{p.localNome}</p>

                                {!p.encontrado ? (
                                  <span className="text-xs text-muted-foreground italic">Não encontrado</span>
                                ) : p.precoUnitario == null ? (
                                  <span className="text-xs text-muted-foreground italic">Sem preço</span>
                                ) : (
                                  <div className="flex items-center gap-2 shrink-0">
                                    {/* Barra relativa */}
                                    <BarraRelativa valor={p.precoUnitario} min={minPreco} max={maxPreco} isMelhor={isMelhor} />
                                    <div className="text-right min-w-[70px]">
                                      <p className={`text-sm font-bold ${isMelhor ? "text-emerald-600" : ""}`}>{BRL(p.precoUnitario)}</p>
                                      {dif !== null && (
                                        <p className="text-xs text-red-500 font-semibold">{PCT(dif)}</p>
                                      )}
                                      {isMelhor && <p className="text-xs text-emerald-600 font-semibold">★ menor</p>}
                                    </div>
                                  </div>
                                )}

                                {/* Foto do preço */}
                                {p.fotoPreco && (
                                  <button onClick={() => setFotoAmpliada(p.fotoPreco!)} className="shrink-0">
                                    <img src={p.fotoPreco} alt="Foto preço" className="h-8 w-8 rounded-lg object-cover border border-gray-200" />
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {validos.length === 0 && (
                          <div className="px-4 py-3 text-sm text-muted-foreground text-center">
                            Nenhum preço coletado
                          </div>
                        )}
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Lightbox foto */}
      {fotoAmpliada && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setFotoAmpliada(null)}>
          <img src={fotoAmpliada} alt="Foto do preço" className="max-w-full max-h-full rounded-2xl object-contain" />
          <button className="absolute top-6 right-6 h-10 w-10 bg-white/10 rounded-full flex items-center justify-center text-white hover:bg-white/20">
            ✕
          </button>
        </div>
      )}
    </>
  );
}
