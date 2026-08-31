import { useMemo, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FileText, ShoppingCart, ClipboardList, CheckCircle2, Clock3, XCircle, Send, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { hasPermission, PERMISSIONS } from "@shared/permissions";

type Tab = "catalog" | "quotes" | "orders";
type CatalogItem = { id: number; sku: string; name: string; unit: string; sales_multiple: number; image_url?: string | null; short_description?: string | null; price_cents: number; available_quantity: number; category_label?: string | null };
type QuoteRow = { id: number; quote_number: string; status: string; total_cents: number; created_at: string | Date; notes?: string | null; items?: unknown[] };

const money = (value: number) => (value / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function StatusBadge({ status }: { status: string }) {
  const approved = status === "APPROVED";
  const rejected = ["REJECTED", "CANCELLED"].includes(status);
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${approved ? "bg-[#e1f5ec] text-[#067c52]" : rejected ? "bg-red-50 text-red-700" : "bg-[#e8f1fb] text-[#098EC7]"}`}>
      {approved ? <CheckCircle2 className="h-3.5 w-3.5" /> : rejected ? <XCircle className="h-3.5 w-3.5" /> : <Clock3 className="h-3.5 w-3.5" />}
      {status === "PENDING" ? "Em análise" : status === "APPROVED" ? "Aprovada" : status === "CONVERTED" ? "Convertida em pedido" : status === "REJECTED" ? "Recusada" : status === "CANCELLED" ? "Cancelada" : status}
    </span>
  );
}

export default function BusinessPortal() {
  const { user, logout } = useAuth();
  const utils = trpc.useUtils();
  const me = trpc.b2b.me.useQuery();
  const canCatalog = hasPermission(user?.permissions, PERMISSIONS.B2B_CATALOG, user?.role);
  const canQuotes = hasPermission(user?.permissions, PERMISSIONS.B2B_QUOTES, user?.role);
  const canOrders = hasPermission(user?.permissions, PERMISSIONS.B2B_ORDERS, user?.role);
  const canHistory = hasPermission(user?.permissions, PERMISSIONS.B2B_ORDER_HISTORY, user?.role);
  const approved = me.data?.status === "APPROVED";
  const catalog = trpc.b2b.catalog.useQuery(undefined, { enabled: Boolean(approved && canCatalog) });
  const quotes = trpc.b2b.myQuotes.useQuery(undefined, { enabled: Boolean(approved && canQuotes) });
  const orders = trpc.b2b.myOrders.useQuery(undefined, { enabled: Boolean(approved && canHistory) });
  const [activeTab, setActiveTab] = useState<Tab>(canCatalog ? "catalog" : canQuotes ? "quotes" : "orders");
  const [query, setQuery] = useState("");
  const [notes, setNotes] = useState("");
  const [cart, setCart] = useState<Record<number, number>>({});

  const items = useMemo(() => {
    const list = (catalog.data?.items || []) as CatalogItem[];
    const needle = query.trim().toLowerCase();
    return needle ? list.filter((item) => `${item.sku} ${item.name} ${item.category_label || ""}`.toLowerCase().includes(needle)) : list;
  }, [catalog.data, query]);

  const selectedItems = useMemo(() => Object.entries(cart).filter(([, quantity]) => quantity > 0).map(([productId, quantity]) => ({ productId: Number(productId), quantity })), [cart]);
  const selectedTotal = selectedItems.reduce((total, selected) => total + ((catalog.data?.items as CatalogItem[] | undefined)?.find((item) => item.id === selected.productId)?.price_cents || 0) * selected.quantity, 0);

  const refreshPortal = async () => {
    await Promise.all([utils.b2b.catalog.invalidate(), utils.b2b.myQuotes.invalidate(), utils.b2b.myOrders.invalidate()]);
  };
  const createOrder = trpc.b2b.createOrder.useMutation({ onSuccess: async () => { toast.success("Pedido enviado para a Ideal Prime."); setCart({}); await refreshPortal(); setActiveTab("orders"); }, onError: (error) => toast.error(error.message) });
  const createQuote = trpc.b2b.createQuote.useMutation({ onSuccess: async () => { toast.success("Cotação enviada para análise comercial."); setCart({}); setNotes(""); await refreshPortal(); setActiveTab("quotes"); }, onError: (error) => toast.error(error.message) });
  const convertQuote = trpc.b2b.createOrderFromQuote.useMutation({ onSuccess: async () => { toast.success("Cotação convertida em pedido."); await refreshPortal(); setActiveTab("orders"); }, onError: (error) => toast.error(error.message) });

  if (!user) return null;
  const tabs: Array<{ key: Tab; label: string; icon: typeof ShoppingCart }> = [
    ...(canCatalog ? [{ key: "catalog" as const, label: "Catálogo", icon: ShoppingCart }] : []),
    ...(canQuotes ? [{ key: "quotes" as const, label: "Cotações", icon: FileText }] : []),
    ...(canHistory ? [{ key: "orders" as const, label: "Meus pedidos", icon: ClipboardList }] : []),
  ];

  return (
    <main className="min-h-screen bg-[#f6f8f7] text-[#17352c]">
      <header className="sticky top-0 z-10 border-b border-[#dcebe5] bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 md:px-8">
          <BrandLogo compact className="w-[170px]" />
          <div className="text-right">
            <div className="font-medium">{me.data?.trade_name || me.data?.legal_name || user.name}</div>
            <button className="text-sm font-medium text-[#098EC7] transition-colors hover:text-[#067c52]" onClick={async () => { await logout(); location.href = "/login" }}>Sair</button>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-10">
        {me.isLoading ? <p className="text-sm text-[#5e776d]">Carregando ambiente empresarial...</p> : !me.data ? <section className="rounded-2xl border border-[#dcebe5] bg-white p-8"><h1 className="text-2xl font-semibold">Empresa não vinculada</h1><p className="mt-2 text-[#5e776d]">Este login ainda não está associado a uma conta empresarial.</p></section> : !approved ? <section className="rounded-2xl border border-[#dcebe5] bg-white p-8 shadow-sm"><div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-[#e8f1fb] text-[#098EC7]"><Clock3 className="h-5 w-5" /></div><h1 className="text-2xl font-semibold">Acesso empresarial em análise</h1><p className="mt-2 max-w-xl text-[#5e776d]">A Ideal Prime precisa aprovar sua empresa e liberar a tabela comercial antes do primeiro pedido ou cotação.</p></section> : <>
          <section className="relative overflow-hidden rounded-3xl bg-[#073b2c] px-6 py-8 text-white shadow-lg md:px-10"><div className="absolute -right-12 -top-16 h-52 w-52 rounded-full border-[26px] border-[#098EC7]/30" /><div className="relative max-w-2xl"><p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#b8e6d2]">Relacionamento PRIME</p><h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">Compre, cote e acompanhe tudo em um só lugar.</h1><p className="mt-3 max-w-xl text-sm leading-6 text-[#d5eee3]">Você acessa somente os recursos liberados para sua empresa, com preços autorizados, estoque atualizado e histórico comercial.</p></div></section>
          <nav className="mt-6 flex flex-wrap gap-2 rounded-2xl border border-[#dcebe5] bg-white p-2 shadow-sm" aria-label="Área empresarial">{tabs.map(({ key, label, icon: Icon }) => <button key={key} onClick={() => setActiveTab(key)} className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${activeTab === key ? "bg-[#e8f1fb] text-[#098EC7]" : "text-[#5e776d] hover:bg-[#f1f8f5] hover:text-[#067c52]"}`}><Icon className="h-4 w-4" />{label}</button>)}</nav>

          {activeTab === "catalog" && canCatalog && <section className="mt-8"><div className="flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#098EC7]">Tabela autorizada</p><h2 className="mt-1 text-2xl font-semibold">Catálogo empresarial</h2><p className="mt-1 text-sm text-[#5e776d]">Selecione quantidades e escolha entre pedido imediato ou cotação comercial.</p></div><Input placeholder="Buscar por SKU, produto ou categoria" className="bg-white md:max-w-md" value={query} onChange={(event) => setQuery(event.target.value)} /></div><div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{items.map((product) => <article key={product.id} className="overflow-hidden rounded-2xl border border-[#dcebe5] bg-white shadow-sm transition-transform hover:-translate-y-0.5"><div className="aspect-square bg-[#f1f8f5]">{product.image_url ? <img src={product.image_url} alt={product.name} className="h-full w-full object-contain" /> : <div className="flex h-full items-center justify-center text-sm text-[#8ca79c]">Sem imagem</div>}</div><div className="p-4"><div className="text-xs text-[#5e776d]">{product.sku} · {product.unit}</div><h3 className="mt-1 font-semibold">{product.name}</h3>{product.short_description && <p className="mt-1 line-clamp-2 text-xs text-[#5e776d]">{product.short_description}</p>}<div className="mt-3 text-lg font-semibold text-[#067c52]">{money(product.price_cents)}</div><div className="mt-1 text-xs text-[#5e776d]">Disponível: {product.available_quantity} · múltiplo {product.sales_multiple}</div><Input aria-label={`Quantidade de ${product.name}`} type="number" min={product.sales_multiple} step={product.sales_multiple} className="mt-3" value={cart[product.id] || ""} onChange={(event) => setCart((current) => ({ ...current, [product.id]: Number(event.target.value) }))} /></div></article>)}</div>{!items.length && <div className="mt-6 rounded-2xl border border-dashed border-[#b8d9ca] bg-white p-10 text-center text-sm text-[#5e776d]">Nenhum produto encontrado na tabela empresarial.</div>}
            <div className="mt-8 grid gap-4 lg:grid-cols-[1fr_360px]"><div className="rounded-2xl border border-[#dcebe5] bg-white p-5"><div className="flex items-center justify-between gap-3"><div><h3 className="font-semibold">Resumo da seleção</h3><p className="text-sm text-[#5e776d]">{selectedItems.length} produto(s) · estimativa {money(selectedTotal)}</p></div><ShoppingCart className="h-5 w-5 text-[#098EC7]" /></div><div className="mt-4 flex flex-wrap gap-3">{canOrders && <Button disabled={!selectedItems.length || createOrder.isPending} onClick={() => createOrder.mutate({ items: selectedItems, paymentMethod: "MANUAL", idempotencyKey: crypto.randomUUID() })} className="gap-2 bg-[#067c52] hover:bg-[#056343]"><Send className="h-4 w-4" />Enviar pedido</Button>}{canQuotes && <Button disabled={!selectedItems.length || createQuote.isPending} variant="outline" onClick={() => setActiveTab("quotes")} className="gap-2 border-[#098EC7] text-[#098EC7] hover:bg-[#e8f1fb]"><FileText className="h-4 w-4" />Solicitar cotação</Button>}</div></div><div className="rounded-2xl border border-[#dcebe5] bg-[#f1f8f5] p-5"><p className="text-sm font-semibold text-[#067c52]">Compra empresarial PRIME</p><p className="mt-2 text-sm leading-6 text-[#5e776d]">Pedidos diretos reservam estoque. Cotações passam pela análise comercial antes da conversão em pedido.</p></div></div>
          </section>}

          {activeTab === "quotes" && canQuotes && <section className="mt-8 grid gap-6 lg:grid-cols-[1fr_380px]"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#098EC7]">Negociação comercial</p><h2 className="mt-1 text-2xl font-semibold">Minhas cotações</h2><div className="mt-5 space-y-3">{((quotes.data || []) as QuoteRow[]).map((quote) => <article key={quote.id} className="rounded-2xl border border-[#dcebe5] bg-white p-5 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold text-[#17352c]">{quote.quote_number}</p><p className="mt-1 text-xs text-[#5e776d]">{new Date(quote.created_at).toLocaleString("pt-BR")} · {quote.items?.length || 0} item(ns)</p></div><StatusBadge status={quote.status} /></div><div className="mt-4 flex flex-wrap items-center justify-between gap-3"><strong className="text-lg text-[#067c52]">{money(Number(quote.total_cents || 0))}</strong>{quote.status === "APPROVED" && canOrders && <Button size="sm" onClick={() => convertQuote.mutate({ quoteId: quote.id, idempotencyKey: crypto.randomUUID() })} disabled={convertQuote.isPending} className="gap-2 bg-[#067c52] hover:bg-[#056343]">Virar pedido <ArrowRight className="h-4 w-4" /></Button>}</div></article>)}{!quotes.data?.length && <div className="rounded-2xl border border-dashed border-[#b8d9ca] bg-white p-10 text-center text-sm text-[#5e776d]">Você ainda não enviou uma cotação.</div>}</div></div><div className="rounded-2xl border border-[#dcebe5] bg-white p-5 shadow-sm"><h3 className="font-semibold">Nova cotação</h3><p className="mt-1 text-sm text-[#5e776d]">Volte ao catálogo para selecionar os produtos e descreva uma necessidade comercial.</p><Textarea className="mt-4 min-h-32" placeholder="Observações, prazo, condição ou contexto do pedido" value={notes} onChange={(event) => setNotes(event.target.value)} />{canCatalog ? <Button className="mt-3 w-full gap-2 border-[#098EC7] text-[#098EC7]" variant="outline" onClick={() => setActiveTab("catalog")}>Selecionar produtos <ArrowRight className="h-4 w-4" /></Button> : <p className="mt-3 rounded-lg bg-[#f1f8f5] p-3 text-xs text-[#5e776d]">O catálogo não está liberado para esta conta.</p>}{selectedItems.length > 0 && <Button className="mt-2 w-full gap-2 bg-[#098EC7] hover:bg-[#0678A8]" onClick={() => createQuote.mutate({ items: selectedItems, notes, idempotencyKey: crypto.randomUUID() })} disabled={createQuote.isPending}><FileText className="h-4 w-4" />Enviar seleção para cotação</Button>}</div></section>}

          {activeTab === "orders" && canHistory && <section className="mt-8"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#098EC7]">Acompanhamento</p><h2 className="mt-1 text-2xl font-semibold">Meus pedidos</h2><div className="mt-5 space-y-3">{((orders.data || []) as any[]).map((order) => <article key={order.id} className="flex flex-col justify-between gap-3 rounded-2xl border border-[#dcebe5] bg-white p-5 shadow-sm md:flex-row md:items-center"><div><p className="font-semibold">{order.order_number}</p><p className="mt-1 text-xs text-[#5e776d]">{new Date(order.created_at).toLocaleString("pt-BR")}</p></div><div className="text-left md:text-right"><p className="text-lg font-semibold text-[#067c52]">{money(Number(order.total_cents || 0))}</p><p className="text-xs text-[#5e776d]">{order.commercial_status} · {order.payment_status} · {order.fulfillment_status}</p></div></article>)}{!orders.data?.length && <div className="rounded-2xl border border-dashed border-[#b8d9ca] bg-white p-10 text-center text-sm text-[#5e776d]">Você ainda não possui pedidos.</div>}</div></section>}
        </>}
      </div>
    </main>
  );
}
