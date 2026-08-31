import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, AlertTriangle, Package, TrendingDown, Plus } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";

const formatBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

export default function Estoque() {
  const { data: products = [], isLoading } = trpc.products.list.useQuery();
  const [search, setSearch] = useState("");
  const [, setLocation] = useLocation();

  const filtered = (products as any[]).filter((p: any) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const totalStock = (products as any[]).reduce((acc: number, p: any) => acc + (p.stockQuantity || 0), 0);
  const lowStock = (products as any[]).filter((p: any) => p.stockQuantity <= p.minimumStock && p.minimumStock > 0);
  const outOfStock = (products as any[]).filter((p: any) => p.stockQuantity === 0);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Estoque</h1>
            <p className="text-muted-foreground text-sm">Controle de produtos em estoque</p>
          </div>
          <Button onClick={() => setLocation("/produtos/novo")}>
            <Plus className="h-4 w-4 mr-2" /> Adicionar Produto
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium">Total em Estoque</CardTitle>
              <Package className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalStock}</div>
              <p className="text-xs text-muted-foreground">unidades cadastradas</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium">Estoque Baixo</CardTitle>
              <TrendingDown className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">{lowStock.length}</div>
              <p className="text-xs text-muted-foreground">abaixo do mínimo</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium">Sem Estoque</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{outOfStock.length}</div>
              <p className="text-xs text-muted-foreground">produtos esgotados</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar produto..."
                  className="pl-9"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-14 w-full" />)}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Package className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p>Nenhum produto encontrado</p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-5 gap-4 px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  <span className="col-span-2">Produto</span>
                  <span className="text-center">Estoque</span>
                  <span className="text-center">Custo Médio</span>
                  <span className="text-center">Status</span>
                </div>
                {filtered.map((p: any) => {
                  const status = p.stockQuantity === 0
                    ? { label: "Esgotado", class: "destructive" }
                    : p.stockQuantity <= p.minimumStock && p.minimumStock > 0
                    ? { label: "Baixo", class: "warning" }
                    : { label: "OK", class: "secondary" };

                  return (
                    <div
                      key={p.id}
                      onClick={() => setLocation(`/produtos/${p.id}/editar`)}
                      className="grid grid-cols-5 gap-4 px-3 py-3 rounded-lg border hover:bg-accent/50 cursor-pointer transition-colors items-center"
                    >
                      <div className="col-span-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
                            {p.imageUrl ? (
                              <img src={p.imageUrl} alt={p.name} className="h-full w-full object-contain" />
                            ) : (
                              <Package className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="inline-flex items-center px-1 py-0.5 rounded text-[10px] font-mono font-bold bg-muted text-muted-foreground border border-border shrink-0">
                                #{p.id}
                              </span>
                              <p className="font-medium text-sm truncate">{p.name}</p>
                            </div>
                            <p className="text-xs text-muted-foreground">{p.category}</p>
                          </div>
                        </div>
                      </div>
                      <div className="text-center">
                        <span className="font-semibold">{p.stockQuantity || 0}</span>
                        <span className="text-xs text-muted-foreground ml-1">un</span>
                      </div>
                      <div className="text-center text-sm">
                        {formatBRL(p.averageCostBrl || 0)}
                      </div>
                      <div className="text-center">
                        <Badge variant={status.class as any}>{status.label}</Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
