import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3, TrendingUp, Package, Calculator } from "lucide-react";

const formatBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

export default function Relatorios() {
  const { data, isLoading } = trpc.dashboard.useQuery();
  const { data: products = [] } = trpc.products.list.useQuery();

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-2 gap-4">
            {[1,2,3,4].map(i => <Skeleton key={i} className="h-32" />)}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const totalEstoque = (products as any[]).reduce((acc: number, p: any) => acc + (p.stockQuantity * p.averageCostBrl || 0), 0);
  const categorias = (products as any[]).reduce((acc: any, p: any) => {
    acc[p.category] = (acc[p.category] || 0) + 1;
    return acc;
  }, {});

  const catLabels: Record<string, string> = {
    CELULAR: "Celulares",
    ELETRONICO: "Eletrônicos",
    PERFUME: "Perfumes",
    OUTRO: "Outros",
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Relatórios</h1>
          <p className="text-muted-foreground text-sm">Visão geral do seu negócio</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium">Total Produtos</CardTitle>
              <Package className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{(data as any)?.totalProducts ?? 0}</div>
              <p className="text-xs text-muted-foreground">{(data as any)?.activeProducts ?? 0} ativos</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium">Simulações</CardTitle>
              <Calculator className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{(data as any)?.totalSimulations ?? 0}</div>
              <p className="text-xs text-muted-foreground">{(data as any)?.healthyCount ?? 0} saudáveis</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium">Valor em Estoque</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatBRL(totalEstoque)}</div>
              <p className="text-xs text-muted-foreground">custo médio total</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium">Atenção</CardTitle>
              <BarChart3 className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">{(data as any)?.attentionCount ?? 0}</div>
              <p className="text-xs text-muted-foreground">simulações em risco</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Produtos por Categoria</CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(categorias).length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-8">Nenhum produto cadastrado</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(categorias).map(([cat, count]: [string, any]) => (
                  <div key={cat} className="flex items-center gap-3">
                    <span className="text-sm w-28 text-muted-foreground">{catLabels[cat] || cat}</span>
                    <div className="flex-1 bg-muted rounded-full h-2.5">
                      <div
                        className="bg-primary h-2.5 rounded-full transition-all"
                        style={{ width: `${Math.round((count / (products as any[]).length) * 100)}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium w-8 text-right">{count}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
