import { type DragEvent, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { formatCurrency } from "../../../shared/pricingCalculator";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ProductVisual } from "@/components/ProductVisual";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpDown,
  Ban,
  Check,
  CheckCheck,
  Copy,
  Download,
  Edit2,
  Eye,
  EyeOff,
  FileText,
  Filter,
  Globe,
  GripVertical,
  ImageOff,
  ListFilter,
  PackageCheck,
  Plus,
  RefreshCw,
  Search,
  Share2,
  SlidersHorizontal,
  Star,
  Store,
  Trash2,
  Warehouse,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

type QuickFilter =
  | "all"
  | "attention"
  | "withPhoto"
  | "inStock"
  | "lowStock"
  | "outOfStock"
  | "published"
  | "drafts"
  | "pending";
type ImageFilter = "all" | "with" | "without";
type PriceFilter = "all" | "without" | "under100" | "100to500" | "over500";

type Metric = {
  key: QuickFilter;
  label: string;
  value: number;
  icon: LucideIcon;
  tone: string;
};

const productPrice = (product: any) =>
  Number(
    product.suggestedPricePix ||
      product.suggestedPriceCard ||
      product.suggestedPriceBoleto ||
      product.suggestedPrice ||
      0
  );

const stockValue = (product: any) => Number(product.stockQuantity ?? 0);
const minimumStockValue = (product: any) => Number(product.minimumStock ?? 0);
const hasImage = (product: any) => Boolean(String(product.imageUrl || "").trim());
const hasPrice = (product: any) => productPrice(product) > 0;
const isLowStock = (product: any) => {
  const stock = stockValue(product);
  const minimum = minimumStockValue(product);
  return stock > 0 && ((minimum > 0 && stock <= minimum) || (minimum <= 0 && stock <= 5));
};
const isOutOfStock = (product: any) => stockValue(product) <= 0;

function stockLabel(product: any) {
  if (isOutOfStock(product)) return "Sem estoque";
  if (isLowStock(product)) return "Baixo";
  return "Disponível";
}

function stockTone(product: any) {
  if (isOutOfStock(product)) return "border-red-200 bg-red-50 text-red-700";
  if (isLowStock(product)) return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

export default function Products() {
  const utils = trpc.useUtils();
  const { data: products = [], isLoading } = trpc.products.list.useQuery();
  const { data: pendingProducts = [] } = trpc.products.pendingToPublish.useQuery(undefined, {
    staleTime: 60_000,
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [productTypeFilter, setProductTypeFilter] = useState("all");
  const [imageFilter, setImageFilter] = useState<ImageFilter>("all");
  const [priceFilter, setPriceFilter] = useState<PriceFilter>("all");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; name: string } | null>(null);
  const [stockDialog, setStockDialog] = useState<any | null>(null);
  const [stockDelta, setStockDelta] = useState("");
  const [stockUnitCost, setStockUnitCost] = useState("");
  const [stockNotes, setStockNotes] = useState("");
  const [minimumStockDraft, setMinimumStockDraft] = useState("");
  const [reorderMode, setReorderMode] = useState(false);
  const [orderedProducts, setOrderedProducts] = useState<any[]>([]);
  const dragIndex = useRef<number | null>(null);

  const categoryOptions = useMemo(
    () =>
      [...new Set((products as any[]).map((p) => String(p.categoryLabel || p.category || "").trim()).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, "pt-BR")
      ),
    [products]
  );
  const productTypeOptions = useMemo(
    () =>
      [...new Set((products as any[]).map((p) => String(p.subcategory || "").trim()).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, "pt-BR")
      ),
    [products]
  );
  const pendingIds = useMemo(() => new Set((pendingProducts as any[]).map((product) => product.id)), [pendingProducts]);

  const togglePublished = trpc.products.togglePublished.useMutation({
    onSuccess: (updated: any) => {
      void utils.products.list.invalidate();
      void utils.products.pendingToPublish.invalidate();
      toast.success(updated?.published ? "Produto publicado na vitrine." : "Produto retirado da vitrine.");
    },
    onError: (error: any) => toast.error(error.message),
  });
  const bulkSetPublished = trpc.products.bulkSetPublished.useMutation({
    onSuccess: (updated: any[]) => {
      void utils.products.list.invalidate();
      void utils.products.pendingToPublish.invalidate();
      setSelectedIds(new Set());
      toast.success(`${updated?.length ?? 0} produto(s) atualizado(s) na vitrine.`);
    },
    onError: (error: any) => toast.error(error.message),
  });
  const toggleFeatured = trpc.products.toggleFeatured.useMutation({
    onSuccess: (updated: any) => {
      void utils.products.list.invalidate();
      toast.success(updated?.isFeatured ? "Produto destacado na página principal." : "Destaque removido.");
    },
    onError: (error: any) => toast.error(error.message),
  });
  const updateProduct = trpc.products.update.useMutation({
    onSuccess: () => void utils.products.list.invalidate(),
    onError: (error: any) => toast.error(error.message),
  });
  const adjustStock = trpc.products.adjustStock.useMutation({
    onSuccess: () => {
      void utils.products.list.invalidate();
      void utils.products.stockEntries.invalidate();
      toast.success("Ajuste de estoque registrado com histórico.");
      setStockDialog(null);
      setStockDelta("");
      setStockNotes("");
    },
    onError: (error: any) => toast.error(error.message),
  });
  const duplicate = trpc.products.duplicate.useMutation({
    onSuccess: () => {
      void utils.products.list.invalidate();
      toast.success("Produto duplicado.");
    },
    onError: (error: any) => toast.error(error.message),
  });
  const deactivate = trpc.products.deactivate.useMutation({
    onSuccess: () => {
      void utils.products.list.invalidate();
      toast.success("Produto desativado.");
    },
    onError: (error: any) => toast.error(error.message),
  });
  const deleteProduct = trpc.products.delete.useMutation({
    onSuccess: () => {
      void utils.products.list.invalidate();
      toast.success("Produto removido permanentemente.");
      setDeleteConfirm(null);
    },
    onError: (error: any) => toast.error(error.message),
  });
  const reorder = trpc.products.reorder.useMutation({
    onSuccess: () => {
      void utils.products.list.invalidate();
      setReorderMode(false);
      setOrderedProducts([]);
      toast.success("Ordem da vitrine salva.");
    },
    onError: (error: any) => toast.error(error.message),
  });

  const openStockDialog = (product: any) => {
    setStockDialog(product);
    setStockDelta("");
    setStockUnitCost(String(product.finalUnitCostBrl || product.averageCostBrl || product.costPrice || 0));
    setMinimumStockDraft(String(product.minimumStock ?? 0));
    setStockNotes("");
  };

  const saveMinimumStock = async () => {
    if (!stockDialog) return;
    const minimumStock = Number(String(minimumStockDraft).replace(",", "."));
    if (!Number.isFinite(minimumStock) || minimumStock < 0) {
      toast.error("Informe um estoque mínimo válido.");
      return;
    }
    try {
      await updateProduct.mutateAsync({ id: stockDialog.id, data: { minimumStock } });
      toast.success("Estoque mínimo atualizado.");
    } catch {
      // O toast de erro é exibido pela mutation.
    }
  };

  const saveStockAdjustment = () => {
    if (!stockDialog) return;
    const quantity = Number(String(stockDelta).replace(",", "."));
    const unitCost = Number(String(stockUnitCost).replace(",", ".")) || 0;
    if (!Number.isFinite(quantity) || quantity === 0) {
      toast.error("Informe uma entrada positiva ou uma saída negativa.");
      return;
    }
    if (!Number.isFinite(unitCost) || unitCost < 0) {
      toast.error("Informe um custo unitário válido.");
      return;
    }
    adjustStock.mutate({
      productId: stockDialog.id,
      quantity,
      unitCost,
      notes: stockNotes.trim() || "Ajuste rápido realizado na lista de produtos",
    });
  };

  const filteredProducts = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return (products as any[]).filter((product) => {
      const category = String(product.categoryLabel || product.category || "").trim();
      const productType = String(product.subcategory || "").trim();
      const price = productPrice(product);
      const matchSearch =
        !term ||
        String(product.id).includes(term) ||
        String(product.sku || "").toLowerCase().includes(term) ||
        String(product.name || "").toLowerCase().includes(term) ||
        String(product.brand || "").toLowerCase().includes(term) ||
        category.toLowerCase().includes(term) ||
        productType.toLowerCase().includes(term);
      const matchQuick =
        quickFilter === "all" ||
        (quickFilter === "attention" && (!hasImage(product) || isOutOfStock(product) || isLowStock(product) || !product.published)) ||
        (quickFilter === "withPhoto" && hasImage(product)) ||
        (quickFilter === "inStock" && !isOutOfStock(product)) ||
        (quickFilter === "lowStock" && isLowStock(product)) ||
        (quickFilter === "outOfStock" && isOutOfStock(product)) ||
        (quickFilter === "published" && product.published) ||
        (quickFilter === "drafts" && !product.published) ||
        (quickFilter === "pending" && pendingIds.has(product.id));
      const matchCategory = categoryFilter === "all" || category === categoryFilter;
      const matchProductType = productTypeFilter === "all" || productType === productTypeFilter;
      const matchImage = imageFilter === "all" || (imageFilter === "with" && hasImage(product)) || (imageFilter === "without" && !hasImage(product));
      const matchPrice =
        priceFilter === "all" ||
        (priceFilter === "without" && price <= 0) ||
        (priceFilter === "under100" && price > 0 && price < 100) ||
        (priceFilter === "100to500" && price >= 100 && price <= 500) ||
        (priceFilter === "over500" && price > 500);
      return matchSearch && matchQuick && matchCategory && matchProductType && matchImage && matchPrice;
    });
  }, [categoryFilter, imageFilter, pendingIds, priceFilter, productTypeFilter, products, quickFilter, searchTerm]);

  const metrics = useMemo<Metric[]>(() => {
    const all = products as any[];
    return [
      { key: "all", label: "Todos", value: all.length, icon: PackageCheck, tone: "text-slate-700 bg-slate-100" },
      { key: "attention", label: "Atenção", value: all.filter((p) => !hasImage(p) || !hasPrice(p) || isOutOfStock(p) || isLowStock(p) || !p.published).length, icon: AlertTriangle, tone: "text-amber-800 bg-amber-100" },
      { key: "withPhoto", label: "Com foto", value: all.filter(hasImage).length, icon: FileText, tone: "text-blue-800 bg-blue-100" },
      { key: "inStock", label: "Com estoque", value: all.filter((p) => !isOutOfStock(p)).length, icon: Warehouse, tone: "text-emerald-800 bg-emerald-100" },
      { key: "lowStock", label: "Estoque baixo", value: all.filter(isLowStock).length, icon: AlertCircle, tone: "text-orange-800 bg-orange-100" },
      { key: "outOfStock", label: "Sem estoque", value: all.filter(isOutOfStock).length, icon: ArrowDownToLine, tone: "text-red-800 bg-red-100" },
      { key: "pending", label: "Aguardando publicar", value: pendingProducts.length, icon: Eye, tone: "text-indigo-800 bg-indigo-100" },
    ];
  }, [pendingProducts, products]);

  const filteredIds = filteredProducts.map((product: any) => product.id);
  const selectedFilteredCount = filteredIds.filter((id) => selectedIds.has(id)).length;
  const allFilteredSelected = filteredIds.length > 0 && selectedFilteredCount === filteredIds.length;
  const hasActiveFilters = quickFilter !== "all" || categoryFilter !== "all" || productTypeFilter !== "all" || imageFilter !== "all" || priceFilter !== "all" || Boolean(searchTerm);

  const setSelectionForFiltered = (selected: boolean) => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      filteredIds.forEach((id) => (selected ? next.add(id) : next.delete(id)));
      return next;
    });
  };

  const toggleProductSelection = (productId: number, selected: boolean) => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (selected) next.add(productId);
      else next.delete(productId);
      return next;
    });
  };

  const applyBulkPublished = (published: boolean) => {
    const ids = [...selectedIds];
    if (!ids.length) {
      toast.info("Selecione produtos para aplicar uma ação.");
      return;
    }
    bulkSetPublished.mutate({ productIds: ids, published });
  };

  const clearFilters = () => {
    setSearchTerm("");
    setQuickFilter("all");
    setCategoryFilter("all");
    setProductTypeFilter("all");
    setImageFilter("all");
    setPriceFilter("all");
  };

  const enterReorderMode = () => {
    const sorted = [...(products as any[]).filter((p) => p.active)].sort((a, b) => {
      if (a.displayOrder !== b.displayOrder) return (a.displayOrder ?? 0) - (b.displayOrder ?? 0);
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    setOrderedProducts(sorted);
    setReorderMode(true);
  };

  const handleDragOver = (event: DragEvent, index: number) => {
    event.preventDefault();
    if (dragIndex.current === null || dragIndex.current === index) return;
    const updated = [...orderedProducts];
    const [moved] = updated.splice(dragIndex.current, 1);
    updated.splice(index, 0, moved);
    dragIndex.current = index;
    setOrderedProducts(updated);
  };

  const exportToExcel = () => {
    const rows = (products as any[]).map((product) => ({
      ID: product.id,
      SKU: product.sku || "",
      Produto: product.name,
      Marca: product.brand || "",
      Categoria: product.categoryLabel || product.category || "",
      Tipo: product.subcategory || "",
      Estoque: stockValue(product),
      "Estoque mínimo": minimumStockValue(product),
      "Status estoque": stockLabel(product),
      Foto: hasImage(product) ? "Sim" : "Não",
      Vitrine: product.published ? "Sim" : "Não",
      "Preço PIX": product.suggestedPricePix || "",
    }));
    if (!rows.length) {
      toast.error("Nenhum produto para exportar.");
      return;
    }
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), "Produtos");
    XLSX.writeFile(workbook, `ideal-prime-produtos-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success("Lista exportada.");
  };

  const shareProduct = (product: any) => {
    const baseUrl = import.meta.env.VITE_STOREFRONT_URL || window.location.origin;
    const url = `${baseUrl}/vitrine/${product.id}`;
    navigator.clipboard.writeText(url).then(() => toast.success("Link do produto copiado."));
  };

  const resetStockDialog = () => {
    setStockDialog(null);
    setStockDelta("");
    setStockNotes("");
  };

  if (isLoading) {
    return (
      <div className="space-y-4" aria-busy="true">
        <div className="h-24 animate-pulse rounded-2xl bg-white shadow-sm" />
        <div className="h-16 animate-pulse rounded-xl bg-white shadow-sm" />
        <div className="h-[420px] animate-pulse rounded-xl bg-white shadow-sm" />
      </div>
    );
  }

  return (
    <div className="admin-products-page mx-auto max-w-[1500px] space-y-5">
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar produto permanentemente?</AlertDialogTitle>
            <AlertDialogDescription>
              O produto <strong>"{deleteConfirm?.name}"</strong> será removido definitivamente. Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteConfirm && deleteProduct.mutate({ id: deleteConfirm.id })}>
              Apagar definitivamente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!stockDialog} onOpenChange={(open) => !open && resetStockDialog()}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-lg">Atualizar estoque</DialogTitle>
            <DialogDescription>
              {stockDialog?.name} · saldo atual: <strong>{stockDialog ? stockValue(stockDialog).toFixed(0) : 0} un.</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-3 text-sm text-blue-900">
              Use uma entrada positiva ou uma saída negativa. O ajuste é gravado no histórico e não permite saldo negativo.
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-600" htmlFor="stock-delta">Ajuste de unidades</label>
                <Input id="stock-delta" type="number" step="any" placeholder="Ex.: 10 ou -2" value={stockDelta} onChange={(event) => setStockDelta(event.target.value)} />
                <p className="text-xs text-muted-foreground">Entrada positiva · saída negativa</p>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-600" htmlFor="stock-unit-cost">Custo unitário</label>
                <Input id="stock-unit-cost" type="number" min="0" step="0.01" value={stockUnitCost} onChange={(event) => setStockUnitCost(event.target.value)} />
                <p className="text-xs text-muted-foreground">Usado no histórico da movimentação.</p>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-600" htmlFor="stock-notes">Observação</label>
              <Input id="stock-notes" placeholder="Ex.: conferência física, avaria, reposição..." value={stockNotes} onChange={(event) => setStockNotes(event.target.value)} />
            </div>
            <div className="border-t border-slate-200 pt-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-600" htmlFor="minimum-stock">Estoque mínimo para alerta</label>
                  <Input id="minimum-stock" className="w-40" type="number" min="0" step="any" value={minimumStockDraft} onChange={(event) => setMinimumStockDraft(event.target.value)} />
                </div>
                <Button variant="outline" onClick={saveMinimumStock} disabled={updateProduct.isPending}>Salvar estoque mínimo</Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetStockDialog}>Cancelar</Button>
            <Button onClick={saveStockAdjustment} disabled={adjustStock.isPending} className="gap-2"><PackageCheck className="h-4 w-4" />{adjustStock.isPending ? "Registrando..." : "Registrar ajuste"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {reorderMode ? (
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">Configuração da vitrine</p>
              <h1 className="mt-1 text-xl font-bold tracking-tight text-slate-900">Ordenar produtos publicados</h1>
              <p className="mt-1 text-sm text-slate-500">Arraste as linhas para definir a ordem exibida na vitrine.</p>
            </div>
            <div className="flex gap-2"><Button variant="outline" onClick={() => setReorderMode(false)}>Cancelar</Button><Button onClick={() => reorder.mutate({ orderedIds: orderedProducts.map((p) => p.id) })} disabled={reorder.isPending} className="gap-2"><Check className="h-4 w-4" />Salvar ordem</Button></div>
          </div>
          <div className="max-h-[72vh] overflow-y-auto p-4">
            <div className="space-y-2">
              {orderedProducts.map((product, index) => (
                <div key={product.id} draggable onDragStart={() => { dragIndex.current = index; }} onDragOver={(event) => handleDragOver(event, index)} onDragEnd={() => { dragIndex.current = null; }} className="flex cursor-grab items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 active:cursor-grabbing">
                  <span className="w-7 text-center font-mono text-xs font-bold text-slate-500">{index + 1}</span><GripVertical className="h-4 w-4 text-slate-400" /><ProductVisual src={product.imageUrl} alt={product.name} category={product.categoryLabel || product.category} compact className="h-10 w-10 rounded border" imageClassName="p-0.5" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-800">{product.name}</p><p className="text-xs text-slate-500">{product.categoryLabel || product.category}</p></div>{product.published ? <Badge className="border-0 bg-emerald-100 text-emerald-700">Publicado</Badge> : <Badge variant="secondary">Rascunho</Badge>}
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : (
        <>
          <header className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:flex-row lg:items-center">
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700"><Warehouse className="h-4 w-4" /> Operação de catálogo</div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">Produtos</h1>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">Encontre rapidamente o que precisa de foto, estoque, publicação ou revisão. Edite sem percorrer uma lista interminável.</p>
            </div>
            <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={enterReorderMode} disabled={!products.length} className="gap-2"><ArrowUpDown className="h-4 w-4" />Ordenar vitrine</Button><Button variant="outline" onClick={exportToExcel} disabled={!products.length} className="gap-2"><Download className="h-4 w-4" />Exportar</Button><Link href="/produtos/novo"><Button className="gap-2"><Plus className="h-4 w-4" />Novo produto</Button></Link></div>
          </header>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            {metrics.map((metric) => {
              const Icon = metric.icon;
              return <button key={metric.key} type="button" onClick={() => setQuickFilter(metric.key)} className={`rounded-xl border bg-white p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${quickFilter === metric.key ? "border-emerald-500 ring-2 ring-emerald-100" : "border-slate-200"}`}><span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${metric.tone}`}><Icon className="h-4 w-4" /></span><span className="mt-3 block text-2xl font-bold tracking-tight text-slate-950">{metric.value}</span><span className="text-xs font-medium text-slate-500">{metric.label}</span></button>;
            })}
          </div>

          <section className="sticky top-[4.5rem] z-30 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm backdrop-blur">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="relative min-w-0 flex-1 xl:max-w-xl"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Buscar por produto, SKU, marca, categoria ou ID..." className="h-11 border-slate-200 bg-slate-50 pl-10 text-sm focus:bg-white" /></div>
              <div className="flex flex-wrap items-center gap-2"><span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500"><SlidersHorizontal className="h-3.5 w-3.5" />Filtros</span><Select value={categoryFilter} onValueChange={setCategoryFilter}><SelectTrigger className="h-9 w-[170px] bg-slate-50 text-xs"><SelectValue placeholder="Categoria" /></SelectTrigger><SelectContent><SelectItem value="all">Todas as categorias</SelectItem>{categoryOptions.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent></Select><Select value={productTypeFilter} onValueChange={setProductTypeFilter}><SelectTrigger className="h-9 w-[160px] bg-slate-50 text-xs"><SelectValue placeholder="Tipo" /></SelectTrigger><SelectContent><SelectItem value="all">Todos os tipos</SelectItem>{productTypeOptions.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent></Select><Select value={imageFilter} onValueChange={(value) => setImageFilter(value as ImageFilter)}><SelectTrigger className="h-9 w-[145px] bg-slate-50 text-xs"><SelectValue placeholder="Foto" /></SelectTrigger><SelectContent><SelectItem value="all">Qualquer foto</SelectItem><SelectItem value="with">Com foto</SelectItem><SelectItem value="without">Sem foto</SelectItem></SelectContent></Select><Select value={priceFilter} onValueChange={(value) => setPriceFilter(value as PriceFilter)}><SelectTrigger className="h-9 w-[155px] bg-slate-50 text-xs"><SelectValue placeholder="Preço" /></SelectTrigger><SelectContent><SelectItem value="all">Qualquer preço</SelectItem><SelectItem value="without">Sob consulta</SelectItem><SelectItem value="under100">Até R$ 100</SelectItem><SelectItem value="100to500">R$ 100 a R$ 500</SelectItem><SelectItem value="over500">Acima de R$ 500</SelectItem></SelectContent></Select>{hasActiveFilters && <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1.5 text-slate-600"><X className="h-3.5 w-3.5" />Limpar</Button>}</div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2"><span className="mr-1 inline-flex items-center gap-1 text-xs font-semibold text-slate-500"><Filter className="h-3.5 w-3.5" />Atalhos:</span>{metrics.map((metric) => <button key={`quick-${metric.key}`} type="button" onClick={() => setQuickFilter(metric.key)} className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${quickFilter === metric.key ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-200 bg-slate-50 text-slate-600 hover:border-emerald-300 hover:text-emerald-700"}`}>{metric.label} <span className="ml-1 opacity-70">{metric.value}</span></button>)}</div>
          </section>

          <section className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4 shadow-sm"><div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between"><div className="flex flex-wrap items-center gap-3"><Checkbox aria-label="Selecionar todos os resultados" checked={allFilteredSelected ? true : selectedFilteredCount > 0 ? "indeterminate" : false} onCheckedChange={(checked) => setSelectionForFiltered(checked === true)} /><div><p className="text-sm font-bold text-slate-900">Ações em lote</p><p className="text-xs text-slate-600">{selectedIds.size} selecionado(s) · {filteredProducts.length} resultado(s) visível(is)</p></div><Button variant="outline" size="sm" onClick={() => setSelectionForFiltered(true)} disabled={!filteredProducts.length} className="gap-1.5 bg-white"><CheckCheck className="h-3.5 w-3.5" />Marcar todos</Button><Button variant="outline" size="sm" onClick={() => setSelectionForFiltered(false)} disabled={!filteredProducts.length} className="gap-1.5 bg-white"><X className="h-3.5 w-3.5" />Desmarcar</Button></div><div className="flex flex-wrap gap-2"><Button size="sm" onClick={() => applyBulkPublished(true)} disabled={!selectedIds.size || bulkSetPublished.isPending} className="gap-1.5 bg-emerald-700 text-white hover:bg-emerald-800"><Eye className="h-3.5 w-3.5" />Publicar selecionados</Button><Button variant="outline" size="sm" onClick={() => applyBulkPublished(false)} disabled={!selectedIds.size || bulkSetPublished.isPending} className="gap-1.5 bg-white text-amber-800"><EyeOff className="h-3.5 w-3.5" />Retirar selecionados</Button></div></div></section>

          {products.length === 0 ? <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm"><AlertCircle className="mx-auto mb-4 h-10 w-10 text-slate-400" /><h2 className="text-lg font-bold text-slate-900">Nenhum produto cadastrado</h2><p className="mt-2 text-sm text-slate-500">Comece criando seu primeiro produto.</p><Link href="/produtos/novo"><Button className="mt-5">Criar produto</Button></Link></div> : filteredProducts.length === 0 ? <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm"><Search className="mx-auto mb-4 h-9 w-9 text-slate-400" /><h2 className="text-lg font-bold text-slate-900">Nenhum produto encontrado</h2><p className="mt-2 text-sm text-slate-500">Ajuste a busca ou limpe os filtros para ver mais itens.</p><Button variant="outline" className="mt-5" onClick={clearFilters}>Limpar filtros</Button></div> : <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-5"><div><h2 className="text-sm font-bold text-slate-900">Lista operacional</h2><p className="text-xs text-slate-500">Mostrando {filteredProducts.length} de {products.length} produtos</p></div><div className="flex items-center gap-2 text-xs text-slate-500"><Globe className="h-3.5 w-3.5 text-emerald-600" />Publicação rápida por linha</div></div><div className="overflow-x-auto"><table className="w-full min-w-[1080px] text-left text-sm"><thead className="bg-slate-50 text-[11px] uppercase tracking-[0.08em] text-slate-500"><tr><th className="w-12 px-4 py-3"><Checkbox aria-label="Selecionar todos os resultados" checked={allFilteredSelected ? true : selectedFilteredCount > 0 ? "indeterminate" : false} onCheckedChange={(checked) => setSelectionForFiltered(checked === true)} /></th><th className="px-3 py-3">Produto</th><th className="px-3 py-3">Categoria / tipo</th><th className="px-3 py-3">Estoque</th><th className="px-3 py-3">Preço</th><th className="px-3 py-3">Vitrine</th><th className="px-3 py-3 text-right">Ações</th></tr></thead><tbody className="divide-y divide-slate-100">{filteredProducts.map((product: any) => { const lowStock = isLowStock(product); const outOfStock = isOutOfStock(product); const price = productPrice(product); return <tr key={product.id} className="group transition hover:bg-slate-50/80"><td className="px-4 py-3 align-top"><Checkbox aria-label={`Selecionar ${product.name}`} checked={selectedIds.has(product.id)} onCheckedChange={(checked) => toggleProductSelection(product.id, checked === true)} /></td><td className="px-3 py-3 align-top"><div className="flex min-w-[300px] items-start gap-3"><ProductVisual src={product.imageUrl} alt={product.name} category={product.categoryLabel || product.category} compact className="h-12 w-12 shrink-0 rounded-lg border border-slate-200" imageClassName="p-1" /><div className="min-w-0"><div className="flex items-center gap-2"><p className="max-w-[330px] truncate font-semibold text-slate-900" title={product.name}>{product.name}</p>{!hasImage(product) && <ImageOff className="h-3.5 w-3.5 shrink-0 text-slate-400" />}</div><p className="mt-1 font-mono text-[11px] text-slate-500">#{product.id}{product.sku ? ` · ${product.sku}` : ""}</p><div className="mt-1 flex flex-wrap gap-1">{product.brand && <span className="text-xs text-slate-500">{product.brand}</span>}{product.promoTag && <Badge className="border-0 bg-orange-100 px-1.5 py-0 text-[10px] text-orange-700">{product.promoTag}</Badge>}</div></div></div></td><td className="px-3 py-3 align-top"><p className="max-w-[190px] truncate text-xs font-semibold text-slate-700">{product.categoryLabel || product.category || "Sem categoria"}</p><p className="mt-1 max-w-[190px] truncate text-xs text-slate-500">{product.subcategory || "Tipo não informado"}</p></td><td className="px-3 py-3 align-top"><div className="flex items-center gap-2"><span className={`inline-flex min-w-[58px] justify-center rounded-md border px-2 py-1 text-sm font-bold ${stockTone(product)}`}>{stockValue(product).toFixed(0)} un.</span><div><p className={`text-[11px] font-semibold ${outOfStock ? "text-red-700" : lowStock ? "text-amber-700" : "text-emerald-700"}`}>{stockLabel(product)}</p><p className="text-[11px] text-slate-500">mín. {minimumStockValue(product).toFixed(0)}</p></div></div></td><td className="px-3 py-3 align-top"><p className={`font-semibold ${price > 0 ? "text-slate-800" : "text-amber-700"}`}>{price > 0 ? formatCurrency(price) : "Sob consulta"}</p><p className="mt-1 text-[11px] text-slate-500">{product.published ? "Preço publicado" : "Não publicado"}</p></td><td className="px-3 py-3 align-top"><div className="flex items-center gap-2"><Switch checked={Boolean(product.published)} onCheckedChange={(checked) => togglePublished.mutate({ productId: product.id, published: checked })} disabled={togglePublished.isPending || bulkSetPublished.isPending} /><span className={`text-xs font-semibold ${product.published ? "text-emerald-700" : "text-slate-500"}`}>{product.published ? "Publicado" : "Rascunho"}</span></div>{product.isFeatured && <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700"><Star className="h-3 w-3 fill-current" />Página principal</span>}</td><td className="px-3 py-3 align-top"><div className="flex justify-end gap-1.5"><Link href={`/produtos/${product.id}/editar`}><Button variant="outline" size="sm" className="h-8 gap-1.5 bg-white px-2.5"><Edit2 className="h-3.5 w-3.5" />Editar</Button></Link><Button variant="outline" size="sm" className="h-8 gap-1.5 bg-white px-2.5" onClick={() => openStockDialog(product)}><Warehouse className="h-3.5 w-3.5" />Estoque</Button><Button variant="ghost" size="icon" className="h-8 w-8" title="Destacar na página principal" onClick={() => toggleFeatured.mutate({ productId: product.id, isFeatured: !product.isFeatured, featuredOrder: Number(product.featuredOrder || 0) })}><Star className={`h-4 w-4 ${product.isFeatured ? "fill-amber-400 text-amber-500" : "text-slate-400"}`} /></Button><Button variant="ghost" size="icon" className="h-8 w-8" title="Copiar link público" onClick={() => shareProduct(product)}><Share2 className="h-4 w-4 text-slate-500" /></Button><Button variant="ghost" size="icon" className="h-8 w-8" title="Duplicar produto" onClick={() => duplicate.mutate({ id: product.id })}><Copy className="h-4 w-4 text-slate-500" /></Button><Button variant="ghost" size="icon" className="h-8 w-8" title="Apagar produto" onClick={() => setDeleteConfirm({ id: product.id, name: product.name })}><Trash2 className="h-4 w-4 text-red-500" /></Button></div><div className="mt-2 flex justify-end gap-2"><Link href={`/simulador?productId=${product.id}`} className="text-[11px] font-semibold text-slate-500 hover:text-emerald-700">Simular preço</Link><button type="button" className="text-[11px] font-semibold text-slate-500 hover:text-emerald-700" onClick={() => deactivate.mutate({ id: product.id })}><Ban className="mr-1 inline h-3 w-3" />Desativar</button></div></td></tr>; })}</tbody></table></div></section>}

          <p className="text-center text-xs text-slate-400">{pendingProducts.length} produto(s) com estoque e custo aguardando publicação · alterações de estoque geram histórico para auditoria.</p>
        </>
      )}
    </div>
  );
}
