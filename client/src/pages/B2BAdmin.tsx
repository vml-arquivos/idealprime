import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileText, Building2, ShoppingBag } from "lucide-react";
import { toast } from "sonner";

const money = (value: number) => (value / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function B2BAdmin() {
  const utils = trpc.useUtils();
  const businesses = trpc.b2b.admin.businesses.useQuery();
  const lists = trpc.b2b.admin.priceLists.useQuery();
  const orders = trpc.b2b.admin.orders.useQuery();
  const quotes = trpc.b2b.admin.quotes.useQuery();
  const imports = trpc.b2b.admin.imports.useQuery();
  const [name, setName] = useState("Tabela B2B padrão");
  const createList = trpc.b2b.admin.createPriceList.useMutation({ onSuccess: () => utils.b2b.admin.priceLists.invalidate(), onError: (error) => toast.error(error.message) });
  const approve = trpc.b2b.admin.approve.useMutation({ onSuccess: () => utils.b2b.admin.businesses.invalidate(), onError: (error) => toast.error(error.message) });
  const transition = trpc.b2b.admin.transition.useMutation({ onSuccess: () => utils.b2b.admin.orders.invalidate(), onError: (error) => toast.error(error.message) });
  const transitionQuote = trpc.b2b.admin.transitionQuote.useMutation({ onSuccess: () => utils.b2b.admin.quotes.invalidate(), onError: (error) => toast.error(error.message) });

  return (
    <div className="space-y-8">
      <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#215b94]">Relacionamento empresarial</p><h1 className="mt-1 text-2xl font-semibold">Operação B2B</h1><p className="text-sm text-muted-foreground">Empresas, tabelas, cotações, pedidos e importações Ideal Prime.</p></div>
      <section><h2 className="mb-3 flex items-center gap-2 font-semibold"><Building2 className="h-5 w-5 text-[#215b94]" /> Empresas pendentes</h2><div className="space-y-2">{businesses.data?.map((business: any) => <div className="flex flex-col justify-between gap-3 rounded-xl border border-border bg-card p-4 md:flex-row md:items-center" key={business.id}><div><strong>{business.trade_name || business.legal_name}</strong><div className="text-xs text-muted-foreground">{business.cnpj} · {business.status}</div></div>{business.status === "PENDING" && <Button size="sm" onClick={() => approve.mutate({ id: business.id, priceListId: lists.data?.find((item: any) => item.is_default)?.id })}>Aprovar empresa</Button>}</div>)}</div></section>
      <section><h2 className="mb-3 font-semibold">Tabelas de preço</h2><div className="flex max-w-lg gap-2"><Input value={name} onChange={(event) => setName(event.target.value)} /><Button onClick={() => createList.mutate({ name, isDefault: !(lists.data?.length) })}>Criar tabela</Button></div><div className="mt-3 space-y-1 text-sm">{lists.data?.map((priceList: any) => <div key={priceList.id}>{priceList.name} {priceList.is_default ? "· padrão" : ""} · versão {priceList.latest_version}</div>)}</div><p className="mt-2 text-xs text-muted-foreground">Importação CSV/XLSX permanece em /api/b2b/import com tabela, modo e arquivo autenticados.</p></section>
      <section><h2 className="mb-3 flex items-center gap-2 font-semibold"><FileText className="h-5 w-5 text-[#215b94]" /> Cotações empresariais</h2><div className="space-y-2">{quotes.data?.map((quote: any) => <div className="rounded-xl border border-border bg-card p-4" key={quote.id}><div className="flex flex-col justify-between gap-2 md:flex-row"><div><strong>{quote.quote_number} · {quote.trade_name || quote.legal_name}</strong><div className="text-xs text-muted-foreground">{quote.buyer_name} · {new Date(quote.created_at).toLocaleString("pt-BR")}</div></div><strong className="text-[#067c52]">{money(Number(quote.total_cents || 0))}</strong></div><div className="mt-3 flex flex-wrap items-center gap-2"><span className="rounded-full bg-[#e8f1fb] px-2.5 py-1 text-xs font-semibold text-[#215b94]">{quote.status}</span>{quote.status === "PENDING" && <><Button size="sm" onClick={() => transitionQuote.mutate({ id: quote.id, action: "APPROVE" })}>Aprovar</Button><Button size="sm" variant="outline" onClick={() => transitionQuote.mutate({ id: quote.id, action: "REJECT" })}>Recusar</Button></>}{quote.status === "APPROVED" && <Button size="sm" variant="outline" onClick={() => transitionQuote.mutate({ id: quote.id, action: "CANCEL" })}>Cancelar</Button>}</div></div>)}{!quotes.data?.length && <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Nenhuma cotação empresarial recebida.</div>}</div></section>
      <section><h2 className="mb-3 flex items-center gap-2 font-semibold"><ShoppingBag className="h-5 w-5 text-[#067c52]" /> Pedidos B2B</h2><div className="space-y-2">{orders.data?.map((order: any) => <div className="rounded-xl border border-border p-4" key={order.id}><div className="flex justify-between gap-3"><strong>{order.order_number} · {order.trade_name || order.legal_name}</strong><span>{money(Number(order.total_cents || 0))}</span></div><div className="mt-1 text-xs text-muted-foreground">{order.commercial_status} · {order.payment_status} · {order.fulfillment_status}</div><div className="mt-3 flex flex-wrap gap-2">{[["ACCEPT", "Aceitar"], ["PAY", "Confirmar pagamento"], ["SHIP", "Expedir"], ["CANCEL", "Cancelar"]].map(([action, label]) => <Button key={action} size="sm" variant="outline" onClick={() => transition.mutate({ id: order.id, action: action as "ACCEPT" | "PAY" | "SHIP" | "CANCEL" })}>{label}</Button>)}</div></div>)}</div></section>
      <section><h2 className="mb-2 font-semibold">Últimas importações</h2>{imports.data?.map((job: any) => <div key={job.id} className="text-sm">#{job.id} · {job.mode} · {job.status} · {job.price_list_name}</div>)}</section>
    </div>
  );
}
