/**
 * NotasFiscais.tsx — Emissão de Nota Fiscal Eletrônica (NF-e/NFC-e)
 *
 * Tela de preparação: hoje nenhum provedor de emissão real está configurado (ver
 * docs/ideal-prime/NFE_INTEGRACAO.md), então "Emitir" com o provedor padrão (Nenhum)
 * só registra a solicitação (status "Aguardando provedor") — não gera nota de verdade
 * perante a SEFAZ. A tela e as rotas já estão prontas para qualquer provedor que for
 * escolhido depois (Focus NFe, PlugNotas, eNotas, NFe.io ou integração direta), sem
 * precisar de nenhuma mudança de estrutura quando isso acontecer.
 */
import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  ShoppingBag,
  Building2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

const money = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const STATUS_META: Record<string, { label: string; className: string; icon: typeof Clock }> = {
  DRAFT: { label: "Rascunho", className: "bg-stone-100 text-stone-600", icon: FileText },
  PENDING_PROVIDER: { label: "Aguardando provedor", className: "bg-amber-100 text-amber-700", icon: Clock },
  PROCESSING: { label: "Processando", className: "bg-blue-100 text-blue-700", icon: Loader2 },
  AUTHORIZED: { label: "Autorizada", className: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
  REJECTED: { label: "Rejeitada", className: "bg-red-100 text-red-600", icon: XCircle },
  ERROR: { label: "Erro", className: "bg-red-100 text-red-600", icon: AlertTriangle },
  CANCELLED: { label: "Cancelada", className: "bg-stone-100 text-stone-500", icon: XCircle },
};

function StatusBadge({ status }: { status?: string | null }) {
  const meta = STATUS_META[status || ""] ?? { label: "Sem nota", className: "bg-stone-100 text-stone-400", icon: FileText };
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${meta.className}`}>
      <Icon className="h-3.5 w-3.5" /> {meta.label}
    </span>
  );
}

function RetailTab() {
  const utils = trpc.useUtils();
  const orders = trpc.fiscal.invoices.eligibleRetailOrders.useQuery({ limit: 50 });
  const [cancelTarget, setCancelTarget] = useState<number | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  const emit = trpc.fiscal.invoices.emit.useMutation({
    onSuccess: (invoice) => {
      utils.fiscal.invoices.eligibleRetailOrders.invalidate();
      if (invoice.status === "PENDING_PROVIDER") toast.warning("Solicitação registrada — nenhum provedor de NF-e configurado ainda.");
      else if (invoice.status === "AUTHORIZED") toast.success("Nota autorizada.");
      else toast.info(`Nota atualizada: ${invoice.status}`);
    },
    onError: (error) => toast.error(error.message),
  });
  const cancel = trpc.fiscal.invoices.cancel.useMutation({
    onSuccess: () => {
      toast.success("Nota cancelada.");
      setCancelTarget(null);
      setCancelReason("");
      utils.fiscal.invoices.eligibleRetailOrders.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  if (orders.isLoading) return <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-stone-400" /></div>;
  if (!orders.data?.length) return <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Nenhum pedido encontrado.</div>;

  return (
    <div className="space-y-2">
      {orders.data.map((row: any) => (
        <div key={row.id} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <strong>#{row.id} — {row.product_name || "Produto"}</strong>
            <div className="text-xs text-muted-foreground">{row.buyer_name} · {money(Math.round(Number(row.total_price || 0) * 100))} · {new Date(row.created_at).toLocaleDateString("pt-BR")}</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={row.invoice_status} />
            {row.invoice_number && <span className="text-xs text-muted-foreground">nº {row.invoice_number}</span>}
            {row.invoice_status !== "AUTHORIZED" && (
              <Button size="sm" disabled={emit.isPending} onClick={() => emit.mutate({ orderType: "RETAIL", orderId: row.id })}>
                {row.invoice_id ? "Tentar novamente" : "Emitir NFC-e"}
              </Button>
            )}
            {row.invoice_status === "AUTHORIZED" && (
              <Button size="sm" variant="outline" onClick={() => setCancelTarget(row.invoice_id)}>Cancelar nota</Button>
            )}
          </div>
          {cancelTarget === row.invoice_id && (
            <div className="mt-2 flex w-full flex-col gap-2 rounded-lg border border-dashed p-3 md:flex-row md:items-center">
              <input className="flex-1 rounded-md border border-stone-300 px-2 py-1 text-sm" placeholder="Motivo do cancelamento" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
              <div className="flex gap-2">
                <Button size="sm" disabled={cancel.isPending || cancelReason.trim().length < 3} onClick={() => cancel.mutate({ invoiceId: row.invoice_id, reason: cancelReason })}>Confirmar</Button>
                <Button size="sm" variant="outline" onClick={() => { setCancelTarget(null); setCancelReason(""); }}>Cancelar</Button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function B2BTab() {
  const utils = trpc.useUtils();
  const orders = trpc.fiscal.invoices.eligibleB2BOrders.useQuery({ limit: 50 });
  const [cancelTarget, setCancelTarget] = useState<number | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  const emit = trpc.fiscal.invoices.emit.useMutation({
    onSuccess: (invoice) => {
      utils.fiscal.invoices.eligibleB2BOrders.invalidate();
      if (invoice.status === "PENDING_PROVIDER") toast.warning("Solicitação registrada — nenhum provedor de NF-e configurado ainda.");
      else if (invoice.status === "AUTHORIZED") toast.success("Nota autorizada.");
      else toast.info(`Nota atualizada: ${invoice.status}`);
    },
    onError: (error) => toast.error(error.message),
  });
  const cancel = trpc.fiscal.invoices.cancel.useMutation({
    onSuccess: () => {
      toast.success("Nota cancelada.");
      setCancelTarget(null);
      setCancelReason("");
      utils.fiscal.invoices.eligibleB2BOrders.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  if (orders.isLoading) return <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-stone-400" /></div>;
  if (!orders.data?.length) return <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Nenhum pedido empresarial encontrado.</div>;

  return (
    <div className="space-y-2">
      {orders.data.map((row: any) => (
        <div key={row.id} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <strong>{row.order_number} — {row.trade_name || row.legal_name}</strong>
            <div className="text-xs text-muted-foreground">{row.cnpj} · {money(Number(row.total_cents || 0))} · {new Date(row.created_at).toLocaleDateString("pt-BR")}</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={row.invoice_status} />
            {row.invoice_number && <span className="text-xs text-muted-foreground">nº {row.invoice_number}</span>}
            {row.invoice_status !== "AUTHORIZED" && (
              <Button size="sm" disabled={emit.isPending} onClick={() => emit.mutate({ orderType: "B2B", orderId: row.id })}>
                {row.invoice_id ? "Tentar novamente" : "Emitir NF-e"}
              </Button>
            )}
            {row.invoice_status === "AUTHORIZED" && (
              <Button size="sm" variant="outline" onClick={() => setCancelTarget(row.invoice_id)}>Cancelar nota</Button>
            )}
          </div>
          {cancelTarget === row.invoice_id && (
            <div className="mt-2 flex w-full flex-col gap-2 rounded-lg border border-dashed p-3 md:flex-row md:items-center">
              <input className="flex-1 rounded-md border border-stone-300 px-2 py-1 text-sm" placeholder="Motivo do cancelamento" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
              <div className="flex gap-2">
                <Button size="sm" disabled={cancel.isPending || cancelReason.trim().length < 3} onClick={() => cancel.mutate({ invoiceId: row.invoice_id, reason: cancelReason })}>Confirmar</Button>
                <Button size="sm" variant="outline" onClick={() => { setCancelTarget(null); setCancelReason(""); }}>Cancelar</Button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function NotasFiscais() {
  const [tab, setTab] = useState<"retail" | "b2b">("retail");
  const settings = trpc.fiscal.settings.get.useQuery();
  const providerConfigured = settings.data && settings.data.provider !== "NONE";

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#215b94]">Fiscal</p>
          <h1 className="mt-1 text-2xl font-semibold">Notas Fiscais</h1>
          <p className="text-sm text-muted-foreground">Emissão de NF-e (pedidos B2B) e NFC-e (pedidos Ideal Prime).</p>
        </div>

        {!providerConfigured && !settings.isLoading && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0" />
            <div>
              <strong>Nenhum provedor de emissão configurado.</strong> Solicitações de emissão ficam registradas como "Aguardando provedor" até um provedor real (Focus NFe, PlugNotas, eNotas, NFe.io ou outro) ser escolhido e configurado em Configurações → Nota Fiscal.
            </div>
          </div>
        )}

        <div className="border-b border-stone-200">
          <nav className="flex gap-1">
            <button onClick={() => setTab("retail")} className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === "retail" ? "border-stone-900 text-stone-900" : "border-transparent text-stone-500 hover:text-stone-700 hover:border-stone-300"}`}>
              <ShoppingBag className="h-4 w-4" /> Pedidos Ideal Prime
            </button>
            <button onClick={() => setTab("b2b")} className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === "b2b" ? "border-stone-900 text-stone-900" : "border-transparent text-stone-500 hover:text-stone-700 hover:border-stone-300"}`}>
              <Building2 className="h-4 w-4" /> Pedidos B2B
            </button>
          </nav>
        </div>

        {tab === "retail" ? <RetailTab /> : <B2BTab />}
      </div>
    </DashboardLayout>
  );
}
