import { useMemo, useState } from "react";
import { Link } from "wouter";
import {
  ArrowLeft,
  CalendarDays,
  Package,
  Search,
  ShoppingBag,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  STATUS_COLOR,
  STATUS_LABEL,
  type OrderStatus,
} from "@/lib/orderStatus";

const initialContact = () => {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("contact") ?? "";
};
const fmt = (value: number) =>
  Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

export default function MinhaConta() {
  const [contact, setContact] = useState(initialContact);
  const [submittedContact, setSubmittedContact] = useState(initialContact);
  const ordersQuery = trpc.customers.myOrders.useQuery(
    { contact: submittedContact },
    { enabled: submittedContact.trim().length >= 5 }
  );
  const groups = useMemo(() => {
    const map = new Map<string, typeof ordersQuery.data>();
    for (const order of ordersQuery.data ?? []) {
      const key = order.checkoutGroupId || `pedido-${order.id}`;
      map.set(key, [...(map.get(key) ?? []), order]);
    }
    return [...map.entries()];
  }, [ordersQuery.data]);

  const searchOrders = () => {
    const value = contact.trim();
    if (value.length < 5)
      return toast.error("Informe um WhatsApp ou e-mail válido.");
    setSubmittedContact(value);
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar para a vitrine
        </Link>
        <header className="rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-7 text-white">
          <p className="flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-amber-200">
            <ShoppingBag className="h-4 w-4" /> Área do cliente
          </p>
          <h1 className="mt-2 text-3xl font-bold">Meus pedidos</h1>
          <p className="mt-2 text-sm text-slate-300">
            Consulte seu histórico usando o mesmo WhatsApp ou e-mail informado
            na compra.
          </p>
        </header>
        <section className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-2">
              <label htmlFor="customer-contact" className="text-sm font-medium">
                Seu WhatsApp ou e-mail
              </label>
              <Input
                id="customer-contact"
                value={contact}
                onChange={event => setContact(event.target.value)}
                onKeyDown={event => {
                  if (event.key === "Enter") searchOrders();
                }}
                placeholder="(00) 00000-0000 ou voce@email.com"
              />
            </div>
            <Button onClick={searchOrders} className="gap-2">
              <Search className="h-4 w-4" /> Ver meus pedidos
            </Button>
          </div>
        </section>
        {ordersQuery.isLoading && (
          <div className="rounded-2xl border bg-white p-8 text-center text-sm text-muted-foreground">
            Buscando seus pedidos…
          </div>
        )}
        {!ordersQuery.isLoading &&
          submittedContact.length >= 5 &&
          ordersQuery.data?.length === 0 && (
            <div className="rounded-2xl border bg-white p-10 text-center">
              <Package className="mx-auto h-10 w-10 text-muted-foreground/30" />
              <p className="mt-3 text-sm text-muted-foreground">
                Nenhum pedido encontrado para este contato.
              </p>
            </div>
          )}
        {groups.length > 0 && (
          <div className="space-y-4">
            {groups.map(([groupId, orders]) => {
              const rows = orders ?? [];
              const createdAt = rows[0]?.createdAt;
              return (
                <section
                  key={groupId}
                  className="rounded-2xl border bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-4">
                    <div>
                      <p className="text-xs uppercase tracking-wider text-muted-foreground">
                        {rows.length > 1 ? "Pedido agrupado" : "Pedido"}
                      </p>
                      <h2 className="mt-1 text-lg font-semibold">
                        {rows.map(order => `#${order.id}`).join(", ")}
                      </h2>
                    </div>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <CalendarDays className="h-3.5 w-3.5" />{" "}
                      {createdAt
                        ? new Date(createdAt).toLocaleString("pt-BR")
                        : "—"}
                    </p>
                  </div>
                  <div className="mt-4 space-y-3">
                    {rows.map(order => {
                      const status = order.status as OrderStatus;
                      return (
                        <div
                          key={order.id}
                          className="flex gap-3 rounded-xl bg-slate-50 p-3"
                        >
                          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white">
                            {order.productImageUrl ? (
                              <img
                                src={order.productImageUrl}
                                alt={order.productName}
                                className="h-full w-full object-contain"
                              />
                            ) : (
                              <Package className="h-5 w-5 text-muted-foreground" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <p className="font-medium">{order.productName}</p>
                              <span
                                className={`rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[status] ?? STATUS_COLOR.EXPIRADO}`}
                              >
                                {STATUS_LABEL[status] ?? order.status}
                              </span>
                            </div>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {order.quantity} unidade(s) ·{" "}
                              {fmt(Number(order.totalPrice))}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Pagamento: {order.paymentMethod}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
