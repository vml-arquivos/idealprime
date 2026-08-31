/**
 * CotacoesGestao.tsx — Página desktop de gestão de cotações
 * 
 * Usa DashboardLayout (para PC/tablet).
 * Funcionalidades:
 *  - Lista todas as sessões com status, produtos, locais
 *  - Detalhes de sessão: preços coletados em tabela
 *  - Comparativo por lote e por produto
 *  - Exportação CSV
 *  - Links para a PWA mobile
 */

import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
// Dialog components removidos — detalhes são exibidos inline agora.
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  ShoppingCart, BarChart3, MapPin, Download, Eye, Trash2,
  CheckCircle, Clock, XCircle, Smartphone, TrendingDown, Package,
  RefreshCw, Trophy, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";

const BRL = (v: number) =>
  isFinite(v) ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";

const PCT = (v: number) =>
  isFinite(v) ? `${v > 0 ? "+" : ""}${v.toFixed(1)}%` : "—";

const STATUS_CFG = {
  em_andamento: { label: "Em andamento", color: "bg-amber-100 text-amber-800 border-amber-200", icon: Clock },
  concluida:    { label: "Concluída",    color: "bg-emerald-100 text-emerald-800 border-emerald-200", icon: CheckCircle },
  cancelada:    { label: "Cancelada",    color: "bg-red-100 text-red-800 border-red-200", icon: XCircle },
} as const;

// ─── Exportação CSV ───────────────────────────────────────────────────────────

function exportarCSV(sessao: any, comparativo: any) {
  const linhas: string[][] = [];
  linhas.push([`Sessão: ${sessao.titulo}`, format(new Date(sessao.createdAt), "dd/MM/yyyy HH:mm")]);
  linhas.push([]);
  linhas.push(["=== POR PRODUTO ==="]);
  linhas.push(["Produto", "Qtd", ...comparativo.porLocal.map((l: any) => l.localNome), "Menor Preço", "Variação %"]);

  for (const prod of comparativo.porProduto) {
    const menorPreco = prod.menorPreco ?? 0;
    const row = [prod.produtoNome, String(prod.quantidade)];
    for (const local of comparativo.porLocal) {
      const p = prod.precos.find((x: any) => x.localId === local.localId);
      row.push(p?.encontrado && p.precoUnitario != null ? String(p.precoUnitario).replace(".", ",") : "N/A");
    }
    const maxPreco = Math.max(...prod.precos.filter((p: any) => p.precoUnitario != null).map((p: any) => p.precoUnitario!));
    row.push(String(menorPreco).replace(".", ","));
    row.push(menorPreco > 0 ? `${(((maxPreco - menorPreco) / menorPreco) * 100).toFixed(1)}%` : "—");
    linhas.push(row);
  }

  linhas.push([]);
  linhas.push(["=== POR LOTE (RANKING) ==="]);
  linhas.push(["#", "Local", "Cesta (R$)", "Deslocamento (R$)", "Total (R$)", "Vs melhor (%)", "Produtos encontrados"]);
  const min = comparativo.ranking.filter((r: any) => !r.desqualificado)[0]?.custoTotal ?? 0;
  comparativo.ranking.forEach((r: any, i: number) => {
    const dif = i > 0 && !r.desqualificado && min > 0 ? (((r.custoTotal - min) / min) * 100).toFixed(1) + "%" : i === 0 ? "base" : "—";
    linhas.push([
      String(r.desqualificado ? "✗" : `#${i + 1}`),
      r.localNome,
      String(r.totalCesta).replace(".", ","),
      String(r.custoOperacional).replace(".", ","),
      r.desqualificado ? "—" : String(r.custoTotal).replace(".", ","),
      dif,
      `${r.produtosEncontrados}/${r.produtosTotais}`,
    ]);
  });

  const csv = linhas.map(l => l.map(c => `"${c}"`).join(";")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `cotacao_${sessao.titulo.replace(/\s+/g, "_")}_${format(new Date(), "yyyyMMdd")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast.success("CSV exportado!");
}

// ─── Componente de detalhe da sessão ─────────────────────────────────────────

function DetalhesSessao({ sessaoId, onClose }: { sessaoId: number; onClose: () => void }) {
  const { data: sessao, isLoading: lS } = trpc.cotacao.sessoes.obter.useQuery({ id: sessaoId });
  const { data: comparativo, isLoading: lC } = trpc.cotacao.comparativo.useQuery({ sessaoId });
  const { data: locais } = trpc.cotacao.locais.listar.useQuery();
  const { data: precos, isLoading: lP } = trpc.cotacao.precos.listarSessao.useQuery({ sessaoId });

  const loading = lS || lC || lP;

  if (loading) return (
    <div className="space-y-4 p-6">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-48 w-full" />
      <Skeleton className="h-48 w-full" />
    </div>
  );

  if (!sessao || !comparativo) return (
    <div className="p-6 text-muted-foreground text-center">Dados não encontrados</div>
  );

  const qualif = comparativo.ranking.filter((r: any) => !r.desqualificado);
  const minCusto = qualif[0]?.custoTotal ?? 0;

  return (
    <div className="p-0">
      <Tabs defaultValue="resumo">
        <TabsList className="w-full rounded-none border-b border-border bg-transparent h-auto p-0">
          <TabsTrigger value="resumo" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-6 py-3">
            Resumo
          </TabsTrigger>
          <TabsTrigger value="produtos" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-6 py-3">
            Por Produto
          </TabsTrigger>
          <TabsTrigger value="lote" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-6 py-3">
            Por Lote
          </TabsTrigger>
          <TabsTrigger value="precos" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-6 py-3">
            Dados Brutos
          </TabsTrigger>
        </TabsList>

        {/* ── Resumo ── */}
        <TabsContent value="resumo" className="p-6 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card><CardContent className="pt-4">
              <p className="text-2xl font-bold">{sessao.produtos?.length ?? 0}</p>
              <p className="text-xs text-muted-foreground">Produtos</p>
            </CardContent></Card>
            <Card><CardContent className="pt-4">
              <p className="text-2xl font-bold">{comparativo.porLocal.length}</p>
              <p className="text-xs text-muted-foreground">Locais pesquisados</p>
            </CardContent></Card>
            <Card><CardContent className="pt-4">
              <p className="text-2xl font-bold text-emerald-600">{comparativo.melhorLocal?.localNome ?? "—"}</p>
              <p className="text-xs text-muted-foreground">Melhor local</p>
            </CardContent></Card>
            <Card><CardContent className="pt-4">
              <p className="text-2xl font-bold text-emerald-600">
                {comparativo.melhorLocal ? BRL(comparativo.melhorLocal.custoTotal) : "—"}
              </p>
              <p className="text-xs text-muted-foreground">Menor custo total</p>
            </CardContent></Card>
          </div>

          {comparativo.melhorLocal && (
            <Card className="border-emerald-200 bg-emerald-50">
              <CardContent className="pt-4 flex items-center gap-4">
                <Trophy className="h-8 w-8 text-emerald-600 shrink-0" />
                <div>
                  <p className="font-bold text-emerald-800 text-lg">{comparativo.melhorLocal.localNome}</p>
                  <p className="text-sm text-emerald-700">
                    Cesta: {BRL(comparativo.melhorLocal.totalCesta)} + Deslocamento: {BRL(comparativo.melhorLocal.custoOperacional)} = <strong>{BRL(comparativo.melhorLocal.custoTotal)}</strong>
                  </p>
                  {comparativo.melhorLocal.economiaVsMedia > 0.01 && (
                    <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                      <TrendingDown className="h-3 w-3" />
                      Economia de {BRL(comparativo.melhorLocal.economiaVsMedia)} em relação à média dos locais
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Por Produto ── */}
        <TabsContent value="produtos" className="p-6">
          <div className="overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[160px]">Produto</TableHead>
                  <TableHead className="text-center">Qtd</TableHead>
                  {comparativo.porLocal.map((l: any) => (
                    <TableHead key={l.localId} className="text-right min-w-[110px]">{l.localNome}</TableHead>
                  ))}
                  <TableHead className="text-right text-emerald-700">Menor</TableHead>
                  <TableHead className="text-right">Variação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {comparativo.porProduto.map((prod: any) => {
                  const validos = prod.precos.filter((p: any) => p.encontrado && p.precoUnitario != null);
                  const min = validos.length > 0 ? Math.min(...validos.map((p: any) => p.precoUnitario)) : 0;
                  const max = validos.length > 0 ? Math.max(...validos.map((p: any) => p.precoUnitario)) : 0;
                  const variacao = min > 0 ? ((max - min) / min) * 100 : 0;
                  return (
                    <TableRow key={prod.sessaoProdutoId}>
                      <TableCell className="font-medium">
                        {prod.produtoNome}
                        {prod.obrigatorio && <span className="ml-1 text-amber-500 text-xs">★</span>}
                      </TableCell>
                      <TableCell className="text-center text-muted-foreground">{prod.quantidade}</TableCell>
                      {comparativo.porLocal.map((l: any) => {
                        const p = prod.precos.find((x: any) => x.localId === l.localId);
                        const isMelhor = l.localId === prod.menorPrecoLocalId;
                        return (
                          <TableCell key={l.localId} className={`text-right ${isMelhor ? "text-emerald-700 font-bold" : ""}`}>
                            {!p?.encontrado ? (
                              <span className="text-xs text-muted-foreground italic">N/A</span>
                            ) : p.precoUnitario != null ? (
                              <div>
                                <span>{BRL(p.precoUnitario)}</span>
                                {isMelhor && <span className="ml-1 text-xs">★</span>}
                                {p.fotoPreco && (
                                  <a href={p.fotoPreco} target="_blank" rel="noreferrer" className="ml-1 text-primary hover:underline text-xs" title="Ver foto">📷</a>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">S/preço</span>
                            )}
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-right font-bold text-emerald-700">
                        {min > 0 ? BRL(min) : "—"}
                      </TableCell>
                      <TableCell className={`text-right text-sm font-medium ${variacao > 20 ? "text-red-600" : variacao > 5 ? "text-amber-600" : "text-muted-foreground"}`}>
                        {variacao > 0 ? `${variacao.toFixed(1)}%` : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <p className="text-xs text-muted-foreground mt-2">★ = menor preço do produto · N/A = não encontrado · Variação = diferença entre maior e menor preço</p>
        </TabsContent>

        {/* ── Por Lote ── */}
        <TabsContent value="lote" className="p-6">
          <div className="overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>Local</TableHead>
                  <TableHead className="text-right">Cesta (R$)</TableHead>
                  <TableHead className="text-right">Deslocamento</TableHead>
                  <TableHead className="text-right font-bold">Total</TableHead>
                  <TableHead className="text-right">Vs melhor</TableHead>
                  <TableHead className="text-center">Produtos</TableHead>
                  <TableHead>Obs.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {comparativo.ranking.map((r: any, i: number) => {
                  const dif = i > 0 && !r.desqualificado && minCusto > 0
                    ? ((r.custoTotal - minCusto) / minCusto) * 100 : null;
                  return (
                    <TableRow key={r.localId} className={i === 0 && !r.desqualificado ? "bg-emerald-50" : r.desqualificado ? "opacity-50" : ""}>
                      <TableCell className={`font-bold ${i === 0 && !r.desqualificado ? "text-emerald-700" : "text-muted-foreground"}`}>
                        {r.desqualificado ? "✗" : `#${i + 1}`}
                      </TableCell>
                      <TableCell className="font-medium">
                        {r.localNome}
                        {i === 0 && !r.desqualificado && <span className="ml-1 text-xs text-emerald-700">🏆</span>}
                      </TableCell>
                      <TableCell className="text-right">{BRL(r.totalCesta)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{BRL(r.custoOperacional)}</TableCell>
                      <TableCell className={`text-right font-bold text-base ${i === 0 && !r.desqualificado ? "text-emerald-700" : ""}`}>
                        {r.desqualificado ? "—" : BRL(r.custoTotal)}
                      </TableCell>
                      <TableCell className={`text-right text-sm font-semibold ${dif !== null ? (dif > 20 ? "text-red-600" : dif > 5 ? "text-amber-600" : "text-muted-foreground") : ""}`}>
                        {i === 0 && !r.desqualificado ? <span className="text-emerald-700">base</span> : dif !== null ? PCT(dif) : "—"}
                      </TableCell>
                      <TableCell className="text-center text-sm">
                        {r.produtosEncontrados}/{r.produtosTotais}
                      </TableCell>
                      <TableCell className="text-xs text-red-500">
                        {r.produtosObrigatoriosAusentes?.join(", ")}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ── Dados brutos ── */}
        <TabsContent value="precos" className="p-6">
          <div className="overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead>Local</TableHead>
                  <TableHead className="text-right">Preço unit.</TableHead>
                  <TableHead className="text-right">Qtd</TableHead>
                  <TableHead className="text-right">Total item</TableHead>
                  <TableHead className="text-center">Encontrado</TableHead>
                  <TableHead>Foto</TableHead>
                  <TableHead>Sync</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(precos ?? []).map((p: any) => {
                  const sp = sessao.produtos?.find((x: any) => x.id === p.sessaoProdutoId);
                  const local = locais?.find((l: any) => l.id === p.localId);
                  const qtd = sp ? parseFloat(String(sp.quantidade)) : 1;
                  const total = p.precoUnitario != null && p.encontrado ? parseFloat(String(p.precoUnitario)) * qtd : null;
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{sp?.produtoNome ?? `#${p.sessaoProdutoId}`}</TableCell>
                      <TableCell>{local?.nome ?? `#${p.localId}`}</TableCell>
                      <TableCell className="text-right">{p.precoUnitario != null ? BRL(parseFloat(p.precoUnitario)) : "—"}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{qtd}</TableCell>
                      <TableCell className="text-right font-medium">{total != null ? BRL(total) : "—"}</TableCell>
                      <TableCell className="text-center">
                        {p.encontrado ? <CheckCircle className="h-4 w-4 text-emerald-500 mx-auto" /> : <XCircle className="h-4 w-4 text-red-400 mx-auto" />}
                      </TableCell>
                      <TableCell>
                        {p.fotoPreco && (
                          <a href={p.fotoPreco} target="_blank" rel="noreferrer">
                            <img src={p.fotoPreco} alt="Foto" className="h-8 w-8 rounded object-cover border border-gray-200 hover:scale-110 transition-transform" />
                          </a>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-xs ${p.syncStatus === "sincronizado" ? "border-emerald-300 text-emerald-700" : "border-amber-300 text-amber-700"}`}>
                          {p.syncStatus}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Rodapé */}
      <div className="flex gap-2 p-4 border-t border-border justify-end">
        {comparativo && (
          <Button variant="outline" size="sm" onClick={() => exportarCSV(sessao, comparativo)}>
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
        )}
        <Button size="sm" onClick={onClose}>Fechar</Button>
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function CotacoesGestao() {
  const utils = trpc.useUtils();
  const [detalheSessaoId, setDetalheSessaoId] = useState<number | null>(null);

  const { data: sessoes, isLoading } = trpc.cotacao.sessoes.listar.useQuery();
  const { data: locais } = trpc.cotacao.locais.listar.useQuery();

  const remover = trpc.cotacao.sessoes.remover.useMutation({
    onSuccess: () => { utils.cotacao.sessoes.listar.invalidate(); toast.success("Sessão removida"); },
    onError: (e: any) => toast.error(e.message),
  });
  const atualizar = trpc.cotacao.sessoes.atualizar.useMutation({
    onSuccess: () => { utils.cotacao.sessoes.listar.invalidate(); toast.success("Status atualizado"); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <DashboardLayout>
      {/*
        Layout master-detail: exibimos a lista de sessões e, quando uma sessão é
        selecionada, renderizamos os detalhes logo abaixo (ou ao lado em
        telas largas). O modal anterior foi removido para melhorar
        usabilidade em desktop.
      */}
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <ShoppingCart className="h-6 w-6 text-primary" />
              Gestão de Cotações
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Dados coletados em campo — visualize, compare e exporte
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => { utils.cotacao.sessoes.listar.invalidate(); utils.cotacao.locais.listar.invalidate(); toast.success("Dados atualizados"); }}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href="/cotacoes" target="_blank">
                <Smartphone className="h-4 w-4 mr-2" />
                Abrir PWA Mobile
              </a>
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <p className="text-2xl font-bold">{sessoes?.length ?? 0}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><ShoppingCart className="h-3 w-3" />Total de sessões</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-2xl font-bold text-amber-600">{sessoes?.filter(s => s.status === "em_andamento").length ?? 0}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><Clock className="h-3 w-3" />Em andamento</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-2xl font-bold text-emerald-600">{sessoes?.filter(s => s.status === "concluida").length ?? 0}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><CheckCircle className="h-3 w-3" />Concluídas</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-2xl font-bold text-primary">{locais?.length ?? 0}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><MapPin className="h-3 w-3" />Locais cadastrados</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabela de sessões */}
        <Card className="md:overflow-y-auto">
          <CardHeader>
            <CardTitle className="text-base">Sessões de Cotação</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-3">
                {[0,1,2].map(i => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : !sessoes || sessoes.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <ShoppingCart className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">Nenhuma cotação ainda</p>
                <p className="text-sm mt-1">Use o app no celular para coletar preços em campo</p>
                <Button variant="outline" className="mt-4" asChild>
                  <a href="/cotacoes" target="_blank">
                    <Smartphone className="h-4 w-4 mr-2" />
                    Abrir PWA Mobile
                  </a>
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sessão</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="text-center">Produtos</TableHead>
                      <TableHead>Criada em</TableHead>
                      <TableHead>Observação</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sessoes.map(s => {
                      const cfg = STATUS_CFG[s.status as keyof typeof STATUS_CFG];
                      const Icon = cfg.icon;
                      const total = (s as any).totalProdutos ?? 0;
                      return (
                        <TableRow key={s.id} className="hover:bg-muted/30">
                          <TableCell className="font-medium">{s.titulo}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className={`text-xs ${cfg.color}`}>
                              <Icon className="h-3 w-3 mr-1" />{cfg.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="secondary">{total}</Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            <div>{format(new Date(s.createdAt), "dd/MM/yyyy HH:mm")}</div>
                            <div className="text-xs opacity-60">{formatDistanceToNow(new Date(s.createdAt), { addSuffix: true, locale: ptBR })}</div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                            {s.observacao ?? "—"}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 justify-end">
                              {/* Ver detalhes */}
                              <Button size="sm" variant="outline" onClick={() => setDetalheSessaoId(s.id)} title="Ver detalhes e comparativo">
                                <Eye className="h-4 w-4 mr-1" /> Detalhes
                              </Button>
                              {/* Concluir / Reabrir */}
                              {s.status === "em_andamento" && (
                                <Button size="sm" variant="outline" onClick={() => atualizar.mutate({ id: s.id, status: "concluida" })} title="Marcar como concluída">
                                  <CheckCircle className="h-4 w-4" />
                                </Button>
                              )}
                              {s.status === "concluida" && (
                                <Button size="sm" variant="outline" onClick={() => atualizar.mutate({ id: s.id, status: "em_andamento" })} title="Reabrir sessão">
                                  <Clock className="h-4 w-4" />
                                </Button>
                              )}
                              {/* Excluir */}
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10" title="Excluir">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Excluir "{s.titulo}"?</AlertDialogTitle>
                                    <AlertDialogDescription>Todos os preços coletados serão removidos permanentemente.</AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => remover.mutate({ id: s.id })}>
                                      Excluir
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Locais cadastrados */}
        {locais && locais.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                Locais de Pesquisa
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Endereço</TableHead>
                      <TableHead className="text-right">Custo deslocamento</TableHead>
                      <TableHead className="text-center">GPS</TableHead>
                      <TableHead className="text-center">Foto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {locais.map(l => (
                      <TableRow key={l.id}>
                        <TableCell className="font-medium">{l.nome}</TableCell>
                        <TableCell className="text-muted-foreground">{l.tipoComercio ?? "—"}</TableCell>
                        <TableCell className="text-muted-foreground max-w-[200px] truncate">{l.endereco ?? "—"}</TableCell>
                        <TableCell className="text-right">{BRL(parseFloat(String(l.custoOperacionalPadrao ?? "0")))}</TableCell>
                        <TableCell className="text-center">
                          {l.lat ? <span className="text-xs text-emerald-600 font-medium">✓ {parseFloat(String(l.lat)).toFixed(4)}, {parseFloat(String(l.lng ?? "0")).toFixed(4)}</span> : <span className="text-muted-foreground text-xs">—</span>}
                        </TableCell>
                        <TableCell className="text-center">
                          {l.fotoFachada ? (
                            <a href={l.fotoFachada} target="_blank" rel="noreferrer">
                              <img src={l.fotoFachada} alt={l.nome} className="h-8 w-8 rounded object-cover border border-gray-200 hover:scale-110 transition-transform mx-auto" />
                            </a>
                          ) : <span className="text-muted-foreground text-xs">—</span>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
        {/* Detalhes da sessão selecionada */}
        {detalheSessaoId !== null && (
          <div className="mt-6">
            <DetalhesSessao sessaoId={detalheSessaoId} onClose={() => setDetalheSessaoId(null)} />
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
