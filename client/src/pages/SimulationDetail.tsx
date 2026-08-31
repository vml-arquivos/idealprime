import { Link } from 'wouter';
import { trpc } from '@/lib/trpc';
import { formatCurrency, formatPercent } from '../../../shared/pricingCalculator';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Star, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, XCircle, Copy } from 'lucide-react';

function diagnosticColor(d: string) {
  if (d === 'SAUDAVEL') return 'text-green-600 bg-green-50 border-green-200';
  if (d === 'ATENCAO') return 'text-yellow-600 bg-yellow-50 border-yellow-200';
  if (d === 'RISCO') return 'text-orange-600 bg-orange-50 border-orange-200';
  return 'text-red-600 bg-red-50 border-red-200';
}

function diagnosticIcon(d: string) {
  if (d === 'SAUDAVEL') return <CheckCircle className="w-4 h-4" />;
  if (d === 'ATENCAO') return <AlertTriangle className="w-4 h-4" />;
  if (d === 'RISCO') return <AlertTriangle className="w-4 h-4" />;
  return <XCircle className="w-4 h-4" />;
}

export default function SimulationDetail({ id }: { id: number }) {
  const { data, isLoading } = trpc.simulations.byId.useQuery({ id });
  const utils = trpc.useUtils();
  const duplicate = trpc.simulations.duplicate.useMutation({
    onSuccess: () => utils.simulations.list.invalidate(),
  });

  if (isLoading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-muted-foreground">Carregando...</div>
    </div>
  );

  if (!data) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-muted-foreground">Simulação não encontrada.</div>
    </div>
  );

  const product = (data.productSnapshot as any) || {};
  const resultSnapshot = (data.resultSnapshot as any) || {};
  const results: any[] = resultSnapshot.results || [];
  const bestMethod = data.bestPaymentMethod;
  const worstMethod = data.worstPaymentMethod;
  const createdAt = new Date(data.createdAt).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  return (
    <div className="min-h-screen bg-background">
      <main className="container py-8 max-w-5xl">
        <div className="space-y-6">

          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <Link href="/simulacoes">
                <Button variant="ghost" size="sm" className="gap-1.5">
                  <ArrowLeft className="w-4 h-4" /> Voltar
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-foreground">{data.name}</h1>
                <p className="text-xs text-muted-foreground mt-0.5">Criado em {createdAt}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => duplicate.mutate({ id })}
                disabled={duplicate.isPending}
              >
                <Copy className="w-3.5 h-3.5" />
                Duplicar
              </Button>
              {product.productId && (
                <Link href={`/simulador?productId=${product.productId}`}>
                  <Button size="sm" className="gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5" />
                    Recalcular
                  </Button>
                </Link>
              )}
            </div>
          </div>

          {/* Resumo do Produto */}
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-sm font-semibold text-foreground mb-4 uppercase tracking-wider text-muted-foreground">Dados do Produto</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Produto</p>
                <p className="text-sm font-semibold text-foreground mt-0.5">{product.productName || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Categoria</p>
                <p className="text-sm font-medium text-foreground mt-0.5">{product.category || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Preço de Custo</p>
                <p className="text-sm font-semibold text-foreground mt-0.5">{formatCurrency(product.costPrice || 0)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Margem Desejada</p>
                <p className="text-sm font-semibold text-foreground mt-0.5">{formatPercent(data.desiredMarginRate || 0)}</p>
              </div>
              {product.freight > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground">Frete</p>
                  <p className="text-sm font-medium text-foreground mt-0.5">{formatCurrency(product.freight)}</p>
                </div>
              )}
              {product.operationalCost > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground">Custo Operacional</p>
                  <p className="text-sm font-medium text-foreground mt-0.5">{formatCurrency(product.operationalCost)}</p>
                </div>
              )}
              {product.packaging > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground">Embalagem</p>
                  <p className="text-sm font-medium text-foreground mt-0.5">{formatCurrency(product.packaging)}</p>
                </div>
              )}
              {product.taxRegime && (
                <div>
                  <p className="text-xs text-muted-foreground">Regime Tributário</p>
                  <p className="text-sm font-medium text-foreground mt-0.5">{product.taxRegime}</p>
                </div>
              )}
            </div>
          </div>

          {/* Preço Recomendado + Diagnóstico */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl border border-border bg-card p-5 flex flex-col gap-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Preço Recomendado</p>
              <p className="text-3xl font-bold text-foreground">{formatCurrency(data.recommendedPrice || 0)}</p>
              <p className="text-xs text-muted-foreground">Melhor forma: <span className="font-medium text-foreground">{bestMethod || '—'}</span></p>
            </div>
            <div className="rounded-xl border border-border bg-card p-5 flex flex-col gap-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Preço Mínimo</p>
              <p className="text-3xl font-bold text-foreground">{formatCurrency(data.minimumBreakEvenPrice || 0)}</p>
              <p className="text-xs text-muted-foreground">Pior forma: <span className="font-medium text-foreground">{worstMethod || '—'}</span></p>
            </div>
            <div className="rounded-xl border border-border bg-card p-5 flex flex-col gap-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Diagnóstico</p>
              <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold border w-fit ${diagnosticColor(data.diagnosis || '')}`}>
                {diagnosticIcon(data.diagnosis || '')}
                {data.diagnosis || '—'}
              </div>
            </div>
          </div>

          {/* Detalhes por Forma de Pagamento */}
          {results.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Detalhamento por Forma de Pagamento</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {results.map((r: any, i: number) => {
                  const isBest = r.method === bestMethod;
                  const isWorst = r.method === worstMethod;
                  return (
                    <div
                      key={i}
                      className={`relative rounded-xl border bg-card p-5 ${
                        isBest ? 'border-green-400/50 ring-1 ring-green-400/20' :
                        isWorst ? 'border-red-300/40 opacity-80' :
                        'border-border'
                      }`}
                    >
                      {isBest && (
                        <div className="absolute -top-2.5 left-4">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-500 text-white">
                            <Star className="w-3 h-3 fill-current" /> Melhor opção
                          </span>
                        </div>
                      )}
                      {isWorst && (
                        <div className="absolute -top-2.5 left-4">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                            <TrendingDown className="w-3 h-3" /> Menor margem
                          </span>
                        </div>
                      )}

                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <p className="text-sm font-semibold text-foreground">{r.methodLabel || r.method}</p>
                          {r.installments > 1 && (
                            <p className="text-xs text-muted-foreground">
                              {r.installments}x de {formatCurrency(r.installmentValue)}
                            </p>
                          )}
                        </div>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${diagnosticColor(r.diagnostic)}`}>
                          {diagnosticIcon(r.diagnostic)}
                          {r.diagnostic}
                        </span>
                      </div>

                      <p className="text-2xl font-bold text-foreground mb-4">{formatCurrency(r.suggestedPrice)}</p>

                      <div className="space-y-1.5 text-xs">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Preço de Custo</span>
                          <span className="font-medium">{formatCurrency(r.baseCost)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Margem de Lucro</span>
                          <span className="font-medium text-green-600">+{formatCurrency(r.marginValue)}</span>
                        </div>
                        <div className="flex justify-between border-t border-dashed pt-1">
                          <span className="font-semibold">Subtotal</span>
                          <span className="font-semibold">{formatCurrency(r.subtotalWithMargin)}</span>
                        </div>
                        <div className="pt-1 space-y-1">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Despesas</p>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Impostos</span>
                            <span className="font-medium">{formatCurrency(r.totalTax)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Taxas/Juros</span>
                            <span className="font-medium">{formatCurrency((r.totalFees || 0) + (r.totalInterest || 0))}</span>
                          </div>
                          {r.otherCosts > 0 && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Outros Custos</span>
                              <span className="font-medium">{formatCurrency(r.otherCosts)}</span>
                            </div>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
                          <div>
                            <p className="text-muted-foreground">Lucro Líquido</p>
                            <p className={`font-semibold text-sm ${r.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {formatCurrency(r.netProfit)}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Margem Real</p>
                            <p className="font-semibold text-sm text-foreground">{formatPercent(r.realMarginRate)}</p>
                          </div>
                        </div>
                        <p className="text-muted-foreground pt-1 border-t border-border">
                          Mín. sem prejuízo: <span className="font-medium text-foreground">{formatCurrency(r.minPriceNoLoss)}</span>
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Aviso fiscal */}
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-xs text-yellow-800">
            <strong>Cálculo fiscal estimativo.</strong> Confirme NCM, CST/CSOSN, CFOP, ICMS-ST, PIS/COFINS e regime tributário com seu contador.
          </div>

        </div>
      </main>
    </div>
  );
}
