import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { BrandLogo } from "@/components/BrandLogo";
import { ProductVisual } from "@/components/ProductVisual";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertCircle,
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleDollarSign,
  ClipboardList,
  Download,
  FileSpreadsheet,
  FileText,
  MapPin,
  PackageCheck,
  Printer,
  Search,
  Send,
  ShoppingCart,
  Trash2,
  XCircle,
  Clock3,
} from "lucide-react";
import { toast } from "sonner";
import { hasPermission, PERMISSIONS } from "@shared/permissions";
import {
  exportOrderSpreadsheet,
  exportQuoteSpreadsheet,
  printOrderDocument,
  printQuoteDocument,
  type OrderDocument,
  type QuoteDocument,
} from "@/lib/b2bDocuments";

type Tab = "catalog" | "quotes" | "orders";

type CatalogItem = {
  id: number;
  sku: string;
  name: string;
  unit: string;
  sales_multiple: number;
  image_url?: string | null;
  short_description?: string | null;
  price_cents: number;
  available_quantity: number;
  category_label?: string | null;
};

type QuoteItem = {
  id: number;
  productId: number;
  sku: string;
  name: string;
  unit: string;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
  catalogUnitPriceCents?: number;
  quotedUnitPriceCents?: number;
  quotedTotalCents?: number;
};

type QuoteRow = QuoteDocument & {
  id: number;
  quote_number: string;
  status: string;
  total_cents: number;
  subtotal_cents?: number;
  discount_cents?: number;
  freight_cents?: number;
  created_at: string | Date;
  items?: QuoteItem[];
};

type QuoteForm = {
  customerReference: string;
  requestedDeliveryDate: string;
  deliveryAddress: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  notes: string;
};

const initialQuoteForm: QuoteForm = {
  customerReference: "",
  requestedDeliveryDate: "",
  deliveryAddress: "",
  contactName: "",
  contactEmail: "",
  contactPhone: "",
  notes: "",
};

const money = (value: number) => (Number(value || 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const hasCommercialPrice = (value: number) => Number(value || 0) > 0;
const dateOnly = (value?: string | Date | null) => value ? new Date(`${String(value).slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR") : "—";

const statusLabel: Record<string, string> = {
  PENDING: "Em análise",
  APPROVED: "Pronta para pedido",
  CONVERTED: "Convertida em pedido",
  REJECTED: "Recusada",
  CANCELLED: "Cancelada",
  ENVIADO: "Enviado",
  ACEITO: "Aceito",
  CANCELADO: "Cancelado",
  PENDENTE: "Pendente",
  PAGO: "Pago",
  AGUARDANDO_SEPARACAO: "Aguardando separação",
  ENTREGUE: "Entregue",
};

function StatusBadge({ status }: { status: string }) {
  const approved = status === "APPROVED" || status === "CONVERTED" || status === "ACEITO" || status === "PAGO" || status === "ENTREGUE";
  const rejected = ["REJECTED", "CANCELLED", "CANCELADO"].includes(status);
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold ${approved ? "bg-[#e1f5ec] text-[#067c52]" : rejected ? "bg-red-50 text-red-700" : "bg-[#e8f1fb] text-[#215b94]"}`}>
      {approved ? <CheckCircle2 className="h-3.5 w-3.5" /> : rejected ? <XCircle className="h-3.5 w-3.5" /> : <Clock3 className="h-3.5 w-3.5" />}
      {statusLabel[status] || status.replaceAll("_", " ")}
    </span>
  );
}

function LabelValue({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="rounded-xl border border-[#e1ebe7] bg-[#fbfdfc] px-3.5 py-3">
      <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#789087]">{label}</p>
      <p className="mt-1 text-sm font-medium text-[#17352c]">{value || "—"}</p>
    </div>
  );
}

export default function BusinessPortal() {
  const { user, loading, logout } = useAuth();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  useEffect(() => {
    if (loading) return;
    if (!user) setLocation(`/login?redirect=${encodeURIComponent("/portal")}`, { replace: true });
  }, [loading, user, setLocation]);

  const me = trpc.b2b.me.useQuery();
  const canCatalog = hasPermission(user?.permissions, PERMISSIONS.B2B_CATALOG, user?.role);
  const canQuotes = hasPermission(user?.permissions, PERMISSIONS.B2B_QUOTES, user?.role);
  const canOrders = hasPermission(user?.permissions, PERMISSIONS.B2B_ORDERS, user?.role);
  const canHistory = hasPermission(user?.permissions, PERMISSIONS.B2B_ORDER_HISTORY, user?.role);
  const approved = me.data?.status === "APPROVED";
  const catalog = trpc.b2b.catalog.useQuery(undefined, { enabled: Boolean(approved && canCatalog) });
  const quotes = trpc.b2b.myQuotes.useQuery(undefined, { enabled: Boolean(approved && canQuotes), refetchInterval: 15000, refetchOnWindowFocus: true });
  const orders = trpc.b2b.myOrders.useQuery(undefined, { enabled: Boolean(approved && canHistory), refetchInterval: 15000, refetchOnWindowFocus: true });

  const [activeTab, setActiveTab] = useState<Tab>(canCatalog ? "catalog" : canQuotes ? "quotes" : "orders");
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [cart, setCart] = useState<Record<number, number>>({});
  const [quoteForm, setQuoteForm] = useState<QuoteForm>(initialQuoteForm);
  const [expandedQuoteId, setExpandedQuoteId] = useState<number | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [quoteOrderSelections, setQuoteOrderSelections] = useState<Record<number, number[]>>({});

  const orderDetail = trpc.b2b.order.useQuery(
    { id: selectedOrderId || 1 },
    { enabled: Boolean(selectedOrderId && approved && canHistory) },
  );

  useEffect(() => {
    if (!me.data) return;
    setQuoteForm((current) => ({
      ...current,
      contactName: current.contactName || user?.name || "",
      contactEmail: current.contactEmail || me.data.email || user?.email || "",
      contactPhone: current.contactPhone || me.data.phone || "",
    }));
  }, [me.data, user?.name, user?.email]);

  const catalogItems = (catalog.data?.items || []) as CatalogItem[];
  const catalogCategories = useMemo(
    () => Array.from(new Set(catalogItems.map((item) => item.category_label?.trim()).filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [catalogItems],
  );

  const items = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return catalogItems.filter((item) => {
      const matchesSearch = needle ? `${item.sku} ${item.name} ${item.category_label || ""}`.toLowerCase().includes(needle) : true;
      const matchesCategory = categoryFilter ? item.category_label === categoryFilter : true;
      return matchesSearch && matchesCategory;
    });
  }, [catalogItems, query, categoryFilter]);

  const selectedItems = useMemo(
    () => Object.entries(cart)
      .filter(([, quantity]) => Number(quantity) > 0)
      .map(([productId, quantity]) => ({ productId: Number(productId), quantity: Number(quantity) })),
    [cart],
  );

  const selectedCatalogItems = useMemo(
    () => selectedItems
      .map((selected) => ({ selected, item: catalogItems.find((item) => item.id === selected.productId) }))
      .filter((entry): entry is { selected: { productId: number; quantity: number }; item: CatalogItem } => Boolean(entry.item)),
    [selectedItems, catalogItems],
  );

  const selectedTotal = selectedCatalogItems.reduce((total, entry) => total + Number(entry.item.price_cents || 0) * entry.selected.quantity, 0);
  const hasSelectionWithoutPrice = selectedCatalogItems.some((entry) => !hasCommercialPrice(entry.item.price_cents));
  const quoteRows = (quotes.data || []) as QuoteRow[];
  const openQuotes = quoteRows.filter((quote) => ["PENDING", "APPROVED"].includes(quote.status)).length;

  const setQuoteField = <K extends keyof QuoteForm>(field: K, value: QuoteForm[K]) =>
    setQuoteForm((current) => ({ ...current, [field]: value }));

  const quoteSelection = (quote: QuoteRow) =>
    quoteOrderSelections[quote.id] ?? (quote.items || []).map((item) => Number(item.id));

  const toggleQuoteOrderItem = (quote: QuoteRow, itemId: number) => {
    setQuoteOrderSelections((current) => {
      const allIds = (quote.items || []).map((item) => Number(item.id));
      const selected = current[quote.id] ?? allIds;
      const next = selected.includes(itemId) ? selected.filter((id) => id !== itemId) : [...selected, itemId];
      return { ...current, [quote.id]: next };
    });
  };

  const refreshPortal = async () => {
    await Promise.all([
      utils.b2b.catalog.invalidate(),
      utils.b2b.myQuotes.invalidate(),
      utils.b2b.myOrders.invalidate(),
    ]);
  };

  const createOrder = trpc.b2b.createOrder.useMutation({
    onSuccess: async () => {
      toast.success("Pedido enviado com sucesso.");
      setCart({});
      await refreshPortal();
      setActiveTab("orders");
    },
    onError: (error) => toast.error(error.message),
  });

  const createQuote = trpc.b2b.createQuote.useMutation({
    onSuccess: async () => {
      toast.success("Cotação enviada para análise comercial.");
      setCart({});
      setQuoteForm((current) => ({ ...initialQuoteForm, contactName: current.contactName, contactEmail: current.contactEmail, contactPhone: current.contactPhone }));
      await refreshPortal();
      setActiveTab("quotes");
    },
    onError: (error) => toast.error(error.message),
  });

  const convertQuote = trpc.b2b.createOrderFromQuote.useMutation({
    onSuccess: async (order: any) => {
      toast.success(`Pedido ${order.order_number || "gerado"} criado a partir da cotação.`);
      setQuoteOrderSelections({});
      await refreshPortal();
      setSelectedOrderId(Number(order.id));
      setActiveTab("orders");
    },
    onError: (error) => toast.error(error.message),
  });

  const handleQuoteSubmit = () => {
    if (!selectedItems.length) {
      toast.error("Selecione ao menos um produto para cotação.");
      return;
    }
    if (quoteForm.contactEmail && !/^\S+@\S+\.\S+$/.test(quoteForm.contactEmail)) {
      toast.error("Confira o e-mail de contato.");
      return;
    }
    createQuote.mutate({
      items: selectedItems,
      notes: quoteForm.notes.trim() || undefined,
      customerReference: quoteForm.customerReference.trim() || undefined,
      requestedDeliveryDate: quoteForm.requestedDeliveryDate || undefined,
      deliveryAddress: quoteForm.deliveryAddress.trim() || undefined,
      contactName: quoteForm.contactName.trim() || undefined,
      contactEmail: quoteForm.contactEmail.trim() || undefined,
      contactPhone: quoteForm.contactPhone.trim() || undefined,
      idempotencyKey: crypto.randomUUID(),
    });
  };

  const handleDirectOrder = () => {
    if (!selectedItems.length) return;
    createOrder.mutate({
      items: selectedItems,
      paymentMethod: "MANUAL",
      delivery: {
        customerReference: quoteForm.customerReference.trim() || undefined,
        requestedDeliveryDate: quoteForm.requestedDeliveryDate || undefined,
        deliveryAddress: quoteForm.deliveryAddress.trim() || undefined,
        contactName: quoteForm.contactName.trim() || undefined,
        contactEmail: quoteForm.contactEmail.trim() || undefined,
        contactPhone: quoteForm.contactPhone.trim() || undefined,
      },
      idempotencyKey: crypto.randomUUID(),
    });
  };

  if (!user) return null;

  const tabs: Array<{ key: Tab; label: string; icon: typeof ShoppingCart; count?: number }> = [
    ...(canCatalog ? [{ key: "catalog" as const, label: "Produtos e seleção", icon: ShoppingCart, count: selectedItems.length }] : []),
    ...(canQuotes ? [{ key: "quotes" as const, label: "Cotações", icon: FileText, count: openQuotes }] : []),
    ...(canHistory ? [{ key: "orders" as const, label: "Pedidos", icon: ClipboardList, count: (orders.data || []).length }] : []),
  ];

  return (
    <main className="min-h-screen bg-[#f5f8f6] text-[#17352c]">
      <header className="sticky top-0 z-20 border-b border-[#dcebe5] bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between px-4 py-3 md:px-8">
          <BrandLogo compact className="w-[176px]" />
          <div className="text-right">
            <div className="text-sm font-semibold">{me.data?.trade_name || me.data?.legal_name || user.name}</div>
            <button className="mt-0.5 text-xs font-medium text-[#087A55] hover:underline" onClick={async () => { await logout(); window.location.href = "/login"; }}>Sair da área</button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1440px] px-4 py-6 md:px-8 md:py-9">
        {me.isLoading ? (
          <p className="text-sm text-[#5e776d]">Carregando sua área...</p>
        ) : !me.data ? (
          <section className="rounded-3xl border border-[#dcebe5] bg-white p-8">
            <h1 className="text-2xl font-semibold">Empresa não vinculada</h1>
            <p className="mt-2 text-[#5e776d]">Este login ainda não está associado a uma conta empresarial.</p>
          </section>
        ) : !approved ? (
          <section className="rounded-3xl border border-[#dcebe5] bg-white p-8 shadow-sm">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-[#e8f1fb] text-[#215b94]"><Clock3 className="h-5 w-5" /></div>
            <h1 className="text-2xl font-semibold">Acesso empresarial em análise</h1>
            <p className="mt-2 max-w-xl text-[#5e776d]">A Ideal Prime precisa aprovar sua empresa e liberar as condições comerciais antes da primeira cotação ou pedido.</p>
          </section>
        ) : (
          <>
            <section className="relative overflow-hidden rounded-[30px] bg-[#083d2f] px-6 py-8 text-white shadow-[0_20px_60px_rgba(7,59,44,0.14)] md:px-10 md:py-10">
              <div className="absolute -right-20 -top-28 h-72 w-72 rounded-full border-[36px] border-[#14a475]/15" />
              <div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
                <div className="max-w-3xl">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#9BE0C3]">Área da empresa · Ideal Prime</p>
                  <h1 className="mt-2 text-3xl font-medium tracking-tight md:text-[42px] md:leading-[1.08]">Cotações e pedidos com clareza do início ao fim.</h1>
                  <p className="mt-4 max-w-2xl text-sm leading-6 text-white/72">Monte sua lista, compare valores, registre prazo e entrega, receba as condições comerciais e transforme a cotação aprovada em pedido sem redigitar nada.</p>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    [selectedItems.length, "itens selecionados"],
                    [openQuotes, "cotações abertas"],
                    [(orders.data || []).length, "pedidos"],
                  ].map(([value, label]) => (
                    <div key={String(label)} className="min-w-[112px] rounded-2xl border border-white/15 bg-white/[0.07] px-4 py-3 backdrop-blur-sm">
                      <p className="text-2xl font-semibold">{value}</p>
                      <p className="mt-1 text-[9px] uppercase tracking-[0.12em] text-white/55">{label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <nav className="mt-5 flex flex-wrap gap-2 rounded-2xl border border-[#dcebe5] bg-white p-2 shadow-sm" aria-label="Área empresarial">
              {tabs.map(({ key, label, icon: Icon, count }) => (
                <button key={key} onClick={() => setActiveTab(key)} className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${activeTab === key ? "bg-[#e8f5ef] text-[#087A55]" : "text-[#60786f] hover:bg-[#f3f8f5] hover:text-[#087A55]"}`}>
                  <Icon className="h-4 w-4" /> {label}
                  {typeof count === "number" && count > 0 && <span className={`rounded-full px-2 py-0.5 text-[10px] ${activeTab === key ? "bg-white text-[#087A55]" : "bg-[#eef4f1] text-[#60786f]"}`}>{count}</span>}
                </button>
              ))}
            </nav>

            {activeTab === "catalog" && canCatalog && (
              <section className="mt-7 grid gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
                <div>
                  <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#087A55]">1 · Monte sua necessidade</p>
                      <h2 className="mt-1 text-2xl font-semibold">Catálogo empresarial</h2>
                      <p className="mt-1 text-sm text-[#667b73]">Informe a quantidade de cada item. Você pode pedir diretamente ou enviar a mesma seleção para cotação.</p>
                    </div>
                    <div className="relative w-full md:max-w-md">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7d9189]" />
                      <Input placeholder="Buscar por SKU, produto ou categoria" className="bg-white pl-9" value={query} onChange={(event) => setQuery(event.target.value)} />
                    </div>
                  </div>

                  {catalogCategories.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button onClick={() => setCategoryFilter(null)} className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold ${categoryFilter === null ? "border-[#087A55] bg-[#087A55] text-white" : "border-[#d5e5de] bg-white text-[#647b72]"}`}>Todos</button>
                      {catalogCategories.map((categoryName) => (
                        <button key={categoryName} onClick={() => setCategoryFilter(categoryName)} className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold ${categoryFilter === categoryName ? "border-[#087A55] bg-[#087A55] text-white" : "border-[#d5e5de] bg-white text-[#647b72]"}`}>{categoryName}</button>
                      ))}
                    </div>
                  )}

                  <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {items.map((product) => {
                      const noPrice = !hasCommercialPrice(product.price_cents);
                      const selected = Number(cart[product.id] || 0);
                      return (
                        <article key={product.id} className={`overflow-hidden rounded-2xl border bg-white transition-all ${selected > 0 ? "border-[#65b899] shadow-[0_10px_30px_rgba(8,122,85,.10)]" : "border-[#dcebe5] shadow-sm hover:-translate-y-0.5"}`}>
                          <div className="aspect-[4/3] bg-[#f4f9f6]"><ProductVisual src={product.image_url} alt={product.name} category={product.category_label} className="h-full w-full" imageClassName="p-5" /></div>
                          <div className="p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#15946C]">{product.category_label || "Produto"}</p>
                                <h3 className="mt-1 line-clamp-2 min-h-[40px] text-sm font-semibold leading-5">{product.name}</h3>
                              </div>
                              {selected > 0 && <BadgeCheck className="h-5 w-5 shrink-0 text-[#087A55]" />}
                            </div>
                            <p className="mt-2 text-[11px] text-[#74877f]">SKU {product.sku} · {product.unit} · múltiplo {product.sales_multiple}</p>
                            <div className="mt-3 flex items-end justify-between gap-3">
                              <div>
                                <p className="text-base font-bold text-[#087A55]">{noPrice ? "Sob consulta" : money(product.price_cents)}</p>
                                <p className="text-[10px] text-[#74877f]">{product.available_quantity > 0 ? `${product.available_quantity} disponível(is)` : "Consulte reposição"}</p>
                              </div>
                              <Input aria-label={`Quantidade de ${product.name}`} type="number" min={product.sales_multiple} step={product.sales_multiple} className="h-9 w-24 text-right" value={cart[product.id] || ""} onChange={(event) => setCart((current) => ({ ...current, [product.id]: Math.max(0, Number(event.target.value)) }))} />
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                  {!items.length && <div className="mt-5 rounded-2xl border border-dashed border-[#b8d9ca] bg-white p-10 text-center text-sm text-[#5e776d]">Nenhum produto encontrado.</div>}
                </div>

                <aside className="h-fit xl:sticky xl:top-24">
                  <div className="overflow-hidden rounded-3xl border border-[#d9e8e1] bg-white shadow-[0_14px_50px_rgba(18,72,54,.08)]">
                    <div className="border-b border-[#e2ece7] bg-[#f2f8f5] p-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#087A55]">Sua seleção</p>
                          <h3 className="mt-1 text-lg font-semibold">Planilha da compra</h3>
                        </div>
                        <ShoppingCart className="h-5 w-5 text-[#087A55]" />
                      </div>
                    </div>
                    <div className="max-h-[360px] divide-y divide-[#edf3f0] overflow-auto px-5">
                      {selectedCatalogItems.map(({ item, selected }) => (
                        <div key={item.id} className="flex gap-3 py-3.5">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-semibold">{item.name}</p>
                            <p className="mt-1 text-[10px] text-[#74877f]">{selected.quantity} {item.unit} × {hasCommercialPrice(item.price_cents) ? money(item.price_cents) : "sob consulta"}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-semibold">{hasCommercialPrice(item.price_cents) ? money(item.price_cents * selected.quantity) : "Cotação"}</p>
                            <button className="mt-1 text-[#9aaba4] hover:text-red-600" onClick={() => setCart((current) => ({ ...current, [item.id]: 0 }))} aria-label={`Remover ${item.name}`}><Trash2 className="h-3.5 w-3.5" /></button>
                          </div>
                        </div>
                      ))}
                      {!selectedCatalogItems.length && <p className="py-8 text-center text-xs leading-5 text-[#7a8e86]">Escolha produtos e informe as quantidades para montar sua cotação ou pedido.</p>}
                    </div>
                    <div className="border-t border-[#e5eeea] p-5">
                      <div className="flex items-center justify-between text-sm"><span className="text-[#667b73]">Itens</span><b>{selectedItems.length}</b></div>
                      <div className="mt-2 flex items-center justify-between"><span className="text-sm text-[#667b73]">Estimativa atual</span><strong className="text-xl text-[#087A55]">{money(selectedTotal)}</strong></div>
                      {hasSelectionWithoutPrice && <div className="mt-4 flex gap-2 rounded-xl bg-[#fff7e8] p-3 text-[11px] leading-4 text-[#7a5b1a]"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />Há produto sem preço. Ele pode seguir normalmente para cotação, mas não para pedido direto.</div>}
                      <Button className="mt-4 w-full gap-2 bg-[#087A55] hover:bg-[#066542]" disabled={!selectedItems.length} onClick={() => setActiveTab("quotes")}><FileText className="h-4 w-4" />Montar cotação detalhada</Button>
                      {canOrders && <Button variant="outline" className="mt-2 w-full gap-2" disabled={!selectedItems.length || hasSelectionWithoutPrice || createOrder.isPending} onClick={handleDirectOrder}><Send className="h-4 w-4" />Enviar pedido direto</Button>}
                    </div>
                  </div>
                </aside>
              </section>
            )}

            {activeTab === "quotes" && canQuotes && (
              <section className="mt-7 space-y-7">
                {selectedItems.length > 0 && (
                  <div className="rounded-3xl border border-[#cfe3da] bg-white shadow-[0_14px_50px_rgba(18,72,54,.07)]">
                    <div className="grid gap-5 border-b border-[#e3eee9] bg-[#f2f8f5] px-5 py-5 md:px-7 lg:grid-cols-[1fr_auto] lg:items-center">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#087A55]">2 · Formalize a cotação</p>
                        <h2 className="mt-1 text-2xl font-semibold">Solicitação de cotação</h2>
                        <p className="mt-1 text-sm text-[#667b73]">Revise os itens e informe os dados que ajudam a equipe comercial a responder de forma objetiva.</p>
                      </div>
                      <div className="rounded-2xl bg-white px-5 py-3 text-right shadow-sm">
                        <p className="text-[9px] uppercase tracking-[0.12em] text-[#789087]">Estimativa de referência</p>
                        <p className="mt-1 text-xl font-bold text-[#087A55]">{money(selectedTotal)}</p>
                        <p className="text-[10px] text-[#789087]">O valor final pode mudar na proposta.</p>
                      </div>
                    </div>

                    <div className="grid gap-6 p-5 md:p-7 xl:grid-cols-[minmax(0,1.25fr)_minmax(340px,.75fr)]">
                      <div>
                        <div className="overflow-hidden rounded-2xl border border-[#e0ebe6]">
                          <div className="grid grid-cols-[90px_minmax(0,1fr)_74px_110px] gap-3 bg-[#f7faf8] px-4 py-2.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-[#73887f]"><span>SKU</span><span>Produto</span><span className="text-right">Qtd.</span><span className="text-right">Referência</span></div>
                          <div className="divide-y divide-[#edf3f0]">
                            {selectedCatalogItems.map(({ item, selected }) => (
                              <div key={item.id} className="grid grid-cols-[90px_minmax(0,1fr)_74px_110px] gap-3 px-4 py-3 text-xs">
                                <span className="text-[#70857c]">{item.sku}</span>
                                <span className="font-medium">{item.name}<span className="ml-1 text-[10px] font-normal text-[#85978f]">/{item.unit}</span></span>
                                <span className="text-right font-semibold">{selected.quantity}</span>
                                <span className="text-right font-semibold text-[#087A55]">{hasCommercialPrice(item.price_cents) ? money(item.price_cents * selected.quantity) : "A cotar"}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="mt-4 rounded-2xl border border-[#d9e8e1] bg-[#fbfdfc] p-4">
                          <label className="text-[10px] font-semibold uppercase tracking-[0.11em] text-[#678077]">Observações e necessidade comercial</label>
                          <Textarea className="mt-2 min-h-28 bg-white" placeholder="Ex.: prazo prioritário, preferência de embalagem, quantidade recorrente, condição específica ou qualquer contexto útil." value={quoteForm.notes} onChange={(event) => setQuoteField("notes", event.target.value)} />
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                          <div><label className="text-[10px] font-semibold uppercase tracking-[0.11em] text-[#678077]">Referência interna / OC</label><Input className="mt-1.5 bg-white" placeholder="Ex.: OC-1458 / setor compras" value={quoteForm.customerReference} onChange={(e) => setQuoteField("customerReference", e.target.value)} /></div>
                          <div><label className="text-[10px] font-semibold uppercase tracking-[0.11em] text-[#678077]">Entrega desejada</label><Input type="date" className="mt-1.5 bg-white" value={quoteForm.requestedDeliveryDate} onChange={(e) => setQuoteField("requestedDeliveryDate", e.target.value)} /></div>
                        </div>
                        <div><label className="text-[10px] font-semibold uppercase tracking-[0.11em] text-[#678077]">Local / instruções de entrega</label><Textarea className="mt-1.5 min-h-20 bg-white" placeholder="Endereço, unidade, cidade ou instrução para cálculo/logística." value={quoteForm.deliveryAddress} onChange={(e) => setQuoteField("deliveryAddress", e.target.value)} /></div>
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                          <div className="sm:col-span-2 xl:col-span-1 2xl:col-span-2"><label className="text-[10px] font-semibold uppercase tracking-[0.11em] text-[#678077]">Responsável pela cotação</label><Input className="mt-1.5 bg-white" value={quoteForm.contactName} onChange={(e) => setQuoteField("contactName", e.target.value)} /></div>
                          <div><label className="text-[10px] font-semibold uppercase tracking-[0.11em] text-[#678077]">E-mail</label><Input type="email" className="mt-1.5 bg-white" value={quoteForm.contactEmail} onChange={(e) => setQuoteField("contactEmail", e.target.value)} /></div>
                          <div><label className="text-[10px] font-semibold uppercase tracking-[0.11em] text-[#678077]">Telefone</label><Input className="mt-1.5 bg-white" value={quoteForm.contactPhone} onChange={(e) => setQuoteField("contactPhone", e.target.value)} /></div>
                        </div>
                        <div className="rounded-2xl border border-[#cfe3da] bg-[#eef7f2] p-4 text-xs leading-5 text-[#557168]">
                          <div className="flex gap-2"><CircleDollarSign className="mt-0.5 h-4 w-4 shrink-0 text-[#087A55]" /><p>A resposta comercial mostrará <b>valor de referência x valor cotado</b>, desconto, frete, total, validade, pagamento e entrega.</p></div>
                        </div>
                        <Button className="w-full gap-2 bg-[#087A55] hover:bg-[#066542]" onClick={handleQuoteSubmit} disabled={createQuote.isPending}>{createQuote.isPending ? "Enviando cotação…" : "Enviar cotação para análise"}<ArrowRight className="h-4 w-4" /></Button>
                        <Button variant="ghost" className="w-full text-[#60786f]" onClick={() => setActiveTab("catalog")}>Voltar e alterar produtos</Button>
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#087A55]">Histórico comercial</p>
                      <h2 className="mt-1 text-2xl font-semibold">Minhas cotações</h2>
                      <p className="mt-1 text-sm text-[#667b73]">Consulte proposta, comparativo de valores, condições e documentos.</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button asChild variant="outline" className="gap-2"><a href="/templates/ideal-prime-cotacao-pedido.xlsx" download><Download className="h-4 w-4" />Modelo XLSX</a></Button>
                      {!selectedItems.length && canCatalog && <Button variant="outline" onClick={() => setActiveTab("catalog")} className="gap-2">Nova cotação <ArrowRight className="h-4 w-4" /></Button>}
                    </div>
                  </div>

                  <div className="mt-5 space-y-3">
                    {quoteRows.map((quote) => {
                      const expanded = expandedQuoteId === quote.id;
                      const referenceTotal = (quote.items || []).reduce((sum, item) => sum + Number(item.totalCents || 0), 0);
                      const quotedItemsTotal = (quote.items || []).reduce((sum, item) => sum + Number(item.quotedTotalCents ?? item.totalCents ?? 0), 0);
                      const savings = Math.max(0, referenceTotal - quotedItemsTotal + Number(quote.discount_cents || 0));
                      const selectedQuoteItemIds = quoteSelection(quote);
                      const selectedQuoteItems = (quote.items || []).filter((item) => selectedQuoteItemIds.includes(Number(item.id)));
                      const selectedSubtotal = selectedQuoteItems.reduce((sum, item) => sum + Number(item.quotedTotalCents ?? (Number(item.quantity || 0) * Number(item.quotedUnitPriceCents ?? item.unitPriceCents ?? 0))), 0);
                      const proposalSubtotal = Math.max(0, Number(quote.subtotal_cents ?? quotedItemsTotal));
                      const proposalDiscount = Math.max(0, Number(quote.discount_cents || 0));
                      const selectedDiscount = selectedQuoteItems.length !== (quote.items || []).length && proposalSubtotal > 0
                        ? Math.min(selectedSubtotal, Math.round(proposalDiscount * (selectedSubtotal / proposalSubtotal)))
                        : Math.min(selectedSubtotal, proposalDiscount);
                      const selectedOrderTotal = Math.max(0, selectedSubtotal - selectedDiscount + Number(quote.freight_cents || 0));
                      const convertedOrder = ((orders.data || []) as any[]).find((order) => Number(order.delivery_snapshot?.quoteId) === Number(quote.id));
                      return (
                        <article key={quote.id} className="overflow-hidden rounded-2xl border border-[#dcebe5] bg-white shadow-sm">
                          <button className="flex w-full flex-col justify-between gap-4 p-5 text-left md:flex-row md:items-center" onClick={() => setExpandedQuoteId(expanded ? null : quote.id)}>
                            <div className="flex items-start gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#eef7f2] text-[#087A55]"><FileText className="h-5 w-5" /></div>
                              <div><p className="font-semibold">{quote.quote_number}</p><p className="mt-1 text-xs text-[#74877f]">{new Date(quote.created_at).toLocaleString("pt-BR")} · {quote.items?.length || 0} item(ns){quote.customer_reference ? ` · ${quote.customer_reference}` : ""}</p></div>
                            </div>
                            <div className="flex items-center gap-4 md:justify-end">
                              <div className="text-left md:text-right"><p className="text-[9px] uppercase tracking-[0.1em] text-[#81938c]">Total</p><p className="text-lg font-bold text-[#087A55]">{money(Number(quote.total_cents || 0))}</p></div>
                              <StatusBadge status={quote.status} />
                              {expanded ? <ChevronUp className="h-4 w-4 text-[#81938c]" /> : <ChevronDown className="h-4 w-4 text-[#81938c]" />}
                            </div>
                          </button>

                          {expanded && (
                            <div className="border-t border-[#e8efec] bg-[#fcfdfc] p-5 md:p-6">
                              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                <LabelValue label="Referência / OC" value={quote.customer_reference} />
                                <LabelValue label="Entrega desejada" value={dateOnly(quote.requested_delivery_date)} />
                                <LabelValue label="Validade da proposta" value={dateOnly(quote.valid_until)} />
                                <LabelValue label="Contato" value={quote.contact_name || quote.contact_email} />
                              </div>

                              {quote.status === "APPROVED" && canOrders && (
                                <div className="mt-5 rounded-2xl border border-[#b8decf] bg-[#edf8f3] p-4">
                                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                    <div><p className="font-semibold text-[#066542]">Proposta liberada para pedido</p><p className="mt-1 text-xs leading-5 text-[#557168]">Revise os itens abaixo. Você pode desmarcar produtos que não deseja incluir antes de confirmar o pedido.</p></div>
                                    <div className="shrink-0 text-left md:text-right"><p className="text-[9px] uppercase tracking-[0.1em] text-[#71877e]">Pedido selecionado</p><p className="text-xl font-bold text-[#087A55]">{money(selectedOrderTotal)}</p><p className="text-[10px] text-[#71877e]">{selectedQuoteItems.length} de {(quote.items || []).length} item(ns)</p></div>
                                  </div>
                                </div>
                              )}

                              <div className="mt-5 hidden overflow-hidden rounded-xl border border-[#e0ebe6] bg-white md:block">
                                <table className="w-full table-fixed text-left text-xs">
                                  <thead className="bg-[#f2f8f5] text-[9px] uppercase tracking-[0.09em] text-[#71877e]"><tr>{quote.status === "APPROVED" && canOrders && <th className="w-[7%] px-3 py-2.5 text-center">Pedido</th>}<th className="w-[13%] px-3 py-2.5">SKU</th><th className="px-3 py-2.5">Produto</th><th className="w-[8%] px-3 py-2.5 text-right">Qtd.</th><th className="w-[14%] px-3 py-2.5 text-right">Referência</th><th className="w-[14%] px-3 py-2.5 text-right">Cotado</th><th className="w-[14%] px-3 py-2.5 text-right">Total</th></tr></thead>
                                  <tbody className="divide-y divide-[#edf3f0]">{(quote.items || []).map((item) => { const included = selectedQuoteItemIds.includes(Number(item.id)); return <tr key={item.id} className={quote.status === "APPROVED" && canOrders && !included ? "bg-slate-50 opacity-55" : ""}>{quote.status === "APPROVED" && canOrders && <td className="px-3 py-3 text-center"><input type="checkbox" className="h-4 w-4 accent-[#087A55]" checked={included} onChange={() => toggleQuoteOrderItem(quote, Number(item.id))} aria-label={`Incluir ${item.name} no pedido`} /></td>}<td className="break-words px-3 py-3 text-[#6f837a]">{item.sku}</td><td className="px-3 py-3 font-medium leading-5">{item.name}<span className="ml-1 text-[10px] font-normal text-[#82958d]">/{item.unit}</span></td><td className="px-3 py-3 text-right font-semibold">{item.quantity}</td><td className="px-3 py-3 text-right">{money(Number(item.catalogUnitPriceCents ?? item.unitPriceCents ?? 0))}</td><td className="px-3 py-3 text-right font-semibold text-[#087A55]">{Number(item.quotedUnitPriceCents ?? item.unitPriceCents ?? 0) > 0 ? money(Number(item.quotedUnitPriceCents ?? item.unitPriceCents ?? 0)) : "Em análise"}</td><td className="px-3 py-3 text-right font-semibold">{money(Number(item.quotedTotalCents ?? item.totalCents ?? 0))}</td></tr>; })}</tbody>
                                </table>
                              </div>
                              <div className="mt-5 space-y-3 md:hidden">
                                {(quote.items || []).map((item) => { const included = selectedQuoteItemIds.includes(Number(item.id)); return <div key={item.id} className={`rounded-2xl border border-[#e0ebe6] bg-white p-4 ${quote.status === "APPROVED" && canOrders && !included ? "opacity-55" : ""}`}><div className="flex items-start gap-3">{quote.status === "APPROVED" && canOrders && <input type="checkbox" className="mt-1 h-4 w-4 accent-[#087A55]" checked={included} onChange={() => toggleQuoteOrderItem(quote, Number(item.id))} aria-label={`Incluir ${item.name} no pedido`} />}<div className="min-w-0 flex-1"><p className="text-[10px] font-semibold text-[#6f837a]">{item.sku}</p><p className="mt-1 font-medium">{item.name}</p><p className="text-xs text-[#82958d]">{item.quantity} {item.unit}</p><div className="mt-3 grid grid-cols-3 gap-2 text-xs"><div><p className="text-[9px] uppercase text-[#82958d]">Referência</p><b>{money(Number(item.catalogUnitPriceCents ?? item.unitPriceCents ?? 0))}</b></div><div><p className="text-[9px] uppercase text-[#82958d]">Cotado</p><b className="text-[#087A55]">{Number(item.quotedUnitPriceCents ?? item.unitPriceCents ?? 0) > 0 ? money(Number(item.quotedUnitPriceCents ?? item.unitPriceCents ?? 0)) : "Em análise"}</b></div><div className="text-right"><p className="text-[9px] uppercase text-[#82958d]">Total</p><b>{money(Number(item.quotedTotalCents ?? item.totalCents ?? 0))}</b></div></div></div></div></div>; })}
                              </div>

                              <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_330px]">
                                <div className="space-y-3 text-sm">
                                  {quote.payment_terms_text && <div><p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[#789087]">Pagamento</p><p className="mt-1 text-[#405f54]">{quote.payment_terms_text}</p></div>}
                                  {quote.delivery_terms_text && <div><p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[#789087]">Entrega</p><p className="mt-1 text-[#405f54]">{quote.delivery_terms_text}</p></div>}
                                  {quote.commercial_notes && <div><p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[#789087]">Observações comerciais</p><p className="mt-1 whitespace-pre-wrap text-[#405f54]">{quote.commercial_notes}</p></div>}
                                  {quote.notes && <div><p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[#789087]">Sua observação</p><p className="mt-1 whitespace-pre-wrap text-[#405f54]">{quote.notes}</p></div>}
                                  {quote.delivery_address && <div className="flex gap-2 rounded-xl bg-[#f2f8f5] p-3 text-xs text-[#557168]"><MapPin className="h-4 w-4 shrink-0 text-[#087A55]" />{quote.delivery_address}</div>}
                                </div>
                                <div className="rounded-2xl border border-[#d9e8e1] bg-white p-4">
                                  <div className="flex justify-between py-1.5 text-xs"><span className="text-[#6d8179]">Referência dos itens</span><b>{money(referenceTotal)}</b></div>
                                  <div className="flex justify-between py-1.5 text-xs"><span className="text-[#6d8179]">Subtotal cotado</span><b>{money(Number(quote.subtotal_cents ?? quotedItemsTotal))}</b></div>
                                  <div className="flex justify-between py-1.5 text-xs"><span className="text-[#6d8179]">Desconto</span><b className="text-[#087A55]">− {money(Number(quote.discount_cents || 0))}</b></div>
                                  <div className="flex justify-between py-1.5 text-xs"><span className="text-[#6d8179]">Frete</span><b>{money(Number(quote.freight_cents || 0))}</b></div>
                                  {savings > 0 && <div className="my-2 rounded-xl bg-[#eaf7f1] px-3 py-2 text-xs text-[#087A55]"><b>Economia estimada:</b> {money(savings)}</div>}
                                  <div className="mt-2 flex justify-between border-t border-[#dfe9e5] pt-3"><span className="font-semibold">Total</span><strong className="text-xl text-[#087A55]">{money(Number(quote.total_cents || 0))}</strong></div>
                                </div>
                              </div>

                              <div className="mt-5 flex flex-wrap items-center gap-2">
                                <Button size="sm" variant="outline" className="gap-2" onClick={() => exportQuoteSpreadsheet(quote).catch((error) => toast.error(error instanceof Error ? error.message : "Não foi possível exportar a planilha."))}><FileSpreadsheet className="h-4 w-4" />Baixar planilha</Button>
                                <Button size="sm" variant="outline" className="gap-2" onClick={() => { try { printQuoteDocument(quote); } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível abrir a impressão."); } }}><Printer className="h-4 w-4" />Imprimir / PDF</Button>
                                {quote.status === "PENDING" && <span className="ml-auto text-xs font-medium text-[#557168]">Aguardando a Ideal Prime concluir e liberar a proposta.</span>}
                                {quote.status === "APPROVED" && canOrders && <Button size="sm" className="ml-auto gap-2 bg-[#087A55] px-5 hover:bg-[#066542]" onClick={() => { if (!selectedQuoteItemIds.length) { toast.error("Selecione ao menos um item para gerar o pedido."); return; } convertQuote.mutate({ quoteId: quote.id, idempotencyKey: crypto.randomUUID(), selectedQuoteItemIds }); }} disabled={convertQuote.isPending || !selectedQuoteItemIds.length}><PackageCheck className="h-4 w-4" />{convertQuote.isPending ? "Gerando pedido…" : "Aceitar cotação e gerar pedido"}</Button>}
                                {quote.status === "CONVERTED" && convertedOrder && <Button size="sm" className="ml-auto gap-2 bg-[#087A55] hover:bg-[#066542]" onClick={() => { setSelectedOrderId(Number(convertedOrder.id)); setActiveTab("orders"); }}><ClipboardList className="h-4 w-4" />Abrir pedido {convertedOrder.order_number}</Button>}
                              </div>
                            </div>
                          )}
                        </article>
                      );
                    })}
                    {!quoteRows.length && <div className="rounded-2xl border border-dashed border-[#b8d9ca] bg-white p-10 text-center text-sm text-[#5e776d]">Você ainda não enviou uma cotação. Selecione produtos no catálogo para começar.</div>}
                  </div>
                </div>
              </section>
            )}

            {activeTab === "orders" && canHistory && (
              <section className="mt-7 grid gap-6 xl:grid-cols-[minmax(0,.85fr)_minmax(520px,1.15fr)]">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#087A55]">3 · Acompanhe a compra</p>
                  <h2 className="mt-1 text-2xl font-semibold">Pedidos</h2>
                  <p className="mt-1 text-sm text-[#667b73]">Abra um pedido para ver itens, valores, origem e condições.</p>
                  <div className="mt-5 space-y-3">
                    {((orders.data || []) as any[]).map((order) => (
                      <button key={order.id} className={`w-full rounded-2xl border p-4 text-left transition-colors ${selectedOrderId === order.id ? "border-[#66b699] bg-[#f2f8f5]" : "border-[#dcebe5] bg-white hover:border-[#a9cebe]"}`} onClick={() => setSelectedOrderId(Number(order.id))}>
                        <div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{order.order_number}</p><p className="mt-1 text-[11px] text-[#74877f]">{new Date(order.created_at).toLocaleString("pt-BR")}{order.delivery_snapshot?.customerReference ? ` · ${order.delivery_snapshot.customerReference}` : ""}</p></div><strong className="text-[#087A55]">{money(Number(order.total_cents || 0))}</strong></div>
                        <div className="mt-3 flex flex-wrap gap-1.5"><StatusBadge status={order.commercial_status} /><StatusBadge status={order.payment_status} /><StatusBadge status={order.fulfillment_status} /></div>
                      </button>
                    ))}
                    {!orders.data?.length && <div className="rounded-2xl border border-dashed border-[#b8d9ca] bg-white p-10 text-center text-sm text-[#5e776d]">Você ainda não possui pedidos.</div>}
                  </div>
                </div>

                <div className="h-fit xl:sticky xl:top-24">
                  {!selectedOrderId ? (
                    <div className="rounded-3xl border border-[#dcebe5] bg-white p-10 text-center shadow-sm"><ClipboardList className="mx-auto h-8 w-8 text-[#8aa097]" /><h3 className="mt-3 font-semibold">Detalhes do pedido</h3><p className="mt-1 text-sm text-[#74877f]">Selecione um pedido para abrir a planilha completa.</p></div>
                  ) : orderDetail.isLoading ? (
                    <div className="rounded-3xl border border-[#dcebe5] bg-white p-8 text-sm text-[#74877f]">Carregando pedido...</div>
                  ) : orderDetail.data ? (
                    <div className="overflow-hidden rounded-3xl border border-[#dcebe5] bg-white shadow-[0_14px_50px_rgba(18,72,54,.07)]">
                      <div className="border-b border-[#e2ece7] bg-[#f2f8f5] p-5 md:p-6">
                        <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#087A55]">Pedido empresarial</p><h3 className="mt-1 text-xl font-semibold">{orderDetail.data.order_number}</h3><p className="mt-1 text-xs text-[#71867d]">{orderDetail.data.trade_name || orderDetail.data.legal_name}</p></div><strong className="text-2xl text-[#087A55]">{money(Number(orderDetail.data.total_cents || 0))}</strong></div>
                      </div>
                      <div className="p-5 md:p-6">
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          <LabelValue label="Comercial" value={statusLabel[orderDetail.data.commercial_status] || orderDetail.data.commercial_status} />
                          <LabelValue label="Pagamento" value={statusLabel[orderDetail.data.payment_status] || orderDetail.data.payment_status} />
                          <LabelValue label="Expedição" value={statusLabel[orderDetail.data.fulfillment_status] || orderDetail.data.fulfillment_status} />
                        </div>
                        <div className="mt-5 hidden overflow-hidden rounded-xl border border-[#e0ebe6] md:block">
                          <table className="w-full table-fixed text-xs"><thead className="bg-[#f6faf8] text-[9px] uppercase tracking-[0.08em] text-[#72877f]"><tr><th className="w-[16%] px-3 py-2.5 text-left">SKU</th><th className="px-3 py-2.5 text-left">Produto</th><th className="w-[14%] px-3 py-2.5 text-right">Qtd.</th><th className="w-[17%] px-3 py-2.5 text-right">Unitário</th><th className="w-[17%] px-3 py-2.5 text-right">Total</th></tr></thead><tbody className="divide-y divide-[#edf3f0]">{(orderDetail.data.items || []).map((item: any) => <tr key={item.id}><td className="break-words px-3 py-3 text-[#71867d]">{item.sku_snapshot}</td><td className="px-3 py-3 font-medium leading-5">{item.name_snapshot}</td><td className="px-3 py-3 text-right">{item.quantity} {item.unit_snapshot}</td><td className="px-3 py-3 text-right">{money(item.unit_price_cents)}</td><td className="px-3 py-3 text-right font-semibold">{money(item.total_cents)}</td></tr>)}</tbody></table>
                        </div>
                        <div className="mt-5 space-y-3 md:hidden">{(orderDetail.data.items || []).map((item: any) => <div key={item.id} className="rounded-2xl border border-[#e0ebe6] bg-white p-4"><p className="text-[10px] font-semibold text-[#71867d]">{item.sku_snapshot}</p><p className="mt-1 font-medium">{item.name_snapshot}</p><div className="mt-3 flex items-end justify-between gap-4 text-xs"><span className="text-[#71867d]">{item.quantity} {item.unit_snapshot} × {money(item.unit_price_cents)}</span><b>{money(item.total_cents)}</b></div></div>)}</div>
                        <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_320px]">
                          <div className="space-y-3">
                            {orderDetail.data.delivery_snapshot && <div className="grid gap-3 sm:grid-cols-2"><LabelValue label="Referência do cliente" value={(orderDetail.data.delivery_snapshot as any).customerReference} /><LabelValue label="Entrega desejada" value={dateOnly((orderDetail.data.delivery_snapshot as any).requestedDeliveryDate)} /><div className="sm:col-span-2"><LabelValue label="Local / instruções de entrega" value={(orderDetail.data.delivery_snapshot as any).deliveryAddress} /></div></div>}
                            <div className="grid gap-3 sm:grid-cols-2"><LabelValue label="Origem" value={(orderDetail.data.terms_snapshot as any)?.quoteNumber ? `Cotação ${(orderDetail.data.terms_snapshot as any).quoteNumber}` : "Pedido direto"} /><LabelValue label="Pagamento" value={(orderDetail.data.terms_snapshot as any)?.paymentTermsText || "Conforme cadastro comercial"} /><div className="sm:col-span-2"><LabelValue label="Condição de entrega" value={(orderDetail.data.delivery_snapshot as any)?.deliveryTermsText || "Conforme confirmação operacional"} /></div></div>
                            {(orderDetail.data.delivery_snapshot as any)?.partialFromQuote && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">Pedido parcial: foram incluídos somente os produtos selecionados na cotação aprovada.</div>}
                          </div>
                          <div className="h-fit rounded-2xl border border-[#d9e8e1] bg-[#f7fbf9] p-4 text-sm">
                            <div className="flex justify-between py-1.5"><span className="text-[#6d8179]">Subtotal</span><b>{money(Number((orderDetail.data.delivery_snapshot as any)?.subtotalCents || orderDetail.data.total_cents || 0))}</b></div>
                            <div className="flex justify-between py-1.5"><span className="text-[#6d8179]">Desconto</span><b className="text-[#087A55]">− {money(Number((orderDetail.data.delivery_snapshot as any)?.discountCents || 0))}</b></div>
                            <div className="flex justify-between py-1.5"><span className="text-[#6d8179]">Frete</span><b>{money(Number((orderDetail.data.delivery_snapshot as any)?.freightCents || 0))}</b></div>
                            <div className="mt-2 flex justify-between border-t border-[#dfe9e5] pt-3"><span className="font-semibold">Total do pedido</span><strong className="text-xl text-[#087A55]">{money(Number(orderDetail.data.total_cents || 0))}</strong></div>
                          </div>
                        </div>
                        <div className="mt-5 flex flex-wrap gap-2"><Button size="sm" variant="outline" className="gap-2" onClick={() => exportOrderSpreadsheet(orderDetail.data as OrderDocument).catch((error) => toast.error(error instanceof Error ? error.message : "Não foi possível exportar o pedido."))}><Download className="h-4 w-4" />Baixar XLSX</Button><Button size="sm" variant="outline" className="gap-2" onClick={() => { try { printOrderDocument(orderDetail.data as OrderDocument); } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível imprimir o pedido."); } }}><Printer className="h-4 w-4" />Imprimir / PDF</Button></div>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-3xl border border-red-100 bg-red-50 p-8 text-sm text-red-700">Não foi possível carregar este pedido.</div>
                  )}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
