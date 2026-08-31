import { type DragEvent, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { formatCurrency } from "../../../shared/pricingCalculator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  AlertCircle,
  ArrowUpDown,
  Ban,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  Edit2,
  Eye,
  EyeOff,
  Globe,
  GripVertical,
  ImageOff,
  Plus,
  RefreshCw,
  Search,
  Share2,
  ShoppingBag,
  Store,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

type ProductView =
  | "todos"
  | "shop"
  | "quaseZero"
  | "publicados"
  | "rascunhos"
  | "paraPublicar";

export default function Products() {
  const utils = trpc.useUtils();
  const { data: products = [] } = trpc.products.list.useQuery();
  const { data: pendingProducts = [] } = trpc.products.pendingToPublish.useQuery(undefined, {
    staleTime: 60_000,
  });
  const { data: globalPayment } = trpc.paymentSettings.get.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [view, setView] = useState<ProductView>("todos");
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; name: string } | null>(null);
  const [collapsedCards, setCollapsedCards] = useState<Record<number, boolean>>({});

  const [reorderMode, setReorderMode] = useState(false);
  const [orderedProducts, setOrderedProducts] = useState<any[]>([]);
  const dragIndex = useRef<number | null>(null);

  const isQuaseZeroProduct = (product: any) =>
    product.salesChannel === "QUASE_ZERO" || product.salesChannel === "BOTH";

  const isShopProduct = (product: any) =>
    product.salesChannel !== "QUASE_ZERO";

  const isCollapsed = (productId: number) => collapsedCards[productId] !== false;

  const toggleCard = (productId: number) => {
    setCollapsedCards((prev) => ({
      ...prev,
      [productId]: !isCollapsed(productId),
    }));
  };

  const setAllCardsCollapsed = (collapsed: boolean) => {
    const map: Record<number, boolean> = {};
    filteredProducts.forEach((product: any) => {
      map[product.id] = collapsed;
    });
    setCollapsedCards((prev) => ({ ...prev, ...map }));
  };

  const enterReorderMode = () => {
    const all = (products as any[]).filter((p) => p.active);
    const sorted = [...all].sort((a, b) => {
      if (a.displayOrder !== b.displayOrder) return (a.displayOrder ?? 0) - (b.displayOrder ?? 0);
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    setOrderedProducts(sorted);
    setReorderMode(true);
  };

  const cancelReorder = () => {
    setReorderMode(false);
    setOrderedProducts([]);
  };

  const handleDragStart = (index: number) => {
    dragIndex.current = index;
  };

  const handleDragOver = (e: DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex.current === null || dragIndex.current === index) return;
    const updated = [...orderedProducts];
    const [moved] = updated.splice(dragIndex.current, 1);
    updated.splice(index, 0, moved);
    dragIndex.current = index;
    setOrderedProducts(updated);
  };

  const handleDragEnd = () => {
    dragIndex.current = null;
  };

  const reorder = trpc.products.reorder.useMutation({
    onSuccess: () => {
      utils.products.list.invalidate();
      setReorderMode(false);
      setOrderedProducts([]);
      toast.success("Ordem da vitrine salva!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const saveReorder = () => {
    reorder.mutate({ orderedIds: orderedProducts.map((p) => p.id) });
  };

  const deactivate = trpc.products.deactivate.useMutation({
    onSuccess: () => {
      utils.products.list.invalidate();
      toast.success("Produto desativado.");
    },
  });

  const deleteProduct = trpc.products.delete.useMutation({
    onSuccess: () => {
      utils.products.list.invalidate();
      toast.success("Produto removido permanentemente.");
      setDeleteConfirm(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const duplicate = trpc.products.duplicate.useMutation({
    onSuccess: () => {
      utils.products.list.invalidate();
      toast.success("Produto duplicado.");
    },
  });

  const togglePublished = trpc.products.togglePublished.useMutation({
    onSuccess: (updated: any) => {
      utils.products.list.invalidate();
      toast.success(updated?.published ? "Produto publicado na vitrine!" : "Produto removido da vitrine.");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const shareProduct = (product: any) => {
    const baseUrl = import.meta.env.VITE_STOREFRONT_URL || window.location.origin;
    const path = isQuaseZeroProduct(product) && product.salesChannel !== "BOTH" ? "/quase-zero" : "/vitrine";
    const url = `${baseUrl}${path}/${product.id}`;

    if (navigator.share) {
      navigator
        .share({ title: product.name, url })
        .catch(() => {
          navigator.clipboard.writeText(url);
          toast.success("Link copiado!");
        });
    } else {
      navigator.clipboard.writeText(url);
      toast.success("Link copiado!");
    }
  };

  const pendingIds = new Set((pendingProducts as any[]).map((p) => p.id));

  const listForCurrentView = view === "paraPublicar" ? (pendingProducts as any[]) : (products as any[]);

  const filteredProducts = useMemo(() => {
    return listForCurrentView.filter((p: any) => {
      const term = searchTerm.toLowerCase().trim();
      const matchSearch =
        !term ||
        String(p.id).includes(term) ||
        String(p.name || "").toLowerCase().includes(term) ||
        String(p.category || "").toLowerCase().includes(term);

      const matchView =
        view === "todos" ||
        view === "paraPublicar" ||
        (view === "shop" && isShopProduct(p)) ||
        (view === "quaseZero" && isQuaseZeroProduct(p)) ||
        (view === "publicados" && p.published) ||
        (view === "rascunhos" && !p.published);

      return matchSearch && matchView;
    });
  }, [listForCurrentView, searchTerm, view]);

  const publishedCount = (products as any[]).filter((p) => p.published).length;
  const draftCount = (products as any[]).filter((p) => !p.published).length;
  const pendingCount = (pendingProducts as any[]).length;
  const quaseZeroCount = (products as any[]).filter((p) => isQuaseZeroProduct(p)).length;
  const shopCount = (products as any[]).filter((p) => isShopProduct(p)).length;

  const exportToExcel = () => {
    if (products.length === 0) {
      toast.error("Nenhum produto para exportar");
      return;
    }

    const now = new Date().toISOString().split("T")[0];
    const baseUrl = import.meta.env.VITE_STOREFRONT_URL || window.location.origin;
    const catalogRows = (products as any[]).map((p) => ({
      "Nome do Produto": p.name,
      "Canal": p.salesChannel || "SHOP",
      "Categoria": p.category,
      "Descrição Curta": p.shortDescription || "—",
      "Publicado na Vitrine": p.published ? "Sim" : "Não",
      "Status": p.active ? "Ativo" : "Inativo",
      "Data de Criação": new Date(p.createdAt).toLocaleDateString("pt-BR"),
      "Link do Produto": `${baseUrl}/${isQuaseZeroProduct(p) && p.salesChannel !== "BOTH" ? "quase-zero" : "vitrine"}/${p.id}`,
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(catalogRows);
    XLSX.utils.book_append_sheet(wb, ws, "Catálogo");
    XLSX.writeFile(wb, `permupay-produtos-${now}.xlsx`);
    toast.success("Planilha exportada!");
  };

  return (
    <div className="space-y-4">
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar produto permanentemente?</AlertDialogTitle>
            <AlertDialogDescription>
              O produto <strong>"{deleteConfirm?.name}"</strong> será removido definitivamente do sistema. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteConfirm && deleteProduct.mutate({ id: deleteConfirm.id })}
            >
              Apagar definitivamente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {reorderMode && (
        <div className="rounded-xl border-2 border-primary/40 bg-card shadow-lg">
          <div className="flex items-center justify-between gap-3 border-b border-border/50 bg-primary/5 px-4 py-3 rounded-t-xl">
            <div className="flex items-center gap-2 min-w-0">
              <ArrowUpDown className="h-4 w-4 text-primary shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">Ordenar Vitrine</p>
                <p className="text-xs text-muted-foreground">Arraste os produtos para definir a sequência.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="gap-1.5" onClick={cancelReorder}>
                <X className="h-3.5 w-3.5" /> Cancelar
              </Button>
              <Button size="sm" className="gap-1.5" onClick={saveReorder} disabled={reorder.isPending}>
                <Check className="h-3.5 w-3.5" /> {reorder.isPending ? "Salvando…" : "Salvar ordem"}
              </Button>
            </div>
          </div>

          <div className="max-h-[70vh] space-y-1.5 overflow-y-auto p-3">
            {orderedProducts.map((product: any, index: number) => (
              <div
                key={product.id}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                className={`flex items-center gap-3 rounded-lg border bg-background p-2.5 select-none transition-all cursor-grab active:cursor-grabbing ${
                  product.published ? "border-green-200 dark:border-green-900/50" : "border-border/60"
                } hover:border-primary/40 hover:shadow-sm`}
              >
                <span className="w-6 shrink-0 text-center font-mono text-xs font-bold text-muted-foreground">{index + 1}</span>
                <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/50" />

                {product.imageUrl ? (
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded border bg-white">
                    <img src={product.imageUrl} alt={product.name} className="h-full w-full object-contain p-0.5" />
                  </div>
                ) : (
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded border bg-muted">
                    <ShoppingBag className="h-4 w-4 text-muted-foreground/40" />
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{product.name}</p>
                  <p className="text-xs text-muted-foreground">{product.category}</p>
                </div>

                <div className="shrink-0">
                  {product.published ? (
                    <Badge className="border-0 bg-green-100 text-xs text-green-700 dark:bg-green-900/30 dark:text-green-400">
                      <Globe className="mr-1 h-3 w-3" /> Publicado
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs">
                      <EyeOff className="mr-1 h-3 w-3" /> Rascunho
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!reorderMode && (
        <>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Produtos</h1>
              <p className="mt-1 text-sm text-muted-foreground">Gerencie produtos, preços e publicação na vitrine.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {(products as any[]).length > 0 && (
                <Button onClick={enterReorderMode} variant="outline" className="gap-2">
                  <ArrowUpDown className="h-4 w-4" /> Ordenar Vitrine
                </Button>
              )}
              <Button onClick={exportToExcel} disabled={products.length === 0} variant="outline" className="gap-2">
                <Download className="h-4 w-4" /> Exportar
              </Button>
              <Link href="/produtos/novo">
                <Button className="gap-2">
                  <Plus className="h-4 w-4" /> Novo Produto
                </Button>
              </Link>
            </div>
          </div>

          {products.length > 0 && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2 rounded-xl border bg-card p-2">
                {(
                  [
                    { key: "todos", label: `Todos (${products.length})` },
                    { key: "shop", label: `Ideal Prime (${shopCount})` },
                    { key: "quaseZero", label: `Quase Zero (${quaseZeroCount})` },
                    { key: "publicados", label: `Publicados (${publishedCount})` },
                    { key: "rascunhos", label: `Rascunhos (${draftCount})` },
                    { key: "paraPublicar", label: `Para Publicar (${pendingCount})` },
                  ] as { key: ProductView; label: string }[]
                ).map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setView(key)}
                    className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      view === key ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Pesquisar por nome, categoria ou ID..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="h-10 pl-10"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => setAllCardsCollapsed(true)}>
                    Recolher tudo
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setAllCardsCollapsed(false)}>
                    Expandir tudo
                  </Button>
                </div>
              </div>
            </div>
          )}

          {view === "paraPublicar" && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                <div>
                  <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Produtos para Publicar</p>
                  <p className="mt-1 text-xs text-amber-700/80 dark:text-amber-400/80">
                    Aqui aparecem produtos com custo e estoque, mas ainda não publicados na vitrine.
                  </p>
                </div>
              </div>
            </div>
          )}

          {products.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-12 text-center">
              <AlertCircle className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="mb-2 text-lg font-semibold text-foreground">Nenhum produto cadastrado</h3>
              <p className="mb-6 text-sm text-muted-foreground">Comece criando seu primeiro produto.</p>
              <Link href="/produtos/novo"><Button>Criar Produto</Button></Link>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-8 text-center">
              <p className="text-sm text-muted-foreground">
                {view === "quaseZero"
                  ? "Nenhum produto Quase Zero encontrado."
                  : view === "shop"
                    ? "Nenhum produto do Shop encontrado."
                    : view === "paraPublicar"
                      ? "Nenhum produto pendente de publicação encontrado."
                      : `Nenhum produto encontrado com \"${searchTerm}\"`}
              </p>
            </div>
          ) : (
            <div className="grid gap-3">
              {filteredProducts.map((product: any) => {
                const productPixKey = product.pixKey || product.pixLink;
                const productCard = product.cardPaymentUrl;
                const productBoleto = product.boletoUrl;
                const globalPixKey = globalPayment?.pixKey || globalPayment?.pixLink;
                const globalCard = globalPayment?.cardPaymentUrl;
                const globalBoleto = globalPayment?.boletoUrl;
                const hasPaymentMethod = !!(productPixKey || productCard || productBoleto || globalPixKey || globalCard || globalBoleto);
                const lowStock = (product.minimumStock ?? 0) > 0 && (product.stockQuantity ?? 0) <= (product.minimumStock ?? 0);
                const noImage = !product.imageUrl;
                const hasPix = (product.suggestedPricePix ?? 0) > 0;
                const hasCard = (product.suggestedPriceCard ?? 0) > 0;
                const hasBoleto = (product.suggestedPriceBoleto ?? 0) > 0;
                const hasAnyPrice = hasPix || hasCard || hasBoleto || (product.suggestedPrice ?? 0) > 0;
                const publishedWithoutPayment = product.published && !hasPaymentMethod;
                const compact = isCollapsed(product.id);

                return (
                  <div key={product.id} className="rounded-xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md">
                    <div className="space-y-3 p-3 sm:p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 flex-1 items-start gap-3">
                          {product.imageUrl ? (
                            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border bg-white">
                              <img src={product.imageUrl} alt={product.name} className="h-full w-full object-contain p-1" />
                            </div>
                          ) : (
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border bg-white">
                              <ShoppingBag className="h-4 w-4 text-muted-foreground/40" />
                            </div>
                          )}

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className="inline-flex shrink-0 cursor-pointer select-all items-center rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] font-bold text-muted-foreground"
                                title="ID do produto"
                                onClick={() => navigator.clipboard.writeText(String(product.id))}
                              >
                                #{product.id}
                              </span>
                              <h3 className="truncate text-sm font-semibold text-foreground sm:text-base">{product.name}</h3>

                              {product.published ? (
                                <Badge className="border-0 bg-green-100 text-[11px] text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                  <Globe className="mr-1 h-3 w-3" /> Publicado
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="text-[11px]">
                                  <EyeOff className="mr-1 h-3 w-3" /> Rascunho
                                </Badge>
                              )}

                              {product.salesChannel === "QUASE_ZERO" ? (
                                <Badge className="border-0 bg-amber-100 text-[11px] text-amber-800">
                                  Quase Zero
                                </Badge>
                              ) : product.salesChannel === "BOTH" ? (
                                <Badge className="border-0 bg-blue-100 text-[11px] text-blue-700">
                                  Shop + Quase Zero
                                </Badge>
                              ) : (
                                <Badge className="border-0 bg-slate-100 text-[11px] text-slate-700">
                                  <Store className="mr-1 h-3 w-3" /> Shop
                                </Badge>
                              )}

                              {product.productCondition && product.productCondition !== "NEW" && (
                                <Badge variant="outline" className="border-stone-300 text-[11px] text-stone-600">
                                  {String(product.productCondition).replaceAll("_", " ")}
                                </Badge>
                              )}

                              {pendingIds.has(product.id) && !product.published && (
                                <Badge variant="outline" className="border-blue-300 text-[11px] text-blue-600">
                                  Para publicar
                                </Badge>
                              )}

                              {!product.active && (
                                <Badge variant="secondary" className="text-[11px] opacity-60">Inativo</Badge>
                              )}
                              {product.promoTag && (
                                <Badge className="border-0 bg-orange-100 text-[11px] text-orange-700">🏷️ {product.promoTag}</Badge>
                              )}
                              {lowStock && (
                                <Badge variant="outline" className="border-amber-300 text-[11px] text-amber-600">⚠️ Baixo estoque</Badge>
                              )}
                              {publishedWithoutPayment && (
                                <Badge variant="outline" className="border-red-300 text-[11px] text-red-600">⚠️ Sem pagamento</Badge>
                              )}
                              {!hasPaymentMethod && !product.published && (
                                <Badge variant="outline" className="border-amber-300 text-[11px] text-amber-600">Sem pagamento</Badge>
                              )}
                              {noImage && (
                                <Badge variant="outline" className="border-slate-300 text-[11px] text-slate-500">
                                  <ImageOff className="mr-1 h-3 w-3" /> Sem imagem
                                </Badge>
                              )}
                            </div>

                            <p className="mt-1 text-xs text-muted-foreground">
                              {product.category}
                              {product.ncm && ` • NCM: ${product.ncm}`}
                              {product.shortDescription && <span className="ml-1 text-muted-foreground/70">— {product.shortDescription}</span>}
                            </p>
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          <div className="hidden items-center gap-2 sm:flex">
                            <span className="text-xs text-muted-foreground">Na vitrine</span>
                            <Switch
                              checked={product.published ?? false}
                              onCheckedChange={(checked) => togglePublished.mutate({ productId: product.id, published: checked })}
                              disabled={togglePublished.isPending}
                            />
                          </div>
                          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => toggleCard(product.id)}>
                            {compact ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                            {compact ? "Expandir" : "Recolher"}
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted/30 p-2.5 sm:grid-cols-3 xl:grid-cols-6">
                        <div>
                          <p className="text-[11px] text-muted-foreground">Custo</p>
                          <p className="text-sm font-semibold text-foreground">
                            {product.costCurrency === "USD" ? `$${(product.costPriceUsd || 0).toFixed(2)}` : formatCurrency(product.costPrice || 0)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] text-muted-foreground">Custo unit.</p>
                          <p className="text-sm font-semibold text-foreground">{formatCurrency(product.finalUnitCostBrl || product.averageCostBrl || product.costPrice || 0)}</p>
                        </div>
                        <div>
                          <p className="text-[11px] text-muted-foreground">Custo total</p>
                          <p className="text-sm font-semibold text-foreground">{formatCurrency((product.finalUnitCostBrl || product.averageCostBrl || product.costPrice || 0) * (product.stockQuantity || 0))}</p>
                        </div>
                        <div>
                          <p className="text-[11px] text-muted-foreground">Preço PIX</p>
                          <p className={`text-sm font-semibold ${hasPix ? "text-green-600" : "text-muted-foreground"}`}>
                            {hasPix ? formatCurrency(product.suggestedPricePix) : "—"}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] text-muted-foreground">Cartão / Boleto</p>
                          <p className="text-sm font-semibold text-foreground">
                            {hasCard
                              ? formatCurrency(product.suggestedPriceCard)
                              : hasBoleto
                                ? formatCurrency(product.suggestedPriceBoleto)
                                : !hasAnyPrice
                                  ? <span className="text-xs text-amber-600">Não calculado</span>
                                  : "—"}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] text-muted-foreground">Estoque</p>
                          <p className={`text-sm font-semibold ${(product.stockQuantity ?? 0) === 0 ? "text-red-600" : lowStock ? "text-amber-600" : "text-foreground"}`}>
                            {(product.stockQuantity || 0).toFixed(0)} un.
                          </p>
                        </div>
                      </div>

                      {!compact && (
                        <>
                          <div className="grid gap-2 rounded-lg border border-border/60 p-3 sm:grid-cols-2 lg:grid-cols-4">
                            <div>
                              <p className="text-[11px] text-muted-foreground">Canal</p>
                              <p className="text-sm font-medium text-foreground">
                                {product.salesChannel === "QUASE_ZERO"
                                  ? "Quase Zero"
                                  : product.salesChannel === "BOTH"
                                    ? "Shop + Quase Zero"
                                    : "Ideal Prime"}
                              </p>
                            </div>
                            <div>
                              <p className="text-[11px] text-muted-foreground">Condição</p>
                              <p className="text-sm font-medium text-foreground">
                                {product.productCondition ? String(product.productCondition).replaceAll("_", " ") : "NEW"}
                              </p>
                            </div>
                            <div>
                              <p className="text-[11px] text-muted-foreground">Margem</p>
                              <p className="text-sm font-medium text-foreground">{Number(product.desiredMarginPercent || 0).toFixed(0)}%</p>
                            </div>
                            <div>
                              <p className="text-[11px] text-muted-foreground">Estoque mínimo</p>
                              <p className="text-sm font-medium text-foreground">{Number(product.minimumStock || 0).toFixed(0)} un.</p>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2 border-t border-border/50 pt-2">
                            <Link href={`/produtos/${product.id}/editar`}>
                              <Button variant="outline" size="sm" className="gap-1.5">
                                <Edit2 className="h-3.5 w-3.5" /> {view === "paraPublicar" ? "Configurar venda" : "Editar"}
                              </Button>
                            </Link>
                            <Link href={`/simulador?productId=${product.id}`}>
                              <Button variant="outline" size="sm" className="gap-1.5">
                                <RefreshCw className="h-3.5 w-3.5" /> Simular
                              </Button>
                            </Link>
                            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => duplicate.mutate({ id: product.id })}>
                              <Copy className="h-3.5 w-3.5" /> Duplicar
                            </Button>
                            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => shareProduct(product)}>
                              <Share2 className="h-3.5 w-3.5" /> Compartilhar
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className={`gap-1.5 ${product.published ? "text-amber-600 hover:text-amber-700" : "text-green-600 hover:text-green-700"}`}
                              onClick={() => togglePublished.mutate({ productId: product.id, published: !product.published })}
                              disabled={togglePublished.isPending}
                            >
                              {product.published ? (
                                <>
                                  <EyeOff className="h-3.5 w-3.5" /> Despublicar
                                </>
                              ) : (
                                <>
                                  <Eye className="h-3.5 w-3.5" /> Publicar
                                </>
                              )}
                            </Button>
                            <div className="ml-auto flex flex-wrap gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-1.5 text-muted-foreground hover:text-foreground"
                                onClick={() => {
                                  if (confirm("Desativar este produto?")) {
                                    deactivate.mutate({ id: product.id });
                                  }
                                }}
                              >
                                <Ban className="h-3.5 w-3.5" /> Desativar
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-1.5 text-destructive hover:border-destructive/50 hover:text-destructive"
                                onClick={() => setDeleteConfirm({ id: product.id, name: product.name })}
                              >
                                <Trash2 className="h-3.5 w-3.5" /> Apagar
                              </Button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
